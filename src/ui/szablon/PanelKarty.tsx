import type { ReactNode } from 'react';
import { zastosujZestawStylu, zmienTypKontenera, zmienWezel } from '../../dane/szablon';
import { t } from '../../i18n';
import { wymiaryKarty, type Kontener } from '../../model/szablon';
import { ZESTAWY_STYLOW } from '../../ozdobniki/zestawyStylow';
import { PoleLiczby } from '../kartka/PoleLiczby';
import type { KontekstPaneluKarty } from './EdytorDrzewa';
import { GrupyStylow } from './GrupyStylow';
import { KolorZDanych } from './KolorZDanych';
import { Sekcja } from './Kontrolki';
import { PanelWezla } from './PanelWezla';
import { PolePostrzepienia } from './PolaDekoracji';
import { PoleRamki } from './PanelWygladu';
import { SekcjaTlaKarty, tenSamStanTla } from './SekcjaTlaKarty';

/** Strona karty: przód (awers, szablon z danymi) albo tył (rewers). */
export type StronaKarty = 'przod' | 'tyl';

/** Nowe wymiary karty z pól rozmiaru, orientacji i zaokrąglenia rogów. */
export interface WymiaryKarty {
  szer: number;
  wys: number;
  promien: number;
}

/**
 * Ustawienia całej karty („nic nie zaznaczono”) – wspólne dla przodu i tyłu: rozmiar, orientacja,
 * rogi, tło, postrzępienie, zestawy stylów, ramka, grupy stylów i kontener całej karty. Różnice
 * stron przychodzą w parametrach (kolor z danych, dodatki obrazu tła, kontener tylko swobodny).
 */
export function PanelKarty({
  k: { szablon, zmienSz, czcionki, obrazy, wymiary, uklad },
  tytul,
  opis,
  zmienWymiary,
  bladRozmiaru,
  bezDanych,
  zajeteKlucze,
  wgrywanieObrazu,
  dodatkiObrazu,
  dopasowanieZawartosci,
  rogiJakPrzod,
}: {
  k: KontekstPaneluKarty;
  tytul: string;
  opis: string;
  /** Zmiana rozmiaru, orientacji lub rogów – wołający może zapytać o powiązane szablony. */
  zmienWymiary: (w: WymiaryKarty) => void;
  bladRozmiaru?: string | undefined;
  /** Tył: bez danych kart (bez koloru z danych, kontener całej karty tylko swobodny). */
  bezDanych: boolean;
  zajeteKlucze: () => Iterable<string>;
  wgrywanieObrazu?: ReactNode;
  dodatkiObrazu?: ReactNode;
  /** Wybór sposobu dopasowania zawartości przy zmianie rozmiaru. */
  dopasowanieZawartosci?: ReactNode;
  /** Tył bez własnych rogów (projekt sprzed schematu 31) – rogi dopasowane do przodu. */
  rogiJakPrzod?: boolean;
}) {
  const r = szablon.rozmiar;
  const { szer, wys } = wymiaryKarty(szablon);
  const promien = szablon.promienRogow ?? 0;
  return (
    <>
      <h2>{tytul}</h2>
      {bladRozmiaru && (
        <p role="alert" className="blad-pola">
          {bladRozmiaru}
        </p>
      )}
      <p className="podpis">{opis}</p>
      {r.tryb === 'mm' ? (
        <>
          <div className="pole-panelu dwa-pola">
            <PoleLiczby
              id="karta-szer"
              etykieta={t('kreator.szerokosc')}
              wartosc={r.szerokosc}
              min={10}
              max={300}
              krok={0.5}
              poWyjsciu
              zmien={(v) => zmienWymiary({ szer: v, wys: r.wysokosc, promien })}
            />
            <PoleLiczby
              id="karta-wys"
              etykieta={t('kreator.wysokosc')}
              wartosc={r.wysokosc}
              min={10}
              max={300}
              krok={0.5}
              poWyjsciu
              zmien={(v) => zmienWymiary({ szer: r.szerokosc, wys: v, promien })}
            />
          </div>
          <div className="pole-panelu">
            <span id="karta-orientacja">{t('kartka.orientacja')}</span>
            <div className="przelacznik-segmentowy" role="group" aria-labelledby="karta-orientacja">
              {(['pionowa', 'pozioma'] as const).map((o) => {
                const wybrana = o === 'pozioma' ? szer > wys : szer <= wys;
                return (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={wybrana}
                    onClick={() => {
                      if (!wybrana && szer !== wys)
                        zmienWymiary({ szer: r.wysokosc, wys: r.szerokosc, promien });
                    }}
                  >
                    {t(`kartka.orientacja.${o}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <p className="podpis">{t('szablon.rozmiarWSlotach')}</p>
      )}
      <div className="pole-panelu dwa-pola">
        <PoleLiczby
          id="karta-promien"
          etykieta={t('kreator.promien')}
          wartosc={promien}
          min={0}
          max={Math.min(szer, wys) / 2}
          krok={0.5}
          poWyjsciu
          zmien={(v) => zmienWymiary({ szer, wys, promien: v })}
        />
      </div>
      {rogiJakPrzod && <p className="podpis">{t('rewers.rogiJakPrzod')}</p>}
      {dopasowanieZawartosci}
      <SekcjaTlaKarty
        stan={szablon}
        idKoloru="karta-tlo-kolor"
        obrazy={obrazy}
        zmien={(f, klucz) =>
          zmienSz(
            (s) => {
              const { tlo: _t, teksturaTla: _x, wzorTla: _w, ...reszta } = s;
              void _t;
              void _x;
              void _w;
              const nowy = f(s);
              if (tenSamStanTla(s, nowy)) return s;
              return { ...reszta, ...nowy };
            },
            klucz && `tlo-karty:${klucz}`,
          )
        }
        {...(wgrywanieObrazu ? { wgrywanieObrazu } : {})}
        {...(dodatkiObrazu ? { dodatkiObrazu } : {})}
        {...(bezDanych
          ? {}
          : {
              dodatkiKoloru: (
                <KolorZDanych
                  szablon={szablon}
                  {...(szablon.tloZDanych ? { regula: szablon.tloZDanych } : {})}
                  kolor={szablon.tlo ?? '#ffffff'}
                  zmien={(v, klucz) =>
                    zmienSz(
                      (s) => {
                        const x = { ...s };
                        if (v) x.tloZDanych = v;
                        else delete x.tloZDanych;
                        return x;
                      },
                      klucz && `kolor-karty:${klucz}`,
                    )
                  }
                />
              ),
            })}
      />
      <Sekcja tytul={t('dekoracje.postrzepienie')}>
        <PolePostrzepienia
          wartosc={szablon.postrzepienie}
          zmien={(v) =>
            zmienSz((s) => {
              const x = { ...s };
              if (v) x.postrzepienie = v;
              else delete x.postrzepienie;
              return x;
            }, 'postrzepienie-karty')
          }
        />
      </Sekcja>
      <Sekcja tytul={t('zestawy.tytul')}>
        <p className="podpis">{t('zestawy.opis')}</p>
        <div className="dwa-pola">
          {ZESTAWY_STYLOW.map((zestaw) => (
            <button
              key={zestaw.id}
              type="button"
              className="maly"
              onClick={() => zmienSz((s) => zastosujZestawStylu(s, zestaw))}
            >
              {t(`zestawy.${zestaw.id}`)}
            </button>
          ))}
        </div>
      </Sekcja>
      <Sekcja tytul={t('wlasciwosci.ramkaKarty')} otwarta={!!szablon.ramka}>
        <PoleRamki
          etykieta={t('wlasciwosci.ramkaKarty')}
          krawedzie={false}
          rodzaj
          narozniki={{
            wartosc: szablon.ramka?.narozniki,
            zmien: (n) =>
              zmienSz((s) => {
                if (!s.ramka) return s;
                const { narozniki: _n, ...rm } = s.ramka;
                void _n;
                return { ...s, ramka: n ? { ...rm, narozniki: n } : rm };
              }, 'ramka-narozniki'),
          }}
          ozdoba={{
            wartosc: szablon.ramka?.ozdoba,
            zmien: (o) =>
              zmienSz((s) => {
                if (!s.ramka) return s;
                const { ozdoba: _o, ...rm } = s.ramka;
                void _o;
                return { ...s, ramka: o ? { ...rm, ozdoba: o } : rm };
              }, 'ramka-ozdoba'),
            ramkaZostaje: true,
            promien: promien > 0 || (szablon.ramka?.promien ?? 0) > 0,
          }}
          ramka={szablon.ramka}
          zmien={(f) =>
            zmienSz((s) => {
              const x = { ...s };
              const rm = f(s.ramka);
              if (rm) x.ramka = rm;
              else delete x.ramka;
              return x;
            }, 'ramka')
          }
        />
        {szablon.ramka && (
          <div className="dwa-pola">
            <PoleLiczby
              id="karta-ramka-ods"
              etykieta={t('wlasciwosci.odsuniecie')}
              wartosc={szablon.ramka.odsuniecie ?? 0}
              min={0}
              max={Math.min(szer, wys) / 2}
              krok={0.5}
              zmien={(v) =>
                zmienSz((s) => ({ ...s, ramka: { ...s.ramka!, odsuniecie: v } }), 'ramka-ods')
              }
            />
            {!szablon.ramka.ozdoba && (
              <PoleLiczby
                id="karta-ramka-prom"
                etykieta={t('wlasciwosci.promienRamki')}
                wartosc={
                  szablon.ramka.promien ??
                  Math.max(0, promien - (szablon.ramka.odsuniecie ?? 0) - szablon.ramka.grubosc / 2)
                }
                min={0}
                max={Math.min(szer, wys) / 2}
                krok={0.5}
                zmien={(v) =>
                  zmienSz((s) => ({ ...s, ramka: { ...s.ramka!, promien: v } }), 'ramka-prom')
                }
              />
            )}
          </div>
        )}
        {szablon.ramka?.promien !== undefined && !szablon.ramka.ozdoba && (
          <button
            type="button"
            className="maly"
            onClick={() =>
              zmienSz((s) => {
                const { promien: _p, ...rm } = s.ramka!;
                void _p;
                return { ...s, ramka: rm };
              })
            }
          >
            {t('wlasciwosci.jakRogiKarty')}
          </button>
        )}
      </Sekcja>
      {szablon.warianty?.length ? <p className="podpis">{t('szablon.warianty')}</p> : null}
      <GrupyStylow szablon={szablon} czcionki={czcionki} zmien={zmienSz} />
      {/* Kontener całej karty: odstępy, rozłożenie, wygląd (jak każdy kontener). */}
      <Sekcja tytul={t('wlasciwosci.ukladKarty')}>
        <PanelWezla
          key={szablon.korzen.id}
          szablon={szablon}
          wezel={szablon.korzen}
          zmienSzablon={zmienSz}
          wymiary={wymiary(szablon.korzen.id)}
          czcionki={czcionki}
          obrazy={obrazy}
          zajeteKlucze={zajeteKlucze}
          {...(bezDanych ? { bezDanych: true, korzenSwobodnyTylko: true } : {})}
          mozeNaSwobodny={!!uklad}
          zmienWezel={(f, klucz) =>
            zmienSz((s) => zmienWezel(s, s.korzen.id, f), klucz && `korzen:${klucz}`)
          }
          zmienTyp={(typ) =>
            zmienSz((s) => zmienTypKontenera(s, s.korzen.id, typ as Kontener['typ'], uklad))
          }
          zmienPrzyklad={() => undefined}
        />
      </Sekcja>
    </>
  );
}
