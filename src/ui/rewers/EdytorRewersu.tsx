import { useEffect, useMemo, useRef, useState } from 'react';
import {
  duplikujRewersWProjekcie,
  rewersJakoSzablon,
  szablonDoRewersu,
  ustawStalyObrazRewersu,
  ustawTekstureRewersu,
  zmienRewers,
} from '../../dane/rewers';
import { zmienWezel, znajdzWezel } from '../../dane/szablon';
import { czyProjektWlasny } from '../../dane/wlasneKarty';
import { t } from '../../i18n';
import {
  DOMYSLNY_KOLOR_TEKSTU,
  type Rewers,
  type Szablon,
  type TrybTla,
} from '../../model/szablon';
import { renderujRewers } from '../../silnik/karta';
import { PoleLiczby } from '../kartka/PoleLiczby';
import { przygotujPlikObrazu } from '../obrazyUI';
import {
  czcionkiSzablonu,
  dodajRewersZPaczki,
  eksportujRewers,
  importujRewers,
  ROZSZERZENIE_SZABLONU,
} from '../../dane/archiwum';
import { nazwaPliku } from '../pliki';
import { EdytorDrzewa, type KontekstPaneluKarty, type RysujPodglad } from '../szablon/EdytorDrzewa';
import { Liczba, Lista, Sekcja, Wybor } from '../szablon/Kontrolki';
import { PanelWezla } from '../szablon/PanelWezla';
import { SekcjaTlaKarty } from '../szablon/SekcjaTlaKarty';
import { PoleRamki } from '../szablon/PanelWygladu';
import { RODZAJE_REWERSU } from '../szablon/PozycjeMenuDodaj';
import type { ProjektWEdycji } from '../useProjekt';

const rysujRewers: RysujPodglad = (klucz, ctx) => renderujRewers(JSON.parse(klucz) as Rewers, ctx);

/**
 * Edytor warstwowego rewersu karty: drzewo warstw, swobodny podgląd z przyciąganiem,
 * właściwości tła (4 tryby obrazu), czcionek, ramek i grafik wektorowych. Wspólna część
 * z Edytorem szablonu – `EdytorDrzewa`.
 */
export function EdytorRewersu({ edycja, rewersId }: { edycja: ProjektWEdycji; rewersId: string }) {
  const { projekt, zmien } = edycja;
  const rewers = projekt.rewersy?.find((r) => r.id === rewersId);
  const [idKopii, ustawIdKopii] = useState('');
  const kopia = projekt.rewersy?.find((r) => r.id === idKopii);
  const idProjektu = encodeURIComponent(projekt.id);

  // Każdy zaprojektowany w edytorze rewers trafia automatycznie do biblioteki rewersów
  // (po zapisaniu oraz przy opuszczeniu edytora bez niezapisanych zmian), żeby można go było wybrać przy dowolnej karcie.
  const aktualnyDoZapisu = useRef<
    { projekt: typeof projekt; dane: typeof edycja.dane } | undefined
  >(undefined);
  // Zapis ręczny: przy wyjściu do biblioteki trafia tylko stan zapisany w projekcie.
  useEffect(() => {
    aktualnyDoZapisu.current =
      rewers && !edycja.niezapisane ? { projekt, dane: edycja.dane } : undefined;
  }, [projekt, edycja.dane, edycja.niezapisane, rewers]);
  useEffect(() => {
    if (!rewers || edycja.zapis.stan !== 'zapisano') return;
    void import('../rewersyGlobalne')
      .then(({ zapiszRewersGlobalnie }) => zapiszRewersGlobalnie(projekt, edycja.dane, rewersId))
      .catch(() => undefined);
  }, [edycja.zapis.stan, edycja.wersja, edycja.dane, projekt, rewers, rewersId]);
  useEffect(() => {
    return () => {
      const stan = aktualnyDoZapisu.current;
      if (!stan) return;
      void import('../rewersyGlobalne')
        .then(({ zapiszRewersGlobalnie }) =>
          zapiszRewersGlobalnie(stan.projekt, stan.dane, rewersId),
        )
        .catch(() => undefined);
    };
  }, [rewersId]);

  const szablon = useMemo(() => (rewers ? rewersJakoSzablon(rewers) : undefined), [rewers]);
  const zmienRev = (f: (r: Rewers) => Rewers, klucz?: string) =>
    zmien((p) => zmienRewers(p, rewersId, f), klucz ? { klucz: `rewers:${klucz}` } : {});
  const zmienSz = (f: (s: Szablon) => Szablon, klucz?: string) =>
    zmienRev((r) => szablonDoRewersu(r, f(rewersJakoSzablon(r))), klucz);

  const [bladTekstury, ustawBladTekstury] = useState('');
  const wgrajTeksture = async (plik: File) => {
    ustawBladTekstury('');
    try {
      const obraz = await przygotujPlikObrazu(plik);
      await edycja.zmienZZasobami((p, d) => ustawTekstureRewersu(p, d, rewersId, plik.name, obraz));
    } catch (e) {
      ustawBladTekstury(e instanceof Error ? e.message : String(e));
    }
  };

  const wgrajStalyObraz = async (poleId: string, plik: File, sygnal: AbortSignal) => {
    const pole = szablon && znajdzWezel(szablon, poleId);
    if (!pole) return;
    const obraz = await przygotujPlikObrazu(plik);
    if (sygnal.aborted) return;
    await edycja.zmienZZasobami((p, d) => {
      const r = p.rewersy?.find((x) => x.id === rewersId);
      return p.id === projekt.id && r && znajdzWezel(rewersJakoSzablon(r), poleId) === pole
        ? ustawStalyObrazRewersu(p, d, rewersId, poleId, plik.name, obraz)
        : { projekt: p, dane: d };
    });
  };

  return (
    <EdytorDrzewa
      edycja={edycja}
      id={rewersId}
      szablon={rewers && szablon}
      zmienSz={zmienSz}
      czcionkiUzyte={rewers ? czcionkiSzablonu(rewers) : []}
      kluczRysunku={(w) =>
        rewers ? JSON.stringify({ ...szablonDoRewersu(rewers, w), nazwa: '' }) : ''
      }
      rysuj={rysujRewers}
      przedrostekSvg="rw-"
      miniatura="rewers"
      bezDanych
      rodzajeDodaj={RODZAJE_REWERSU}
      teksty={{
        brak: t('rewers.brak'),
        tytul: t('rewers.tytulEdytora'),
        nazwa: t('rewers.nazwa'),
        drzewo: t('rewers.warstwy'),
        podglad: t('rewers.podgladEtykieta'),
        pomocPodgladu: t('rewers.pomocPodgladu'),
      }}
      zmienNazwe={(nazwa) => zmienRev((r) => ({ ...r, nazwa }), 'nazwa')}
      duplikuj={() => {
        let id = '';
        zmien((p) => {
          const res = duplikujRewersWProjekcie(p, rewersId, (n) =>
            n === 1 ? t('szablon.kopia') : t('szablon.kopiaNumer', { n }),
          );
          id = res.id;
          return res.projekt;
        });
        ustawIdKopii(id);
      }}
      kopia={
        kopia && {
          adres: `#/projekt/${idProjektu}/rewers/${encodeURIComponent(kopia.id)}`,
          tekst: t('rewers.otworzKopie', { nazwa: kopia.nazwa }),
        }
      }
      plikSzablonu={{
        eksportuj: () => ({
          bajty: eksportujRewers(projekt, edycja.dane, rewersId),
          ostrzezenia: [],
          nazwa: nazwaPliku(rewers?.nazwa ?? '', ROZSZERZENIE_SZABLONU),
        }),
        importuj: async (bajty) => {
          // Każdy plik szablonu (także awers) wczytuje się jako nowy rewers projektu.
          const paczka = importujRewers(bajty);
          let w: ReturnType<typeof dodajRewersZPaczki> | undefined;
          await edycja.zmienZZasobami((p, d) => {
            w = dodajRewersZPaczki(p, d, paczka);
            return { projekt: w.projekt, dane: w.dane };
          });
          const nowy = w!.projekt.rewersy?.find((r) => r.id === w!.rewersId);
          return {
            adres: `#/projekt/${idProjektu}/rewers/${encodeURIComponent(w!.rewersId)}`,
            tekst: t('rewers.zaimportowano', { nazwa: nowy?.nazwa ?? '' }),
            ostrzezenia: [],
          };
        },
      }}
      adresPowrotu={
        rewers &&
        czyProjektWlasny(projekt) &&
        projekt.talie.every((tl) => tl.karty.length === 0) &&
        projekt.szablony.length === 1 &&
        projekt.szablony[0]!.korzen.dzieci.length === 0 &&
        projekt.nazwa === rewers.nazwa
          ? '#/wlasne/nowy'
          : `#/projekt/${idProjektu}/drukuj`
      }
      akcjaGlowna={
        <a className="przycisk glowny" href={`#/projekt/${idProjektu}`}>
          {t('szablon.robKarty')}
        </a>
      }
      wgrajStalyObraz={wgrajStalyObraz}
      panelKarty={(k) =>
        rewers && (
          <PanelTlaRewersu
            k={k}
            rewers={rewers}
            zmienRev={zmienRev}
            wgrajTeksture={(f) => void wgrajTeksture(f)}
            bladTekstury={bladTekstury}
          />
        )
      }
    />
  );
}

/** Panel „nic nie zaznaczono”: rozmiar, tło (kolor, tekstura), ramka karty i układ rewersu. */
function PanelTlaRewersu({
  k: { szablon, zmienSz, czcionki, obrazy, wymiary },
  rewers,
  zmienRev,
  wgrajTeksture,
  bladTekstury,
}: {
  k: KontekstPaneluKarty;
  rewers: Rewers;
  zmienRev: (f: (r: Rewers) => Rewers, klucz?: string) => void;
  wgrajTeksture: (f: File) => void;
  bladTekstury: string;
}) {
  const plikTekstury = useRef<HTMLInputElement>(null);
  const { szer, wys } = { szer: rewers.rozmiar.szerokosc, wys: rewers.rozmiar.wysokosc };
  return (
    <>
      <h2>{t('rewers.tloIRamka')}</h2>
      <p className="podpis">{t('rewers.rozmiarOpis')}</p>
      <div className="pole-panelu dwa-pola">
        <PoleLiczby
          id="rewers-szer"
          etykieta={t('kreator.szerokosc')}
          wartosc={rewers.rozmiar.szerokosc}
          min={10}
          max={300}
          krok={0.5}
          zmien={(v) =>
            zmienRev((r) => ({ ...r, rozmiar: { ...r.rozmiar, szerokosc: v } }), 'szer')
          }
        />
        <PoleLiczby
          id="rewers-wys"
          etykieta={t('kreator.wysokosc')}
          wartosc={rewers.rozmiar.wysokosc}
          min={10}
          max={300}
          krok={0.5}
          zmien={(v) => zmienRev((r) => ({ ...r, rozmiar: { ...r.rozmiar, wysokosc: v } }), 'wys')}
        />
      </div>
      <SekcjaTlaKarty
        stan={rewers}
        obrazy={obrazy}
        zmien={(f, klucz) =>
          zmienRev(
            (r) => {
              const { tlo: _t, teksturaTla: _x, wzorTla: _w, ...reszta } = r;
              void _t;
              void _x;
              void _w;
              const x: Rewers = { ...reszta, ...f(r) };
              if (!x.teksturaTla) {
                delete x.teksturaTryb;
                delete x.teksturaKrycie;
                delete x.teksturaZabarwienie;
              }
              return x;
            },
            klucz && `tlo-karty:${klucz}`,
          )
        }
        wgrywanieObrazu={
          <>
            <div className="wiersz-przyciskow">
              <button type="button" onClick={() => plikTekstury.current?.click()}>
                {t('dekoracje.wgrajTeksture')}
              </button>
              <input
                ref={plikTekstury}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                data-testid="plik-tekstury-rewersu"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) wgrajTeksture(f);
                }}
              />
            </div>
            {bladTekstury && (
              <p role="alert" className="blad-pola">
                {bladTekstury}
              </p>
            )}
          </>
        }
        dodatkiObrazu={
          <>
            <Lista
              etykieta={t('dekoracje.trybTla')}
              opcje={(['wypelnij', 'dopasuj', 'rozciagnij', 'kafelki'] as const).map(
                (m: TrybTla) => ({
                  wartosc: m,
                  tekst: t(`obraz.${m}`),
                }),
              )}
              wartosc={rewers.teksturaTryb ?? 'wypelnij'}
              zmien={(m) => zmienRev((r) => ({ ...r, teksturaTryb: m }), 'teksturaTryb')}
            />
            <Liczba
              etykieta={t('dekoracje.krycieTekstury')}
              wartosc={Math.round((rewers.teksturaKrycie ?? 1) * 100)}
              min={0}
              max={100}
              krok={5}
              zmien={(v) =>
                zmienRev((r) => {
                  const k = Math.max(0, Math.min(1, Math.round(v) / 100));
                  const x = { ...r };
                  if (k >= 1) delete x.teksturaKrycie;
                  else x.teksturaKrycie = k;
                  return x;
                }, 'teksturaKrycie')
              }
            />
            <Wybor
              etykieta={t('dekoracje.zabarwienie')}
              wartosc={!!rewers.teksturaZabarwienie}
              zmien={(v) =>
                zmienRev((r) => {
                  const x = { ...r };
                  if (v)
                    x.teksturaZabarwienie = {
                      kolor: DOMYSLNY_KOLOR_TEKSTU,
                      krycie: 0.35,
                    };
                  else delete x.teksturaZabarwienie;
                  return x;
                }, 'teksturaZabarwienie')
              }
            />
            {rewers.teksturaZabarwienie && (
              <div className="dwa-pola">
                <div className="pole-panelu">
                  <label htmlFor="rewers-tekstura-zabarwienie-kolor">
                    {t('dekoracje.kolorZabarwienia')}
                  </label>
                  <input
                    id="rewers-tekstura-zabarwienie-kolor"
                    type="color"
                    value={rewers.teksturaZabarwienie.kolor}
                    onChange={(e) =>
                      zmienRev(
                        (r) =>
                          r.teksturaZabarwienie
                            ? {
                                ...r,
                                teksturaZabarwienie: {
                                  ...r.teksturaZabarwienie,
                                  kolor: e.target.value,
                                },
                              }
                            : r,
                        'teksturaZabarwienieKolor',
                      )
                    }
                  />
                </div>
                <Liczba
                  etykieta={t('dekoracje.silaZabarwienia')}
                  wartosc={Math.round(rewers.teksturaZabarwienie.krycie * 100)}
                  min={0}
                  max={100}
                  krok={5}
                  zmien={(v) =>
                    zmienRev(
                      (r) =>
                        r.teksturaZabarwienie
                          ? {
                              ...r,
                              teksturaZabarwienie: {
                                ...r.teksturaZabarwienie,
                                krycie: Math.max(0, Math.min(1, Math.round(v) / 100)),
                              },
                            }
                          : r,
                      'teksturaZabarwienieSila',
                    )
                  }
                />
              </div>
            )}
          </>
        }
      />
      <Sekcja tytul={t('wlasciwosci.ramkaKarty')} otwarta={!!rewers.ramka}>
        <PoleRamki
          etykieta={t('wlasciwosci.ramkaKarty')}
          krawedzie={false}
          rodzaj
          narozniki={{
            wartosc: rewers.ramka?.narozniki,
            zmien: (n) =>
              zmienRev((r) => {
                if (!r.ramka) return r;
                const { narozniki: _n, ...ramka } = r.ramka;
                void _n;
                return { ...r, ramka: n ? { ...ramka, narozniki: n } : ramka };
              }, 'ramka-narozniki'),
          }}
          ozdoba={{
            wartosc: rewers.ramka?.ozdoba,
            zmien: (o) =>
              zmienRev((r) => {
                if (!r.ramka) return r;
                const { ozdoba: _o, ...ramka } = r.ramka;
                void _o;
                return { ...r, ramka: o ? { ...ramka, ozdoba: o } : ramka };
              }, 'ramka-ozdoba'),
            ramkaZostaje: true,
            promien: (rewers.ramka?.promien ?? 0) > 0,
          }}
          ramka={rewers.ramka}
          zmien={(f) =>
            zmienRev((r) => {
              const x = { ...r };
              const ramka = f(r.ramka);
              if (ramka) x.ramka = ramka;
              else delete x.ramka;
              return x;
            }, 'ramka')
          }
        />
        {rewers.ramka && (
          <div className="dwa-pola">
            <PoleLiczby
              id="rewers-ramka-ods"
              etykieta={t('wlasciwosci.odsuniecie')}
              wartosc={rewers.ramka.odsuniecie ?? 0}
              min={0}
              max={Math.min(szer, wys) / 2}
              krok={0.5}
              zmien={(v) =>
                zmienRev((r) => ({ ...r, ramka: { ...r.ramka!, odsuniecie: v } }), 'ramka-ods')
              }
            />
            {!rewers.ramka.ozdoba && (
              <PoleLiczby
                id="rewers-ramka-prom"
                etykieta={t('wlasciwosci.promienRamki')}
                wartosc={rewers.ramka.promien ?? 0}
                min={0}
                max={Math.min(szer, wys) / 2}
                krok={0.5}
                zmien={(v) =>
                  zmienRev((r) => ({ ...r, ramka: { ...r.ramka!, promien: v } }), 'ramka-prom')
                }
              />
            )}
          </div>
        )}
      </Sekcja>
      {szablon.korzen.dzieci.length === 0 && <p className="uwaga">{t('rewers.pusty')}</p>}
      <Sekcja tytul={t('wlasciwosci.ukladKarty')}>
        <PanelWezla
          key={szablon.korzen.id}
          szablon={szablon}
          wezel={szablon.korzen}
          zmienSzablon={zmienSz}
          wymiary={wymiary(szablon.korzen.id)}
          czcionki={czcionki}
          obrazy={obrazy}
          zajeteKlucze={() => []}
          bezDanych
          korzenSwobodnyTylko
          zmienWezel={(f, klucz) =>
            zmienSz((s) => zmienWezel(s, s.korzen.id, f), klucz && `korzen:${klucz}`)
          }
          zmienTyp={() => undefined}
          zmienPrzyklad={() => undefined}
        />
      </Sekcja>
    </>
  );
}
