import { useId } from 'react';
import { zmienKotwice, type ZmianaKolejnosci } from '../../dane/szablon';
import { t } from '../../i18n';
import { KOTWICE, type Kotwica, type Pozycja } from '../../model/szablon';
import { Liczba, Przelacznik } from './Kontrolki';

const OBROTY: readonly number[] = [0, 90, 180, 270];
const KOLEJNOSC: readonly { jak: ZmianaKolejnosci; klucz: string }[] = [
  { jak: 'na-wierzch', klucz: 'polozenie.naWierzch' },
  { jak: 'wyzej', klucz: 'polozenie.wyzej' },
  { jak: 'nizej', klucz: 'polozenie.nizej' },
  { jak: 'na-spod', klucz: 'polozenie.naSpod' },
];

/** Rozmiary do zachowania miejsca elementu przy zmianie kotwicy: wnętrze kontenera i prostokąt elementu. */
export interface RozmiaryKotwicy {
  ramka: { szer: number; wys: number };
  element: { szer: number; wys: number };
}

/**
 * Pola położenia elementu w kontenerze swobodnym (wewnątrz sekcji „Położenie i rozmiar”):
 * X i Y w mm, kotwica (9 punktów), obrót (w stopniach oraz cztery skróty) i kolejność rysowania.
 * Wszystko dostępne z klawiatury – przeciąganie w podglądzie jest dodatkiem, nie jedyną drogą.
 */
export function PanelPolozenia({
  kontener,
  pozycja,
  zmien,
  rozmiary,
  kolejnosc,
}: {
  /** Nazwa kontenera swobodnego (do podpisu). */
  kontener: string;
  pozycja: Pozycja | undefined;
  /** Zmiana położenia – funkcja dostaje id węzła (przy kilku zaznaczonych liczona osobno). */
  zmien: (f: (p: Pozycja, id: string) => Pozycja, klucz: string) => void;
  /** Rozmiary elementu o danym id – bez nich zmiana kotwicy tylko przestawia punkt odniesienia. */
  rozmiary: (id: string) => RozmiaryKotwicy | undefined;
  /** Zmiana kolejności rysowania – tylko dla jednego elementu. */
  kolejnosc?: (jak: ZmianaKolejnosci) => void;
}) {
  const p: Pozycja = pozycja ?? { x: 0, y: 0 };
  const kotwica = p.kotwica ?? 'lewy-gorny';
  const idKotwicy = useId();
  const ustawKotwice = (k: Kotwica) =>
    zmien((q, id) => {
      const r = zmienKotwice(q, k, rozmiary(id));
      // Domyślna kotwica nie jest zapisywana.
      if (k !== 'lewy-gorny') return r;
      const { kotwica: _k, ...reszta } = r;
      void _k;
      return reszta;
    }, 'poz-kotwica');
  const ustawObrot = (v: number) =>
    zmien((q) => {
      const { obrot: _o, ...reszta } = q;
      void _o;
      const kat = v % 360;
      return kat ? { ...reszta, obrot: kat } : reszta;
    }, 'poz-obrot');
  return (
    <>
      <p className="podpis">{t('polozenie.wKontenerze', { kontener })}</p>
      <div className="pole-panelu dwa-pola">
        <Liczba
          etykieta={t('polozenie.x')}
          wartosc={p.x}
          min={-1000}
          max={1000}
          zmien={(v) => zmien((q) => ({ ...q, x: v }), 'poz-x')}
        />
        <Liczba
          etykieta={t('polozenie.y')}
          wartosc={p.y}
          min={-1000}
          max={1000}
          zmien={(v) => zmien((q) => ({ ...q, y: v }), 'poz-y')}
        />
      </div>
      <p className="podpis">{t('polozenie.opis')}</p>
      <div className="pole-panelu">
        <span id={idKotwicy}>{t('polozenie.kotwica')}</span>
        <div
          className="siatka-kotwic"
          role="radiogroup"
          aria-labelledby={idKotwicy}
          onKeyDown={(e) => {
            // Wzorzec APG „radio group”: strzałki przenoszą fokus i zaznaczenie (z zawinięciem).
            const krok =
              e.key === 'ArrowRight' || e.key === 'ArrowDown'
                ? 1
                : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                  ? -1
                  : 0;
            if (!krok) return;
            e.preventDefault();
            const n = (KOTWICE.indexOf(kotwica) + krok + KOTWICE.length) % KOTWICE.length;
            ustawKotwice(KOTWICE[n]!);
            e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[n]?.focus();
          }}
        >
          {KOTWICE.map((k: Kotwica) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kotwica === k}
              aria-label={t(`polozenie.kotwica.${k}`)}
              title={t(`polozenie.kotwica.${k}`)}
              // Jeden przystanek Tab: zaznaczony punkt.
              tabIndex={kotwica === k ? 0 : -1}
              onClick={() => ustawKotwice(k)}
            >
              {/* Zaznaczenie nie tylko kolorem: kropka w środku przycisku. */}
              <span aria-hidden="true">{kotwica === k ? '●' : ''}</span>
            </button>
          ))}
        </div>
      </div>
      <Przelacznik
        etykieta={t('polozenie.obrot')}
        opcje={OBROTY.map((o) => ({
          wartosc: String(o),
          tekst: t('polozenie.obrot.wartosc', { kat: o }),
        }))}
        wartosc={String(p.obrot ?? 0)}
        zmien={(v) => ustawObrot(Number(v))}
      />
      <Liczba
        etykieta={t('polozenie.kat')}
        wartosc={p.obrot ?? 0}
        min={0}
        max={360}
        krok={0.1}
        zmien={ustawObrot}
      />
      <p className="podpis">{t('polozenie.obrotOpis')}</p>
      {kolejnosc && (
        <div className="pole-panelu">
          <span>{t('polozenie.kolejnosc')}</span>
          <div className="wiersz-przyciskow">
            {KOLEJNOSC.map((k) => (
              <button key={k.jak} type="button" className="maly" onClick={() => kolejnosc(k.jak)}>
                {t(k.klucz as 'polozenie.naWierzch')}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
