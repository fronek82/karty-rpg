import { useRef, useState, type ReactNode } from 'react';
import { t } from '../../i18n';
import {
  DOMYSLNE_TLO_KARTY,
  type Kolor,
  type RodzajWzoruTla,
  type UkladWzoruTla,
  type WzorTla,
} from '../../model/szablon';
import { czyJednokolorowy } from '../../ozdobniki/narozniki';
import { czyWbudowany } from '../../ozdobniki/katalog';
import type { ElementOzdobny } from '../../ozdobniki/typy';
import { konturNaD } from '../../silnik/svg';
import {
  DOMYSLNY_ROZMIAR_KAFELKA,
  DOMYSLNY_WZOR_TLA,
  elementyWzoruTla,
} from '../../silnik/wzorTla';
import { zapiszOzdobnikWBibliotece } from '../bazaUI';
import { paczkaOzdobnikaZPliku } from '../biblioteki/plikiOzdobnikow';
import { useAdresBiblioteki, useElementyWlasne, useWyjscieDoBiblioteki } from './elementyWlasne';
import { Liczba, Lista, PoleKoloru, Przelacznik, Sekcja, Wybor } from './Kontrolki';
import { MiniaturaOzdobnika } from './MiniaturaOzdobnika';
import { nazwaElementu } from './PanelWygladu';

/** Część strony (awersu albo rewersu) opisująca tło karty. */
export interface StanTla {
  tlo?: Kolor;
  teksturaTla?: string;
  wzorTla?: WzorTla;
}

export type TrybTlaKarty = 'brak' | 'kolor' | 'obraz' | 'wzor';

const RODZAJE: readonly Exclude<RodzajWzoruTla, 'svg'>[] = [
  'pionowe',
  'poziome',
  'kratka',
  'romby',
  'ukosne',
  'kropki',
];
const BIALY = DOMYSLNE_TLO_KARTY;
const UKLADY: readonly UkladWzoruTla[] = ['siatka', 'cegielka', 'pion'];

/** Grafiki biblioteki użytkownika, które mogą być wzorem tła (rysunek SVG, bez wbudowanych). */
export const grafikiWzoru = (elementy: readonly ElementOzdobny[]) =>
  elementy.filter((e) => !czyWbudowany(e.id) && e.kontury.length > 0);

/** Miniatura wbudowanego wzoru – ten sam silnik co na karcie (kolor tekstu przycisku). */
function MiniaturaWzoru({ rodzaj }: { rodzaj: Exclude<RodzajWzoruTla, 'svg'> }) {
  const kropki = rodzaj === 'kropki';
  const [e] = elementyWzoruTla(
    { ...DOMYSLNY_WZOR_TLA, rodzaj, grubosc: kropki ? 1.2 : 0.4, odstep: 3 },
    { x: 0, y: 0, szer: 12, wys: 12 },
  );
  if (e?.typ !== 'sciezka') return null;
  return (
    <svg
      className="miniatura-ozdobnika"
      viewBox="0 0 12 12"
      width={32}
      height={32}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={konturNaD(e.kontur)}
        fill={e.wypelnienie ? 'currentColor' : 'none'}
        stroke={e.obrys ? 'currentColor' : 'none'}
        strokeWidth={e.obrys?.grubosc}
      />
    </svg>
  );
}

/** Zmiana pola opcjonalnego wzoru: wartość domyślna usuwa pole (zapis bez zbędnych kluczy). */
function zPolem<K extends keyof WzorTla>(
  w: WzorTla,
  klucz: K,
  v: WzorTla[K],
  domyslna: WzorTla[K],
): WzorTla {
  const { [klucz]: _stare, ...reszta } = w;
  void _stare;
  return v === undefined || v === domyslna
    ? (reszta as WzorTla)
    : ({ ...reszta, [klucz]: v } as unknown as WzorTla);
}

/** Czy dwa stany tła są takie same (bez zmiany – bez wpisu „Cofnij” i zapisu). */
export function tenSamStanTla(a: StanTla, b: StanTla): boolean {
  return (
    a.tlo === b.tlo &&
    a.teksturaTla === b.teksturaTla &&
    JSON.stringify(a.wzorTla) === JSON.stringify(b.wzorTla)
  );
}

export function trybTla(s: StanTla): TrybTlaKarty {
  if (s.wzorTla) return 'wzor';
  if (s.teksturaTla) return 'obraz';
  return s.tlo ? 'kolor' : 'brak';
}

/** Przejście do innego trybu tła: zachowuje to, co w nowym trybie ma sens (wzór łączy się z teksturą). */
export function zmienTrybTla(s: StanTla, tryb: TrybTlaKarty, pierwszyObraz?: string): StanTla {
  const { tlo, teksturaTla, wzorTla } = s;
  switch (tryb) {
    case 'brak':
      return {};
    case 'kolor':
      return { tlo: tlo ?? BIALY };
    case 'obraz': {
      const tekstura = teksturaTla ?? pierwszyObraz;
      return { ...(tlo ? { tlo } : {}), ...(tekstura ? { teksturaTla: tekstura } : {}) };
    }
    case 'wzor':
      return {
        tlo: tlo ?? BIALY,
        ...(teksturaTla ? { teksturaTla } : {}),
        wzorTla: wzorTla ?? { ...DOMYSLNY_WZOR_TLA },
      };
  }
}

/**
 * Sekcja „Tło karty” panelu karty (awers i rewers): brak / kolor / obraz / wzór. `dodatkiObrazu`
 * – opcje tekstury właściwe dla strony (np. tryb i krycie w rewersie), `dodatkiKoloru` – np. kolor
 * z danych w awersie.
 */
export function SekcjaTlaKarty({
  stan,
  obrazy,
  zmien,
  dodatkiObrazu,
  dodatkiKoloru,
  wgrywanieObrazu,
  idKoloru,
}: {
  stan: StanTla;
  obrazy: readonly { wartosc: string; tekst: string }[];
  zmien: (f: (s: StanTla) => StanTla, klucz?: string) => void;
  dodatkiObrazu?: ReactNode;
  dodatkiKoloru?: ReactNode;
  /** Przycisk wgrania nowego obrazu tła (rewers) – widoczny także bez wybranej tekstury. */
  wgrywanieObrazu?: ReactNode;
  idKoloru?: string;
}) {
  const pochodny = trybTla(stan);
  // „Obraz” bez obrazów w projekcie nie zmienia modelu – zapamiętujemy wybór, póki model ten sam.
  const [wymuszony, ustawWymuszony] = useState<{ tryb: TrybTlaKarty; przy: TrybTlaKarty }>();
  const tryb = wymuszony && wymuszony.przy === pochodny ? wymuszony.tryb : pochodny;
  const wzor = stan.wzorTla;
  const opcjeObrazow = [{ wartosc: '', tekst: t('dekoracje.brakTekstury') }, ...obrazy];
  if (stan.teksturaTla && !opcjeObrazow.some((o) => o.wartosc === stan.teksturaTla))
    opcjeObrazow.push({
      wartosc: stan.teksturaTla,
      tekst: t('dekoracje.brakZasobu', { id: stan.teksturaTla }),
    });
  const zmienWzor = (f: (w: WzorTla) => WzorTla, klucz: string) =>
    zmien((s) => (s.wzorTla ? { ...s, wzorTla: f(s.wzorTla) } : s), `wzor-${klucz}`);
  const wyborTekstury = (
    <>
      <Lista
        etykieta={tryb === 'wzor' ? t('tloKarty.teksturaPodWzorem') : t('dekoracje.tekstura')}
        opcje={opcjeObrazow}
        wartosc={stan.teksturaTla ?? ''}
        zmien={(v) => {
          const x = { ...stan };
          if (v) x.teksturaTla = v;
          else delete x.teksturaTla;
          // Bez tekstury w trybie „Obraz” zostajemy w nim (lista nie znika).
          const po = trybTla(x);
          ustawWymuszony(po === tryb ? undefined : { tryb, przy: po });
          zmien((s) => {
            const y = { ...s };
            if (v) y.teksturaTla = v;
            else delete y.teksturaTla;
            return y;
          });
        }}
      />
      {obrazy.length === 0 && !wgrywanieObrazu && <p className="podpis">{t('dekoracje.obrazy')}</p>}
      {wgrywanieObrazu}
      {stan.teksturaTla && dodatkiObrazu}
    </>
  );
  return (
    <Sekcja tytul={t('tloKarty.tytul')} otwarta>
      <Przelacznik
        etykieta={t('tloKarty.rodzaj')}
        opcje={(['brak', 'kolor', 'obraz', 'wzor'] as const).map((w) => ({
          wartosc: w,
          tekst: t(`tloKarty.${w}`),
        }))}
        wartosc={tryb}
        zmien={(nowy) => {
          const wynik = zmienTrybTla(stan, nowy, obrazy[0]?.wartosc);
          const po = trybTla(wynik);
          ustawWymuszony(po === nowy ? undefined : { tryb: nowy, przy: po });
          zmien((s) => zmienTrybTla(s, nowy, obrazy[0]?.wartosc));
        }}
      />
      {tryb !== 'brak' && (
        <PoleKoloru
          etykieta={tryb === 'kolor' ? t('kreator.kolor') : t('tloKarty.kolorTla')}
          wartosc={stan.tlo}
          domyslny={BIALY}
          {...(idKoloru ? { id: idKoloru } : {})}
          moznaBrak={tryb !== 'kolor'}
          zmien={(v) =>
            zmien((s) => {
              const x = { ...s };
              if (v) x.tlo = v;
              else delete x.tlo;
              return x;
            }, 'tlo')
          }
        />
      )}
      {dodatkiKoloru}
      {tryb === 'obraz' && wyborTekstury}
      {tryb === 'wzor' && wzor && (
        <>
          <WyborWzoru
            wzor={wzor}
            wybierzWbudowany={(rodzaj) =>
              zmienWzor((w) => {
                const { element: _e, ...reszta } = w;
                void _e;
                return { ...reszta, rodzaj };
              }, 'rodzaj')
            }
            wybierzGrafike={(element) =>
              zmienWzor(
                (w) => ({
                  ...w,
                  rodzaj: 'svg',
                  element,
                  rozmiar: w.rozmiar ?? DOMYSLNY_ROZMIAR_KAFELKA,
                }),
                'rodzaj',
              )
            }
          />
          {wzor.rodzaj === 'svg' ? (
            <>
              <div className="dwa-pola">
                <Liczba
                  etykieta={t('tloKarty.rozmiarKafelka')}
                  wartosc={wzor.rozmiar ?? DOMYSLNY_ROZMIAR_KAFELKA}
                  min={1}
                  max={200}
                  krok={0.5}
                  zmien={(rozmiar) => zmienWzor((w) => ({ ...w, rozmiar }), 'rozmiar')}
                />
              </div>
              <div className="dwa-pola">
                {(['odstepX', 'odstepY'] as const).map((k) => (
                  <Liczba
                    key={k}
                    etykieta={t(`tloKarty.${k}`)}
                    wartosc={wzor[k] ?? 0}
                    min={0}
                    max={200}
                    krok={0.5}
                    zmien={(v) => zmienWzor((w) => zPolem(w, k, v, 0), k)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="dwa-pola">
              <Liczba
                etykieta={wzor.rodzaj === 'kropki' ? t('tloKarty.srednica') : t('tloKarty.grubosc')}
                wartosc={wzor.grubosc}
                min={0.05}
                max={50}
                krok={0.05}
                zmien={(grubosc) => zmienWzor((w) => ({ ...w, grubosc }), 'grubosc')}
              />
              <Liczba
                etykieta={t('tloKarty.odstep')}
                wartosc={wzor.odstep}
                min={0.5}
                max={200}
                krok={0.5}
                zmien={(odstep) => zmienWzor((w) => ({ ...w, odstep }), 'odstep')}
              />
            </div>
          )}
          {(wzor.rodzaj === 'svg' || wzor.rodzaj === 'kropki') && (
            <Przelacznik
              etykieta={t('tloKarty.uklad')}
              opcje={UKLADY.map((u) => ({ wartosc: u, tekst: t(`tloKarty.uklad.${u}`) }))}
              wartosc={wzor.uklad ?? 'siatka'}
              zmien={(uklad) => zmienWzor((w) => zPolem(w, 'uklad', uklad, 'siatka'), 'uklad')}
            />
          )}
          <KolorWzoru wzor={wzor} zmien={(kolor) => zmienWzor((w) => ({ ...w, kolor }), 'kolor')} />
          <div className="dwa-pola">
            <Liczba
              etykieta={t('tloKarty.przezroczystosc')}
              wartosc={Math.round((1 - (wzor.krycie ?? 1)) * 100)}
              min={0}
              max={100}
              krok={5}
              zmien={(v) =>
                zmienWzor((w) => {
                  const krycie = 1 - Math.max(0, Math.min(100, Math.round(v))) / 100;
                  const { krycie: _k, ...reszta } = w;
                  void _k;
                  return krycie >= 1 ? reszta : { ...reszta, krycie };
                }, 'krycie')
              }
            />
            <Liczba
              etykieta={t('tloKarty.obrot')}
              wartosc={wzor.obrot ?? 0}
              min={-180}
              max={180}
              krok={5}
              zmien={(obrot) =>
                zmienWzor((w) => {
                  const { obrot: _o, ...reszta } = w;
                  void _o;
                  return obrot ? { ...reszta, obrot } : reszta;
                }, 'obrot')
              }
            />
          </div>
          <div className="dwa-pola">
            {(['x', 'y'] as const).map((os) => (
              <Liczba
                key={os}
                etykieta={t(os === 'x' ? 'tloKarty.przesuniecieX' : 'tloKarty.przesuniecieY')}
                wartosc={wzor.przesuniecie?.[os] ?? 0}
                min={-200}
                max={200}
                krok={0.5}
                zmien={(v) =>
                  zmienWzor((w) => {
                    const p = { x: 0, y: 0, ...w.przesuniecie, [os]: v };
                    const { przesuniecie: _p, ...reszta } = w;
                    void _p;
                    return p.x || p.y ? { ...reszta, przesuniecie: p } : reszta;
                  }, `przesuniecie-${os}`)
                }
              />
            ))}
          </div>
          {wyborTekstury}
          {stan.teksturaTla && (
            <Wybor
              etykieta={t('tloKarty.podTekstura')}
              wartosc={!!wzor.podTekstura}
              zmien={(v) =>
                zmienWzor((w) => {
                  const { podTekstura: _p, ...reszta } = w;
                  void _p;
                  return v ? { ...reszta, podTekstura: true } : reszta;
                }, 'kolejnosc')
              }
            />
          )}
        </>
      )}
    </Sekcja>
  );
}

/** Kolor wzoru: dla grafiki z biblioteki tylko jednokolorowej (podmiana wypełnień i obrysów). */
function KolorWzoru({ wzor, zmien }: { wzor: WzorTla; zmien: (k: Kolor) => void }) {
  const elementy = useElementyWlasne();
  const grafika = wzor.rodzaj === 'svg' ? elementy.find((e) => e.id === wzor.element) : undefined;
  const wielokolorowy = grafika !== undefined && !czyJednokolorowy(grafika);
  return (
    <PoleKoloru
      etykieta={
        wzor.rodzaj === 'svg'
          ? t('tloKarty.kolorWzoru')
          : wzor.rodzaj === 'kropki'
            ? t('tloKarty.kolorKropek')
            : t('tloKarty.kolorLinii')
      }
      wartosc={wzor.kolor}
      moznaBrak={false}
      {...(wielokolorowy ? { wylaczone: { powod: t('tloKarty.tylkoJednokolorowe') } } : {})}
      zmien={(kolor) => kolor && zmien(kolor)}
    />
  );
}

/**
 * Wybór wzoru w dwóch grupach: „Wbudowane” (linie, kratka, kropki…) i „Z biblioteki” (grafiki SVG
 * biblioteki użytkownika, przewijana siatka) z kafelkiem „+”, który dodaje plik .svg do biblioteki
 * jej zwykłym importem i od razu ustawia go jako wzór. Brak wybranej grafiki – ostrzeżenie.
 */
function WyborWzoru({
  wzor,
  wybierzWbudowany,
  wybierzGrafike,
}: {
  wzor: WzorTla;
  wybierzWbudowany: (r: Exclude<RodzajWzoruTla, 'svg'>) => void;
  wybierzGrafike: (id: string) => void;
}) {
  const grafiki = grafikiWzoru(useElementyWlasne());
  const adresBiblioteki = useAdresBiblioteki();
  const wyjdzDoBiblioteki = useWyjscieDoBiblioteki();
  const plik = useRef<HTMLInputElement>(null);
  const [komunikat, ustawKomunikat] = useState<{ tekst: string; blad?: boolean }>();
  const [dodawany, ustawDodawany] = useState<string>();
  const brakGrafiki =
    wzor.rodzaj === 'svg' &&
    wzor.element !== dodawany &&
    !grafiki.some((e) => e.id === wzor.element);
  const dodaj = async (f: File) => {
    ustawKomunikat(undefined);
    try {
      const { id, nazwa } = await zapiszOzdobnikWBibliotece(await paczkaOzdobnikaZPliku(f));
      // Lista biblioteki odświeża się chwilę później (liveQuery) – do tego czasu bez ostrzeżenia.
      ustawDodawany(id);
      wybierzGrafike(id);
      ustawKomunikat({ tekst: t('tloKarty.dodano', { nazwa }) });
    } catch (e) {
      ustawKomunikat({ tekst: e instanceof Error ? e.message : String(e), blad: true });
    }
  };
  return (
    <div className="pole-panelu">
      <span id="wzor-tla-wbudowane">{t('tloKarty.wzor')}</span>
      <div
        className="wybor-narozniki"
        role="group"
        aria-labelledby="wzor-tla-wbudowane"
        data-testid="wzory-wbudowane"
      >
        <span className="grupa-ozdobnikow">{t('tloKarty.grupaWbudowane')}</span>
        {RODZAJE.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={wzor.rodzaj === r}
            aria-label={t(`tloKarty.wzor.${r}`)}
            onClick={() => wybierzWbudowany(r)}
          >
            <MiniaturaWzoru rodzaj={r} />
            <small>{t(`tloKarty.wzor.${r}`)}</small>
          </button>
        ))}
      </div>
      <div
        className="wybor-narozniki wzory-biblioteki"
        role="group"
        aria-label={t('tloKarty.grupaBiblioteka')}
        data-testid="wzory-biblioteki"
      >
        <span className="grupa-ozdobnikow">{t('tloKarty.grupaBiblioteka')}</span>
        {grafiki.map((e) => (
          <button
            key={e.id}
            type="button"
            aria-pressed={wzor.rodzaj === 'svg' && wzor.element === e.id}
            aria-label={nazwaElementu(e)}
            title={nazwaElementu(e)}
            onClick={() => wybierzGrafike(e.id)}
          >
            <MiniaturaOzdobnika element={e} />
            <small>{nazwaElementu(e)}</small>
          </button>
        ))}
        <button
          type="button"
          className="kafelek-dodaj"
          aria-label={t('tloKarty.dodajSvg')}
          title={t('tloKarty.dodajSvg')}
          data-testid="dodaj-wzor-svg"
          onClick={() => plik.current?.click()}
        >
          <span aria-hidden="true">＋</span>
          <small>SVG</small>
        </button>
      </div>
      <input
        ref={plik}
        type="file"
        accept=".svg,image/svg+xml"
        hidden
        data-testid="plik-wzoru-svg"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void dodaj(f);
        }}
      />
      <a href={adresBiblioteki} onClick={wyjdzDoBiblioteki}>
        {t('biblioteka.otworz')}
      </a>
      {komunikat && (
        <p
          role={komunikat.blad ? 'alert' : 'status'}
          className={komunikat.blad ? 'uwaga' : 'podpis'}
        >
          {komunikat.tekst}
        </p>
      )}
      {brakGrafiki && (
        <p role="alert" className="uwaga" data-testid="brak-grafiki-wzoru">
          {t('tloKarty.brakGrafiki')}
        </p>
      )}
    </div>
  );
}
