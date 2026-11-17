import { kluczZNazwy, kluczeSzablonu } from '../../dane/szablon';
import { t } from '../../i18n';
import {
  kluczeTabeli,
  type KolumnaTabeli,
  type NazwaIkony,
  type Pole,
  type PoleTabela,
  type Szablon,
  type Wezel,
} from '../../model/szablon';
import { Liczba, Lista, PoleKoloru, Przelacznik, Sekcja, Wybor } from './Kontrolki';
import { PanelStylu } from './PanelStylu';
import { PoleRamki } from './PanelWygladu';

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
}: {
  szablon: Szablon;
  pole: Pole;
  zmien: Zmiana;
  czcionki: Opcje;
  /** Obrazy z biblioteki projektu (stały obraz). */
  obrazy: Opcje;
  /** Edycja kilku pól naraz – bez ustawień unikalnych (kolumny tabeli). */
  wiele: boolean;
}) {
  const id = pole.id;
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
          zmien={(s) => ustaw({ styl: s } as Partial<Pole>, `styl:${id}`)}
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
            opcje={KSZTALTY.map((k) => ({ wartosc: k, tekst: t(`ksztalt.${k}`) }))}
            wartosc={pole.ksztalt}
            zmien={(v) => ustaw({ ksztalt: v })}
          />
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
              max={30}
              krok={1}
              zmien={(v) => ustaw({ kolumny: v })}
            />
            <Liczba
              etykieta={t('wlasciwosci.rzedy')}
              wartosc={pole.rzedy}
              min={1}
              max={30}
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
          <p className="podpis">{t('wlasciwosci.znacznikiOpis')}</p>
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
              zmien={(v) => ustaw({ kadr: { x: v / 100, y: pole.kadr?.y ?? 0.5 } })}
            />
            <Liczba
              etykieta={t('wlasciwosci.kadrY')}
              wartosc={Math.round((pole.kadr?.y ?? 0.5) * 100)}
              max={100}
              krok={5}
              zmien={(v) => ustaw({ kadr: { x: pole.kadr?.x ?? 0.5, y: v / 100 } })}
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
      return (
        <Sekcja tytul={t('wezel.separator')} otwarta>
          <Przelacznik
            etykieta={t('wlasciwosci.kierunek')}
            opcje={(['poziomy', 'pionowy'] as const).map((k) => ({
              wartosc: k,
              tekst: t(`wlasciwosci.kierunek.${k}`),
            }))}
            wartosc={pole.kierunek}
            zmien={(v) => ustaw({ kierunek: v })}
          />
          <div className="dwa-pola">
            <Liczba
              etykieta={t('wlasciwosci.grubosc')}
              wartosc={pole.grubosc}
              krok={0.05}
              max={10}
              zmien={(v) => ustaw({ grubosc: v })}
            />
            <PoleKoloru
              etykieta={t('wlasciwosci.kolorLinii')}
              wartosc={pole.kolor ?? '#000000'}
              moznaBrak={false}
              zmien={(v) => ustaw({ kolor: v })}
            />
          </div>
          <Przelacznik
            etykieta={t('wlasciwosci.stylLinii')}
            opcje={(['ciagla', 'przerywana', 'kropkowana'] as const).map((s) => ({
              wartosc: s,
              tekst: t(`wlasciwosci.linia.${s}`),
            }))}
            wartosc={pole.stylLinii ?? 'ciagla'}
            zmien={(v) => ustaw({ stylLinii: v === 'ciagla' ? undefined : v })}
          />
        </Sekcja>
      );
    case 'tabela':
      return (
        <PanelTabeli
          szablon={szablon}
          tabela={pole}
          ustaw={ustaw}
          czcionki={czcionki}
          wiele={wiele}
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
  czcionki,
  wiele,
}: {
  szablon: Szablon;
  tabela: PoleTabela;
  ustaw: (z: Partial<Pole>, klucz?: string) => void;
  czcionki: Opcje;
  wiele: boolean;
}) {
  const id = tabela.id;
  const kol = tabela.kolumny;
  const zmienKolumny = (k: KolumnaTabeli[], klucz?: string) =>
    ustaw({ kolumny: k } as Partial<Pole>, klucz);
  const dodajKolumne = () => {
    // Klucz wolny także dla dalszych wierszy (klucz_2, klucz_3…).
    const zajete = kluczeSzablonu(szablon);
    let k = kluczZNazwy(`${tabela.nazwa || 'tabela'} ${kol.length + 1}`, zajete);
    for (
      let n = 2;
      kluczeTabeli({ ...tabela, kolumny: [{ naglowek: '', klucz: k }] }).some((x) => zajete.has(x));
      n++
    )
      k = kluczZNazwy(`${tabela.nazwa || 'tabela'} ${kol.length + n}`, zajete);
    zmienKolumny([...kol, { naglowek: String(kol.length + 1), klucz: k }]);
  };
  const przesun = (i: number, o: -1 | 1) => {
    const n = [...kol];
    [n[i], n[i + o]] = [n[i + o]!, n[i]!];
    zmienKolumny(n);
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
                        `kolumna:${id}:${i}`,
                      )
                    }
                  />
                </div>
                <Przelacznik
                  etykieta={t('tabela.szerokosc')}
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
                {k.szerokosc && k.szerokosc !== 'auto' && 'mm' in k.szerokosc && (
                  <Liczba
                    etykieta={t('rozmiar.liczba.mm')}
                    wartosc={k.szerokosc.mm}
                    max={300}
                    zmien={(v) =>
                      zmienKolumny(
                        kol.map((x, j) => (j === i ? { ...x, szerokosc: { mm: v } } : x)),
                        `kolszer:${id}:${i}`,
                      )
                    }
                  />
                )}
                <Przelacznik
                  etykieta={t('tabela.wyrownanie')}
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
                    onClick={() => zmienKolumny(kol.filter((_, j) => j !== i))}
                    aria-label={t('tabela.usunKolumne', { n: i + 1 })}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" onClick={dodajKolumne}>
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
                ustaw({
                  stylNaglowka: { ...tabela.stylNaglowka, wariant: v ? 'pogrubiony' : 'normalny' },
                } as Partial<Pole>)
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
          zmien={(r) =>
            ustaw({
              linie: r
                ? { ...r, ...(tabela.linie?.zewnetrzne === false ? { zewnetrzne: false } : {}) }
                : undefined,
            } as Partial<Pole>)
          }
        />
        {tabela.linie && (
          <Wybor
            etykieta={t('tabela.obwodka')}
            wartosc={tabela.linie.zewnetrzne !== false}
            zmien={(v) => {
              const { zewnetrzne: _z, ...reszta } = tabela.linie!;
              void _z;
              ustaw({ linie: v ? reszta : { ...reszta, zewnetrzne: false } } as Partial<Pole>);
            }}
          />
        )}
      </Sekcja>
      <Sekcja tytul={t('wlasciwosci.styl')}>
        <PanelStylu
          styl={tabela.styl}
          czcionki={czcionki}
          akapity={false}
          zmien={(s) => ustaw({ styl: s } as Partial<Pole>, `styl:${id}`)}
        />
      </Sekcja>
      {tabela.naglowki !== false && (
        <Sekcja tytul={t('tabela.stylNaglowkow')}>
          <PanelStylu
            styl={tabela.stylNaglowka ?? {}}
            bazowy={{ ...tabela.styl, wariant: 'pogrubiony' }}
            czcionki={czcionki}
            akapity={false}
            zmien={(s) => ustaw({ stylNaglowka: s } as Partial<Pole>, `stylnagl:${id}`)}
          />
        </Sekcja>
      )}
    </>
  );
}
