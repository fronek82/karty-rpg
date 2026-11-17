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
  domyslne = {},
}: {
  /** Wyrównania, gdy styl ich nie ustawia (np. wartość w kształcie – środek). */
  domyslne?: {
    wyrownanie?: StylTekstu['wyrownanie'];
    wyrownaniePionowe?: StylTekstu['wyrownaniePionowe'];
  };
  styl: Partial<StylTekstu>;
  /** Styl, z którego dziedziczy styl częściowy (podgląd wartości). */
  bazowy?: StylTekstu;
  czcionki: readonly { wartosc: string; tekst: string }[];
  zmien: (s: Partial<StylTekstu>) => void;
  /** Ustawienia akapitów i auto-dopasowania (dla tekstów wielowierszowych). */
  akapity?: boolean;
}) {
  const ef = { ...bazowy, ...styl } as StylTekstu;
  const ustaw = (z: Partial<StylTekstu>) => {
    const n = { ...styl, ...z };
    for (const k of Object.keys(z) as (keyof StylTekstu)[]) if (z[k] === undefined) delete n[k];
    zmien(n);
  };
  const [b, i] = WARIANTY[ef.wariant ?? 'normalny'];
  const listaCzcionek = czcionki.some((c) => c.wartosc === ef.czcionka)
    ? czcionki
    : [...czcionki, { wartosc: ef.czcionka, tekst: ef.czcionka }];
  return (
    <>
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
        <button type="button" aria-pressed={b} onClick={() => ustaw({ wariant: wariant(!b, i) })}>
          <b>{t('styl.pogrubienie')}</b>
        </button>
        <button type="button" aria-pressed={i} onClick={() => ustaw({ wariant: wariant(b, !i) })}>
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
      <Przelacznik
        etykieta={t('styl.wyrownanie')}
        opcje={(['lewo', 'srodek', 'prawo', 'justuj'] as const).map((w) => ({
          wartosc: w,
          tekst: t(`styl.wyrownanie.${w}`),
        }))}
        wartosc={ef.wyrownanie ?? domyslne.wyrownanie ?? 'lewo'}
        zmien={(v) => ustaw({ wyrownanie: v })}
      />
      <Przelacznik
        etykieta={t('styl.wyrownaniePionowe')}
        opcje={(['poczatek', 'srodek', 'koniec'] as const).map((w) => ({
          wartosc: w,
          tekst: t(`styl.pionowo.${w}`),
        }))}
        wartosc={ef.wyrownaniePionowe ?? domyslne.wyrownaniePionowe ?? 'poczatek'}
        zmien={(v) => ustaw({ wyrownaniePionowe: v })}
      />
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
