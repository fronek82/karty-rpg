import type { ReactNode } from 'react';
import { kluczZNazwy, kluczeSzablonu, TYPY_POL, type ZmianaKolejnosci } from '../../dane/szablon';
import { t } from '../../i18n';
import {
  czyKontener,
  DOMYSLNE_TLO_KARTY,
  DOMYSLNY_KOLOR_TEKSTU,
  maStylTekstu,
  stylPola,
  kluczeTabeli,
  type Kontener,
  type Pole,
  type Pozycja,
  type PoleTekst,
  type PoleWartosc,
  type StylTekstu,
  type Szablon,
  type Wezel,
} from '../../model/szablon';
import { nazwaWezla } from './DrzewoSzablonu';
import { Liczba, Lista, Przelacznik, Sekcja } from './Kontrolki';
import { PanelPolozenia, type RozmiaryKotwicy } from './PanelPolozenia';
import { PanelStylu } from './PanelStylu';
import { PanelTypu } from './PanelTypu';
import { PanelWygladu } from './PanelWygladu';
import { PoleRozmiaru } from './PoleRozmiaru';
import { GrupyStylow } from './GrupyStylow';
import { KolorZDanych } from './KolorZDanych';
import { TloDekoracyjne } from './PolaDekoracji';

type Opcje = readonly { wartosc: string; tekst: string }[];

/** Pola, które mogą być stałe (ten sam tekst / obraz na każdej karcie) albo z danych karty. */
const ZE_ZRODLEM = new Set(['tekst', 'wartosc', 'obraz', 'ikona', 'znaczniki', 'wpis']);

/**
 * Właściwości zaznaczonego elementu (albo kilku elementów tego samego typu naraz): typ, nazwa,
 * źródło (dane karty / stały tekst), etykieta, szerokość i wysokość, ustawienia typu, styl,
 * wygląd, odstępy, „gdy puste” i wartość przykładowa do podglądu.
 */
export function PanelWezla({
  szablon,
  wezel,
  wymiary,
  zmienWezel,
  zmienSzablon,
  zmienPrzyklad,
  zmienTyp,
  czcionki,
  obrazy,
  wgrajStalyObraz,
  wiele = false,
  zajeteKlucze,
  rodzicSwobodny,
  rozmiaryKotwicy,
  kolejnosc,
  wyrownanie,
  mozeNaSwobodny = true,
}: {
  szablon: Szablon;
  wezel: Wezel;
  /** Obecny rozmiar elementu w podglądzie (mm) – start przy przełączeniu na mm. */
  wymiary: { szer: number; wys: number } | undefined;
  zmienSzablon: (f: (s: Szablon) => Szablon, klucz?: string) => void;
  zmienWezel: (f: (w: Wezel) => Wezel, klucz?: string) => void;
  zmienPrzyklad: (klucz: string, wartosc: string) => void;
  zmienTyp: (typ: Wezel['typ']) => void;
  czcionki: Opcje;
  obrazy: Opcje;
  wgrajStalyObraz?: (plik: File, sygnal: AbortSignal) => Promise<void>;
  /** Edycja kilku elementów naraz – ustawienia wspólne (bez nazwy, klucza i przykładu). */
  wiele?: boolean;
  /** Klucze zajęte poza szablonem (dane kart) – przy przełączeniu pola na dane karty. */
  zajeteKlucze: () => Iterable<string>;
  /** Kontener swobodny, w którym leży element (sekcja „Położenie”); brak = zwykły rodzic albo korzeń. */
  rodzicSwobodny?: Kontener;
  /** Rozmiary do zachowania miejsca przy zmianie kotwicy (wnętrze kontenera i prostokąt elementu). */
  rozmiaryKotwicy?: (id: string) => RozmiaryKotwicy | undefined;
  /** Zmiana kolejności rysowania (tylko jeden element). */
  kolejnosc?: (jak: ZmianaKolejnosci) => void;
  /** Wyrównanie i rozłożenie zaznaczonych elementów swobodnych (koniec sekcji „Położenie”). */
  wyrownanie?: ReactNode;
  /** Konwersja na swobodny wymaga układu z podglądu – bez niego przycisk jest wyłączony. */
  mozeNaSwobodny?: boolean;
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
  const stalyTekst =
    pole && (pole.typ === 'tekst' || pole.typ === 'wartosc') && typeof pole.tekst === 'string'
      ? pole.tekst
      : '';

  const typy = czyKontener(wezel)
    ? (['wiersz', 'kolumna', 'warstwy', 'swobodny'] as const)
    : TYPY_POL;

  return (
    <>
      {wiele && <p className="uwaga">{t('wlasciwosci.wieleNaraz')}</p>}
      <Lista
        etykieta={t('wlasciwosci.typ')}
        opcje={typy.map((x) => ({ wartosc: x, tekst: t(`wezel.${x}`) }))}
        wartosc={wezel.typ}
        zmien={(v) => zmienTyp(v)}
      />
      {!wiele && (
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
        </div>
      )}

      {rodzicSwobodny && !korzen && (
        <PanelPolozenia
          kontener={nazwaWezla(rodzicSwobodny)}
          pozycja={wezel.pozycja}
          rozmiary={(x) => rozmiaryKotwicy?.(x) as RozmiaryKotwicy | undefined}
          zmien={(f, klucz) =>
            zmienWezel(
              (w) =>
                ({ ...w, pozycja: f(w.pozycja ?? ({ x: 0, y: 0 } as Pozycja), w.id) }) as Wezel,
              `${klucz}:${id}`,
            )
          }
          {...(kolejnosc && !wiele ? { kolejnosc } : {})}
        >
          {wyrownanie}
        </PanelPolozenia>
      )}

      {pole && ZE_ZRODLEM.has(pole.typ) && !wiele && (
        <>
          <Przelacznik
            etykieta={t('wlasciwosci.zrodlo')}
            opcje={[
              { wartosc: 'dane', tekst: t('wlasciwosci.zrodlo.dane') },
              { wartosc: 'staly', tekst: t('wlasciwosci.zrodlo.staly') },
            ]}
            wartosc={pole.klucz ? 'dane' : 'staly'}
            zmien={(v) =>
              zmienWezel((w) => {
                const x = { ...w } as Pole;
                if (v === 'staly') {
                  // Stały tekst: na start wartość przykładowa albo nazwa.
                  if ((x.typ === 'tekst' || x.typ === 'wartosc') && !x.tekst)
                    x.tekst = (x.klucz && szablon.przyklad?.[x.klucz]) || x.nazwa || '';
                  delete x.klucz;
                } else {
                  x.klucz = kluczZNazwy(
                    x.nazwa || x.typ,
                    new Set([...kluczeSzablonu(szablon), ...zajeteKlucze()]),
                  );
                }
                return x;
              })
            }
          />
          {pole.klucz ? (
            <p className="podpis">{t('szablon.kluczDanych', { klucz: pole.klucz })}</p>
          ) : (
            (pole.typ === 'tekst' || pole.typ === 'wartosc') && (
              <div className="pole-panelu">
                <label htmlFor={`staly-${id}`}>{t('wlasciwosci.stalyTekst')}</label>
                <textarea
                  id={`staly-${id}`}
                  rows={pole.typ === 'tekst' ? 2 : 1}
                  value={stalyTekst}
                  onChange={(e) =>
                    zmienWezel((w) => ({ ...w, tekst: e.target.value }) as Wezel, `staly:${id}`)
                  }
                />
              </div>
            )
          )}
          {pole.klucz && (pole.typ === 'tekst' || pole.typ === 'wartosc') && (
            <div className="pole-panelu">
              <label htmlFor={`domyslny-${id}`}>{t('wlasciwosci.domyslny')}</label>
              <input
                id={`domyslny-${id}`}
                value={stalyTekst}
                onChange={(e) =>
                  zmienWezel((w) => {
                    const x = { ...w } as PoleTekst;
                    if (e.target.value) x.tekst = e.target.value;
                    else delete x.tekst;
                    return x;
                  }, `domyslny:${id}`)
                }
              />
            </div>
          )}
        </>
      )}

      {zEtykieta && (
        <Sekcja tytul={t('szablon.etykieta')} otwarta={!!etykieta}>
          <label className="wiersz-pola">
            <input
              type="checkbox"
              checked={!!etykieta}
              onChange={(e) =>
                zmienWezel((w) => {
                  const x = { ...w } as PoleTekst | PoleWartosc;
                  if (e.target.checked)
                    x.etykieta = { tekst: w.nazwa || t(`wezel.${w.typ}`), pozycja: 'nad' };
                  else delete x.etykieta;
                  return x;
                })
              }
            />
            {t('szablon.pokazEtykiete')}
          </label>
          {etykieta && (
            <>
              {!wiele && (
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
              )}
              <Przelacznik
                etykieta={t('szablon.pozycjaEtykiety')}
                opcje={(zEtykieta.typ === 'tekst'
                  ? (['nad', 'przed', 'pod'] as const)
                  : (['nad', 'pod'] as const)
                ).map((p) => ({ wartosc: p, tekst: t(`szablon.pozycja.${p}`) }))}
                wartosc={etykieta.pozycja}
                zmien={(p) =>
                  zmienWezel(
                    (w) =>
                      ({ ...w, etykieta: { ...(w as PoleTekst).etykieta!, pozycja: p } }) as Wezel,
                  )
                }
              />
              {zEtykieta.typ === 'wartosc' && (
                <Liczba
                  etykieta={t('wlasciwosci.odstepEtykiety')}
                  wartosc={(etykieta as NonNullable<PoleWartosc['etykieta']>).odstep ?? 0.5}
                  max={20}
                  krok={0.1}
                  zmien={(v) =>
                    zmienWezel(
                      (w) =>
                        ({
                          ...w,
                          etykieta: { ...(w as PoleWartosc).etykieta!, odstep: v },
                        }) as Wezel,
                      `odstepetykiety:${id}`,
                    )
                  }
                />
              )}
              <Sekcja tytul={t('wlasciwosci.stylEtykiety')}>
                <PanelStylu
                  styl={etykieta.styl ?? {}}
                  bazowy={stylPola(szablon, zEtykieta)}
                  czcionki={czcionki}
                  akapity={false}
                  // Etykieta tekstu leży w akapicie pola – wyrównanie ma ze stylu pola.
                  wyrownanie={zEtykieta.typ === 'wartosc'}
                  wyrownaniePionowe={false}
                  domyslne={{ wyrownanie: 'srodek' }}
                  zmien={(f: (s: Partial<StylTekstu>) => Partial<StylTekstu>) =>
                    zmienWezel((w) => {
                      const e = (w as PoleTekst).etykieta;
                      return e ? ({ ...w, etykieta: { ...e, styl: f(e.styl ?? {}) } } as Wezel) : w;
                    }, `stylEtykiety:${id}`)
                  }
                />
              </Sekcja>
              {!wiele && (
                <KolorZDanych
                  szablon={szablon}
                  {...(etykieta.kolorZDanych ? { regula: etykieta.kolorZDanych } : {})}
                  kolor={
                    etykieta.styl?.kolor ??
                    stylPola(szablon, zEtykieta).kolor ??
                    DOMYSLNY_KOLOR_TEKSTU
                  }
                  zmien={(v, klucz) =>
                    zmienWezel(
                      (w) => {
                        if ((w.typ !== 'tekst' && w.typ !== 'wartosc') || !w.etykieta) return w;
                        const e = { ...w.etykieta };
                        if (v) e.kolorZDanych = v;
                        else delete e.kolorZDanych;
                        return { ...w, etykieta: e } as Wezel;
                      },
                      klucz && `kolor-etykiety:${id}:${klucz}`,
                    )
                  }
                />
              )}
            </>
          )}
        </Sekcja>
      )}

      {!korzen && (
        <>
          <PoleRozmiaru
            id={`szer-${id}`}
            etykieta={t('szablon.szerokosc')}
            wartosc={wezel.szerokosc}
            domyslneMm={wymiary?.szer ?? 10}
            bezWypelnij={!!rodzicSwobodny}
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
            bezWypelnij={!!rodzicSwobodny}
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
        <>
          {(wezel.typ === 'wiersz' || wezel.typ === 'kolumna') && (
            <Liczba
              etykieta={t('szablon.odstepDzieci')}
              wartosc={(wezel as Kontener).odstep ?? 0}
              max={50}
              zmien={(v) => zmienWezel((w) => ({ ...w, odstep: v }) as Wezel, `odstep:${id}`)}
            />
          )}
          {wezel.typ !== 'warstwy' && wezel.typ !== 'swobodny' && (
            <Przelacznik
              etykieta={t('wlasciwosci.rozklad')}
              opcje={(['poczatek', 'srodek', 'koniec', 'miedzy'] as const).map((r) => ({
                wartosc: r,
                tekst: t(`wlasciwosci.rozklad.${r}`),
              }))}
              wartosc={wezel.rozklad ?? 'poczatek'}
              zmien={(v) =>
                zmienWezel((w) => {
                  const x = { ...w } as Kontener;
                  if (v === 'poczatek') delete x.rozklad;
                  else x.rozklad = v;
                  return x;
                })
              }
            />
          )}
          {!wiele && (
            <div className="pole-panelu konwersja">
              <div className="wiersz-przyciskow">
                {wezel.typ !== 'swobodny' && (
                  <button
                    type="button"
                    className="maly"
                    disabled={!mozeNaSwobodny}
                    onClick={() => zmienTyp('swobodny')}
                  >
                    {t('polozenie.zamienNaSwobodny')}
                  </button>
                )}
                {wezel.typ === 'swobodny' && (
                  <>
                    <button type="button" className="maly" onClick={() => zmienTyp('kolumna')}>
                      {t('polozenie.zamienNaKolumne')}
                    </button>
                    <button type="button" className="maly" onClick={() => zmienTyp('wiersz')}>
                      {t('polozenie.zamienNaWiersz')}
                    </button>
                  </>
                )}
              </div>
              <p className="podpis">
                {t(
                  wezel.typ === 'swobodny'
                    ? 'polozenie.konwersjaOpis'
                    : 'polozenie.konwersjaNaSwobodnyOpis',
                )}
              </p>
            </div>
          )}
        </>
      )}

      {!wiele && maStylTekstu(wezel) && (
        <GrupyStylow szablon={szablon} czcionki={czcionki} zmien={zmienSzablon} pole={wezel} />
      )}
      {pole && (
        <PanelTypu
          szablon={szablon}
          pole={pole}
          zmien={zmienWezel}
          czcionki={czcionki}
          obrazy={obrazy}
          {...(wgrajStalyObraz ? { wgrajStalyObraz } : {})}
          wiele={wiele}
          zajeteKlucze={zajeteKlucze}
        />
      )}

      {(pole?.klucz || pole?.typ === 'tabela') && (
        <Przelacznik
          etykieta={t('wlasciwosci.gdyPuste')}
          opcje={[
            { wartosc: 'pokaz-ramke', tekst: t('wlasciwosci.gdyPuste.pokaz') },
            { wartosc: 'ukryj', tekst: t('wlasciwosci.gdyPuste.ukryj') },
          ]}
          wartosc={pole.gdyPuste ?? 'pokaz-ramke'}
          zmien={(v) =>
            zmienWezel((w) => {
              const x = { ...w } as Pole;
              if (v === 'ukryj') x.gdyPuste = 'ukryj';
              else delete x.gdyPuste;
              return x;
            })
          }
        />
      )}

      <PanelWygladu wezel={wezel} zmien={zmienWezel} />
      {!wiele && czyKontener(wezel) && (
        <TloDekoracyjne
          obrazy={obrazy}
          {...(wezel.teksturaTla ? { tekstura: wezel.teksturaTla } : {})}
          {...(wezel.postrzepienie ? { postrzepienie: wezel.postrzepienie } : {})}
          zmienTeksture={(v) =>
            zmienWezel((w) => {
              if (!czyKontener(w)) return w;
              const x = { ...w };
              if (v) x.teksturaTla = v;
              else delete x.teksturaTla;
              return x;
            })
          }
          zmienPostrzepienie={(v) =>
            zmienWezel((w) => {
              if (!czyKontener(w)) return w;
              const x = { ...w };
              if (v) x.postrzepienie = v;
              else delete x.postrzepienie;
              return x;
            }, `postrzepienie:${id}`)
          }
        />
      )}
      {!wiele && czyKontener(wezel) && (
        <KolorZDanych
          szablon={szablon}
          {...(wezel.tloZDanych ? { regula: wezel.tloZDanych } : {})}
          kolor={wezel.tlo ?? DOMYSLNE_TLO_KARTY}
          zmien={(v, klucz) =>
            zmienWezel(
              (w) => {
                if (!czyKontener(w)) return w;
                const x = { ...w };
                if (v) x.tloZDanych = v;
                else delete x.tloZDanych;
                return x;
              },
              klucz && `kolor-panelu:${id}:${klucz}`,
            )
          }
        />
      )}

      {!wiele && pole?.klucz && pole.typ !== 'obraz' && (
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
      {!wiele && pole?.typ === 'tabela' && (
        <Sekcja tytul={t('szablon.przyklad')}>
          {kluczeTabeli(pole).map((k, i) => {
            const kolumna = pole.kolumny[i % pole.kolumny.length]!;
            const wiersz = Math.floor(i / pole.kolumny.length) + 1;
            return (
              <div key={k} className="pole-panelu">
                <label htmlFor={`przyklad-${id}-${k}`}>
                  {t('szablon.przykladKomorki', {
                    naglowek: `${kolumna.naglowek || kolumna.klucz} (${wiersz})`,
                  })}
                </label>
                <input
                  id={`przyklad-${id}-${k}`}
                  value={szablon.przyklad?.[k] ?? ''}
                  onChange={(e) => zmienPrzyklad(k, e.target.value)}
                />
              </div>
            );
          })}
        </Sekcja>
      )}
    </>
  );
}
