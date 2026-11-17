import { kluczZNazwy, kluczeSzablonu } from '../../dane/szablon';
import { t } from '../../i18n';
import { MAKS_ZNACZNIKOW } from '../../silnik/karta';
import {
  kluczeTabeli,
  type KolumnaTabeli,
  type NazwaIkony,
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
import { MiniaturaOzdobnika } from './MiniaturaOzdobnika';
import { elementyRodzaju, useAdresBiblioteki, useElementyWlasne } from './elementyWlasne';

type Zmiana = (f: (w: Wezel) => Wezel, klucz?: string) => void;
type Opcje = readonly { wartosc: string; tekst: string }[];

const KSZTALTY = [
  'prostokat',
  'kwadrat',
  'kolo',
  'sciety',
  'romb',
  'tarcza',
  'szesciokat',
] as const;
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
  wiele,
  zajeteKlucze,
}: {
  szablon: Szablon;
  pole: Pole;
  zmien: Zmiana;
  czcionki: Opcje;
  /** Obrazy z biblioteki projektu (stały obraz). */
  obrazy: Opcje;
  /** Edycja kilku pól naraz – bez ustawień unikalnych (kolumny tabeli). */
  wiele: boolean;
  /** Klucze zajęte poza szablonem (dane kart) – dla nowych kolumn tabeli. */
  zajeteKlucze: () => Iterable<string>;
}) {
  const id = pole.id;
  const adresBiblioteki = useAdresBiblioteki();
  const wlasneKsztalty = elementyRodzaju('ksztalt', useElementyWlasne());
  // Zmiana stylu jako funkcja – przy kilku zaznaczonych stosowana do stylu każdego elementu.
  const zmienStyl = (
    k: 'styl' | 'stylNaglowka',
    f: (s: Partial<StylTekstu>) => Partial<StylTekstu>,
    klucz?: string,
  ) =>
    zmien((w) => {
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
  const styl =
    'styl' in pole && typeof pole.styl === 'object' ? (
      <Sekcja tytul={t('wlasciwosci.styl')} otwarta={pole.typ === 'tekst'}>
        <PanelStylu
          styl={pole.styl}
          czcionki={czcionki}
          akapity={pole.typ === 'tekst'}
          domyslne={
            pole.typ === 'wartosc'
              ? { wyrownanie: 'srodek', wyrownaniePionowe: 'srodek' }
              : pole.typ === 'wpis'
                ? { wyrownaniePionowe: 'srodek' }
                : {}
          }
          zmien={(f) => zmienStyl('styl', f, `styl:${id}`)}
          autoDopasowanie={pole.typ !== 'wpis'}
          wyrownanie={pole.typ !== 'wpis'}
        />
      </Sekcja>
    ) : null;

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
          {styl}
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
          {styl}
        </>
      );
    case 'wpis':
      return (
        <>
          <div className="pole-panelu">
            <label htmlFor={`sufiks-${id}`}>{t('wlasciwosci.sufiks')}</label>
            <input
              id={`sufiks-${id}`}
              value={typeof pole.sufiks === 'string' ? pole.sufiks : ''}
              onChange={(e) => ustaw({ sufiks: e.target.value || undefined }, `sufiks:${id}`)}
            />
          </div>
          {styl}
        </>
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
          <Przelacznik
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
            <Lista
              etykieta={t('wlasciwosci.obrazStaly')}
              opcje={[{ wartosc: '', tekst: t('wlasciwosci.brak') }, ...obrazy]}
              wartosc={pole.zasob ?? ''}
              zmien={(v) => ustaw({ zasob: v || undefined })}
            />
          )}
        </Sekcja>
      );
    case 'ikona':
      return (
        <Sekcja tytul={t('wlasciwosci.ikona')} otwarta>
          <Lista
            etykieta={t('wlasciwosci.ikona')}
            opcje={IKONY.map((k) => ({ wartosc: k, tekst: t(`ikona.${k}`) }))}
            wartosc={pole.ikona}
            zmien={(v) => ustaw({ ikona: v })}
          />
          <div className="dwa-pola">
            <Liczba
              etykieta={t('wlasciwosci.rozmiarMm')}
              wartosc={pole.rozmiar}
              min={0.5}
              max={100}
              zmien={(v) => ustaw({ rozmiar: v })}
            />
            <PoleKoloru
              etykieta={t('styl.kolor')}
              wartosc={pole.kolor ?? '#000000'}
              moznaBrak={false}
              zmien={(v) => ustaw({ kolor: v })}
            />
          </div>
        </Sekcja>
      );
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
                <Przelacznik
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
      <Sekcja tytul={t('wlasciwosci.styl')}>
        <PanelStylu
          styl={tabela.styl}
          czcionki={czcionki}
          akapity={false}
          domyslne={{ wyrownanie: 'srodek' }}
          wyrownaniePionowe={false}
          zmien={(f) => zmienStyl('styl', f, `styl:${id}`)}
        />
      </Sekcja>
      {tabela.naglowki !== false && (
        <Sekcja tytul={t('tabela.stylNaglowkow')}>
          <PanelStylu
            styl={tabela.stylNaglowka ?? {}}
            bazowy={{ ...tabela.styl, wariant: 'pogrubiony' }}
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
