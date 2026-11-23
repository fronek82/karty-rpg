import { PoleSzkicu } from './PolaDekoracji';
import { useId } from 'react';
import { t } from '../../i18n';
import type { Pole, PoleSeparator } from '../../model/szablon';
import { ODSTEP_OZDOBY_DOMYSLNY, znajdzElement, type ElementOzdobny } from '../../ozdobniki';
import { elementyRodzaju, useElementyWlasne } from './elementyWlasne';
import { Liczba, Lista, PoleKoloru, Przelacznik, Sekcja } from './Kontrolki';
import { GrupyOzdobnikow } from './GrupyOzdobnikow';
import { MiniaturaOzdobnika } from './MiniaturaOzdobnika';
import { nazwaElementu } from './PanelWygladu';

type Ozdoba = { element: string; rozmiar: number } | undefined;

/** Wybór elementu (miniatury z „brak”) i jego wysokości – zakończenia i środek separatora. */
function WyborOzdoby({
  etykieta,
  elementy,
  wartosc,
  zmien,
  kolor,
}: {
  etykieta: string;
  elementy: ElementOzdobny[];
  wartosc: Ozdoba;
  zmien: (o: Ozdoba) => void;
  kolor: string;
}) {
  const idEtykiety = useId();
  return (
    <div className="pole-panelu">
      <span id={idEtykiety}>{etykieta}</span>
      <div className="wybor-narozniki" role="group" aria-labelledby={idEtykiety}>
        <button
          type="button"
          aria-pressed={!wartosc}
          aria-label={t('separator.brak')}
          onClick={() => zmien(undefined)}
        >
          <span aria-hidden="true">–</span>
          <small>{t('separator.brak')}</small>
        </button>
        <GrupyOzdobnikow
          elementy={elementy}
          render={(e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={wartosc?.element === e.id}
              aria-label={nazwaElementu(e)}
              style={{ color: kolor }}
              onClick={() => zmien({ element: e.id, rozmiar: wartosc?.rozmiar ?? 2.4 })}
            >
              <MiniaturaOzdobnika element={e} />
              <small>{nazwaElementu(e)}</small>
            </button>
          )}
        />
      </div>
      {wartosc && (
        <Liczba
          etykieta={`${t('separator.rozmiarOzdoby')} – ${etykieta}`}
          wartosc={wartosc.rozmiar}
          min={0.5}
          max={30}
          krok={0.1}
          zmien={(v) => zmien({ ...wartosc, rozmiar: v })}
        />
      )}
    </div>
  );
}

/**
 * Separator: kierunek, rysunek (linia / motyw), styl linii, zakończenia, środek, długość
 * (całość / mm / %) i odstęp linii od ozdoby.
 */
export function PanelSeparatora({
  pole,
  ustaw,
}: {
  pole: PoleSeparator;
  ustaw: (z: Partial<Pole>) => void;
}) {
  const idMotywu = useId();
  const wlasne = useElementyWlasne();
  const kolor = pole.kolor ?? '#000000';
  const rysunek = pole.rysunek && pole.rysunek !== 'linia' ? pole.rysunek : undefined;
  const dlugosc = pole.dlugosc
    ? 'mm' in pole.dlugosc
      ? ('mm' as const)
      : ('procent' as const)
    : ('calosc' as const);
  // Motyw nieznany lub bez szerokości nie rysuje się – separator wraca do zwykłej linii.
  const motywDziala =
    !!rysunek && rysunek.szerokosc > 0 && znajdzElement(rysunek.motyw, wlasne)?.rodzaj === 'motyw';
  const ozdoby = !!pole.zakonczenia || !!pole.srodek || !!rysunek;
  return (
    <Sekcja tytul={t('wezel.separator')} otwarta>
      <PoleSzkicu
        {...(pole.szkic ? { wartosc: pole.szkic } : {})}
        zmien={(v) => ustaw({ szkic: v })}
      />
      <Przelacznik
        etykieta={t('wlasciwosci.kierunek')}
        opcje={(['poziomy', 'pionowy'] as const).map((k) => ({
          wartosc: k,
          tekst: t(`wlasciwosci.kierunek.${k}`),
        }))}
        wartosc={pole.kierunek}
        zmien={(v) => ustaw({ kierunek: v })}
      />
      <Przelacznik
        etykieta={t('separator.rysunek')}
        opcje={(['linia', 'motyw'] as const).map((k) => ({
          wartosc: k,
          tekst: t(`separator.rysunek.${k}`),
        }))}
        wartosc={rysunek ? 'motyw' : 'linia'}
        zmien={(v) =>
          ustaw({
            rysunek: v === 'linia' ? undefined : (rysunek ?? { motyw: 'wb:lancuch', szerokosc: 3 }),
          })
        }
      />
      {rysunek && (
        <div className="pole-panelu">
          <span id={idMotywu}>{t('motywy.tytul')}</span>
          <div className="wybor-narozniki" role="group" aria-labelledby={idMotywu}>
            <GrupyOzdobnikow
              elementy={elementyRodzaju('motyw', wlasne)}
              render={(e) => (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={rysunek.motyw === e.id}
                  aria-label={nazwaElementu(e)}
                  style={{ color: kolor }}
                  onClick={() => ustaw({ rysunek: { ...rysunek, motyw: e.id } })}
                >
                  <MiniaturaOzdobnika element={e} />
                  <small>{nazwaElementu(e)}</small>
                </button>
              )}
            />
          </div>
          <Liczba
            etykieta={t('separator.szerokoscMotywu')}
            wartosc={rysunek.szerokosc}
            min={0.5}
            max={30}
            krok={0.5}
            zmien={(v) => ustaw({ rysunek: { ...rysunek, szerokosc: v } })}
          />
        </div>
      )}
      {!motywDziala && (
        <Lista
          etykieta={t('wlasciwosci.stylLinii')}
          opcje={(['ciagla', 'przerywana', 'kropkowana', 'podwojna'] as const).map((s) => ({
            wartosc: s,
            tekst: t(`wlasciwosci.linia.${s}`),
          }))}
          wartosc={pole.stylLinii ?? 'ciagla'}
          zmien={(v) => ustaw({ stylLinii: v === 'ciagla' ? undefined : v })}
        />
      )}
      <div className="dwa-pola">
        {!motywDziala && (
          <Liczba
            etykieta={t('wlasciwosci.grubosc')}
            wartosc={pole.grubosc}
            krok={0.05}
            max={10}
            zmien={(v) => ustaw({ grubosc: v })}
          />
        )}
        <PoleKoloru
          etykieta={t('wlasciwosci.kolorLinii')}
          wartosc={kolor}
          moznaBrak={false}
          zmien={(v) => ustaw({ kolor: v })}
        />
      </div>
      {!motywDziala && pole.stylLinii === 'podwojna' && (
        <Liczba
          etykieta={t('wlasciwosci.przerwa')}
          wartosc={pole.przerwa ?? 2 * pole.grubosc}
          krok={0.05}
          max={10}
          zmien={(v) => ustaw({ przerwa: v })}
        />
      )}
      <Przelacznik
        etykieta={t('separator.dlugosc')}
        opcje={(['calosc', 'mm', 'procent'] as const).map((k) => ({
          wartosc: k,
          tekst: t(`separator.dlugosc.${k}`),
        }))}
        wartosc={dlugosc}
        zmien={(v) =>
          ustaw({
            dlugosc: v === 'calosc' ? undefined : v === 'mm' ? { mm: 40 } : { procent: 80 },
          })
        }
      />
      {pole.dlugosc && 'mm' in pole.dlugosc && (
        <Liczba
          etykieta={t('separator.dlugoscMm')}
          wartosc={pole.dlugosc.mm}
          max={500}
          zmien={(v) => ustaw({ dlugosc: { mm: v } })}
        />
      )}
      {pole.dlugosc && 'procent' in pole.dlugosc && (
        <Liczba
          etykieta={t('separator.dlugoscProcent')}
          wartosc={pole.dlugosc.procent}
          max={100}
          krok={5}
          zmien={(v) => ustaw({ dlugosc: { procent: v } })}
        />
      )}
      <WyborOzdoby
        etykieta={t('separator.zakonczenia')}
        elementy={elementyRodzaju('zakonczenie', wlasne)}
        wartosc={pole.zakonczenia}
        zmien={(v) => ustaw({ zakonczenia: v })}
        kolor={kolor}
      />
      <WyborOzdoby
        etykieta={t('separator.srodek')}
        elementy={elementyRodzaju('srodek', wlasne)}
        wartosc={pole.srodek}
        zmien={(v) => ustaw({ srodek: v })}
        kolor={kolor}
      />
      {ozdoby && (
        <Liczba
          etykieta={t('separator.odstep')}
          wartosc={pole.odstepOdOzdoby ?? ODSTEP_OZDOBY_DOMYSLNY}
          max={20}
          krok={0.1}
          zmien={(v) => ustaw({ odstepOdOzdoby: v })}
        />
      )}
    </Sekcja>
  );
}
