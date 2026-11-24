import { useEffect, useRef, useState } from 'react';
import {
  niezgodnosc,
  niezgodnosciTalii,
  opisRozmiaru,
  wymiaryPrzodu,
  wymiaryTylu,
  type Niezgodnosc,
} from '../dane/zgodnosc';
import { formatujLiczbe, t } from '../i18n';
import type { Projekt } from '../model/projekt';
import type { Rewers, Szablon } from '../model/szablon';
import { OknoModalne } from './OknoModalne';

/**
 * Przody, do których trafi tył przypisany talii (karty bez własnego przypisania; pusta talia –
 * wszystkie szablony projektu) albo wybranym kartom.
 */
export function przodyDoPrzypisania(
  p: Projekt,
  taliaId: string,
  kartaIds?: readonly string[],
): Szablon[] {
  const talia = p.talie.find((x) => x.id === taliaId);
  const szablony = new Map(p.szablony.map((s) => [s.id, s] as const));
  if (!talia) return [];
  const karty = kartaIds
    ? talia.karty.filter((k) => kartaIds.includes(k.id))
    : talia.karty.filter((k) => k.rewersId === undefined);
  // Pusta talia – przody, które dostaną karty; wszystkie karty z własnym tyłem – nic się nie zmienia.
  if (!kartaIds && talia.karty.length === 0)
    return p.szablony.filter((s) => s.rewersId === undefined);
  if (karty.length === 0) return [];
  const wynik = new Map<string, Szablon>();
  for (const k of karty) {
    const s = szablony.get(k.szablonId);
    if (s && (kartaIds || s.rewersId === undefined)) wynik.set(s.id, s);
  }
  return [...wynik.values()];
}

/** Opis jednej niezgodności: rozmiar (z orientacją) albo rogi. */
export function opisNiezgodnosci(s: Szablon, r: Rewers, n: Niezgodnosc): string {
  const przod = wymiaryPrzodu(s);
  const tyl = wymiaryTylu(r);
  return n.rozmiar || n.orientacja
    ? t('zgodnosc.para', {
        nazwa: s.nazwa,
        przod: opisRozmiaru(przod),
        tyl: opisRozmiaru(tyl),
      })
    : t('zgodnosc.paraRogi', {
        nazwa: s.nazwa,
        przod: formatujLiczbe(przod.promien ?? 0, 1),
        tyl: formatujLiczbe(tyl.promien ?? 0, 1),
      });
}

/** Pary przód–tył, które do siebie nie pasują. */
export function niezgodnePary(przody: readonly Szablon[], r: Rewers): string[] {
  return przody.flatMap((s) => {
    const n = niezgodnosc(wymiaryPrzodu(s), wymiaryTylu(r));
    return n ? [opisNiezgodnosci(s, r, n)] : [];
  });
}

/**
 * Kontrola zgodności przy przypisywaniu tyłu do przodów: `potwierdz` od razu daje `true`, gdy
 * rozmiary pasują; w przeciwnym razie pokazuje okno z różnicami i czeka na decyzję.
 */
export function useZgodnoscTylu() {
  const [pytanie, ustawPytanie] = useState<{
    opis: string;
    pary: string[];
    tak: string;
    rozwiaz: (tak: boolean) => void;
  }>();
  // Fokus na „Anuluj” – bezpieczny wybór domyślny.
  const przyciskAnuluj = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pytanie) return;
    const z = requestAnimationFrame(() => przyciskAnuluj.current?.focus());
    return () => cancelAnimationFrame(z);
  }, [pytanie]);
  /** Okno z listą niezgodności; `true` – użytkownik wybrał działanie mimo różnic. */
  const pytaj = (opis: string, pary: string[], tak: string): Promise<boolean> =>
    pary.length === 0
      ? Promise.resolve(true)
      : new Promise((rozwiaz) => ustawPytanie({ opis, pary, tak, rozwiaz }));
  const potwierdz = (przody: readonly Szablon[], r: Rewers): Promise<boolean> =>
    pytaj(
      t('zgodnosc.opisPrzypisania', { tyl: r.nazwa }),
      niezgodnePary(przody, r),
      t('zgodnosc.przypiszMimo'),
    );
  const zakoncz = (tak: boolean) => {
    pytanie?.rozwiaz(tak);
    ustawPytanie(undefined);
  };
  const okno = pytanie && (
    <OknoModalne tytul={t('zgodnosc.tytul')} zamknij={() => zakoncz(false)}>
      <p>{pytanie.opis}</p>
      <ul>
        {pytanie.pary.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="podpis">{t('zgodnosc.skutek')}</p>
      <div className="wiersz-przyciskow">
        <button type="button" onClick={() => zakoncz(true)}>
          {pytanie.tak}
        </button>
        <button
          ref={przyciskAnuluj}
          type="button"
          className="glowny"
          onClick={() => zakoncz(false)}
        >
          {t('zgodnosc.anuluj')}
        </button>
      </div>
    </OknoModalne>
  );
  return { okno, potwierdz, pytaj };
}

/** Opisy niezgodnych par przód–tył talii (druk dwustronny). */
export function niezgodnosciDruku(p: Projekt, taliaId: string): string[] {
  return niezgodnosciTalii(p, taliaId).map((x) => opisNiezgodnosci(x.przod, x.tyl, x.roznica));
}
