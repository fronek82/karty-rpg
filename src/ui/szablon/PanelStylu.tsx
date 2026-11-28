import { t } from '../../i18n';
import { pt, type Mm } from '../../model/jednostki';
import type { StylTekstu, WariantCzcionki } from '../../model/szablon';
import { Liczba, Lista, PoleKoloru, Przelacznik, Wybor } from './Kontrolki';

/** 1 pt = 0,3528 mm – rozmiary w panelu w punktach (jak w edytorach tekstu). */
const naPt = (mm: Mm) => Math.round((mm / pt(1)) * 10) / 10;
const zPt = (p: number) => pt(p);

const WARIANTY: Record<WariantCzcionki, [boolean, boolean]> = {
  normalny: [false, false],
  pogrubiony: [true, false],
  kursywa: [false, true],
  'pogrubiona-kursywa': [true, true],
};
const wariant = (b: boolean, i: boolean): WariantCzcionki =>
  b && i ? 'pogrubiona-kursywa' : b ? 'pogrubiony' : i ? 'kursywa' : 'normalny';

/**
 * Styl tekstu: czcionka (rola projektu albo rodzina), rozmiar w pt, pogrubienie, kursywa, kolor,
 * wyrównanie, wielkie litery, kapitaliki, odstęp liter, interlinia, wcięcie i odstęp akapitów,
 * auto-dopasowanie (najmniejszy rozmiar) i obwódka liter. Tryb `czesciowy` (np. etykieta) –
 * puste wartości dziedziczą ze stylu pola (`bazowy`).
 */
export function PanelStylu({
  styl,
  bazowy,
  czcionki,
  zmien,
  akapity = true,
  autoDopasowanie = true,
  wyrownanie = true,
  wyrownaniePionowe = true,
  domyslne = {},
}: {
  /** Auto-dopasowanie (najmniejszy rozmiar) – silnik je stosuje. */
  autoDopasowanie?: boolean;
  /** Wyrównanie w poziomie / w pionie (ukryte tam, gdzie silnik go nie używa). */
  wyrownanie?: boolean;
  wyrownaniePionowe?: boolean;
  /** Wyrównania, gdy styl ich nie ustawia (np. wartość w kształcie – środek). */
  domyslne?: {
    wyrownanie?: StylTekstu['wyrownanie'];
    wyrownaniePionowe?: StylTekstu['wyrownaniePionowe'];
  };
  styl: Partial<StylTekstu>;
  /** Styl, z którego dziedziczy styl częściowy (podgląd wartości). */
  bazowy?: StylTekstu;
  czcionki: readonly { wartosc: string; tekst: string }[];
  /**
   * Zmiana jako funkcja stylu – przy kilku zaznaczonych elementach stosowana do stylu każdego
   * z nich (zmienia się tylko ruszona właściwość).
   */
  zmien: (f: (s: Partial<StylTekstu>) => Partial<StylTekstu>) => void;
  /** Ustawienia akapitów i auto-dopasowania (dla tekstów wielowierszowych). */
  akapity?: boolean;
}) {
  const ef = { ...bazowy, ...styl } as StylTekstu;
  const czesciowy = bazowy !== undefined;
  // Styl częściowy (etykieta, nagłówki): „wyłączone” zapisywane jawnie (false / 0), żeby nie
  // dziedziczyć wartości z pola; pełny styl – brak klucza.
  const WYLACZONE: Partial<Record<keyof StylTekstu, unknown>> = {
    wielkieLitery: false,
    kapitaliki: false,
    odstepLiter: 0,
    wciecie: 0,
    odstepAkapitow: 0,
  };
  const ustaw = (z: Partial<StylTekstu>) =>
    zmien((st) => {
      const n = { ...st, ...z } as Record<string, unknown>;
      for (const k of Object.keys(z) as (keyof StylTekstu)[])
        if (z[k] === undefined) {
          if (czesciowy && k in WYLACZONE) n[k] = WYLACZONE[k];
          else delete n[k];
        }
      return n as Partial<StylTekstu>;
    });
  const ustawKroj = (pogr: boolean | undefined, kurs: boolean | undefined) =>
    zmien((st) => {
      const [b0, i0] = WARIANTY[{ ...bazowy, ...st }.wariant ?? 'normalny'];
      return { ...st, wariant: wariant(pogr ?? b0, kurs ?? i0) };
    });
  const [b, i] = WARIANTY[ef.wariant ?? 'normalny'];
  const listaCzcionek = czcionki.some((c) => c.wartosc === ef.czcionka)
    ? czcionki
    : [...czcionki, { wartosc: ef.czcionka, tekst: ef.czcionka }];
  return (
    <>
      {czesciowy && (
        <p>
          <button
            type="button"
            className="maly"
            disabled={Object.keys(styl).length === 0}
            onClick={() => zmien(() => ({}))}
          >
            {t('styl.jakPole')}
          </button>
        </p>
      )}
      <Lista
        etykieta={t('styl.czcionka')}
        opcje={listaCzcionek}
        wartosc={ef.czcionka}
        zmien={(v) => ustaw({ czcionka: v })}
      />
      <div className="dwa-pola">
        <Liczba
          etykieta={t('styl.rozmiar')}
          wartosc={naPt(ef.rozmiar ?? pt(9))}
          min={2}
          max={200}
          krok={0.5}
          zmien={(v) => ustaw({ rozmiar: zPt(v) })}
        />
        <PoleKoloru
          etykieta={t('styl.kolor')}
          wartosc={ef.kolor ?? '#000000'}
          moznaBrak={false}
          zmien={(v) => ustaw({ kolor: v })}
        />
      </div>
      <div className="przelacznik-segmentowy wiersz-stylu" role="group" aria-label={t('styl.kroj')}>
        <button type="button" aria-pressed={b} onClick={() => ustawKroj(!b, undefined)}>
          <b>{t('styl.pogrubienie')}</b>
        </button>
        <button type="button" aria-pressed={i} onClick={() => ustawKroj(undefined, !i)}>
          <i>{t('styl.kursywa')}</i>
        </button>
        <button
          type="button"
          aria-pressed={!!ef.wielkieLitery}
          onClick={() => ustaw({ wielkieLitery: !ef.wielkieLitery || undefined })}
        >
          {t('styl.wielkie')}
        </button>
        <button
          type="button"
          aria-pressed={!!ef.kapitaliki}
          onClick={() => ustaw({ kapitaliki: !ef.kapitaliki || undefined })}
        >
          {t('styl.kapitaliki')}
        </button>
      </div>
      {wyrownanie && (
        <Przelacznik
          etykieta={t('styl.wyrownanie')}
          wJednymWierszu
          opcje={(['lewo', 'srodek', 'prawo', 'justuj'] as const).map((w) => ({
            wartosc: w,
            tekst: t(`styl.wyrownanie.krotkie.${w}`),
          }))}
          wartosc={ef.wyrownanie ?? domyslne.wyrownanie ?? 'lewo'}
          zmien={(v) => ustaw({ wyrownanie: v })}
        />
      )}
      {wyrownaniePionowe && (
        <Przelacznik
          etykieta={t('styl.wyrownaniePionowe')}
          opcje={(['poczatek', 'srodek', 'koniec'] as const).map((w) => ({
            wartosc: w,
            tekst: t(`styl.pionowo.${w}`),
          }))}
          wartosc={ef.wyrownaniePionowe ?? domyslne.wyrownaniePionowe ?? 'poczatek'}
          zmien={(v) => ustaw({ wyrownaniePionowe: v })}
        />
      )}
      <div className="dwa-pola">
        <Liczba
          etykieta={t('styl.odstepLiter')}
          wartosc={ef.odstepLiter ?? 0}
          min={-2}
          max={10}
          krok={0.1}
          zmien={(v) => ustaw({ odstepLiter: v || undefined })}
        />
        <Liczba
          etykieta={t('styl.interlinia')}
          wartosc={ef.interlinia ?? 1.2}
          min={0.5}
          max={4}
          krok={0.05}
          zmien={(v) => ustaw({ interlinia: v })}
        />
      </div>
      {akapity && (
        <>
          <div className="dwa-pola">
            <Liczba
              etykieta={t('styl.wciecie')}
              wartosc={ef.wciecie ?? 0}
              max={50}
              zmien={(v) => ustaw({ wciecie: v || undefined })}
            />
            <Liczba
              etykieta={t('styl.odstepAkapitow')}
              wartosc={ef.odstepAkapitow ?? 0}
              max={50}
              zmien={(v) => ustaw({ odstepAkapitow: v || undefined })}
            />
          </div>
        </>
      )}
      {autoDopasowanie && (
        <>
          <Wybor
            etykieta={t('styl.autoDopasowanie')}
            wartosc={ef.minRozmiar !== undefined}
            zmien={(v) =>
              ustaw({ minRozmiar: v ? Math.min(ef.rozmiar ?? pt(9), pt(6)) : undefined })
            }
          />
          {ef.minRozmiar !== undefined && (
            <Liczba
              etykieta={t('styl.minRozmiar')}
              wartosc={naPt(ef.minRozmiar)}
              min={1}
              max={200}
              zmien={(v) => ustaw({ minRozmiar: zPt(v) })}
            />
          )}
        </>
      )}
      <Wybor
        etykieta={t('styl.obwodka')}
        wartosc={!!ef.obwodka}
        zmien={(v) => ustaw({ obwodka: v ? { grubosc: 0.3, kolor: '#ffffff' } : undefined })}
      />
      {ef.obwodka && (
        <div className="dwa-pola">
          <Liczba
            etykieta={t('styl.grubosc')}
            wartosc={ef.obwodka.grubosc}
            krok={0.05}
            max={5}
            zmien={(v) => ustaw({ obwodka: { ...ef.obwodka!, grubosc: v } })}
          />
          <PoleKoloru
            etykieta={t('styl.kolorObwodki')}
            wartosc={ef.obwodka.kolor}
            moznaBrak={false}
            zmien={(v) => ustaw({ obwodka: { ...ef.obwodka!, kolor: v! } })}
          />
        </div>
      )}
    </>
  );
}
