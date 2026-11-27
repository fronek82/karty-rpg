import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  dodajRewersZPaczki,
  eksportujRewers,
  eksportujSzablon,
  importujRewers,
  importujSzablon,
  ROZSZERZENIE_SZABLONU,
} from '../../dane/archiwum';
import { roleSzablonu, type WpisSzablonu } from '../../dane/bibliotekaSzablonow';
import {
  czyZasobProjektu,
  przepiszObrazElementu,
  przepiszZasobyProjektu,
} from '../../dane/bibliotekaUzytkownika';
import { cofnij, ponow, pustaHistoria, zapamietaj, type Historia } from '../../dane/historia';
import { projektZPakietu } from '../../dane/pakiet';
import { nowyRewers } from '../../dane/rewers';
import { BladDanych } from '../../dane/schemat';
import { dodajSzablonZKartka, PAKIET_WLASNY, pakietWlasny } from '../../dane/wlasneKarty';
import { t, tn } from '../../i18n';
import type { DaneZasobow, Projekt } from '../../model/projekt';
import { wymiaryKarty } from '../../model/szablon';
import { AktywnyProjektKontekst } from '../AktywnyProjektKontekst';
import { baza } from '../bazaUI';
import { zapiszMiniatureWpisuSzablonu } from '../miniaturaRewersu';
import { OknoModalne } from '../OknoModalne';
import { nazwaPliku } from '../pliki';
import { zapiszZakladkeStart } from '../start/ListaProjektow';
import { polaczElementy, useElementyOzdobne } from '../useBiblioteka';
import type { ProjektWEdycji, StanZapisu } from '../useProjekt';
import { dolaczZasobyGlobalne } from '../zasobyGlobalne';
import { zasobyProjektu } from '../zasobyProjektu';
import type { PlikSzablonuEdytora, TrybBibliotekiEdytora } from './EdytorDrzewa';
import { EdytorKarty } from './EdytorKarty';

async function pobierzCzcionke(plik: string): Promise<Uint8Array> {
  const odp = await fetch(`${import.meta.env.BASE_URL}czcionki/${plik}`);
  if (!odp.ok) throw new Error(`${plik}: HTTP ${odp.status}`);
  return new Uint8Array(await odp.arrayBuffer());
}

/** Nowe zasoby i ozdobniki wgrane podczas edycji szablonu trafiają od razu do biblioteki użytkownika. */
async function dodajNoweDoBiblioteki(
  przed: Projekt,
  po: Projekt,
  dane: DaneZasobow,
): Promise<{ obrazy: Map<string, string>; elementy: Map<string, string> }> {
  const obrazy = new Map<string, string>();
  const elementy = new Map<string, string>();
  const byly = new Set(przed.zasoby.map((o) => o.id));
  const byloEl = new Set((przed.biblioteka?.ozdobniki ?? []).map((e) => e.id));
  const noweEl = (po.biblioteka?.ozdobniki ?? []).filter((e) => !byloEl.has(e.id));
  const ramki = new Set(
    noweEl.flatMap((e) => (e.ramka9?.zrodlo.typ === 'obraz' ? [e.ramka9.zrodlo.zasob] : [])),
  );
  for (const o of po.zasoby) {
    const d = dane.get(o.id);
    if (byly.has(o.id) || czyZasobProjektu(o) || !d) continue;
    const id = await baza().dodajZasobDoBiblioteki(o, d, { wewnetrzny: ramki.has(o.id) });
    if (id !== o.id && o.rodzaj === 'obraz') obrazy.set(o.id, id);
  }
  for (const e of noweEl) {
    const id = await baza().dodajElementDoBibliotekiUzytkownika(przepiszObrazElementu(e, obrazy));
    if (id !== e.id) elementy.set(e.id, id);
  }
  return { obrazy, elementy };
}

interface ZaladowanySzablon {
  wpis: WpisSzablonu;
  powiazanyPrzodId?: string;
  powiazanyTylId?: string;
  liczbaKopii: number;
  powrotHref: string;
  powrotEtykieta: string;
}

type StanSzablonuBiblioteki =
  | { typ: 'ladowanie' }
  | { typ: 'blad'; komunikat: string }
  | { typ: 'gotowy'; dane: ZaladowanySzablon; edycja: ProjektWEdycji; wpisRef: () => WpisSzablonu };

interface StanEdycjiSzablonu {
  projekt: Projekt;
  dane: DaneZasobow;
  historia: Historia<Projekt>;
  wersja: number;
  niezapisane: boolean;
}

function useSzablonBiblioteki(id: string, zapytanie?: string): StanSzablonuBiblioteki {
  const [stan, ustawStan] = useState<
    | { typ: 'ladowanie' }
    | { typ: 'blad'; komunikat: string }
    | { typ: 'gotowy'; dane: ZaladowanySzablon }
  >({ typ: 'ladowanie' });

  const [ed, ustawEd] = useState<StanEdycjiSzablonu>();
  const [zapis, ustawZapis] = useState<StanZapisu>({ stan: 'zapisano' });

  const refEd = useRef<StanEdycjiSzablonu | undefined>(undefined);
  const refWpis = useRef<WpisSzablonu | undefined>(undefined);
  const { wlasne: wlasneElementy } = useElementyOzdobne();

  useEffect(() => {
    refEd.current = ed;
  }, [ed]);

  // Ostrzeżenie przeglądarki przy zamknięciu karty z niezapisanymi zmianami (jak w useProjekt).
  useEffect(() => {
    const przedZamknieciem = (e: BeforeUnloadEvent) => {
      if (refEd.current?.niezapisane) e.preventDefault();
    };
    window.addEventListener('beforeunload', przedZamknieciem);
    return () => window.removeEventListener('beforeunload', przedZamknieciem);
  }, []);

  useEffect(() => {
    let aktywny = true;

    void (async () => {
      try {
        const wpis = await baza().szablonBiblioteki(id);
        if (!aktywny) return;
        if (!wpis) {
          ustawStan({ typ: 'blad', komunikat: t('szablony.nieZnaleziono') });
          return;
        }

        const [kopie, wszystkieAwersy, powiazanyTyl] = await Promise.all([
          baza().projektyZKopiaSzablonu(wpis.id),
          wpis.rodzaj === 'rewers' ? baza().szablonyBiblioteki('awers') : Promise.resolve([]),
          wpis.rodzaj === 'awers' && wpis.domyslnyRewersId
            ? baza().szablonBiblioteki(wpis.domyslnyRewersId)
            : Promise.resolve(undefined),
        ]);
        if (!aktywny) return;

        const powiazanyPrzod =
          wpis.rodzaj === 'rewers'
            ? wszystkieAwersy.find((a) => a.domyslnyRewersId === wpis.id)
            : undefined;

        // Kontekst powrotu: z projektu (?powrot=/projekt/<pid>/karty) albo do „Moich szablonów”.
        const parametry = new URLSearchParams(zapytanie ?? '');
        const powrotParam = parametry.get('powrot') ?? '';
        let powrotHref = '#/';
        let powrotEtykieta = t('szablony.powrotDoSzablonow');
        const dopasowanieProjektu = /^\/projekt\/([^/]+)/.exec(powrotParam);
        if (dopasowanieProjektu) {
          let projektId: string | undefined;
          try {
            projektId = decodeURIComponent(dopasowanieProjektu[1]!);
          } catch {
            projektId = undefined;
          }
          if (projektId) {
            const lista = await baza().lista();
            const znaleziony = lista.find((p) => p.id === projektId);
            powrotHref = `#${powrotParam}`;
            powrotEtykieta = znaleziony
              ? t('szablony.wrocDoProjektu', { nazwa: znaleziony.nazwa })
              : t('ui2.projektyPowrot');
          }
        } else {
          zapiszZakladkeStart('szablony');
        }
        if (!aktywny) return;

        // Syntetyczny projekt nośny dla EdytorKarty (czcionki domyślne + zasoby globalne).
        const bazowy = await projektZPakietu(
          pakietWlasny([]),
          pobierzCzcionke,
          () => Promise.reject(new Error('brak obrazów')),
          `szablon-edytor:${wpis.id}`,
        );
        const szablony =
          wpis.rodzaj === 'awers' && wpis.szablon
            ? [wpis.szablon]
            : powiazanyPrzod?.szablon
              ? [powiazanyPrzod.szablon]
              : [];
        const rewersy =
          wpis.rodzaj === 'rewers' && wpis.rewers
            ? [wpis.rewers]
            : powiazanyTyl?.rewers
              ? [powiazanyTyl.rewers]
              : [];
        const rolePolaczone = {
          ...bazowy.projekt.role,
          ...(powiazanyPrzod?.role ?? {}),
          ...(powiazanyTyl?.role ?? {}),
          ...wpis.role,
        };
        const syntetyczny: Projekt = {
          ...bazowy.projekt,
          nazwa: wpis.nazwa,
          pakiet: PAKIET_WLASNY,
          role: rolePolaczone,
          szablony,
          ...(rewersy.length > 0 ? { rewersy } : {}),
          ...(wpis.rodzaj === 'awers' && powiazanyTyl?.rewers && wpis.szablon
            ? {
                rewersDomyslny: {
                  [wpis.szablon.id]: powiazanyTyl.rewers.id,
                },
              }
            : powiazanyPrzod?.szablon && wpis.rewers
              ? {
                  rewersDomyslny: {
                    [powiazanyPrzod.szablon.id]: wpis.rewers.id,
                  },
                }
              : {}),
        };
        const zGlobalnymi = await dolaczZasobyGlobalne(syntetyczny, bazowy.zasoby);
        if (!aktywny) return;

        refWpis.current = wpis;
        ustawEd({
          projekt: zGlobalnymi.projekt,
          dane: zGlobalnymi.dane,
          historia: pustaHistoria(),
          wersja: 0,
          niezapisane: false,
        });
        ustawZapis({ stan: 'zapisano' });
        ustawStan({
          typ: 'gotowy',
          dane: {
            wpis,
            ...(powiazanyPrzod ? { powiazanyPrzodId: powiazanyPrzod.id } : {}),
            ...(powiazanyTyl ? { powiazanyTylId: powiazanyTyl.id } : {}),
            liczbaKopii: kopie.length,
            powrotHref,
            powrotEtykieta,
          },
        });
      } catch (e) {
        if (!aktywny) return;
        ustawStan({
          typ: 'blad',
          komunikat: e instanceof Error ? e.message : String(e),
        });
      }
    })();

    return () => {
      aktywny = false;
    };
  }, [id, zapytanie]);

  const projektZElementami = useMemo(() => {
    if (!ed) return undefined;
    const polaczone = polaczElementy(ed.projekt.biblioteka?.ozdobniki ?? [], wlasneElementy);
    return polaczone.length > 0
      ? { ...ed.projekt, biblioteka: { ...ed.projekt.biblioteka, ozdobniki: polaczone } }
      : ed.projekt;
  }, [ed, wlasneElementy]);

  const daneZasobow = ed?.dane;

  const zasoby = useMemo(
    () =>
      projektZElementami && daneZasobow
        ? zasobyProjektu(projektZElementami, daneZasobow)
        : undefined,
    [projektZElementami, daneZasobow],
  );
  useEffect(() => () => zasoby?.zwolnij(), [zasoby]);

  const zmien = useCallback((f: (p: Projekt) => Projekt, opcje?: { klucz?: string }) => {
    ustawEd((pop) => {
      if (!pop) return pop;
      const nowy = f(pop.projekt);
      if (nowy === pop.projekt) return pop;
      return {
        ...pop,
        projekt: nowy,
        historia: zapamietaj(pop.historia, pop.projekt, opcje),
        wersja: pop.wersja + 1,
        niezapisane: true,
      };
    });
  }, []);

  const zmienZZasobami = useCallback(
    async (f: (p: Projekt, d: DaneZasobow) => { projekt: Projekt; dane: DaneZasobow }) => {
      const biezacy = refEd.current;
      if (!biezacy) return;
      const wynik = f(biezacy.projekt, biezacy.dane);
      const dodane = await dodajNoweDoBiblioteki(biezacy.projekt, wynik.projekt, wynik.dane);
      const przepisany = przepiszZasobyProjektu(wynik.projekt, dodane.obrazy, dodane.elementy);
      const noweDane = new Map(wynik.dane);
      for (const [staryId, nowyId] of dodane.obrazy) {
        const b = noweDane.get(staryId);
        if (b) {
          noweDane.delete(staryId);
          noweDane.set(nowyId, b);
        }
      }
      ustawEd((pop) =>
        pop
          ? {
              projekt: przepisany,
              dane: noweDane,
              historia: zapamietaj(pop.historia, pop.projekt),
              wersja: pop.wersja + 1,
              niezapisane: true,
            }
          : pop,
      );
    },
    [],
  );

  const cofnijEdycje = useCallback(() => {
    ustawEd((pop) => {
      if (!pop) return pop;
      const po = cofnij(pop.historia, pop.projekt);
      if (!po) return pop;
      return {
        ...pop,
        projekt: po.stan,
        historia: po.historia,
        wersja: pop.wersja + 1,
        niezapisane: true,
      };
    });
  }, []);

  const ponowEdycje = useCallback(() => {
    ustawEd((pop) => {
      if (!pop) return pop;
      const po = ponow(pop.historia, pop.projekt);
      if (!po) return pop;
      return {
        ...pop,
        projekt: po.stan,
        historia: po.historia,
        wersja: pop.wersja + 1,
        niezapisane: true,
      };
    });
  }, []);

  const zapiszTeraz = useCallback(async () => {
    const wpis = refWpis.current;
    const biezacy = refEd.current;
    if (!wpis || !biezacy) return;
    const wersjaPrzed = biezacy.wersja;
    const { projekt } = biezacy;
    ustawZapis({ stan: 'zapisywanie' });
    try {
      let zaktualizowany: WpisSzablonu;
      if (wpis.rodzaj === 'awers') {
        const sz = projekt.szablony[0];
        if (!sz) throw new BladDanych(t('szablony.nieZnaleziono'));
        zaktualizowany = await baza().zapiszSzablonWBibliotece({
          ...wpis,
          nazwa: sz.nazwa,
          szablon: sz,
          role: roleSzablonu(sz, projekt.role),
        });
      } else {
        const rw = projekt.rewersy?.[0];
        if (!rw) throw new BladDanych(t('szablony.nieZnaleziono'));
        zaktualizowany = await baza().zapiszSzablonWBibliotece({
          ...wpis,
          nazwa: rw.nazwa,
          rewers: rw,
          role: roleSzablonu(rw, projekt.role),
        });
      }
      refWpis.current = zaktualizowany;
      await zapiszMiniatureWpisuSzablonu(zaktualizowany).catch(() => undefined);
      // Oznacz jako zapisane tylko jeśli użytkownik nie wprowadził kolejnych zmian podczas zapisu.
      if (refEd.current?.wersja === wersjaPrzed) {
        ustawEd((pop) =>
          pop && pop.wersja === wersjaPrzed ? { ...pop, niezapisane: false } : pop,
        );
        ustawZapis({ stan: 'zapisano' });
      } else {
        ustawZapis({ stan: 'niezapisane' });
      }
    } catch (e) {
      ustawZapis({
        stan: 'blad',
        komunikat: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }, []);

  if (stan.typ === 'blad') return stan;
  if (stan.typ === 'ladowanie' || !ed || !projektZElementami || !zasoby) {
    return { typ: 'ladowanie' };
  }
  const stanZapisuEfektywny: StanZapisu =
    zapis.stan === 'zapisywanie' || zapis.stan === 'blad'
      ? zapis
      : ed.niezapisane
        ? { stan: 'niezapisane' }
        : { stan: 'zapisano' };

  const edycja: ProjektWEdycji = {
    projekt: projektZElementami,
    dane: ed.dane,
    zasoby,
    ostrzezenia: [],
    zapis: stanZapisuEfektywny,
    niezapisane: ed.niezapisane,
    zapiszTeraz,
    zmien,
    cofnij: cofnijEdycje,
    ponow: ponowEdycje,
    mozeCofnac: ed.historia.przeszle.length > 0,
    mozePonowic: ed.historia.przyszle.length > 0,
    wersja: ed.wersja,
    zmienZZasobami,
  };
  return {
    typ: 'gotowy',
    dane: stan.dane,
    edycja,
    wpisRef: () => refWpis.current ?? stan.dane.wpis,
  };
}

/**
 * Samodzielny edytor szablonu lub tyłu poza projektem (`#/szablon/<id>`, Plan S, S4, sekcja 5.4).
 * Działa bezpośrednio na tabeli `szablony` („Moje szablony”) bez ruszania kopii w projektach.
 */
export function EdytorSzablonuStrona({ id, zapytanie }: { id: string; zapytanie?: string }) {
  const stan = useSzablonBiblioteki(id, zapytanie);
  const [kopiaWlasna, ustawKopieWlasna] = useState<{ adres: string; tekst: string }>();
  const [potwierdzUsuniecie, ustawPotwierdzUsuniecie] = useState(false);
  const dodajeTyl = useRef(false);

  if (stan.typ === 'blad') {
    return (
      <section className="tresc">
        <h1>{t('projekt.bladTytul')}</h1>
        <p role="alert" className="uwaga">
          {stan.komunikat}
        </p>
        <a href="#/">{t('szablony.powrotDoSzablonow')}</a>
      </section>
    );
  }
  if (stan.typ === 'ladowanie') {
    return <p className="tresc">{t('projekty.wczytywanie')}</p>;
  }

  const { edycja, wpisRef } = stan;
  const { wpis, powiazanyPrzodId, powiazanyTylId, liczbaKopii, powrotHref, powrotEtykieta } =
    stan.dane;
  const strona = wpis.rodzaj === 'rewers' ? 'tyl' : 'przod';
  const idKarty =
    strona === 'przod'
      ? (edycja.projekt.szablony[0]?.id ?? wpis.id)
      : (edycja.projekt.rewersy?.[0]?.id ?? wpis.id);
  const biezacaNazwa =
    strona === 'przod'
      ? (edycja.projekt.szablony[0]?.nazwa ?? wpis.nazwa)
      : (edycja.projekt.rewersy?.[0]?.nazwa ?? wpis.nazwa);

  const sufiksZapytania = zapytanie ? `?${zapytanie}` : '';
  const adresPrzod =
    strona === 'przod'
      ? `#/szablon/${encodeURIComponent(wpis.id)}${sufiksZapytania}`
      : powiazanyPrzodId
        ? `#/szablon/${encodeURIComponent(powiazanyPrzodId)}${sufiksZapytania}`
        : undefined;
  const adresTyl =
    strona === 'tyl'
      ? `#/szablon/${encodeURIComponent(wpis.id)}${sufiksZapytania}`
      : powiazanyTylId
        ? `#/szablon/${encodeURIComponent(powiazanyTylId)}${sufiksZapytania}`
        : undefined;

  const dodajTyl = async () => {
    if (wpis.rodzaj !== 'awers' || dodajeTyl.current) return;
    const p = edycja.projekt;
    const sz = p.szablony[0] ?? wpis.szablon;
    if (!sz) return;
    dodajeTyl.current = true;
    try {
      const wym = wymiaryKarty(sz);
      const { projekt: zRewersem, id: rewersId } = nowyRewers(p, {
        nazwa: `${sz.nazwa} (${t('projekty.stronaRewers')})`,
        rozmiar: { szerokosc: wym.szer, wysokosc: wym.wys },
      });
      const r = zRewersem.rewersy?.find((x) => x.id === rewersId);
      if (!r) return;
      const dodany = await baza().dodajRewersDoBiblioteki(r, roleSzablonu(r, p.role), {
        bezDeduplikacji: true,
      });
      const wpisTylu = await baza().szablonBiblioteki(dodany.id);
      if (wpisTylu) await zapiszMiniatureWpisuSzablonu(wpisTylu).catch(() => undefined);
      const zapisanyPrzod = await baza().zapiszSzablonWBibliotece({
        ...wpisRef(),
        szablon: sz,
        nazwa: sz.nazwa,
        role: roleSzablonu(sz, p.role),
        domyslnyRewersId: dodany.id,
      });
      await zapiszMiniatureWpisuSzablonu(zapisanyPrzod).catch(() => undefined);
      window.location.hash = `#/szablon/${encodeURIComponent(dodany.id)}${sufiksZapytania}`;
    } finally {
      dodajeTyl.current = false;
    }
  };

  const duplikujWlasne = () => {
    void (async () => {
      const p = edycja.projekt;
      const aktualnyWpis = wpisRef();
      const dodany =
        strona === 'przod' && p.szablony[0]
          ? await baza().dodajSzablonDoBiblioteki(
              p.szablony[0],
              roleSzablonu(p.szablony[0], p.role),
              {
                ...(aktualnyWpis.domyslnyRewersId
                  ? { domyslnyRewersId: aktualnyWpis.domyslnyRewersId }
                  : {}),
                bezDeduplikacji: true,
              },
            )
          : p.rewersy?.[0]
            ? await baza().dodajRewersDoBiblioteki(
                p.rewersy[0],
                roleSzablonu(p.rewersy[0], p.role),
                { bezDeduplikacji: true },
              )
            : undefined;
      if (!dodany) return;
      const nowyWpis = await baza().szablonBiblioteki(dodany.id);
      if (nowyWpis) await zapiszMiniatureWpisuSzablonu(nowyWpis).catch(() => undefined);
      ustawKopieWlasna({
        adres: `#/szablon/${encodeURIComponent(dodany.id)}${sufiksZapytania}`,
        tekst:
          strona === 'tyl'
            ? t('rewers.otworzKopie', { nazwa: nowyWpis?.nazwa ?? wpis.nazwa })
            : t('szablony.otworzKopie', { nazwa: nowyWpis?.nazwa ?? wpis.nazwa }),
      });
    })();
  };

  const wykonajUsuniecie = () => {
    void (async () => {
      await baza().usunSzablonZBiblioteki(wpis.id);
      zapiszZakladkeStart('szablony');
      window.location.hash = powrotHref;
    })();
  };

  const plikSzablonuWlasny: PlikSzablonuEdytora = {
    eksportuj: () => {
      const p = edycja.projekt;
      const d = edycja.dane;
      if (strona === 'przod') {
        const { bajty, ostrzezenia } = eksportujSzablon(p, d, idKarty);
        const nazwa = p.szablony[0]?.nazwa ?? wpis.nazwa;
        return { bajty, nazwa: nazwaPliku(nazwa, ROZSZERZENIE_SZABLONU), ostrzezenia };
      }
      const bajty = eksportujRewers(p, d, idKarty);
      const nazwa = p.rewersy?.[0]?.nazwa ?? wpis.nazwa;
      return { bajty, nazwa: nazwaPliku(nazwa, ROZSZERZENIE_SZABLONU), ostrzezenia: [] };
    },
    importuj: async (bajty) => {
      if (strona === 'przod') {
        const paczka = importujSzablon(bajty);
        let nazwaImportu = paczka.szablon.nazwa;
        let ostrzezenia: string[] = [];
        await edycja.zmienZZasobami((p, d) => {
          const w = dodajSzablonZKartka(p, d, paczka);
          const dodany = w.projekt.szablony.find((s) => s.id === w.szablonId);
          if (!dodany) return { projekt: p, dane: d };
          nazwaImportu = dodany.nazwa;
          ostrzezenia = w.ostrzezenia;
          return {
            projekt: {
              ...w.projekt,
              szablony: [{ ...dodany, id: idKarty }],
            },
            dane: w.zasoby,
          };
        });
        return {
          adres: '',
          tekst: t('szablony.zastapiono', { nazwa: nazwaImportu }),
          ostrzezenia,
        };
      }
      const paczka = importujRewers(bajty);
      let nazwaImportu = paczka.rewers.nazwa;
      await edycja.zmienZZasobami((p, d) => {
        const w = dodajRewersZPaczki(p, d, paczka);
        const dodany = w.projekt.rewersy?.find((r) => r.id === w.rewersId);
        if (!dodany) return { projekt: p, dane: d };
        nazwaImportu = dodany.nazwa;
        return {
          projekt: {
            ...w.projekt,
            rewersy: [{ ...dodany, id: idKarty }],
          },
          dane: w.dane,
        };
      });
      return {
        adres: '',
        tekst: t('szablony.zastapiono', { nazwa: nazwaImportu }),
        ostrzezenia: [],
      };
    },
  };

  const trybBiblioteki: TrybBibliotekiEdytora = {
    etykietaPowrotu: powrotEtykieta,
    hrefPowrotu: powrotHref,
    ...(liczbaKopii > 0 ? { dopisekKopii: tn('szablony.dopisekKopii', liczbaKopii) } : {}),
    adresPrzod,
    adresTyl,
    ...(strona === 'przod' && !adresTyl ? { onDodajTyl: () => void dodajTyl() } : {}),
    onUsun: () => ustawPotwierdzUsuniecie(true),
  };

  return (
    <AktywnyProjektKontekst.Provider value={edycja}>
      <EdytorKarty
        key={`${strona}:${idKarty}`}
        edycja={edycja}
        strona={strona}
        id={idKarty}
        trybBiblioteki={trybBiblioteki}
        duplikujWlasne={duplikujWlasne}
        {...(kopiaWlasna ? { kopiaWlasna } : {})}
        plikSzablonuWlasny={plikSzablonuWlasny}
      />
      {potwierdzUsuniecie && (
        <OknoModalne
          tytul={t('szablony.usunPotwierdzTytul', { nazwa: biezacaNazwa })}
          zamknij={() => ustawPotwierdzUsuniecie(false)}
        >
          <p>{t('szablony.usunPotwierdzOpis')}</p>
          {liczbaKopii > 0 && <p className="podpis">{tn('szablony.dopisekKopii', liczbaKopii)}</p>}
          <div className="przyciski-okna">
            <button type="button" onClick={() => ustawPotwierdzUsuniecie(false)}>
              {t('nowyProjekt.anuluj')}
            </button>
            <button type="button" className="glowny" onClick={wykonajUsuniecie}>
              {t('edytor.menuSzablon.usun')}
            </button>
          </div>
        </OknoModalne>
      )}
    </AktywnyProjektKontekst.Provider>
  );
}
