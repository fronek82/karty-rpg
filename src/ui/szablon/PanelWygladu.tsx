import { t } from '../../i18n';
import type { Obramowanie, Wezel, WyrownanieOsi } from '../../model/szablon';
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
}: {
  etykieta: string;
  ramka: R | undefined;
  /**
   * Zmiana jako funkcja ramki – przy kilku zaznaczonych stosowana do ramki każdego elementu
   * (zmienia się tylko ruszona właściwość, reszta – np. odsunięcie ramki karty – zostaje).
   */
  zmien: (f: (r: R | undefined) => R | undefined) => void;
  krawedzie?: boolean;
}) {
  const zmienRamke = (f: (r: R) => R) => zmien((r) => (r ? f(r) : r));
  return (
    <>
      <Wybor
        etykieta={etykieta}
        wartosc={!!ramka}
        zmien={(v) =>
          zmien((r) => (v ? (r ?? ({ grubosc: 0.3, kolor: '#000000' } as R)) : undefined))
        }
      />
      {ramka && (
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
            opcje={(['ciagla', 'przerywana', 'kropkowana'] as const).map((s) => ({
              wartosc: s,
              tekst: t(`wlasciwosci.linia.${s}`),
            }))}
            wartosc={ramka.styl ?? 'ciagla'}
            zmien={(v) => zmienRamke((r) => (v === 'ciagla' ? bez(r, 'styl') : { ...r, styl: v }))}
          />
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
    </>
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
