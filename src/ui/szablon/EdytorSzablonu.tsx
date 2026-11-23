import { useState } from 'react';
import {
  czcionkiSzablonu,
  eksportujSzablon,
  importujSzablon,
  ROZSZERZENIE_SZABLONU,
} from '../../dane/archiwum';
import { ustawStalyObraz } from '../../dane/edycja';
import { opisObrazu } from '../../dane/obrazy';
import { ustawPodklad, usunPodklad } from '../../dane/podklad';
import {
  danePodgladu,
  duplikujSzablonWProjekcie,
  kluczeDanychKart,
  zastosujZestawStylu,
  zmienSzablon,
  zmienTypKontenera,
  zmienWezel,
  znajdzWezel,
} from '../../dane/szablon';
import {
  czyProjektWlasny,
  dodajSzablonZKartka,
  kartkaDlaSzablonu,
  zmienRozmiarSzablonu,
} from '../../dane/wlasneKarty';
import { nazwaPliku } from '../pliki';
import { t } from '../../i18n';
import {
  czyKontener,
  wymiaryKarty,
  type Kontener,
  type Szablon,
  type Wezel,
} from '../../model/szablon';
import { ZESTAWY_STYLOW } from '../../ozdobniki/zestawyStylow';
import { renderujKarte } from '../../silnik/karta';
import { PoleLiczby } from '../kartka/PoleLiczby';
import { przygotujPlikObrazu } from '../obrazyUI';
import type { ProjektWEdycji } from '../useProjekt';
import { EdytorDrzewa, type RysujPodglad } from './EdytorDrzewa';
import { GrupyStylow } from './GrupyStylow';
import { KolorZDanych } from './KolorZDanych';
import { Liczba, Sekcja } from './Kontrolki';
import { PanelWezla } from './PanelWezla';
import { PolePostrzepienia } from './PolaDekoracji';
import { SekcjaTlaKarty } from './SekcjaTlaKarty';
import { PoleRamki } from './PanelWygladu';

/** Podgląd awersu: karta z danymi przykładowymi (silnik jak na kartce i w PDF). */
const rysujSzablon: RysujPodglad = (klucz, ctx) => {
  const sz = JSON.parse(klucz) as Szablon;
  return renderujKarte(sz, { dane: danePodgladu(sz) }, ctx);
};

/**
 * Edytor szablonu karty od zera: drzewo wierszy, kolumn i pól (lewa kolumna), podgląd karty
 * z danymi przykładowymi i zaznaczaniem klikiem (środek), właściwości zaznaczonego elementu
 * (prawa kolumna). Zmiany zapisują się w projekcie z historią „Cofnij”. Wspólna część
 * z Edytorem rewersu – `EdytorDrzewa`.
 */
export function EdytorSzablonu({
  edycja,
  szablonId,
}: {
  edycja: ProjektWEdycji;
  szablonId: string;
}) {
  const { projekt, zmien } = edycja;
  const szablon = projekt.szablony.find((s) => s.id === szablonId);
  const [idKopii, ustawIdKopii] = useState('');
  const kopia = projekt.szablony.find((s) => s.id === idKopii);
  const [bladPodkladu, ustawBladPodkladu] = useState('');
  const idProjektu = encodeURIComponent(projekt.id);
  const zasoby = edycja.zasoby.zasoby;

  const zmienSz = (f: (s: Szablon) => Szablon, klucz?: string) =>
    zmien((p) => zmienSzablon(p, szablonId, f), klucz ? { klucz: `szablon:${klucz}` } : {});

  const robKarty = () => {
    let arkuszId = '';
    zmien((p) => {
      const w = kartkaDlaSzablonu(p, szablonId);
      arkuszId = w.arkuszId;
      return w.projekt;
    });
    window.location.hash = `#/projekt/${idProjektu}/kartka/${encodeURIComponent(arkuszId)}`;
  };
  const wczytajPodklad = async (f: File) => {
    ustawBladPodkladu('');
    try {
      const { dane, ...wymiary } = await przygotujPlikObrazu(f);
      await edycja.zmienZZasobami((p, d) => {
        const opis = opisObrazu(f.name, dane, wymiary, new Set(p.zasoby.map((z) => z.id)));
        return ustawPodklad(p, d, szablonId, { opis, dane });
      });
    } catch (e) {
      ustawBladPodkladu(
        t('podklad.blad', { plik: f.name, powod: e instanceof Error ? e.message : String(e) }),
      );
    }
  };
  const wgrajStalyObraz = async (poleId: string, plik: File, sygnal: AbortSignal) => {
    const pole = szablon && znajdzWezel(szablon, poleId);
    if (!pole) return;
    const obraz = await przygotujPlikObrazu(plik);
    if (sygnal.aborted) return;
    await edycja.zmienZZasobami((p, d) => {
      const s = p.szablony.find((s) => s.id === szablonId);
      return p.id === projekt.id && s && znajdzWezel(s, poleId) === pole
        ? ustawStalyObraz(p, d, szablonId, poleId, plik.name, obraz)
        : { projekt: p, dane: d };
    });
  };

  return (
    <EdytorDrzewa
      edycja={edycja}
      id={szablonId}
      szablon={szablon}
      zmienSz={zmienSz}
      czcionkiUzyte={szablon ? czcionkiSzablonu(szablon) : []}
      // Zależy tylko od tego, co widać na karcie – zmiana nazwy nie rysuje karty od nowa.
      // Podkład ze wzoru nie bierze udziału w rysunku (jest tylko pod podglądem w edytorze).
      kluczRysunku={(w) => JSON.stringify({ ...w, nazwa: '', podklad: undefined })}
      rysuj={rysujSzablon}
      przedrostekSvg="sz-"
      miniatura="szablon"
      bezDanych={false}
      zajeteKlucze={() => kluczeDanychKart(projekt, szablonId)}
      teksty={{
        brak: t('szablon.brak'),
        tytul: t('szablon.tytulEdytora'),
        nazwa: t('szablon.nazwaSzablonu'),
        drzewo: t('szablon.struktura'),
        podglad: t('szablon.podglad'),
        pomocPodgladu: t('szablon.pomocPodgladu'),
      }}
      zmienNazwe={(nazwa) => zmienSz((s) => ({ ...s, nazwa }), 'nazwa')}
      duplikuj={() => {
        let id = '';
        zmien((p) => {
          const k = duplikujSzablonWProjekcie(p, szablonId, (n) =>
            n === 1 ? t('szablon.kopia') : t('szablon.kopiaNumer', { n }),
          );
          id = k.id;
          return czyProjektWlasny(p) ? k.projekt : kartkaDlaSzablonu(k.projekt, id).projekt;
        });
        ustawIdKopii(id);
      }}
      kopia={
        kopia && {
          adres: `#/projekt/${idProjektu}/szablon/${encodeURIComponent(kopia.id)}`,
          tekst: t('szablony.otworzKopie', { nazwa: kopia.nazwa }),
        }
      }
      adresPowrotu={czyProjektWlasny(projekt) ? '#/wlasne' : `#/projekt/${idProjektu}`}
      plikSzablonu={{
        eksportuj: () => {
          const { bajty, ostrzezenia } = eksportujSzablon(projekt, edycja.dane, szablonId);
          return {
            bajty,
            ostrzezenia,
            nazwa: nazwaPliku(szablon?.nazwa ?? '', ROZSZERZENIE_SZABLONU),
          };
        },
        importuj: async (bajty) => {
          // Każdy plik szablonu (także sam rewers) wczytuje się jako nowy awers projektu.
          const paczka = importujSzablon(bajty);
          let w: ReturnType<typeof dodajSzablonZKartka> | undefined;
          await edycja.zmienZZasobami((p, d) => {
            w = dodajSzablonZKartka(p, d, paczka);
            return { projekt: w.projekt, dane: w.zasoby };
          });
          const nowy = w!.projekt.szablony.find((s) => s.id === w!.szablonId);
          return {
            adres: `#/projekt/${idProjektu}/szablon/${encodeURIComponent(w!.szablonId)}`,
            tekst: t('szablon.zaimportowano', { nazwa: nowy?.nazwa ?? '' }),
            ostrzezenia: [
              ...(w!.nowaKartka ? [t('szablony.dodanoKartke')] : []),
              ...w!.ostrzezenia,
            ],
          };
        },
      }}
      akcjaGlowna={
        <button type="button" className="glowny" onClick={robKarty}>
          {t('szablon.robKarty')}
        </button>
      }
      wgrajStalyObraz={wgrajStalyObraz}
      podklad={
        szablon && {
          podklad: szablon.podklad,
          adres: szablon.podklad ? zasoby.obrazy.get(szablon.podklad.zasob)?.adres : undefined,
          blad: bladPodkladu,
          wczytaj: (f) => void wczytajPodklad(f),
          zmien: (f) =>
            zmienSz((x) => (x.podklad ? { ...x, podklad: f(x.podklad) } : x), 'podklad'),
          usun: () => void edycja.zmienZZasobami((p, d) => usunPodklad(p, d, szablonId)),
        }
      }
      panelKarty={({ szablon: sz, czcionki, obrazy, wymiary, uklad }) => (
        <>
          <PanelKarty
            szablon={sz}
            obrazy={obrazy}
            zmienSz={zmienSz}
            zmienRozmiar={(s, w) => {
              // Karta, która nie zmieści się na stronie kartki – odrzucona (komunikat w panelu).
              if (zmienRozmiarSzablonu(projekt, szablonId, s, w) === projekt) return false;
              zmien((p) => zmienRozmiarSzablonu(p, szablonId, s, w), { klucz: 'rozmiar-karty' });
              return true;
            }}
          />
          <GrupyStylow szablon={sz} czcionki={czcionki} zmien={zmienSz} />
          {/* Kontener całej karty: odstępy, rozłożenie, wygląd (jak każdy kontener). */}
          <Sekcja tytul={t('wlasciwosci.ukladKarty')}>
            <PanelWezla
              key={sz.korzen.id}
              szablon={sz}
              wezel={sz.korzen}
              zmienSzablon={zmienSz}
              wymiary={wymiary(sz.korzen.id)}
              mozeNaSwobodny={!!uklad}
              czcionki={czcionki}
              obrazy={obrazy}
              zajeteKlucze={() => kluczeDanychKart(projekt, szablonId)}
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
      )}
    />
  );
}

/** Ustawienia całej karty: rozmiar (mm), zaokrąglenie rogów, kolor tła i ramka. */
function PanelKarty({
  szablon,
  obrazy,
  zmienSz,
  zmienRozmiar,
}: {
  szablon: Szablon;
  obrazy: readonly { wartosc: string; tekst: string }[];
  zmienSz: (f: (s: Szablon) => Szablon, klucz?: string) => void;
  zmienRozmiar: (szer: number, wys: number) => boolean;
}) {
  const r = szablon.rozmiar;
  const [blad, ustawBlad] = useState(false);
  const { szer, wys } = wymiaryKarty(szablon);
  const rozmiar = (s: number, w: number) => ustawBlad(!zmienRozmiar(s, w));
  return (
    <>
      <h2>{t('szablon.karta')}</h2>
      {blad && (
        <p role="alert" className="blad-pola">
          {t('szablon.rozmiarNieMiesci')}
        </p>
      )}
      <p className="podpis">{t('szablon.kartaOpis')}</p>
      {r.tryb === 'mm' ? (
        <div className="pole-panelu dwa-pola">
          <PoleLiczby
            id="karta-szer"
            etykieta={t('kreator.szerokosc')}
            wartosc={r.szerokosc}
            min={10}
            max={300}
            krok={0.5}
            zmien={(v) => rozmiar(v, r.wysokosc)}
          />
          <PoleLiczby
            id="karta-wys"
            etykieta={t('kreator.wysokosc')}
            wartosc={r.wysokosc}
            min={10}
            max={300}
            krok={0.5}
            zmien={(v) => rozmiar(r.szerokosc, v)}
          />
        </div>
      ) : (
        <p className="podpis">{t('szablon.rozmiarWSlotach')}</p>
      )}
      <div className="pole-panelu dwa-pola">
        <PoleLiczby
          id="karta-promien"
          etykieta={t('kreator.promien')}
          wartosc={szablon.promienRogow ?? 0}
          min={0}
          max={Math.min(szer, wys) / 2}
          krok={0.5}
          zmien={(v) => zmienSz((s) => ({ ...s, promienRogow: v }), 'promien')}
        />
      </div>
      <SekcjaTlaKarty
        stan={szablon}
        obrazy={obrazy}
        zmien={(f, klucz) =>
          zmienSz(
            (s) => {
              const { tlo: _t, teksturaTla: _x, wzorTla: _w, ...reszta } = s;
              void _t;
              void _x;
              void _w;
              return { ...reszta, ...f(s) };
            },
            klucz && `tlo-karty:${klucz}`,
          )
        }
        dodatkiKoloru={
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
        }
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
                const { narozniki: _n, ...r } = s.ramka;
                void _n;
                return { ...s, ramka: n ? { ...r, narozniki: n } : r };
              }, 'ramka-narozniki'),
          }}
          ozdoba={{
            wartosc: szablon.ramka?.ozdoba,
            zmien: (o) =>
              zmienSz((s) => {
                if (!s.ramka) return s;
                const { ozdoba: _o, ...r } = s.ramka;
                void _o;
                return { ...s, ramka: o ? { ...r, ozdoba: o } : r };
              }, 'ramka-ozdoba'),
            ramkaZostaje: true,
            promien: (szablon.promienRogow ?? 0) > 0 || (szablon.ramka?.promien ?? 0) > 0,
          }}
          ramka={szablon.ramka}
          zmien={(f) =>
            zmienSz((s) => {
              const x = { ...s };
              const r = f(s.ramka);
              if (r) x.ramka = r;
              else delete x.ramka;
              return x;
            }, 'ramka')
          }
        />
        {szablon.ramka && (
          <div className="dwa-pola">
            <Liczba
              etykieta={t('wlasciwosci.odsuniecie')}
              wartosc={szablon.ramka.odsuniecie ?? 0}
              max={Math.min(szer, wys) / 2}
              zmien={(v) =>
                zmienSz((s) => ({ ...s, ramka: { ...s.ramka!, odsuniecie: v } }), 'ramka-ods')
              }
            />
            {!szablon.ramka.ozdoba && (
              <Liczba
                etykieta={t('wlasciwosci.promienRamki')}
                wartosc={
                  szablon.ramka.promien ??
                  Math.max(
                    0,
                    (szablon.promienRogow ?? 0) -
                      (szablon.ramka.odsuniecie ?? 0) -
                      szablon.ramka.grubosc / 2,
                  )
                }
                max={Math.min(szer, wys) / 2}
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
                const { promien: _p, ...r } = s.ramka!;
                void _p;
                return { ...s, ramka: r };
              })
            }
          >
            {t('wlasciwosci.jakRogiKarty')}
          </button>
        )}
      </Sekcja>
      {szablon.warianty?.length ? <p className="podpis">{t('szablon.warianty')}</p> : null}
      {jedenWezelUwaga(szablon.korzen)}
    </>
  );
}

const jedenWezelUwaga = (k: Wezel) =>
  czyKontener(k) && k.dzieci.length === 0 ? (
    <p className="uwaga">{t('szablon.pustaKarta')}</p>
  ) : null;
