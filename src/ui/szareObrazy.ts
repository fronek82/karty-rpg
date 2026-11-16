import { useEffect, useMemo, useRef, useState } from 'react';
import { zasobySzablonu } from '../dane/schemat';
import { SUFIKS_SZARY } from '../druk/arkusz';
import type { Arkusz } from '../model/arkusz';
import type { Talia } from '../model/szablon';
import { obrazNaSzarosc } from './szarosc';
import type { ObrazWPamieci, ZasobyPakietu } from './zasoby';

type ZrodloArkuszy = { arkusze: Arkusz[]; talie: Talia[] };

/** Obrazy użyte na arkuszach czarno-białych: wartości danych kart i stałe obrazy szablonów. */
function obrazyCzarnoBialych(zrodlo: ZrodloArkuszy, z: ZasobyPakietu): Set<string> {
  const ids = new Set<string>();
  for (const a of zrodlo.arkusze) {
    if (!a.ustawienia.czarnoBialy) continue;
    for (const k of zrodlo.talie.find((x) => x.id === a.taliaId)?.karty ?? []) {
      for (const v of Object.values(k.dane)) if (z.obrazy.has(v)) ids.add(v);
      const s = z.szablony.get(k.szablonId);
      if (s) for (const id of zasobySzablonu(s)) ids.add(id);
    }
  }
  return ids;
}

/**
 * Zasoby uzupełnione o szare wersje obrazów (`id#szary`) użytych na arkuszach czarno-białych.
 * Konwersje pamiętane (po obiekcie obrazu) – edycja kart nie powtarza ich; do pierwszej
 * konwersji – undefined (podgląd czeka). Adresy blob: szarych obrazów zwalniane przy odmontowaniu.
 */
export function useZSzarymiObrazami(
  z: ZasobyPakietu | undefined,
  zrodlo: ZrodloArkuszy,
): ZasobyPakietu | undefined {
  const pamiec = useRef(new Map<ObrazWPamieci, Promise<ObrazWPamieci>>());
  useEffect(() => {
    const m = pamiec.current;
    return () => {
      for (const p of m.values()) void p.then((o) => URL.revokeObjectURL(o.adres));
      m.clear();
    };
  }, []);
  const potrzebne = useMemo(
    () => (z ? [...obrazyCzarnoBialych(zrodlo, z)].sort().join('\n') : ''),
    [z, zrodlo],
  );
  const [szare, ustawSzare] = useState<{
    klucz: string;
    zrodlo: ZasobyPakietu;
    mapa: Map<string, ObrazWPamieci>;
  }>();
  useEffect(() => {
    if (!z || !potrzebne) return;
    let aktywny = true;
    void Promise.all(
      potrzebne.split('\n').flatMap((id) => {
        const o = z.obrazy.get(id);
        if (!o) return [];
        let p = pamiec.current.get(o);
        if (!p) {
          // Obraz, którego nie da się przetworzyć, zostaje kolorowy – lepsze niż brak obrazu.
          p = obrazNaSzarosc(o).catch(() => ({ ...o }));
          pamiec.current.set(o, p);
        }
        return [p.then((s) => [id + SUFIKS_SZARY, s] as const)];
      }),
    ).then((pary) => {
      if (aktywny) ustawSzare({ klucz: potrzebne, zrodlo: z, mapa: new Map(pary) });
    });
    return () => {
      aktywny = false;
    };
  }, [z, potrzebne]);
  return useMemo(() => {
    if (!z || !potrzebne) return z;
    if (szare?.zrodlo !== z || szare.klucz !== potrzebne) {
      // Do czasu nowej konwersji – poprzednie szare obrazy (bez znikania podglądu).
      return szare ? { ...z, obrazy: new Map([...z.obrazy, ...szare.mapa]) } : undefined;
    }
    return { ...z, obrazy: new Map([...z.obrazy, ...szare.mapa]) };
  }, [z, potrzebne, szare]);
}
