import { useId } from 'react';
import { zmienKotwice, type ZmianaKolejnosci } from '../../dane/szablon';
import { t } from '../../i18n';
import { KOTWICE, type Kotwica, type ObrotSwobodny, type Pozycja } from '../../model/szablon';
import { Liczba, Przelacznik } from './Kontrolki';

const OBROTY: readonly ObrotSwobodny[] = [0, 90, 180, 270];
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
 * Sekcja „Położenie” elementu w kontenerze swobodnym: X i Y w mm, kotwica (9 punktów), obrót
 * (0 / 90 / 180 / 270°) i kolejność rysowania. Wszystko dostępne z klawiatury – przeciąganie
 * w podglądzie jest dodatkiem, nie jedyną drogą.
 */
export function PanelPolozenia({
  kontener,
  pozycja,
  zmien,
  rozmiary,
  kolejnosc,
}: {
  /** Nazwa kontenera swobodnego (do nagłówka). */
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
  return (
    <fieldset className="polozenie" aria-label={t('polozenie.tytul')}>
      <legend>
        <strong>{t('polozenie.tytul')}</strong>{' '}
        <span className="podpis">{t('polozenie.wKontenerze', { kontener })}</span>
      </legend>
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
        <div className="siatka-kotwic" role="radiogroup" aria-labelledby={idKotwicy}>
          {KOTWICE.map((k: Kotwica) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kotwica === k}
              aria-label={t(`polozenie.kotwica.${k}`)}
              title={t(`polozenie.kotwica.${k}`)}
              onClick={() =>
                zmien((q, id) => {
                  const r = zmienKotwice(q, k, rozmiary(id));
                  // Domyślna kotwica nie jest zapisywana.
                  if (k !== 'lewy-gorny') return r;
                  const { kotwica: _k, ...reszta } = r;
                  void _k;
                  return reszta;
                }, 'poz-kotwica')
              }
            />
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
        zmien={(v) =>
          zmien((q) => {
            const { obrot: _o, ...reszta } = q;
            void _o;
            return v === '0' ? reszta : { ...reszta, obrot: Number(v) as ObrotSwobodny };
          }, 'poz-obrot')
        }
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
    </fieldset>
  );
}
