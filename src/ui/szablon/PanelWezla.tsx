import { t } from '../../i18n';
import {
  czyKontener,
  type Kontener,
  type PoleTekst,
  type PoleWartosc,
  type Szablon,
  type Wezel,
} from '../../model/szablon';
import { PoleLiczby } from '../kartka/PoleLiczby';
import { nazwaWezla } from './DrzewoSzablonu';
import { PoleRozmiaru } from './PoleRozmiaru';

/**
 * Właściwości zaznaczonego elementu: typ, nazwa, etykieta, szerokość, wysokość i wartość
 * przykładowa (podgląd); dla kontenera – odstępy. Pełne ustawienia stylu – M2-4.
 */
export function PanelWezla({
  szablon,
  wezel,
  wymiary,
  zmienWezel,
  zmienPrzyklad,
}: {
  szablon: Szablon;
  wezel: Wezel;
  /** Obecny rozmiar elementu w podglądzie (mm) – start przy przełączeniu na mm. */
  wymiary: { szer: number; wys: number } | undefined;
  zmienWezel: (f: (w: Wezel) => Wezel, klucz?: string) => void;
  zmienPrzyklad: (klucz: string, wartosc: string) => void;
}) {
  const id = wezel.id;
  const korzen = wezel.id === szablon.korzen.id;
  const pole = czyKontener(wezel) ? undefined : wezel;
  const zEtykieta =
    pole && (pole.typ === 'tekst' || pole.typ === 'wartosc')
      ? (pole as PoleTekst | PoleWartosc)
      : undefined;
  const etykieta = zEtykieta?.etykieta;
  const tekstEtykiety = etykieta && typeof etykieta.tekst === 'string' ? etykieta.tekst : '';

  return (
    <>
      <p className="podpis">{t(`wezel.${wezel.typ}`)}</p>
      <div className="pole-panelu">
        <label htmlFor={`nazwa-${id}`}>{t('szablon.nazwaElementu')}</label>
        <input
          id={`nazwa-${id}`}
          value={wezel.nazwa ?? ''}
          placeholder={nazwaWezla({ ...wezel, nazwa: '' })}
          onChange={(e) => {
            const nazwa = e.target.value;
            zmienWezel((w) => {
              const x = { ...w, nazwa } as Wezel;
              // Etykieta równa dotychczasowej nazwie idzie za nią (np. „Pole 1” → „Siła”).
              if (
                (x.typ === 'tekst' || x.typ === 'wartosc') &&
                x.etykieta &&
                x.etykieta.tekst === (w.nazwa ?? '')
              )
                x.etykieta = { ...x.etykieta, tekst: nazwa };
              return x;
            }, `nazwa:${id}`);
          }}
        />
        {pole?.klucz && <p className="podpis">{t('szablon.kluczDanych', { klucz: pole.klucz })}</p>}
      </div>

      {zEtykieta && (
        <fieldset className="sekcja-panelu">
          <legend>{t('szablon.etykieta')}</legend>
          <label className="wiersz-pola">
            <input
              type="checkbox"
              checked={!!etykieta}
              onChange={(e) =>
                zmienWezel((w) => {
                  const x = { ...w } as PoleTekst | PoleWartosc;
                  if (e.target.checked)
                    x.etykieta = {
                      tekst: w.nazwa || t(`wezel.${w.typ}`),
                      pozycja: 'nad',
                    };
                  else delete x.etykieta;
                  return x;
                })
              }
            />
            {t('szablon.pokazEtykiete')}
          </label>
          {etykieta && (
            <>
              <div className="pole-panelu">
                <label htmlFor={`etykieta-${id}`}>{t('szablon.tekstEtykiety')}</label>
                <input
                  id={`etykieta-${id}`}
                  value={tekstEtykiety}
                  onChange={(e) =>
                    zmienWezel(
                      (w) =>
                        ({
                          ...w,
                          etykieta: { ...(w as PoleTekst).etykieta!, tekst: e.target.value },
                        }) as Wezel,
                      `etykieta:${id}`,
                    )
                  }
                />
              </div>
              <div className="pole-panelu">
                <span id={`pozycja-${id}`}>{t('szablon.pozycjaEtykiety')}</span>
                <div
                  className="przelacznik-segmentowy"
                  role="group"
                  aria-labelledby={`pozycja-${id}`}
                >
                  {(zEtykieta.typ === 'tekst'
                    ? (['nad', 'przed', 'pod'] as const)
                    : (['nad', 'pod'] as const)
                  ).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={etykieta.pozycja === p}
                      onClick={() =>
                        zmienWezel(
                          (w) =>
                            ({
                              ...w,
                              etykieta: { ...(w as PoleTekst).etykieta!, pozycja: p },
                            }) as Wezel,
                        )
                      }
                    >
                      {t(`szablon.pozycja.${p}`)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </fieldset>
      )}

      {!korzen && (
        <>
          <PoleRozmiaru
            id={`szer-${id}`}
            etykieta={t('szablon.szerokosc')}
            wartosc={wezel.szerokosc}
            domyslneMm={wymiary?.szer ?? 10}
            zmien={(r) =>
              zmienWezel((w) => {
                const x = { ...w };
                if (r) x.szerokosc = r;
                else delete x.szerokosc;
                return x;
              }, `szer:${id}`)
            }
          />
          <PoleRozmiaru
            id={`wys-${id}`}
            etykieta={t('szablon.wysokosc')}
            wartosc={wezel.wysokosc}
            domyslneMm={wymiary?.wys ?? 10}
            zmien={(r) =>
              zmienWezel((w) => {
                const x = { ...w };
                if (r) x.wysokosc = r;
                else delete x.wysokosc;
                return x;
              }, `wys:${id}`)
            }
          />
        </>
      )}

      {czyKontener(wezel) && (
        <div className="pole-panelu dwa-pola">
          <PoleLiczby
            id={`odstep-${id}`}
            etykieta={t('szablon.odstepDzieci')}
            wartosc={(wezel as Kontener).odstep ?? 0}
            min={0}
            max={50}
            krok={0.5}
            zmien={(v) => zmienWezel((w) => ({ ...w, odstep: v }) as Wezel, `odstep:${id}`)}
          />
          <PoleLiczby
            id={`padding-${id}`}
            etykieta={t('szablon.padding')}
            wartosc={typeof wezel.padding === 'number' ? wezel.padding : 0}
            min={0}
            max={50}
            krok={0.5}
            zmien={(v) => zmienWezel((w) => ({ ...w, padding: v }), `padding:${id}`)}
          />
        </div>
      )}

      {pole?.klucz && pole.typ !== 'obraz' && (
        <div className="pole-panelu">
          <label htmlFor={`przyklad-${id}`}>{t('szablon.przyklad')}</label>
          <textarea
            id={`przyklad-${id}`}
            rows={pole.typ === 'tekst' ? 3 : 1}
            value={szablon.przyklad?.[pole.klucz] ?? ''}
            onChange={(e) => zmienPrzyklad(pole.klucz!, e.target.value)}
          />
          <p className="podpis">{t('szablon.przykladOpis')}</p>
        </div>
      )}
      {pole?.typ === 'tabela' &&
        pole.kolumny.map((k) => (
          <div key={k.klucz} className="pole-panelu">
            <label htmlFor={`przyklad-${id}-${k.klucz}`}>
              {t('szablon.przykladKomorki', { naglowek: k.naglowek || k.klucz })}
            </label>
            <input
              id={`przyklad-${id}-${k.klucz}`}
              value={szablon.przyklad?.[k.klucz] ?? ''}
              onChange={(e) => zmienPrzyklad(k.klucz, e.target.value)}
            />
          </div>
        ))}
    </>
  );
}
