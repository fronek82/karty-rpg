import { t } from '../../i18n';
import type { Obramowanie, Odstepy, Wezel, WyrownanieOsi } from '../../model/szablon';
import { Liczba, PoleKoloru, PoleOdstepow, Przelacznik, Sekcja, Wybor } from './Kontrolki';

type Zmiana = (f: (w: Wezel) => Wezel, klucz?: string) => void;

const bez = <T extends object>(o: T, k: keyof T): T => {
  const x = { ...o };
  delete x[k];
  return x;
};

/** Ramka z linii: grubość, kolor, styl linii, wybrane krawędzie. */
export function PoleRamki({
  etykieta,
  ramka,
  zmien,
  krawedzie = true,
}: {
  etykieta: string;
  ramka: Obramowanie | undefined;
  zmien: (r: Obramowanie | undefined) => void;
  krawedzie?: boolean;
}) {
  return (
    <>
      <Wybor
        etykieta={etykieta}
        wartosc={!!ramka}
        zmien={(v) => zmien(v ? { grubosc: 0.3, kolor: '#000000' } : undefined)}
      />
      {ramka && (
        <>
          <div className="dwa-pola">
            <Liczba
              etykieta={t('wlasciwosci.grubosc')}
              wartosc={ramka.grubosc}
              krok={0.05}
              max={10}
              zmien={(v) => zmien({ ...ramka, grubosc: v })}
            />
            <PoleKoloru
              etykieta={t('wlasciwosci.kolorLinii')}
              wartosc={ramka.kolor}
              moznaBrak={false}
              zmien={(v) => zmien({ ...ramka, kolor: v! })}
            />
          </div>
          <Przelacznik
            etykieta={t('wlasciwosci.stylLinii')}
            opcje={(['ciagla', 'przerywana', 'kropkowana'] as const).map((s) => ({
              wartosc: s,
              tekst: t(`wlasciwosci.linia.${s}`),
            }))}
            wartosc={ramka.styl ?? 'ciagla'}
            zmien={(v) => zmien(v === 'ciagla' ? bez(ramka, 'styl') : { ...ramka, styl: v })}
          />
          {krawedzie && (
            <fieldset className="krawedzie">
              <legend>{t('wlasciwosci.krawedzie')}</legend>
              {(['gora', 'prawo', 'dol', 'lewo'] as const).map((k) => (
                <Wybor
                  key={k}
                  etykieta={t(`wlasciwosci.strona.${k}`)}
                  wartosc={!ramka.krawedzie || !!ramka.krawedzie[k]}
                  zmien={(v) => {
                    const obecne = ramka.krawedzie ?? {
                      gora: true,
                      prawo: true,
                      dol: true,
                      lewo: true,
                    };
                    const n = { ...obecne, [k]: v };
                    const wszystkie = n.gora && n.prawo && n.dol && n.lewo;
                    zmien(wszystkie ? bez(ramka, 'krawedzie') : { ...ramka, krawedzie: n });
                  }}
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
          zmien={(r) => ustaw('obramowanie', r, `ramka:${id}`)}
        />
        <Liczba
          etykieta={t('wlasciwosci.promien')}
          wartosc={wezel.promien ?? 0}
          max={50}
          zmien={(v) => ustaw('promien', v || undefined, `promien:${id}`)}
        />
      </Sekcja>
      <Sekcja tytul={t('wlasciwosci.odstepy')}>
        <PoleOdstepow
          etykieta={t('wlasciwosci.margines')}
          wartosc={wezel.margines}
          min={-50}
          zmien={(v: number | Odstepy) =>
            ustaw('margines', v === 0 ? undefined : v, `margines:${id}`)
          }
        />
        <PoleOdstepow
          etykieta={t('szablon.padding')}
          wartosc={wezel.padding}
          zmien={(v: number | Odstepy) =>
            ustaw('padding', v === 0 ? undefined : v, `padding:${id}`)
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
