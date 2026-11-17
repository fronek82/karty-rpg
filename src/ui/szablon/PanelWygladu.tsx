import { useId } from 'react';
import { t } from '../../i18n';
import type { Narozniki, Obramowanie, Ozdoba, Wezel, WyrownanieOsi } from '../../model/szablon';
import { MOTYWY_WBUDOWANE, NAROZNIKI_WBUDOWANE, type ElementOzdobny } from '../../ozdobniki';
import { MiniaturaOzdobnika } from './MiniaturaOzdobnika';
import { Liczba, PoleKoloru, PoleOdstepow, Przelacznik, Sekcja, Wybor } from './Kontrolki';

type Zmiana = (f: (w: Wezel) => Wezel, klucz?: string) => void;

const bez = <T extends object>(o: T, k: keyof T): T => {
  const x = { ...o };
  delete x[k];
  return x;
};

/** Ramka z linii: grubość, kolor, styl linii, wybrane krawędzie. */
export function PoleRamki<R extends Obramowanie>({
  etykieta,
  ramka,
  zmien,
  krawedzie = true,
  rodzaj = false,
  narozniki,
  ozdoba,
}: {
  etykieta: string;
  ramka: R | undefined;
  /**
   * Zmiana jako funkcja ramki – przy kilku zaznaczonych stosowana do ramki każdego elementu
   * (zmienia się tylko ruszona właściwość, reszta – np. odsunięcie ramki karty – zostaje).
   */
  zmien: (f: (r: R | undefined) => R | undefined) => void;
  krawedzie?: boolean;
  /** Wybór rodzaju ramki (brak / linia / motyw / z obrazu) zamiast pola „włącz”. */
  rodzaj?: boolean;
  /** Wybór narożników (przy rodzaju „linia”); brak = bez narożników. */
  narozniki?: { wartosc: Narozniki | undefined; zmien: (n: Narozniki | undefined) => void };
  /**
   * Motyw zamiast linii (rodzaj „motyw”). `ramkaZostaje` – ramka karty trzyma odsunięcie i pola
   * linii także przy motywie; `odsuniecie` – pokaż własne pole odsunięcia ozdoby (węzły);
   * `promien` – ustawiono zaokrąglenie rogów (podpowiedź R3); `wylaczony` – rodzaj niedostępny
   * (np. kształt inny niż prostokąt).
   */
  ozdoba?: {
    wartosc: Ozdoba | undefined;
    zmien: (o: Ozdoba | undefined) => void;
    ramkaZostaje?: boolean;
    odsuniecie?: boolean;
    promien?: boolean;
    wylaczony?: boolean;
  };
}) {
  const zmienRamke = (f: (r: R) => R) => zmien((r) => (r ? f(r) : r));
  return (
    <>
      {rodzaj ? (
        <>
          <Przelacznik
            etykieta={etykieta}
            opcje={[
              { wartosc: 'brak', tekst: t('ramka.rodzaj.brak') },
              { wartosc: 'linia', tekst: t('ramka.rodzaj.linia') },
              {
                wartosc: 'motyw',
                tekst: t('ramka.rodzaj.motyw'),
                wylaczona: !ozdoba || (ozdoba.wylaczony && !ozdoba.wartosc),
              },
              { wartosc: 'obraz', tekst: t('ramka.rodzaj.obraz'), wylaczona: true },
            ]}
            wartosc={ozdoba?.wartosc ? 'motyw' : ramka ? 'linia' : 'brak'}
            zmien={(v) => {
              if (v === 'brak') {
                ozdoba?.zmien(undefined);
                zmien(() => undefined);
                narozniki?.zmien(undefined);
              } else if (v === 'linia') {
                ozdoba?.zmien(undefined);
                zmien((r) => r ?? ({ grubosc: 0.3, kolor: '#000000' } as R));
              } else if (v === 'motyw' && ozdoba) {
                if (ozdoba.ramkaZostaje)
                  zmien((r) => r ?? ({ grubosc: 0.3, kolor: '#000000' } as R));
                else zmien(() => undefined);
                ozdoba.zmien(
                  ozdoba.wartosc ?? {
                    rodzaj: 'motyw',
                    element: MOTYWY_WBUDOWANE[0]!.id,
                    szerokosc: 6,
                    kolor: ramka?.kolor ?? '#000000',
                  },
                );
              }
            }}
          />
          <p className="podpis">{t('ramka.wKolejnychEtapach')}</p>
        </>
      ) : (
        <Wybor
          etykieta={etykieta}
          wartosc={!!ramka}
          zmien={(v) =>
            zmien((r) => (v ? (r ?? ({ grubosc: 0.3, kolor: '#000000' } as R)) : undefined))
          }
        />
      )}
      {ozdoba?.wartosc && (
        <WyborMotywu
          ozdoba={ozdoba.wartosc}
          zmien={ozdoba.zmien}
          odsuniecie={!!ozdoba.odsuniecie}
          podpowiedz={!!ozdoba.promien}
        />
      )}
      {ramka && !ozdoba?.wartosc && (
        <>
          <div className="dwa-pola">
            <Liczba
              etykieta={t('wlasciwosci.grubosc')}
              wartosc={ramka.grubosc}
              krok={0.05}
              max={10}
              zmien={(v) => zmienRamke((r) => ({ ...r, grubosc: v }))}
            />
            <PoleKoloru
              etykieta={t('wlasciwosci.kolorLinii')}
              wartosc={ramka.kolor}
              moznaBrak={false}
              zmien={(v) => zmienRamke((r) => ({ ...r, kolor: v! }))}
            />
          </div>
          <Przelacznik
            etykieta={t('wlasciwosci.stylLinii')}
            opcje={(['ciagla', 'przerywana', 'kropkowana', 'podwojna'] as const).map((s) => ({
              wartosc: s,
              tekst: t(`wlasciwosci.linia.${s}`),
            }))}
            wartosc={ramka.styl ?? 'ciagla'}
            zmien={(v) => zmienRamke((r) => (v === 'ciagla' ? bez(r, 'styl') : { ...r, styl: v }))}
          />
          {ramka.styl === 'podwojna' && (
            <Liczba
              etykieta={t('wlasciwosci.przerwa')}
              wartosc={ramka.przerwa ?? 2 * ramka.grubosc}
              krok={0.05}
              max={10}
              zmien={(v) => zmienRamke((r) => ({ ...r, przerwa: v }))}
            />
          )}
          {krawedzie && (
            <fieldset className="krawedzie">
              <legend>{t('wlasciwosci.krawedzie')}</legend>
              {(['gora', 'prawo', 'dol', 'lewo'] as const).map((k) => (
                <Wybor
                  key={k}
                  etykieta={t(`wlasciwosci.strona.${k}`)}
                  wartosc={!ramka.krawedzie || !!ramka.krawedzie[k]}
                  zmien={(v) =>
                    zmienRamke((r) => {
                      const obecne = r.krawedzie ?? {
                        gora: true,
                        prawo: true,
                        dol: true,
                        lewo: true,
                      };
                      const n = { ...obecne, [k]: v };
                      const wszystkie = n.gora && n.prawo && n.dol && n.lewo;
                      return wszystkie ? bez(r, 'krawedzie') : { ...r, krawedzie: n };
                    })
                  }
                />
              ))}
            </fieldset>
          )}
        </>
      )}
      {narozniki && (ramka || ozdoba?.wartosc) && (
        <WyborNarozniki
          {...narozniki}
          kolorLinii={ozdoba?.wartosc?.kolor ?? ramka?.kolor ?? '#000000'}
          domyslnyRozmiar={ozdoba?.wartosc?.szerokosc ?? 6}
        />
      )}
    </>
  );
}

const NAZWY_NAROZNIKOW = {
  'wb:kat': 'narozniki.nazwa.kat',
  'wb:lisc': 'narozniki.nazwa.lisc',
  'wb:okucie': 'narozniki.nazwa.okucie',
  'wb:gwiazda': 'narozniki.nazwa.gwiazda',
  'wb:wezel': 'narozniki.nazwa.wezel',
  'wb:zawijas': 'narozniki.nazwa.zawijas',
} as const;

const NAZWY_MOTYWOW = {
  'wb:pnacze': 'motywy.nazwa.pnacze',
  'wb:przeplot': 'motywy.nazwa.przeplot',
  'wb:luski': 'motywy.nazwa.luski',
  'wb:runy': 'motywy.nazwa.runy',
  'wb:lancuch': 'motywy.nazwa.lancuch',
  'wb:gwiazdki': 'motywy.nazwa.gwiazdki',
} as const;

const NAZWY_SEPARATOROW = {
  'wb:zak-grot': 'zakonczenia.nazwa.grot',
  'wb:zak-zawijas': 'zakonczenia.nazwa.zawijas',
  'wb:zak-lisc': 'zakonczenia.nazwa.lisc',
  'wb:zak-kropka': 'zakonczenia.nazwa.kropka',
  'wb:zak-kolec': 'zakonczenia.nazwa.kolec',
  'wb:sr-romb': 'srodek.nazwa.romb',
  'wb:sr-gwiazda': 'srodek.nazwa.gwiazda',
  'wb:sr-lisc': 'srodek.nazwa.lisc',
  'wb:sr-kropka': 'srodek.nazwa.kropka',
} as const;

/** Nazwa elementu dla użytkownika: własna albo z i18n (wbudowane). */
export function nazwaElementu(e: ElementOzdobny): string {
  const klucz =
    NAZWY_NAROZNIKOW[e.id as keyof typeof NAZWY_NAROZNIKOW] ??
    NAZWY_MOTYWOW[e.id as keyof typeof NAZWY_MOTYWOW] ??
    NAZWY_SEPARATOROW[e.id as keyof typeof NAZWY_SEPARATOROW];
  return e.nazwa ?? (klucz ? t(klucz) : e.id);
}

/** Wybór motywu z listy miniatur oraz szerokość pasa, szyny, odsunięcie i kolor. */
function WyborMotywu({
  ozdoba,
  zmien,
  odsuniecie,
  podpowiedz,
}: {
  ozdoba: Ozdoba;
  zmien: (o: Ozdoba) => void;
  odsuniecie: boolean;
  podpowiedz: boolean;
}) {
  const idEtykiety = useId();
  const ustaw = (z: Partial<Ozdoba>) => zmien({ ...ozdoba, ...z });
  return (
    <div className="pole-panelu">
      <span id={idEtykiety}>{t('motywy.tytul')}</span>
      <div className="wybor-narozniki" role="group" aria-labelledby={idEtykiety}>
        {MOTYWY_WBUDOWANE.map((e) => (
          <button
            key={e.id}
            type="button"
            aria-pressed={ozdoba.element === e.id}
            aria-label={nazwaElementu(e)}
            style={{ color: ozdoba.kolor }}
            onClick={() => ustaw({ element: e.id })}
          >
            <MiniaturaOzdobnika element={e} />
            <small>{nazwaElementu(e)}</small>
          </button>
        ))}
      </div>
      <div className="dwa-pola">
        <Liczba
          etykieta={t('motywy.szerokosc')}
          wartosc={ozdoba.szerokosc}
          min={1}
          max={30}
          krok={0.5}
          zmien={(v) => ustaw({ szerokosc: v })}
        />
        <PoleKoloru
          etykieta={t('motywy.kolor')}
          wartosc={ozdoba.kolor}
          moznaBrak={false}
          zmien={(v) => ustaw({ kolor: v! })}
        />
      </div>
      <div className="dwa-pola">
        <Liczba
          etykieta={t('motywy.szyny')}
          wartosc={ozdoba.szyny ?? 0}
          max={3}
          krok={0.05}
          zmien={(v) => zmien(v > 0 ? { ...ozdoba, szyny: v } : bez(ozdoba, 'szyny'))}
        />
        {odsuniecie && (
          <Liczba
            etykieta={t('motywy.odsuniecie')}
            wartosc={ozdoba.odsuniecie ?? 0}
            max={30}
            krok={0.5}
            zmien={(v) => zmien(v > 0 ? { ...ozdoba, odsuniecie: v } : bez(ozdoba, 'odsuniecie'))}
          />
        )}
      </div>
      {podpowiedz && (
        <p className="podpis" role="note">
          {t('motywy.podpowiedzPromien')}
        </p>
      )}
    </div>
  );
}

/** Wybór narożnika z biblioteki (miniatury), jego rozmiaru i koloru. */
function WyborNarozniki({
  wartosc,
  zmien,
  kolorLinii,
  domyslnyRozmiar,
}: {
  wartosc: Narozniki | undefined;
  zmien: (n: Narozniki | undefined) => void;
  kolorLinii: string;
  /** Rozmiar nowego narożnika: przy motywie – szerokość pasa (narożnik wypełnia kostkę). */
  domyslnyRozmiar: number;
}) {
  const idEtykiety = useId();
  const ustaw = (z: Partial<Narozniki>) => wartosc && zmien({ ...wartosc, ...z });
  return (
    <div className="pole-panelu">
      <span id={idEtykiety}>{t('narozniki.tytul')}</span>
      <div className="wybor-narozniki" role="group" aria-labelledby={idEtykiety}>
        <button
          type="button"
          aria-pressed={!wartosc}
          aria-label={t('narozniki.brak')}
          onClick={() => zmien(undefined)}
        >
          <span aria-hidden="true">–</span>
          <small>{t('narozniki.brak')}</small>
        </button>
        {NAROZNIKI_WBUDOWANE.map((e) => (
          <button
            key={e.id}
            type="button"
            aria-pressed={wartosc?.element === e.id}
            aria-label={nazwaElementu(e)}
            style={{ color: wartosc?.kolor ?? kolorLinii }}
            onClick={() =>
              zmien(
                wartosc
                  ? { ...wartosc, element: e.id }
                  : { element: e.id, rozmiar: domyslnyRozmiar },
              )
            }
          >
            <MiniaturaOzdobnika element={e} />
            <small>{nazwaElementu(e)}</small>
          </button>
        ))}
      </div>
      {wartosc && (
        <div className="dwa-pola">
          <Liczba
            etykieta={t('narozniki.rozmiar')}
            wartosc={wartosc.rozmiar}
            min={1}
            max={30}
            krok={0.5}
            zmien={(v) => ustaw({ rozmiar: v })}
          />
          <PoleKoloru
            etykieta={t('narozniki.kolor')}
            wartosc={wartosc.kolor}
            domyslny={kolorLinii}
            zmien={(v) =>
              wartosc && zmien(v === undefined ? bez(wartosc, 'kolor') : { ...wartosc, kolor: v })
            }
          />
        </div>
      )}
    </div>
  );
}

/**
 * Wygląd i odstępy dowolnego elementu: tło, ramka z linii, zaokrąglenie, margines zewnętrzny,
 * padding, położenie w rodzicu i najmniejszy rozmiar.
 */
export function PanelWygladu({ wezel, zmien }: { wezel: Wezel; zmien: Zmiana }) {
  const id = wezel.id;
  const ustaw = <K extends keyof Wezel>(k: K, v: Wezel[K] | undefined, klucz?: string) =>
    zmien((w) => (v === undefined ? bez(w, k) : ({ ...w, [k]: v } as Wezel)), klucz);
  const wyr = wezel.wyrownanie ?? {};
  // Kształty wartości: promień i wybór krawędzi dotyczą tylko prostokątów (ścięte – wielkość ścięcia).
  const ksztalt = wezel.typ === 'wartosc' ? wezel.ksztalt : undefined;
  const ksztaltSciezki =
    !!ksztalt && ['kolo', 'romb', 'tarcza', 'szesciokat', 'sciety'].includes(ksztalt);
  const sciety = ksztalt === 'sciety';
  const bezPromienia = ksztaltSciezki && !sciety;
  const ustawWyr = (os: 'poziomo' | 'pionowo', v: WyrownanieOsi | 'rozciagnij') =>
    zmien((w) => {
      const n = { ...(w.wyrownanie ?? {}) };
      if (v === 'rozciagnij') delete n[os];
      else n[os] = v;
      const x = { ...w, wyrownanie: n } as Wezel;
      if (!n.poziomo && !n.pionowo) delete x.wyrownanie;
      return x;
    });
  const opcjeWyr = (os: 'poziomo' | 'pionowo') =>
    (['rozciagnij', 'poczatek', 'srodek', 'koniec'] as const).map((v) => ({
      wartosc: v,
      tekst: t(`wlasciwosci.wyr.${os}.${v}`),
    }));
  return (
    <>
      <Sekcja tytul={t('wlasciwosci.wyglad')}>
        <PoleKoloru
          etykieta={t('wlasciwosci.tlo')}
          wartosc={wezel.tlo}
          domyslny="#ffffff"
          zmien={(v) => ustaw('tlo', v, `tlo:${id}`)}
        />
        <PoleRamki
          etykieta={t('wlasciwosci.ramka')}
          ramka={wezel.obramowanie}
          krawedzie={!ksztaltSciezki}
          rodzaj
          narozniki={{
            wartosc: wezel.narozniki,
            zmien: (n) => ustaw('narozniki', n, `narozniki:${id}`),
          }}
          ozdoba={{
            wartosc: wezel.ozdoba,
            zmien: (o) => ustaw('ozdoba', o, `ozdoba:${id}`),
            odsuniecie: true,
            promien: (wezel.promien ?? 0) > 0,
            wylaczony: ksztaltSciezki,
          }}
          zmien={(f) =>
            zmien((w) => {
              const r = f(w.obramowanie);
              return r ? ({ ...w, obramowanie: r } as Wezel) : bez(w, 'obramowanie');
            }, `ramka:${id}`)
          }
        />
        {!bezPromienia && (
          <Liczba
            etykieta={t(sciety ? 'wlasciwosci.sciecie' : 'wlasciwosci.promien')}
            wartosc={wezel.promien ?? 0}
            max={50}
            zmien={(v) => ustaw('promien', v || undefined, `promien:${id}`)}
          />
        )}
      </Sekcja>
      <Sekcja tytul={t('wlasciwosci.odstepy')}>
        <PoleOdstepow
          etykieta={t('wlasciwosci.margines')}
          wartosc={wezel.margines}
          min={-50}
          zmien={(f) =>
            zmien((w) => {
              const v = f(w.margines);
              return v === 0 ? bez(w, 'margines') : ({ ...w, margines: v } as Wezel);
            }, `margines:${id}`)
          }
        />
        <PoleOdstepow
          etykieta={t('szablon.padding')}
          wartosc={wezel.padding}
          zmien={(f) =>
            zmien((w) => {
              const v = f(w.padding);
              return v === 0 ? bez(w, 'padding') : ({ ...w, padding: v } as Wezel);
            }, `padding:${id}`)
          }
        />
        <Przelacznik
          etykieta={t('wlasciwosci.wyrownaniePoziome')}
          opcje={opcjeWyr('poziomo')}
          wartosc={wyr.poziomo ?? 'rozciagnij'}
          zmien={(v) => ustawWyr('poziomo', v)}
        />
        <Przelacznik
          etykieta={t('wlasciwosci.wyrownaniePionowe')}
          opcje={opcjeWyr('pionowo')}
          wartosc={wyr.pionowo ?? 'rozciagnij'}
          zmien={(v) => ustawWyr('pionowo', v)}
        />
        <div className="dwa-pola">
          <Liczba
            etykieta={t('wlasciwosci.minSzerokosc')}
            wartosc={wezel.minSzerokosc ?? 0}
            zmien={(v) => ustaw('minSzerokosc', v || undefined, `minsz:${id}`)}
          />
          <Liczba
            etykieta={t('wlasciwosci.minWysokosc')}
            wartosc={wezel.minWysokosc ?? 0}
            zmien={(v) => ustaw('minWysokosc', v || undefined, `minwy:${id}`)}
          />
        </div>
      </Sekcja>
    </>
  );
}
