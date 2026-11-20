import { useEffect, useMemo, useRef, useState } from 'react';
import { zasobyObrazowSzablonu } from '../dane/biblioteka';
import { rewersJakoSzablon, rewersKarty } from '../dane/rewers';
import { SUFIKS_SZARY } from '../druk/arkusz';
import type { Arkusz } from '../model/arkusz';
import type { Rewers, Talia } from '../model/szablon';
import { obrazNaSzarosc } from './szarosc';
import type { ObrazWPamieci, ZasobyPakietu } from './zasoby';

type ZrodloArkuszy = { arkusze: Arkusz[]; talie: Talia[]; rewersy?: Rewers[] };

/** Obrazy użyte na arkuszach czarno-białych: dane kart, szablony oraz przypisane rewersy. */
export function obrazyCzarnoBialych(zrodlo: ZrodloArkuszy, z: ZasobyPakietu): Set<string> {
  const ids = new Set<string>();
  const rewersyMapa = new Map((zrodlo.rewersy ?? []).map((r) => [r.id, r] as const));
  const przetworzoneRewersy = new Set<string>();
  for (const a of zrodlo.arkusze) {
    if (!a.ustawienia.czarnoBialy) continue;
    const talia = zrodlo.talie.find((x) => x.id === a.taliaId);
    const dwustronny = !!a.ustawienia.dwustronny?.wlaczony && rewersyMapa.size > 0;
    for (const k of talia?.karty ?? []) {
      for (const v of Object.values(k.dane)) if (z.obrazy.has(v)) ids.add(v);
      const s = z.szablony.get(k.szablonId);
      if (s) {
        for (const id of zasobyObrazowSzablonu(s, z.elementy ?? [])) ids.add(id);
        if (dwustronny && talia) {
          const rev = rewersKarty(rewersyMapa, k, s, talia);
          if (rev && !przetworzoneRewersy.has(rev.id)) {
            przetworzoneRewersy.add(rev.id);
            for (const id of zasobyObrazowSzablonu(rewersJakoSzablon(rev), z.elementy ?? []))
              ids.add(id);
          }
        }
      }
    }
  }
  return ids;
}

/**
 * Zasoby uzupełnione o szare wersje obrazów (`id#szary`) użytych na arkuszach czarno-białych.
 * Konwersje pamiętane (po obiekcie obrazu) – edycja kart nie powtarza ich; do pierwszej
 * konwersji – obrazy kolorowe pod szarymi id (podgląd nie znika). Adresy blob: szarych obrazów zwalniane przy odmontowaniu.
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
      // Pierwsza konwersja: kolorowe obrazy pod szarymi id – edytor nie znika na czas konwersji.
      const zastepcze = szare
        ? szare.mapa
        : new Map([...z.obrazy].map(([id, o]) => [id + SUFIKS_SZARY, o] as const));
      return { ...z, obrazy: new Map([...z.obrazy, ...zastepcze]) };
    }
    return { ...z, obrazy: new Map([...z.obrazy, ...szare.mapa]) };
  }, [z, potrzebne, szare]);
}
