import { useEffect, useRef, useState } from 'react';
import { kluczZNazwy, kluczeSzablonu } from '../../dane/szablon';
import { t } from '../../i18n';
import { MAKS_ZNACZNIKOW } from '../../silnik/karta';
import {
  kluczeTabeli,
  KSZTALTY_WARTOSCI,
  RAMIONA_GWIAZDY,
  type KolumnaTabeli,
  type NazwaIkony,
  znajdzGrupeStylu,
  maStylTekstu,
  stylPola,
  type Pole,
  type PoleObraz,
  type PoleTabela,
  type StylTekstu,
  type Szablon,
  type Wezel,
} from '../../model/szablon';
import { Liczba, Lista, PoleKoloru, Przelacznik, Sekcja, Wybor } from './Kontrolki';
import { PanelSeparatora } from './PanelSeparatora';
import { PanelStylu } from './PanelStylu';
import { PoleRamki, nazwaElementu } from './PanelWygladu';
import { ELEMENTY_WBUDOWANE } from '../../ozdobniki/katalog';
import { MiniaturaOzdobnika } from './MiniaturaOzdobnika';
import { elementyRodzaju, useAdresBiblioteki, useElementyWlasne } from './elementyWlasne';

type Zmiana = (f: (w: Wezel) => Wezel, klucz?: string) => void;
type Opcje = readonly { wartosc: string; tekst: string }[];

const KSZTALTY = KSZTALTY_WARTOSCI.filter((k) => k !== 'wlasny');
/** Kształty wypełniające pole albo zawsze równoboczne – bez opcji „Zachowaj proporcje”. */
const BEZ_PROPORCJI = new Set(['prostokat', 'sciety', 'kwadrat', 'kolo']);
const IKONY: NazwaIkony[] = ['gwiazdka', 'nozyczki'];

/**
 * Ustawienia zależne od typu pola: kształt wartości, znaczniki, pole do wpisania, obraz, ikona,
 * separator, tabela; dla pól z tekstem – styl tekstu.
 */
export function PanelTypu({
  szablon,
  pole,
  zmien,
  czcionki,
  obrazy,
  wgrajStalyObraz,
  wiele,
  bezDanych = false,
  zajeteKlucze,
}: {
  szablon: Szablon;
  pole: Pole;
  zmien: Zmiana;
  czcionki: Opcje;
  /** Obrazy z biblioteki projektu (stały obraz). */
  obrazy: Opcje;
  wgrajStalyObraz?: (plik: File, sygnal: AbortSignal) => Promise<void>;
  /** Edycja kilku pól naraz – bez ustawień unikalnych (kolumny tabeli). */
  wiele: boolean;
  /** Tryb bez danych karty (edytor rewersu) – ukrywa opcje zależne od danych talii. */
  bezDanych?: boolean;
  /** Klucze zajęte poza szablonem (dane kart) – dla nowych kolumn tabeli. */
  zajeteKlucze: () => Iterable<string>;
}) {
  const id = pole.id;
  const adresBiblioteki = useAdresBiblioteki();
  const wlasneElementy = useElementyWlasne();
  const wlasneKsztalty = elementyRodzaju('ksztalt', wlasneElementy);
  const grafikiSvg = [...ELEMENTY_WBUDOWANE, ...wlasneElementy].filter((e) => e.kontury.length > 0);
  // Zmiana stylu jako funkcja – przy kilku zaznaczonych stosowana do stylu każdego elementu.
  const zmienStyl = (
    k: 'styl' | 'stylNaglowka',
    f: (s: Partial<StylTekstu>) => Partial<StylTekstu>,
    klucz?: string,
  ) =>
    zmien((w) => {
      if (k === 'styl' && maStylTekstu(w) && znajdzGrupeStylu(szablon, w.grupaStyluId)) return w;
      const x = { ...w } as Record<string, unknown>;
      x[k] = f((x[k] as Partial<StylTekstu> | undefined) ?? {});
      return x as unknown as Wezel;
    }, klucz);
  const ustaw = (z: Partial<Pole>, klucz?: string) =>
    zmien((w) => {
      const n = { ...w, ...z } as Record<string, unknown>;
      for (const [k, v] of Object.entries(z)) if (v === undefined) delete n[k];
      return n as unknown as Wezel;
    }, klucz);

  switch (pole.typ) {
    case 'tekst':
      return (
        <>
          <Wybor
            etykieta={t('wlasciwosci.wieleWierszy')}
            wartosc={pole.wieleWierszy !== false}
            zmien={(v) => ustaw({ wieleWierszy: v ? undefined : false })}
          />
          <Wybor
            etykieta={t('wlasciwosci.formatowanie')}
            wartosc={pole.formatowanie !== false}
            zmien={(v) => ustaw({ formatowanie: v ? undefined : false })}
          />
          <Wybor
            etykieta={t('wlasciwosci.listyNumerowane')}
            wartosc={pole.listyNumerowane === true}
            zmien={(v) => ustaw({ listyNumerowane: v || undefined })}
          />
          <Wybor
            etykieta={t('wlasciwosci.ikonyWTekscie')}
            wartosc={pole.ikonyWTekscie === true}
            zmien={(v) => ustaw({ ikonyWTekscie: v || undefined })}
          />
          {(pole.listyNumerowane || pole.ikonyWTekscie) && (
            <p className="podpis">{t('wlasciwosci.notacjaPomoc')}</p>
          )}
          {!wiele && !bezDanych && (
            <Wybor
              etykieta={t('wlasciwosci.kontynuuj')}
              wartosc={pole.kontynuuj === true}
              zmien={(v) => ustaw({ kontynuuj: v || undefined })}
            />
          )}
          {!bezDanych && pole.kontynuuj && (
            <p className="podpis">{t('wlasciwosci.kontynuujPomoc')}</p>
          )}
          <Wybor
            etykieta={t('wlasciwosci.tekstPoLuku')}
            wartosc={!!pole.luk}
            zmien={(v) =>
              ustaw({ luk: v ? { promien: 40, kierunek: 'gora' } : undefined }, `luk:${id}`)
            }
          />
          {pole.luk && (
            <>
              <Liczba
                etykieta={t('wlasciwosci.lukPromien')}
                wartosc={pole.luk.promien}
                min={5}
                max={500}
                krok={1}
                zmien={(v) =>
                  ustaw(
                    {
                      luk: {
                        promien: Math.max(1, v),
                        ...(pole.luk?.kierunek ? { kierunek: pole.luk.kierunek } : {}),
                      },
                    },
                    `luk-promien:${id}`,
                  )
                }
              />
              <Lista
                etykieta={t('wlasciwosci.lukKierunek')}
                opcje={(['gora', 'dol'] as const).map((k) => ({
                  wartosc: k,
                  tekst: t(`wlasciwosci.luk.${k}`),
                }))}
                wartosc={pole.luk.kierunek ?? 'gora'}
                zmien={(k) => ustaw({ luk: { ...pole.luk!, kierunek: k } }, `luk-kierunek:${id}`)}
              />
            </>
          )}
        </>
      );
    case 'wartosc':
      return (
        <>
          <Lista
            etykieta={t('wlasciwosci.ksztalt')}
            opcje={[
              ...KSZTALTY.map((k) => ({ wartosc: k, tekst: t(`ksztalt.${k}`) })),
              // Własny kształt z biblioteki ozdobników (rodzaj „kształt”).
              ...(wlasneKsztalty.length > 0 || pole.ksztalt === 'wlasny'
                ? [{ wartosc: 'wlasny' as const, tekst: t('ksztalt.wlasny') }]
                : []),
            ]}
            wartosc={pole.ksztalt}
            zmien={(v) =>
              ustaw(
                v === 'wlasny'
                  ? { ksztalt: v, ksztaltElement: pole.ksztaltElement ?? wlasneKsztalty[0]?.id }
                  : { ksztalt: v, ksztaltElement: undefined },
              )
            }
          />
          {pole.ksztalt === 'gwiazda' && (
            <Liczba
              etykieta={t('wlasciwosci.ramiona')}
              wartosc={pole.ramiona ?? RAMIONA_GWIAZDY.domyslnie}
              min={RAMIONA_GWIAZDY.min}
              max={RAMIONA_GWIAZDY.max}
              krok={1}
              zmien={(v) =>
                ustaw({ ramiona: v === RAMIONA_GWIAZDY.domyslnie ? undefined : v }, `ramiona:${id}`)
              }
            />
          )}
          {!BEZ_PROPORCJI.has(pole.ksztalt) && (
            <Wybor
              etykieta={t('wlasciwosci.zachowajProporcje')}
              wartosc={pole.zachowajProporcje !== false}
              zmien={(v) => ustaw({ zachowajProporcje: v ? undefined : false })}
            />
          )}
          {pole.ksztalt === 'wlasny' && (
            <div className="pole-panelu">
              <span id={`ksztalt-el-${id}`}>{t('ksztalt.wlasnyElement')}</span>
              <div
                className="wybor-narozniki"
                role="group"
                aria-labelledby={`ksztalt-el-${id}`}
                data-testid="wybor-ksztaltu"
              >
                {wlasneKsztalty.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={pole.ksztaltElement === e.id}
                    aria-label={nazwaElementu(e)}
                    onClick={() => ustaw({ ksztaltElement: e.id })}
                  >
                    <MiniaturaOzdobnika element={e} />
                    <small>{nazwaElementu(e)}</small>
                  </button>
                ))}
              </div>
              <a href={adresBiblioteki}>{t('biblioteka.otworz')}</a>
            </div>
          )}
        </>
      );
    case 'wpis':
      return (
        <div className="pole-panelu">
          <label htmlFor={`sufiks-${id}`}>{t('wlasciwosci.sufiks')}</label>
          <input
            id={`sufiks-${id}`}
            value={typeof pole.sufiks === 'string' ? pole.sufiks : ''}
            onChange={(e) => ustaw({ sufiks: e.target.value || undefined }, `sufiks:${id}`)}
          />
        </div>
      );
    case 'znaczniki':
      return (
        <Sekcja tytul={t('wlasciwosci.znaczniki')} otwarta>
          <div className="dwa-pola">
            <Liczba
              etykieta={t('wlasciwosci.kolumny')}
              wartosc={pole.kolumny}
              min={1}
              max={Math.floor(MAKS_ZNACZNIKOW / pole.rzedy)}
              krok={1}
              zmien={(v) => ustaw({ kolumny: v })}
            />
            <Liczba
              etykieta={t('wlasciwosci.rzedy')}
              wartosc={pole.rzedy}
              min={1}
              max={Math.floor(MAKS_ZNACZNIKOW / pole.kolumny)}
              krok={1}
              zmien={(v) => ustaw({ rzedy: v })}
            />
          </div>
          <Przelacznik
            etykieta={t('wlasciwosci.ksztalt')}
            opcje={(['kolo', 'kwadrat'] as const).map((k) => ({
              wartosc: k,
              tekst: t(`ksztalt.${k}`),
            }))}
            wartosc={pole.ksztalt}
            zmien={(v) => ustaw({ ksztalt: v })}
          />
          <div className="dwa-pola">
            <Liczba
              etykieta={t('wlasciwosci.srednica')}
              wartosc={pole.srednica}
              min={0.5}
              max={30}
              zmien={(v) => ustaw({ srednica: v })}
            />
            <Liczba
              etykieta={t('wlasciwosci.odstep')}
              wartosc={pole.odstep}
              max={30}
              zmien={(v) => ustaw({ odstep: v })}
            />
            <Liczba
              etykieta={t('wlasciwosci.grubosc')}
              wartosc={pole.grubosc}
              krok={0.05}
              max={5}
              zmien={(v) => ustaw({ grubosc: v })}
            />
            <PoleKoloru
              etykieta={t('wlasciwosci.kolorLinii')}
              wartosc={pole.kolor ?? '#000000'}
              moznaBrak={false}
              zmien={(v) => ustaw({ kolor: v })}
            />
          </div>
          <p className="podpis">{t('wlasciwosci.znacznikiOpis', { maks: MAKS_ZNACZNIKOW })}</p>
        </Sekcja>
      );
    case 'obraz':
      return (
        <Sekcja tytul={t('wlasciwosci.obraz')} otwarta>
          <Lista
            etykieta={t('wlasciwosci.dopasowanie')}
            opcje={(['dopasuj', 'wypelnij', 'rozciagnij'] as const).map((k) => ({
              wartosc: k,
              tekst: t(`obraz.${k}`),
            }))}
            wartosc={pole.dopasowanie}
            zmien={(v) => ustaw({ dopasowanie: v })}
          />
          <div className="dwa-pola">
            <Liczba
              etykieta={t('wlasciwosci.kadrX')}
              wartosc={Math.round((pole.kadr?.x ?? 0.5) * 100)}
              max={100}
              krok={5}
              zmien={(v) =>
                zmien(
                  (w) =>
                    ({ ...w, kadr: { x: v / 100, y: (w as PoleObraz).kadr?.y ?? 0.5 } }) as Wezel,
                )
              }
            />
            <Liczba
              etykieta={t('wlasciwosci.kadrY')}
              wartosc={Math.round((pole.kadr?.y ?? 0.5) * 100)}
              max={100}
              krok={5}
              zmien={(v) =>
                zmien(
                  (w) =>
                    ({ ...w, kadr: { x: (w as PoleObraz).kadr?.x ?? 0.5, y: v / 100 } }) as Wezel,
                )
              }
            />
          </div>
          {!pole.klucz && (
            <StalyObraz
              wartosc={pole.zasob ?? ''}
              obrazy={obrazy}
              wybierz={(v) => ustaw({ zasob: v || undefined })}
              wgraj={wgrajStalyObraz}
            />
          )}
        </Sekcja>
      );
    case 'ikona': {
      const wybranySvg = pole.element ? grafikiSvg.find((e) => e.id === pole.element) : undefined;
      return (
        <Sekcja tytul={t('wlasciwosci.ikona')} otwarta>
          <Lista
            etykieta={t('ikona.typ')}
            opcje={[
              { wartosc: 'wbudowana', tekst: t('ikona.wbudowana') },
              { wartosc: 'ozdobnik', tekst: t('ikona.ozdobnik') },
            ]}
            wartosc={pole.element ? 'ozdobnik' : 'wbudowana'}
            zmien={(v) =>
              ustaw(
                v === 'ozdobnik'
                  ? { element: pole.element ?? grafikiSvg[0]?.id }
                  : { element: undefined },
              )
            }
          />
          {pole.element ? (
            <div className="pole-panelu">
              <span id={`ikona-el-${id}`}>{t('ikona.wybierzOzdobnik')}</span>
              <div
                className="wybor-narozniki"
                role="group"
                aria-labelledby={`ikona-el-${id}`}
                data-testid="wybor-ikony-svg"
              >
                {grafikiSvg.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={pole.element === e.id}
                    aria-label={nazwaElementu(e)}
                    onClick={() => ustaw({ element: e.id })}
                  >
                    <MiniaturaOzdobnika element={e} />
                    <small>{nazwaElementu(e)}</small>
                  </button>
                ))}
              </div>
              <a href={adresBiblioteki}>{t('biblioteka.otworz')}</a>
              {wybranySvg?.kolorowanie === 'oryginal' && (
                <p className="podpis">{t('ikona.kolorWlasnyInfo')}</p>
              )}
            </div>
          ) : (
            <Lista
              etykieta={t('wlasciwosci.ikona')}
              opcje={IKONY.map((k) => ({ wartosc: k, tekst: t(`ikona.${k}`) }))}
              wartosc={pole.ikona}
              zmien={(v) => ustaw({ ikona: v })}
            />
          )}
          <div className="dwa-pola">
            <Liczba
              etykieta={t('wlasciwosci.rozmiarMm')}
              wartosc={pole.rozmiar}
              min={0.5}
              max={100}
              zmien={(v) => ustaw({ rozmiar: v })}
            />
            {(!wybranySvg || wybranySvg.kolorowanie !== 'oryginal') && (
              <PoleKoloru
                etykieta={t('styl.kolor')}
                wartosc={pole.kolor ?? '#000000'}
                moznaBrak={false}
                zmien={(v) => ustaw({ kolor: v })}
              />
            )}
          </div>
        </Sekcja>
      );
    }
    case 'separator':
      return <PanelSeparatora pole={pole} ustaw={ustaw} />;
    case 'tabela':
      return (
        <PanelTabeli
          szablon={szablon}
          tabela={pole}
          ustaw={ustaw}
          zmienStyl={zmienStyl}
          zmien={zmien}
          czcionki={czcionki}
          wiele={wiele}
          zajeteKlucze={zajeteKlucze}
        />
      );
  }
}

/**
 * Tabela: kolumny (dodaj, usuń, przesuń; nagłówek, szerokość, wyrównanie), liczba wierszy
 * wartości, widoczność i wygląd nagłówków, linie siatki, odstęp komórek, styl tekstu.
 */
function PanelTabeli({
  szablon,
  tabela,
  ustaw,
  zmienStyl,
  zmien,
  czcionki,
  wiele,
  zajeteKlucze,
}: {
  szablon: Szablon;
  tabela: PoleTabela;
  ustaw: (z: Partial<Pole>, klucz?: string) => void;
  zmienStyl: (
    k: 'styl' | 'stylNaglowka',
    f: (s: Partial<StylTekstu>) => Partial<StylTekstu>,
    klucz?: string,
  ) => void;
  zmien: Zmiana;
  czcionki: Opcje;
  wiele: boolean;
  zajeteKlucze: () => Iterable<string>;
}) {
  const id = tabela.id;
  const kol = tabela.kolumny;
  const zmienKolumny = (k: KolumnaTabeli[], klucz?: string) =>
    ustaw({ kolumny: k } as Partial<Pole>, klucz);
  const dodajKolumne = () => {
    // Klucz wolny także dla dalszych wierszy (klucz_2, klucz_3…).
    const zajete = new Set([...kluczeSzablonu(szablon), ...zajeteKlucze()]);
    let k = kluczZNazwy(`${tabela.nazwa || 'tabela'} ${kol.length + 1}`, zajete);
    for (
      let n = 2;
      kluczeTabeli({ ...tabela, kolumny: [{ naglowek: '', klucz: k }] }).some((x) => zajete.has(x));
      n++
    )
      k = kluczZNazwy(`${tabela.nazwa || 'tabela'} ${kol.length + n}`, zajete);
    zmienKolumny([...kol, { naglowek: String(kol.length + 1), klucz: k }]);
  };
  // Fokus po przesunięciu / usunięciu kolumny: pole nagłówka kolumny w nowym miejscu
  // (albo przycisk „Dodaj kolumnę”).
  const fokus = (sel: string) =>
    requestAnimationFrame(() => document.querySelector<HTMLElement>(sel)?.focus());
  const przesun = (i: number, o: -1 | 1) => {
    const n = [...kol];
    [n[i], n[i + o]] = [n[i + o]!, n[i]!];
    zmienKolumny(n);
    fokus(`#kol-${CSS.escape(id)}-${i + o}`);
  };
  const styl = { ...tabela.styl, wariant: 'pogrubiony' as const, ...tabela.stylNaglowka };
  return (
    <>
      {!wiele && (
        <Sekcja tytul={t('tabela.kolumny', { liczba: kol.length })} otwarta>
          <ol className="kolumny-tabeli">
            {kol.map((k, i) => (
              <li key={k.klucz}>
                <div className="pole-panelu">
                  <label htmlFor={`kol-${id}-${i}`}>{t('tabela.naglowek', { n: i + 1 })}</label>
                  <input
                    id={`kol-${id}-${i}`}
                    value={k.naglowek}
                    onChange={(e) =>
                      zmienKolumny(
                        kol.map((x, j) => (j === i ? { ...x, naglowek: e.target.value } : x)),
                        `kolumna:${id}:${k.klucz}`,
                      )
                    }
                  />
                </div>
                <Przelacznik
                  etykieta={t('tabela.szerokosc', { n: i + 1 })}
                  opcje={[
                    { wartosc: 'auto', tekst: t('rozmiar.tryb.auto') },
                    { wartosc: 'wypelnij', tekst: t('rozmiar.tryb.wypelnij') },
                    { wartosc: 'mm', tekst: t('rozmiar.tryb.mm') },
                  ]}
                  wartosc={
                    !k.szerokosc || k.szerokosc === 'auto'
                      ? 'auto'
                      : 'mm' in k.szerokosc
                        ? 'mm'
                        : 'wypelnij'
                  }
                  zmien={(v) =>
                    zmienKolumny(
                      kol.map((x, j) =>
                        j !== i
                          ? x
                          : v === 'auto'
                            ? (({ szerokosc: _s, ...r }) => (void _s, r))(x)
                            : { ...x, szerokosc: v === 'mm' ? { mm: 10 } : { wypelnij: 1 } },
                      ),
                    )
                  }
                />
                {k.szerokosc && k.szerokosc !== 'auto' && (
                  <Liczba
                    etykieta={t('mm' in k.szerokosc ? 'tabela.szerokoscMm' : 'tabela.waga', {
                      n: i + 1,
                    })}
                    wartosc={'mm' in k.szerokosc ? k.szerokosc.mm : k.szerokosc.wypelnij}
                    min={'mm' in k.szerokosc ? 0 : 0.1}
                    max={300}
                    zmien={(v) =>
                      zmienKolumny(
                        kol.map((x, j) =>
                          j !== i || !x.szerokosc || x.szerokosc === 'auto'
                            ? x
                            : {
                                ...x,
                                szerokosc: 'mm' in x.szerokosc ? { mm: v } : { wypelnij: v },
                              },
                        ),
                        `kolszer:${id}:${k.klucz}`,
                      )
                    }
                  />
                )}
                <Lista
                  etykieta={t('tabela.wyrownanie', { n: i + 1 })}
                  opcje={(['domyslnie', 'lewo', 'srodek', 'prawo'] as const).map((w) => ({
                    wartosc: w,
                    tekst: t(w === 'domyslnie' ? 'rozmiar.tryb.domyslnie' : `styl.wyrownanie.${w}`),
                  }))}
                  wartosc={k.wyrownanie ?? 'domyslnie'}
                  zmien={(v) =>
                    zmienKolumny(
                      kol.map((x, j) =>
                        j !== i
                          ? x
                          : v === 'domyslnie'
                            ? (({ wyrownanie: _w, ...r }) => (void _w, r))(x)
                            : { ...x, wyrownanie: v },
                      ),
                    )
                  }
                />
                <div className="akcje-kolumny">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => przesun(i, -1)}
                    aria-label={t('tabela.wLewo', { n: i + 1 })}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={i === kol.length - 1}
                    onClick={() => przesun(i, 1)}
                    aria-label={t('tabela.wPrawo', { n: i + 1 })}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    className="niebezpieczny"
                    disabled={kol.length === 1}
                    onClick={() => {
                      zmienKolumny(kol.filter((_, j) => j !== i));
                      fokus(`#dodaj-kolumne-${CSS.escape(id)}`);
                    }}
                    aria-label={t('tabela.usunKolumne', { n: i + 1 })}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" id={`dodaj-kolumne-${id}`} onClick={dodajKolumne}>
            {t('tabela.dodajKolumne')}
          </button>
        </Sekcja>
      )}
      <Sekcja tytul={t('tabela.wiersze')} otwarta>
        <Liczba
          etykieta={t('tabela.liczbaWierszy')}
          wartosc={tabela.wiersze ?? 1}
          min={1}
          max={50}
          krok={1}
          zmien={(v) => ustaw({ wiersze: v > 1 ? v : undefined } as Partial<Pole>)}
        />
        <Wybor
          etykieta={t('tabela.pokazNaglowki')}
          wartosc={tabela.naglowki !== false}
          zmien={(v) => ustaw({ naglowki: v ? undefined : false } as Partial<Pole>)}
        />
        {tabela.naglowki !== false && (
          <>
            <Wybor
              etykieta={t('tabela.naglowkiPogrubione')}
              wartosc={styl.wariant === 'pogrubiony' || styl.wariant === 'pogrubiona-kursywa'}
              zmien={(v) =>
                // Kursywa nagłówków zostaje – zmienia się tylko pogrubienie.
                zmienStyl('stylNaglowka', (st) => {
                  const kursywa = st.wariant === 'kursywa' || st.wariant === 'pogrubiona-kursywa';
                  return {
                    ...st,
                    wariant: v
                      ? kursywa
                        ? 'pogrubiona-kursywa'
                        : 'pogrubiony'
                      : kursywa
                        ? 'kursywa'
                        : 'normalny',
                  };
                })
              }
            />
            <PoleKoloru
              etykieta={t('tabela.tloNaglowka')}
              wartosc={tabela.tloNaglowka}
              domyslny="#eeeeee"
              zmien={(v) => ustaw({ tloNaglowka: v } as Partial<Pole>)}
            />
          </>
        )}
        <Liczba
          etykieta={t('tabela.odstepKomorki')}
          wartosc={tabela.paddingKomorki ?? 0.8}
          max={10}
          krok={0.1}
          zmien={(v) => ustaw({ paddingKomorki: v } as Partial<Pole>)}
        />
      </Sekcja>
      <Sekcja tytul={t('tabela.linie')}>
        <PoleRamki
          etykieta={t('tabela.linieSiatki')}
          krawedzie={false}
          ramka={tabela.linie}
          zmien={(f) =>
            zmien((w) => {
              const t0 = w as PoleTabela;
              const r = f(t0.linie);
              const x = { ...t0 } as PoleTabela;
              if (r) x.linie = r;
              else delete x.linie;
              return x;
            })
          }
        />
        {tabela.linie && (
          <Wybor
            etykieta={t('tabela.obwodka')}
            wartosc={tabela.linie.zewnetrzne !== false}
            zmien={(v) =>
              zmien((w) => {
                const t0 = w as PoleTabela;
                if (!t0.linie) return w;
                const { zewnetrzne: _z, ...reszta } = t0.linie;
                void _z;
                return { ...t0, linie: v ? reszta : { ...reszta, zewnetrzne: false } } as Wezel;
              })
            }
          />
        )}
      </Sekcja>
      {tabela.naglowki !== false && (
        <Sekcja tytul={t('tabela.stylNaglowkow')}>
          <PanelStylu
            styl={tabela.stylNaglowka ?? {}}
            bazowy={{ ...stylPola(szablon, tabela), wariant: 'pogrubiony' }}
            czcionki={czcionki}
            akapity={false}
            domyslne={{ wyrownanie: 'srodek' }}
            wyrownaniePionowe={false}
            autoDopasowanie={false}
            zmien={(f) => zmienStyl('stylNaglowka', f, `stylnagl:${id}`)}
          />
        </Sekcja>
      )}
    </>
  );
}

function StalyObraz({
  wartosc,
  obrazy,
  wybierz,
  wgraj,
}: {
  wartosc: string;
  obrazy: Opcje;
  wybierz: (id: string) => void;
  wgraj: ((plik: File, sygnal: AbortSignal) => Promise<void>) | undefined;
}) {
  const plik = useRef<HTMLInputElement>(null);
  const operacja = useRef<AbortController | undefined>(undefined);
  const [trwa, ustawTrwa] = useState(false);
  const [blad, ustawBlad] = useState('');
  useEffect(() => () => operacja.current?.abort(), []);
  const wczytaj = async (f: File) => {
    if (!wgraj || operacja.current) return;
    const o = new AbortController();
    operacja.current = o;
    ustawBlad('');
    ustawTrwa(true);
    try {
      await wgraj(f, o.signal);
    } catch (e) {
      if (!o.signal.aborted) ustawBlad(e instanceof Error ? e.message : String(e));
    } finally {
      operacja.current = undefined;
      if (!o.signal.aborted) ustawTrwa(false);
    }
  };
  return (
    <>
      <div className="wiersz-przyciskow">
        <Lista
          etykieta={t('wlasciwosci.obrazStaly')}
          opcje={[{ wartosc: '', tekst: t('wlasciwosci.brak') }, ...obrazy]}
          wartosc={wartosc}
          zmien={wybierz}
        />
        {wgraj && (
          <>
            <button
              type="button"
              aria-disabled={trwa}
              onClick={() => {
                if (!operacja.current) plik.current?.click();
              }}
            >
              {t('karta.wgrajObraz')}
            </button>
            <input
              ref={plik}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              data-testid="plik-stalego-obrazu"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void wczytaj(f);
              }}
            />
          </>
        )}
      </div>
      {trwa && <p role="status">{t('projekty.trwa')}</p>}
      {blad && (
        <p className="uwaga" role="alert">
          {blad}
        </p>
      )}
    </>
  );
}
