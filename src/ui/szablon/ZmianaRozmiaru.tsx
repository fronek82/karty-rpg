import { useEffect, useRef, useState } from 'react';
import {
  DOPASOWANIA_ZAWARTOSCI,
  opisRozmiaru,
  type DopasowanieZawartosci,
  type Powiazanie,
} from '../../dane/zgodnosc';
import { formatujLiczbe, t, tn } from '../../i18n';
import { KLUCZ_DOPASOWANIA_ZAWARTOSCI } from '../../wspolne/ustawienia';
import { OknoModalne } from '../OknoModalne';
import type { StronaKarty, WymiaryKarty } from './PanelKarty';

function odczytajDopasowanie(): DopasowanieZawartosci {
  try {
    const v = localStorage.getItem(KLUCZ_DOPASOWANIA_ZAWARTOSCI);
    return v === 'zostaw' ? 'zostaw' : 'skaluj';
  } catch {
    return 'skaluj';
  }
}

/** Zapamiętany (w przeglądarce) sposób dopasowania zawartości przy zmianie rozmiaru karty. */
export function useDopasowanieZawartosci(): [
  DopasowanieZawartosci,
  (d: DopasowanieZawartosci) => void,
] {
  const [d, ustaw] = useState(odczytajDopasowanie);
  return [
    d,
    (nowe) => {
      ustaw(nowe);
      try {
        localStorage.setItem(KLUCZ_DOPASOWANIA_ZAWARTOSCI, nowe);
      } catch {
        // Zablokowane localStorage – wybór działa do końca sesji strony.
      }
    },
  ];
}

/** Przełącznik „Przeskaluj zawartość / Zostaw elementy” (panel karty i okno zmiany rozmiaru). */
export function WyborDopasowania({
  wartosc,
  zmien,
  nazwa,
}: {
  wartosc: DopasowanieZawartosci;
  zmien: (d: DopasowanieZawartosci) => void;
  nazwa: string;
}) {
  return (
    <fieldset className="wybor-dopasowania">
      <legend>{t('dopasowanieZawartosci.tytul')}</legend>
      {DOPASOWANIA_ZAWARTOSCI.map((d) => (
        <label key={d} className="pole-wyboru">
          <input
            type="radio"
            name={nazwa}
            value={d}
            checked={wartosc === d}
            onChange={() => zmien(d)}
          />{' '}
          {t(`dopasowanieZawartosci.${d}`)}
        </label>
      ))}
    </fieldset>
  );
}

export type DecyzjaZmianyRozmiaru = 'kopia' | 'mimo';

/** Lista powiązanych szablonów z rozmiarem: wspólny rozmiar raz albo przy każdej pozycji. */
function opisPowiazan(strona: StronaKarty, lista: readonly Powiazanie[]): string {
  const rozmiary = new Set(lista.map((p) => opisRozmiaru(p.wymiary)));
  const wspolny = rozmiary.size === 1 ? [...rozmiary][0]! : undefined;
  const nazwy = lista
    .map((p) =>
      wspolny
        ? p.nazwa
        : t('zmianaRozmiaru.pozycja', { nazwa: p.nazwa, rozmiar: opisRozmiaru(p.wymiary) }),
    )
    .join(', ');
  return t(strona === 'tyl' ? 'zmianaRozmiaru.tylUzywany' : 'zmianaRozmiaru.przodMaTyl', {
    liczba: tn(strona === 'tyl' ? 'zgodnosc.przody' : 'zgodnosc.tyly', lista.length),
    rozmiar: wspolny ? ` (${wspolny} mm)` : '',
    lista: nazwy,
  });
}

/**
 * Okno przy zmianie rozmiaru, orientacji albo rogów szablonu powiązanego z innymi: kopia w nowym
 * rozmiarze (domyślnie), zmiana mimo to albo anulowanie; do tego sposób dopasowania zawartości.
 */
export function OknoZmianyRozmiaru({
  strona,
  powiazane,
  stare,
  nowe,
  dopasowanie,
  zmienDopasowanie,
  zdecyduj,
}: {
  strona: StronaKarty;
  powiazane: readonly Powiazanie[];
  stare: WymiaryKarty;
  nowe: WymiaryKarty;
  dopasowanie: DopasowanieZawartosci;
  zmienDopasowanie: (d: DopasowanieZawartosci) => void;
  /** `undefined` – anulowanie (rozmiar bez zmian). */
  zdecyduj: (d: DecyzjaZmianyRozmiaru | undefined) => void;
}) {
  const kopia = useRef<HTMLButtonElement>(null);
  // Przycisk domyślny dostaje fokus po otwarciu (OknoModalne ustawia go najpierw na „Zamknij”).
  useEffect(() => {
    const z = requestAnimationFrame(() => kopia.current?.focus());
    return () => cancelAnimationFrame(z);
  }, []);
  const tylkoRogi = stare.szer === nowe.szer && stare.wys === nowe.wys;
  return (
    <OknoModalne tytul={t('zmianaRozmiaru.tytul')} zamknij={() => zdecyduj(undefined)}>
      <div className="okno-zmiany-rozmiaru">
        <p>{opisPowiazan(strona, powiazane)}</p>
        <p>
          {tylkoRogi
            ? t('zmianaRozmiaru.skutekRogi', { promien: formatujLiczbe(nowe.promien, 1) })
            : t('zmianaRozmiaru.skutek', { rozmiar: opisRozmiaru(nowe) })}
        </p>
        {!tylkoRogi && (
          <WyborDopasowania
            wartosc={dopasowanie}
            zmien={zmienDopasowanie}
            nazwa="dopasowanie-okno"
          />
        )}
        <div className="wiersz-przyciskow">
          <button
            ref={kopia}
            type="button"
            className="glowny"
            aria-describedby="zmiana-rozmiaru-kopia-opis"
            onClick={() => zdecyduj('kopia')}
          >
            {t('zmianaRozmiaru.kopia')}
          </button>
          <button type="button" onClick={() => zdecyduj('mimo')}>
            {t('zmianaRozmiaru.mimo')}
          </button>
          <button type="button" onClick={() => zdecyduj(undefined)}>
            {t('zmianaRozmiaru.anuluj')}
          </button>
        </div>
        <p id="zmiana-rozmiaru-kopia-opis" className="podpis">
          {t('zmianaRozmiaru.kopiaOpis')}
        </p>
      </div>
    </OknoModalne>
  );
}
