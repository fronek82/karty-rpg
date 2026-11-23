import { useState, type ReactNode } from 'react';
import { t } from '../../i18n';
import type { Kolor, RodzajWzoruTla, WzorTla } from '../../model/szablon';
import { DOMYSLNY_WZOR_TLA } from '../../silnik/wzorTla';
import { Liczba, Lista, PoleKoloru, Przelacznik, Sekcja, Wybor } from './Kontrolki';

/** Część strony (awersu albo rewersu) opisująca tło karty. */
export interface StanTla {
  tlo?: Kolor;
  teksturaTla?: string;
  wzorTla?: WzorTla;
}

export type TrybTlaKarty = 'brak' | 'kolor' | 'obraz' | 'wzor';

const RODZAJE: readonly RodzajWzoruTla[] = [
  'pionowe',
  'poziome',
  'kratka',
  'romby',
  'ukosne',
  'kropki',
];
const BIALY = '#ffffff';

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
        zmien={(v) =>
          zmien((s) => {
            const x = { ...s };
            if (v) x.teksturaTla = v;
            else delete x.teksturaTla;
            return x;
          })
        }
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
          zmien((s) => zmienTrybTla(s, nowy, obrazy[0]?.wartosc), 'tryb-tla');
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
          <Lista
            etykieta={t('tloKarty.wzor')}
            opcje={RODZAJE.map((r) => ({ wartosc: r, tekst: t(`tloKarty.wzor.${r}`) }))}
            wartosc={wzor.rodzaj}
            zmien={(rodzaj) => zmienWzor((w) => ({ ...w, rodzaj }), 'rodzaj')}
          />
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
          <PoleKoloru
            etykieta={
              wzor.rodzaj === 'kropki' ? t('tloKarty.kolorKropek') : t('tloKarty.kolorLinii')
            }
            wartosc={wzor.kolor}
            moznaBrak={false}
            zmien={(kolor) => kolor && zmienWzor((w) => ({ ...w, kolor }), 'kolor')}
          />
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
