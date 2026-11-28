import { useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  aktualizujRewersWProjekcie,
  aktualizujSzablonWProjekcie,
  dodajKopieRewersuDoProjektu,
  dodajKopieSzablonuDoProjektu,
  przeniesKartyNaSzablon,
  wykryjNowszeWersje,
  type NowaWersjaSzablonu,
} from '../../dane/aktualizacjaSzablonu';
import { roleSzablonu, type WpisSzablonu } from '../../dane/bibliotekaSzablonow';
import { kolumnySzablonu, ustawDane } from '../../dane/edycja';
import { przypiszRewers, rewersKarty } from '../../dane/rewers';
import { nazwaKarty } from '../../dane/szablon';
import { t } from '../../i18n';
import type { Karta, PrzypisanieRewersu, Rewers, Szablon, Talia } from '../../model/szablon';
import { renderujKarte, renderujRewers, type KontekstRenderowania } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import { baza } from '../bazaUI';
import { zapiszMiniatureWpisuSzablonu } from '../miniaturaRewersu';
import { usePasekKomunikatu } from '../PasekKomunikatu';
import { nazwaPliku, zapiszPlik } from '../pliki';
import type { WartosciImportu } from '../../dane/importTabeli';
import { ImportDanych } from '../kartka/ImportDanych';
import { OknoNowySzablon } from '../start/OknoNowySzablon';
import { NaglowekProjektu, type DefinicjaKroku, type StanZapisuUi2 } from '../ui2/NaglowekProjektu';
import { PasekBoczny, type GrupaPaskaBocznego } from '../ui2/PasekBoczny';
import type { ProjektWEdycji } from '../useProjekt';
import { useSkrotZapisu, useStrazWyjscia } from '../zapisReczny';
import { OknoAktualizacjiSzablonu } from './OknoAktualizacjiSzablonu';
import { OknoPrzeniesieniaKart } from './OknoPrzeniesieniaKart';
import './kartyUi2.css';

interface WpisKarty {
  talia: Talia;
  karta: Karta;
  szablon: Szablon | undefined;
  rewers: Rewers | undefined;
  etykieta: string;
}

function unikalneIdKarty(talie: readonly Talia[]): string {
  const uzyte = new Set(talie.flatMap((tl) => tl.karty.map((k) => k.id)));
  let n = uzyte.size + 1;
  while (uzyte.has(`k-${n}`)) n++;
  return `k-${n}`;
}

function komorkaCsv(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

/**
 * Ekran „Krok 2: Karty” (UI2 R6, wzór: docs/makiety-ui2/Karty.dc.html).
 * Służy wyłącznie do wypełniania danych kart, liczby kopii i wyboru tyłu (decyzja D9).
 * Działa bezpośrednio na `projekt.talie` bez zmian w modelu ani silniku.
 */
export function EkranKart({ edycja }: { edycja: ProjektWEdycji }) {
  const { projekt, zmien, zasoby: zEdycji } = edycja;
  const zasoby = zEdycji.zasoby;
  const idProjektu = encodeURIComponent(projekt.id);

  useSkrotZapisu(edycja.zapiszTeraz);
  const { sprawdzWyjscie, okno: oknoWyjscia } = useStrazWyjscia(edycja);

  const [widok, ustawWidok] = useState<'podglad' | 'tabela'>('podglad');
  const [strona, ustawStrona] = useState<'przod' | 'tyl' | 'obie'>('przod');
  const [szukaj, ustawSzukaj] = useState('');
  const [filtrSzablonu, ustawFiltrSzablonu] = useState('');
  const [zaznaczone, ustawZaznaczone] = useState<string[]>([]);
  const [nadUpuszczaniem, ustawNadUpuszczaniem] = useState(false);
  const [szukajBiblioteki, ustawSzukajBiblioteki] = useState('');
  const [oknoNowegoSzablonu, ustawOknoNowegoSzablonu] = useState(false);
  const [oknoPrzeniesienia, ustawOknoPrzeniesienia] = useState(false);
  const [oknoImportu, ustawOknoImportu] = useState(false);
  const [wpisySzablonow, ustawWpisySzablonow] = useState<WpisSzablonu[]>([]);
  const [aktualizowanyCel, ustawAktualizowanyCel] = useState<
    { rodzaj: 'awers' | 'rewers'; idWProjekcie: string } | undefined
  >();
  const [wersjaKomunikatu, ustawWersjeKomunikatu] = useState<number | undefined>();
  const { pasek: pasekKomunikatu, pokaz: pokazKomunikat } = usePasekKomunikatu();

  const odswiezSzablonyBiblioteki = () => {
    void baza()
      .szablonyBiblioteki()
      .then((lista) => ustawWpisySzablonow(lista))
      .catch(() => undefined);
  };

  useEffect(() => {
    let aktywny = true;
    const odswiez = () => {
      void baza()
        .szablonyBiblioteki()
        .then((lista) => {
          if (aktywny) ustawWpisySzablonow(lista);
        })
        .catch(() => undefined);
    };
    odswiez();
    window.addEventListener('focus', odswiez);
    return () => {
      aktywny = false;
      window.removeEventListener('focus', odswiez);
    };
  }, []);

  const nowszeWersje = useMemo(
    () => wykryjNowszeWersje(projekt, wpisySzablonow),
    [projekt, wpisySzablonow],
  );
  const aktualizowanaWersja = useMemo(
    () =>
      aktualizowanyCel
        ? nowszeWersje.find(
            (n) =>
              n.rodzaj === aktualizowanyCel.rodzaj &&
              n.idWProjekcie === aktualizowanyCel.idWProjekcie,
          )
        : undefined,
    [aktualizowanyCel, nowszeWersje],
  );
  const nowszePoSzablonie = useMemo(
    () =>
      new Map(
        nowszeWersje.filter((n) => n.rodzaj === 'awers').map((n) => [n.idWProjekcie, n] as const),
      ),
    [nowszeWersje],
  );

  const szablonyPoId = useMemo(
    () => new Map(projekt.szablony.map((s) => [s.id, s] as const)),
    [projekt.szablony],
  );

  const wszystkieWpisy = useMemo<WpisKarty[]>(() => {
    const rewersyPoId = new Map((projekt.rewersy ?? []).map((r) => [r.id, r] as const));
    const lista: WpisKarty[] = [];
    for (const talia of projekt.talie) {
      for (const karta of talia.karty) {
        const szablon = szablonyPoId.get(karta.szablonId);
        const rewers = rewersKarty(rewersyPoId, karta, szablon ?? {}, talia);
        const nazwa = nazwaKarty(karta.dane, szablon).trim();
        lista.push({
          talia,
          karta,
          szablon,
          rewers,
          etykieta: nazwa || szablon?.nazwa || t('karty.bezNazwy'),
        });
      }
    }
    return lista;
  }, [projekt, szablonyPoId]);

  const widoczneWpisy = useMemo(() => {
    const fraza = szukaj.trim().toLowerCase();
    return wszystkieWpisy.filter((w) => {
      if (filtrSzablonu && w.karta.szablonId !== filtrSzablonu) return false;
      if (!fraza) return true;
      if (w.etykieta.toLowerCase().includes(fraza)) return true;
      if (w.szablon?.nazwa.toLowerCase().includes(fraza)) return true;
      return Object.values(w.karta.dane).some((v) => v.toLowerCase().includes(fraza));
    });
  }, [wszystkieWpisy, filtrSzablonu, szukaj]);

  const aktywneIds = useMemo(() => {
    const dostepne = new Set(wszystkieWpisy.map((w) => w.karta.id));
    const przefiltrowane = zaznaczone.filter((id) => dostepne.has(id));
    if (przefiltrowane.length > 0) return przefiltrowane;
    return widoczneWpisy[0] ? [widoczneWpisy[0].karta.id] : [];
  }, [wszystkieWpisy, widoczneWpisy, zaznaczone]);

  const wybraneWpisy = useMemo(
    () => wszystkieWpisy.filter((w) => aktywneIds.includes(w.karta.id)),
    [wszystkieWpisy, aktywneIds],
  );
  const aktywnyWpis = wybraneWpisy.length === 1 ? wybraneWpisy[0] : undefined;

  const ctxRenderu = useMemo<KontekstRenderowania>(
    () => ({
      czcionki: zasoby.czcionki,
      obraz: (id) => zasoby.obrazy.get(id)?.info,
      ...(zasoby.elementy ? { elementy: zasoby.elementy } : {}),
    }),
    [zasoby.czcionki, zasoby.obrazy, zasoby.elementy],
  );

  const svgPrzodu = (w: WpisKarty, sufiks: string): string => {
    if (!w.szablon) return '';
    try {
      const r = renderujKarte(w.szablon, w.karta, ctxRenderu);
      return scenaDoSvg(r.scena, {
        adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
        przedrostekId: `kp-${sufiks}-${w.karta.id}-`,
      });
    } catch {
      return '';
    }
  };

  const svgTylu = (w: WpisKarty, sufiks: string): string => {
    if (!w.rewers) return '';
    try {
      const r = renderujRewers(
        w.rewers,
        ctxRenderu,
        w.szablon ? { awers: { szablon: w.szablon, dane: w.karta.dane } } : undefined,
      );
      return scenaDoSvg(r.scena, {
        adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
        przedrostekId: `kt-${sufiks}-${w.karta.id}-`,
      });
    } catch {
      return '';
    }
  };

  const dodajKarteSzablonu = (szablonId: string) => {
    const sz = szablonyPoId.get(szablonId);
    if (!sz) return;
    let noweId = '';
    zmien((p) => {
      noweId = unikalneIdKarty(p.talie);
      const nowaKarta: Karta = {
        id: noweId,
        szablonId: sz.id,
        dane: { ...(sz.przyklad ?? {}) },
        ilosc: 1,
      };
      if (p.talie.length === 0) {
        return {
          ...p,
          talie: [{ id: 't-1', nazwa: p.nazwa, karty: [nowaKarta] }],
        };
      }
      const celTalia =
        p.talie.find((tl) => tl.karty.some((k) => k.szablonId === sz.id)) ?? p.talie[0]!;
      return {
        ...p,
        talie: p.talie.map((tl) =>
          tl.id === celTalia.id ? { ...tl, karty: [...tl.karty, nowaKarta] } : tl,
        ),
      };
    });
    if (noweId) ustawZaznaczone([noweId]);
  };

  const duplikujWybrane = () => {
    if (wybraneWpisy.length === 0) return;
    const noweIds: string[] = [];
    zmien((p) => {
      let aktualneTalie = p.talie;
      for (const wpis of wybraneWpisy) {
        const noweId = unikalneIdKarty(aktualneTalie);
        noweIds.push(noweId);
        const kopia: Karta = {
          ...structuredClone(wpis.karta),
          id: noweId,
        };
        aktualneTalie = aktualneTalie.map((tl) =>
          tl.id === wpis.talia.id ? { ...tl, karty: [...tl.karty, kopia] } : tl,
        );
      }
      return { ...p, talie: aktualneTalie };
    });
    if (noweIds.length > 0) ustawZaznaczone(noweIds);
  };

  const usunWybrane = () => {
    if (aktywneIds.length === 0) return;
    const doUsuniecia = new Set(aktywneIds);
    zmien((p) => ({
      ...p,
      talie: p.talie.map((tl) => ({
        ...tl,
        karty: tl.karty.filter((k) => !doUsuniecia.has(k.id)),
      })),
    }));
    ustawZaznaczone([]);
  };

  const zmienPoleKarty = (wpis: WpisKarty, klucz: string, wartosc: string) => {
    zmien((p) => ustawDane(p, wpis.talia.id, wpis.karta.id, klucz, wartosc), {
      klucz: `karty:${wpis.karta.id}:${klucz}`,
    });
  };

  const zmienKopie = (wpis: WpisKarty, nowaIlosc: number) => {
    const ilosc = Math.max(0, Math.min(99, Math.round(nowaIlosc)));
    zmien((p) => ({
      ...p,
      talie: p.talie.map((tl) =>
        tl.id === wpis.talia.id
          ? {
              ...tl,
              karty: tl.karty.map((k) => (k.id === wpis.karta.id ? { ...k, ilosc } : k)),
            }
          : tl,
      ),
    }));
  };

  const wpisyPoId = useMemo(
    () => new Map(wpisySzablonow.map((w) => [w.id, w] as const)),
    [wpisySzablonow],
  );

  const dodajKarteZMoichSzablonow = (wpis: WpisSzablonu) => {
    if (wpis.rodzaj !== 'awers' || !wpis.szablon) return;
    const domyslnyRewers = wpis.domyslnyRewersId ? wpisyPoId.get(wpis.domyslnyRewersId) : undefined;
    let noweId = '';
    zmien((p) => {
      const dodany = dodajKopieSzablonuDoProjektu(
        p,
        wpis,
        domyslnyRewers ? { domyslnyRewers } : {},
      );
      const sz = dodany.projekt.szablony.find((s) => s.id === dodany.szablonId);
      if (!sz) return dodany.projekt;
      noweId = unikalneIdKarty(dodany.projekt.talie);
      const nowaKarta: Karta = {
        id: noweId,
        szablonId: sz.id,
        dane: { ...(sz.przyklad ?? {}) },
        ilosc: 1,
      };
      if (dodany.projekt.talie.length === 0) {
        return {
          ...dodany.projekt,
          talie: [{ id: 't-1', nazwa: dodany.projekt.nazwa, karty: [nowaKarta] }],
        };
      }
      const celTalia = dodany.projekt.talie[0]!;
      return {
        ...dodany.projekt,
        talie: dodany.projekt.talie.map((tl) =>
          tl.id === celTalia.id ? { ...tl, karty: [...tl.karty, nowaKarta] } : tl,
        ),
      };
    });
    if (noweId) ustawZaznaczone([noweId]);
  };

  const zmienTylKarty = (wpis: WpisKarty, wartosc: string) => {
    if (wartosc.startsWith('bib:')) {
      const idBib = wartosc.slice(4);
      const wpisTylu = wpisyPoId.get(idBib);
      if (!wpisTylu || wpisTylu.rodzaj !== 'rewers') return;
      zmien((p) => {
        const dodany = dodajKopieRewersuDoProjektu(p, wpisTylu);
        return przypiszRewers(
          dodany.projekt,
          { rodzaj: 'karta', taliaId: wpis.talia.id, id: wpis.karta.id },
          dodany.rewersId,
        );
      });
      return;
    }
    const cel: PrzypisanieRewersu | undefined =
      wartosc === '__domyslny__' ? undefined : wartosc === '__brak__' ? null : wartosc;
    zmien((p) =>
      przypiszRewers(p, { rodzaj: 'karta', taliaId: wpis.talia.id, id: wpis.karta.id }, cel),
    );
  };

  const eksportujCsv = () => {
    const sz =
      (filtrSzablonu ? szablonyPoId.get(filtrSzablonu) : aktywnyWpis?.szablon) ??
      projekt.szablony[0];
    if (!sz) return;
    const kolumny = kolumnySzablonu(sz);
    const naglowek = [
      ...kolumny.map((k) => komorkaCsv(k.klucz)),
      komorkaCsv(t('karty.kolumnaKopie')),
    ].join(',');
    const wiersze = wszystkieWpisy
      .filter((w) => w.karta.szablonId === sz.id)
      .map((w) =>
        [
          ...kolumny.map((k) => komorkaCsv(w.karta.dane[k.klucz] ?? '')),
          String(w.karta.ilosc),
        ].join(','),
      );
    const tresc = `\uFEFF${[naglowek, ...wiersze].join('\r\n')}`;
    zapiszPlik(
      new TextEncoder().encode(tresc),
      'text/csv;charset=utf-8',
      nazwaPliku(sz.nazwa, 'csv'),
    );
  };

  const wybierzKarte = (
    id: string,
    e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) => {
    if (e.ctrlKey || e.metaKey) {
      ustawZaznaczone((pop) => (pop.includes(id) ? pop.filter((x) => x !== id) : [...pop, id]));
    } else if (e.shiftKey && aktywneIds.length > 0) {
      const listaIds = widoczneWpisy.map((w) => w.karta.id);
      const start = listaIds.indexOf(aktywneIds[0]!);
      const koniec = listaIds.indexOf(id);
      if (start !== -1 && koniec !== -1) {
        const [a, b] = start < koniec ? [start, koniec] : [koniec, start];
        ustawZaznaczone(listaIds.slice(a, b + 1));
        return;
      }
      ustawZaznaczone([id]);
    } else {
      ustawZaznaczone([id]);
    }
  };

  const onUpuscSzablon = (e: DragEvent) => {
    e.preventDefault();
    ustawNadUpuszczaniem(false);
    const bibId = e.dataTransfer.getData('application/x-karty-bib-szablon').trim();
    if (bibId) {
      const wpis = wpisyPoId.get(bibId);
      if (wpis) {
        dodajKarteZMoichSzablonow(wpis);
        return;
      }
    }
    const szId = (
      e.dataTransfer.getData('application/x-karty-szablon') ||
      e.dataTransfer.getData('text/plain') ||
      ''
    ).trim();
    if (szId && szablonyPoId.has(szId)) {
      dodajKarteSzablonu(szId);
    }
  };

  const sumaKopii = wszystkieWpisy.reduce((acc, w) => acc + w.karta.ilosc, 0);
  const przyblizoneArkusze = sumaKopii === 0 ? 0 : Math.ceil(sumaKopii / 9);

  // Plan S (S5, D-S4): projekt ma wyłącznie kroki 1 Karty → 2 Druk (szablony edytuje się w Moich szablonach).
  const kroki: DefinicjaKroku[] = [
    { id: 'karty', numer: 1, etykieta: t('ui2.krok.karty'), href: `#/projekt/${idProjektu}/karty` },
    { id: 'druk', numer: 2, etykieta: t('ui2.krok.druk'), href: `#/projekt/${idProjektu}/drukuj` },
  ];

  const stanZapisu: StanZapisuUi2 =
    edycja.zapis.stan === 'zapisywanie'
      ? 'zapisywanie'
      : edycja.niezapisane
        ? 'niezapisane'
        : 'zapisano';

  const zatwierdzAktualizacje = (zmiana: NowaWersjaSzablonu) => {
    const docelowaWersja = edycja.wersja + 1;
    if (zmiana.rodzaj === 'awers') {
      zmien(
        (p) => aktualizujSzablonWProjekcie(p, zmiana.idWProjekcie, zmiana.wpisBiblioteki).projekt,
      );
    } else {
      zmien((p) => aktualizujRewersWProjekcie(p, zmiana.idWProjekcie, zmiana.wpisBiblioteki));
    }
    ustawAktualizowanyCel(undefined);
    ustawWersjeKomunikatu(docelowaWersja);
    pokazKomunikat({
      tekst:
        zmiana.liczbaKart > 0
          ? t('karty.aktualizacja.zaktualizowano', {
              n: zmiana.liczbaKart,
              nazwa: zmiana.wpisBiblioteki.nazwa,
            })
          : t('karty.aktualizacja.zaktualizowanoSzablon', {
              nazwa: zmiana.wpisBiblioteki.nazwa,
            }),
      akcja: {
        etykieta: t('pasek.cofnij'),
        wykonaj: () => {
          ustawWersjeKomunikatu(undefined);
          edycja.cofnij();
        },
      },
    });
  };

  const przeniesWybraneNaSzablon = (docelowySzablonId: string) => {
    const cel = szablonyPoId.get(docelowySzablonId);
    if (!cel || aktywneIds.length === 0) return;
    const zbior = new Set(aktywneIds);
    const wynik = przeniesKartyNaSzablon(projekt, zbior, docelowySzablonId);
    if (wynik.przeniesioneKarty === 0) {
      ustawOknoPrzeniesienia(false);
      return;
    }
    const docelowaWersja = edycja.wersja + 1;
    zmien((p) => przeniesKartyNaSzablon(p, zbior, docelowySzablonId).projekt);
    ustawOknoPrzeniesienia(false);
    ustawWersjeKomunikatu(docelowaWersja);
    pokazKomunikat({
      tekst: t('karty.przenies.przeniesiono', { n: wynik.przeniesioneKarty, nazwa: cel.nazwa }),
      akcja: {
        etykieta: t('pasek.cofnij'),
        wykonaj: () => {
          ustawWersjeKomunikatu(undefined);
          edycja.cofnij();
        },
      },
    });
  };

  // Szablony z „Moich szablonów” nieobecne jeszcze w projekcie (porównane po zrodlo.id).
  const zrodlaAwersowWProjekcie = useMemo(
    () => new Set(projekt.szablony.map((s) => s.zrodlo?.id).filter((x): x is string => !!x)),
    [projekt.szablony],
  );
  const szablonyZBiblioteki = useMemo(
    () => wpisySzablonow.filter((w) => w.rodzaj === 'awers' && !zrodlaAwersowWProjekcie.has(w.id)),
    [wpisySzablonow, zrodlaAwersowWProjekcie],
  );
  const widoczneZBiblioteki = useMemo(() => {
    const f = szukajBiblioteki.trim().toLocaleLowerCase('pl');
    if (!f) return szablonyZBiblioteki;
    return szablonyZBiblioteki.filter((w) => w.nazwa.toLocaleLowerCase('pl').includes(f));
  }, [szablonyZBiblioteki, szukajBiblioteki]);

  const zrodlaRewersowWProjekcie = useMemo(
    () => new Set((projekt.rewersy ?? []).map((r) => r.zrodlo?.id).filter((x): x is string => !!x)),
    [projekt.rewersy],
  );
  const rewersyZBiblioteki = useMemo(
    () =>
      wpisySzablonow.filter((w) => w.rodzaj === 'rewers' && !zrodlaRewersowWProjekcie.has(w.id)),
    [wpisySzablonow, zrodlaRewersowWProjekcie],
  );

  const powrotKarty = encodeURIComponent(`/projekt/${idProjektu}/karty`);

  const otworzWMoichSzablonach = async (sz: Szablon) => {
    if (sz.zrodlo?.id && wpisyPoId.has(sz.zrodlo.id)) {
      window.location.hash = `#/szablon/${encodeURIComponent(sz.zrodlo.id)}?powrot=${powrotKarty}`;
      return;
    }
    const byloNiezapisane = edycja.niezapisane;
    const dodany = await baza().dodajSzablonDoBiblioteki(sz, roleSzablonu(sz, projekt.role));
    const wpis = await baza().szablonBiblioteki(dodany.id);
    if (wpis) await zapiszMiniatureWpisuSzablonu(wpis).catch(() => undefined);
    zmien((p) => ({
      ...p,
      szablony: p.szablony.map((x) =>
        x.id === sz.id ? { ...x, zrodlo: { id: dodany.id, hash: dodany.hash } } : x,
      ),
    }));
    if (!byloNiezapisane) {
      await edycja.zapiszTeraz().catch(() => undefined);
    }
    window.location.hash = `#/szablon/${encodeURIComponent(dodany.id)}?powrot=${powrotKarty}`;
  };

  const grupyPaska: GrupaPaskaBocznego[] = [
    {
      id: 'w-projekcie',
      nazwa: t('karty.grupaWProjekcie'),
      pozycje: projekt.szablony.map((sz) => {
        const maNowsza = nowszePoSzablonie.has(sz.id);
        return {
          id: `sz-${sz.id}`,
          nazwa: sz.nazwa,
          ...(maNowsza ? { odznaka: '●', podpowiedz: t('karty.nowszaWersja') } : {}),
          ikona: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
          przeciagane: true,
          onKlik: () => dodajKarteSzablonu(sz.id),
          onPoczatekPrzeciagania: (e: DragEvent<HTMLButtonElement>) => {
            e.dataTransfer.setData('application/x-karty-szablon', sz.id);
            e.dataTransfer.setData('text/plain', sz.id);
            e.dataTransfer.effectAllowed = 'copy';
          },
        };
      }),
    },
    {
      id: 'moje-szablony',
      nazwa: t('karty.grupaZMoichSzablonow'),
      naglowekDodatkowy:
        szablonyZBiblioteki.length > 0 ? (
          <input
            type="search"
            className="karty-ui2-pasek-szukaj"
            aria-label={t('karty.szukajZMoichSzablonow')}
            placeholder={t('karty.szukajZMoichSzablonow')}
            value={szukajBiblioteki}
            onChange={(e) => ustawSzukajBiblioteki(e.target.value)}
          />
        ) : undefined,
      pozycje: [
        ...widoczneZBiblioteki.map((w) => ({
          id: `bib-${w.id}`,
          nazwa: w.nazwa,
          ikona: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
          przeciagane: true,
          onKlik: () => dodajKarteZMoichSzablonow(w),
          onPoczatekPrzeciagania: (e: DragEvent<HTMLButtonElement>) => {
            e.dataTransfer.setData('application/x-karty-bib-szablon', w.id);
            e.dataTransfer.setData('text/plain', w.id);
            e.dataTransfer.effectAllowed = 'copy';
          },
        })),
        {
          id: 'nowy-szablon',
          nazwa: t('start.nowySzablon'),
          ikona: 'M12 5v14M5 12h14',
          onKlik: () => ustawOknoNowegoSzablonu(true),
        },
      ],
    },
    {
      id: 'dane',
      nazwa: t('karty.grupaDane'),
      pozycje: [
        {
          id: 'import-csv',
          nazwa: t('karty.importCsv'),
          ikona: 'M12 15V3m0 0L8 7m4-4l4 4M4 19h16',
          wylaczona: projekt.szablony.length === 0,
          onKlik: () => {
            if (projekt.szablony.length > 0) ustawOknoImportu(true);
          },
        },
        {
          id: 'eksport-csv',
          nazwa: t('karty.eksportCsv'),
          ikona: 'M12 3v12m0 0l-4-4m4 4l4-4M4 19h16',
          onKlik: eksportujCsv,
        },
      ],
    },
  ];

  // Kolumny dla widoku tabeli (ze wszystkich szablonów widocznych kart lub wybranego filtru).
  const kolumnyTabeli = useMemo(() => {
    const widziane = new Set<string>();
    const wynik: { klucz: string; nazwa: string }[] = [];
    const listaSz = filtrSzablonu
      ? [szablonyPoId.get(filtrSzablonu)].filter((x): x is Szablon => !!x)
      : projekt.szablony;
    for (const sz of listaSz) {
      for (const kol of kolumnySzablonu(sz)) {
        if (widziane.has(kol.klucz)) continue;
        widziane.add(kol.klucz);
        wynik.push({ klucz: kol.klucz, nazwa: kol.nazwa });
      }
    }
    return wynik;
  }, [projekt.szablony, filtrSzablonu, szablonyPoId]);

  const szablonAktywnej = aktywnyWpis?.szablon;
  const kolumnyAktywnej = useMemo(
    () => (szablonAktywnej ? kolumnySzablonu(szablonAktywnej) : []),
    [szablonAktywnej],
  );

  const rewersyProjektu = projekt.rewersy ?? [];
  const wartoscSelectTylu = (k: Karta) =>
    k.rewersId === undefined ? '__domyslny__' : k.rewersId === null ? '__brak__' : k.rewersId;

  return (
    <div className="karty-ui2-ekran">
      <NaglowekProjektu
        nazwaProjektu={projekt.nazwa}
        aktywnyKrok="karty"
        kroki={kroki}
        onNawiguj={sprawdzWyjscie}
        mozeCofnac={edycja.mozeCofnac}
        mozePonowic={edycja.mozePonowic}
        onCofnij={edycja.cofnij}
        onPonow={edycja.ponow}
        stanZapisu={stanZapisu}
        onZapisz={edycja.zapiszTeraz}
        akcjaGlowna={{
          etykieta: t('karty.doDruku'),
          href: `#/projekt/${idProjektu}/drukuj`,
        }}
      />
      {oknoWyjscia}
      <h1 className="tylko-czytnik">{t('karty.tytul')}</h1>

      <div className="karty-ui2-uklad">
        <PasekBoczny
          ekranId="karty"
          tytul={t('karty.dodajKarty')}
          grupy={grupyPaska}
          wskazowka={t('karty.wskazowkaDodaj')}
          domyslnieRozwiniety={true}
        />

        <div className="karty-ui2-srodek">
          <div className="karty-ui2-pasek">
            <div className="karty-ui2-segmenty" role="tablist" aria-label={t('karty.widok')}>
              <button
                type="button"
                role="tab"
                className="karty-ui2-seg"
                aria-selected={widok === 'podglad'}
                onClick={() => ustawWidok('podglad')}
              >
                {t('karty.widokPodglad')}
              </button>
              <button
                type="button"
                role="tab"
                className="karty-ui2-seg"
                aria-selected={widok === 'tabela'}
                onClick={() => ustawWidok('tabela')}
              >
                {t('karty.widokTabela')}
              </button>
            </div>

            <div className="karty-ui2-segmenty" role="tablist" aria-label={t('karty.strona')}>
              <button
                type="button"
                role="tab"
                className="karty-ui2-seg"
                aria-selected={strona === 'przod'}
                onClick={() => ustawStrona('przod')}
              >
                {t('karty.stronaPrzod')}
              </button>
              <button
                type="button"
                role="tab"
                className="karty-ui2-seg"
                aria-selected={strona === 'tyl'}
                onClick={() => ustawStrona('tyl')}
              >
                {t('karty.stronaTyl')}
              </button>
              <button
                type="button"
                role="tab"
                className="karty-ui2-seg"
                aria-selected={strona === 'obie'}
                onClick={() => ustawStrona('obie')}
              >
                {t('karty.stronaObie')}
              </button>
            </div>

            <input
              type="search"
              className="karty-ui2-szukaj"
              aria-label={t('karty.szukaj')}
              placeholder={t('karty.szukaj')}
              value={szukaj}
              onChange={(e) => ustawSzukaj(e.target.value)}
            />

            {projekt.szablony.length > 1 && (
              <select
                className="karty-ui2-filtr"
                aria-label={t('karty.wszystkieSzablony')}
                value={filtrSzablonu}
                onChange={(e) => ustawFiltrSzablonu(e.target.value)}
              >
                <option value="">{t('karty.wszystkieSzablony')}</option>
                {projekt.szablony.map((sz) => (
                  <option key={sz.id} value={sz.id}>
                    {sz.nazwa}
                  </option>
                ))}
              </select>
            )}
          </div>

          {nowszeWersje.length > 0 && (
            <div className="karty-ui2-aktualizacje" data-testid="pasek-nowszych-szablonow">
              {nowszeWersje.map((zm) => (
                <div
                  key={`${zm.rodzaj}:${zm.idWProjekcie}`}
                  className="karty-ui2-aktualizacja-wiersz"
                >
                  <span className="karty-ui2-aktualizacja-odznaka">{t('karty.nowszaWersja')}</span>
                  <span className="karty-ui2-aktualizacja-nazwa">{zm.nazwaWProjekcie}</span>
                  <button
                    type="button"
                    className="karty-ui2-aktualizacja-przycisk"
                    onClick={() =>
                      ustawAktualizowanyCel({ rodzaj: zm.rodzaj, idWProjekcie: zm.idWProjekcie })
                    }
                  >
                    {zm.liczbaKart > 0
                      ? t('karty.aktualizujKarty', { n: zm.liczbaKart })
                      : t('karty.aktualizujSzablon')}
                  </button>
                </div>
              ))}
            </div>
          )}

          <section
            className="karty-ui2-obszar"
            aria-label={t('karty.tytul')}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (!nadUpuszczaniem) ustawNadUpuszczaniem(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) ustawNadUpuszczaniem(false);
            }}
            onDrop={onUpuscSzablon}
          >
            {widok === 'podglad' ? (
              <div className={`karty-ui2-siatka${strona === 'obie' ? ' obie' : ''}`}>
                {widoczneWpisy.map((w) => {
                  const wybrany = aktywneIds.includes(w.karta.id);
                  return (
                    <button
                      key={w.karta.id}
                      type="button"
                      className={`karty-ui2-kafelek${wybrany ? ' wybrany' : ''}`}
                      data-testid="kafelek-karty"
                      data-karta-id={w.karta.id}
                      aria-pressed={wybrany}
                      onClick={(e) => wybierzKarte(w.karta.id, e)}
                    >
                      <div className="karty-ui2-kafelek-obrazy">
                        {(strona === 'przod' || strona === 'obie') && (
                          <div
                            className="karty-ui2-svg-box"
                            data-testid="podglad-przod"
                            dangerouslySetInnerHTML={{ __html: svgPrzodu(w, 'g') }}
                          />
                        )}
                        {(strona === 'tyl' || strona === 'obie') && (
                          <div className="karty-ui2-svg-box" data-testid="podglad-tyl">
                            {w.rewers ? (
                              <div dangerouslySetInnerHTML={{ __html: svgTylu(w, 'g') }} />
                            ) : (
                              <span className="karty-ui2-brak-tylu">
                                {t('karty.brakTyluPodglad')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="karty-ui2-kafelek-stopka">
                        <span className="karty-ui2-kafelek-nazwa">{w.etykieta}</span>
                        {w.karta.ilosc !== 1 && (
                          <span className="karty-ui2-odznaka-kopii" data-testid="odznaka-kopii">
                            ×{w.karta.ilosc}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                <div
                  className={`karty-ui2-upusc${nadUpuszczaniem ? ' nad' : ''}`}
                  data-testid="strefa-upuszczania-szablonu"
                >
                  {wszystkieWpisy.length === 0
                    ? t('karty.brakKart')
                    : t('karty.przeciagnijSzablon')}
                </div>
              </div>
            ) : (
              <div className="karty-ui2-tabela-opak">
                <table className="karty-ui2-tabela" data-testid="tabela-kart">
                  <thead>
                    <tr>
                      <th>{t('karty.kolumnaNumer')}</th>
                      <th>{t('karty.kolumnaSzablon')}</th>
                      {kolumnyTabeli.map((kol) => (
                        <th key={kol.klucz}>{kol.nazwa}</th>
                      ))}
                      <th>{t('karty.kolumnaKopie')}</th>
                      <th>{t('karty.kolumnaTyl')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {widoczneWpisy.map((w, idx) => {
                      const wybrany = aktywneIds.includes(w.karta.id);
                      return (
                        <tr
                          key={w.karta.id}
                          className={wybrany ? 'wybrany' : undefined}
                          onClick={(e) => wybierzKarte(w.karta.id, e)}
                        >
                          <td>{idx + 1}</td>
                          <td>{w.szablon?.nazwa ?? '—'}</td>
                          {kolumnyTabeli.map((kol) => (
                            <td key={kol.klucz}>
                              <input
                                type="text"
                                className="karty-ui2-komorka-input"
                                aria-label={`${w.etykieta} – ${kol.nazwa}`}
                                value={w.karta.dane[kol.klucz] ?? ''}
                                onChange={(e) => zmienPoleKarty(w, kol.klucz, e.target.value)}
                              />
                            </td>
                          ))}
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={99}
                              className="karty-ui2-komorka-input"
                              aria-label={`${w.etykieta} – ${t('karty.kolumnaKopie')}`}
                              value={w.karta.ilosc}
                              onChange={(e) => zmienKopie(w, Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <select
                              aria-label={`${w.etykieta} – ${t('karty.kolumnaTyl')}`}
                              value={wartoscSelectTylu(w.karta)}
                              onChange={(e) => zmienTylKarty(w, e.target.value)}
                            >
                              <option value="__domyslny__">{t('karty.tylDomyslny')}</option>
                              <option value="__brak__">{t('karty.tylBrak')}</option>
                              {rewersyProjektu.length > 0 && (
                                <optgroup label={t('karty.grupaWProjekcie')}>
                                  {rewersyProjektu.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.nazwa}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {rewersyZBiblioteki.length > 0 && (
                                <optgroup label={t('karty.grupaZMoichSzablonow')}>
                                  {rewersyZBiblioteki.map((r) => (
                                    <option key={r.id} value={`bib:${r.id}`}>
                                      {r.nazwa}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="ui2-pasek-stanu" data-testid="pasek-stanu-kart">
            <span>
              {t('karty.stanPodsumowanie', {
                karty: wszystkieWpisy.length,
                kopie: sumaKopii,
                arkusze: przyblizoneArkusze,
              })}
            </span>
          </div>
        </div>

        <aside className="karty-ui2-prawa" aria-label={t('karty.panelTytul')}>
          <div className="karty-ui2-prawa-naglowek">
            <h2 className="karty-ui2-prawa-tytul">
              {wybraneWpisy.length > 1
                ? t('karty.zaznaczonoWiele', { n: wybraneWpisy.length })
                : t('karty.panelTytul')}
            </h2>
            <div className="karty-ui2-prawa-akcje">
              <button
                type="button"
                disabled={wybraneWpisy.length === 0}
                onClick={duplikujWybrane}
                title={t('kartka.duplikuj')}
              >
                ⧉ {t('kartka.duplikuj')}
              </button>
              <button
                type="button"
                className="niebezpieczny"
                disabled={wybraneWpisy.length === 0}
                onClick={usunWybrane}
                title={t('kartka.usun')}
              >
                ✕ {t('kartka.usun')}
              </button>
            </div>
          </div>

          <div className="karty-ui2-prawa-tresc">
            {wybraneWpisy.length > 0 && projekt.szablony.length > 1 && (
              <button
                type="button"
                className="karty-ui2-przenies-btn"
                data-testid="przenies-na-szablon-btn"
                onClick={() => ustawOknoPrzeniesienia(true)}
              >
                {t('karty.przeniesNaSzablon')}
              </button>
            )}

            {aktywnyWpis ? (
              <>
                <div className="karty-ui2-podglad-pary">
                  <div
                    className="karty-ui2-svg-box karty-ui2-podglad-przod"
                    dangerouslySetInnerHTML={{ __html: svgPrzodu(aktywnyWpis, 'p') }}
                  />
                  {aktywnyWpis.rewers && (
                    <div
                      className="karty-ui2-svg-box karty-ui2-podglad-tyl"
                      dangerouslySetInnerHTML={{ __html: svgTylu(aktywnyWpis, 'p') }}
                    />
                  )}
                </div>

                {aktywnyWpis.szablon && (
                  <p className="podpis">
                    {t('karty.kolumnaSzablon')}: <strong>{aktywnyWpis.szablon.nazwa}</strong> ·{' '}
                    {aktywnyWpis.szablon.zrodlo?.id &&
                    wpisyPoId.has(aktywnyWpis.szablon.zrodlo.id) ? (
                      <a
                        href={`#/szablon/${encodeURIComponent(aktywnyWpis.szablon.zrodlo.id)}?powrot=${powrotKarty}`}
                        onClick={(e) =>
                          sprawdzWyjscie(
                            e,
                            `#/szablon/${encodeURIComponent(aktywnyWpis.szablon!.zrodlo!.id)}?powrot=${powrotKarty}`,
                          )
                        }
                      >
                        {t('karty.edytujWMoichSzablonach')}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="karty-ui2-szablon-link"
                        onClick={() => void otworzWMoichSzablonach(aktywnyWpis.szablon!)}
                      >
                        {t('karty.edytujWMoichSzablonach')}
                      </button>
                    )}
                  </p>
                )}

                {kolumnyAktywnej.map((kol) => (
                  <label key={kol.klucz} className="karty-ui2-pole">
                    <span>{kol.nazwa}</span>
                    <input
                      type="text"
                      value={aktywnyWpis.karta.dane[kol.klucz] ?? ''}
                      onChange={(e) => zmienPoleKarty(aktywnyWpis, kol.klucz, e.target.value)}
                    />
                  </label>
                ))}

                <div className="karty-ui2-pole">
                  <span>{t('karty.kopieDoDruku')}</span>
                  <div className="karty-ui2-kopie">
                    <button
                      type="button"
                      aria-label={t('karty.mniejKopii')}
                      data-testid="kopie-minus"
                      onClick={() => zmienKopie(aktywnyWpis, aktywnyWpis.karta.ilosc - 1)}
                    >
                      −
                    </button>
                    <span className="karty-ui2-kopie-liczba" data-testid="kopie-wartosc">
                      {aktywnyWpis.karta.ilosc}
                    </span>
                    <button
                      type="button"
                      aria-label={t('karty.wiecejKopii')}
                      data-testid="kopie-plus"
                      onClick={() => zmienKopie(aktywnyWpis, aktywnyWpis.karta.ilosc + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <label className="karty-ui2-pole">
                  <span>{t('karty.tylKarty')}</span>
                  <select
                    data-testid="wybor-tylu-karty"
                    value={wartoscSelectTylu(aktywnyWpis.karta)}
                    onChange={(e) => zmienTylKarty(aktywnyWpis, e.target.value)}
                  >
                    <option value="__domyslny__">{t('karty.tylDomyslny')}</option>
                    <option value="__brak__">{t('karty.tylBrak')}</option>
                    {rewersyProjektu.length > 0 && (
                      <optgroup label={t('karty.grupaWProjekcie')}>
                        {rewersyProjektu.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nazwa}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {rewersyZBiblioteki.length > 0 && (
                      <optgroup label={t('karty.grupaZMoichSzablonow')}>
                        {rewersyZBiblioteki.map((r) => (
                          <option key={r.id} value={`bib:${r.id}`}>
                            {r.nazwa}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
              </>
            ) : (
              <p className="podpis">{t('karty.wybierzKarte')}</p>
            )}
          </div>
        </aside>
      </div>
      {aktualizowanaWersja && (
        <OknoAktualizacjiSzablonu
          projekt={projekt}
          zmiana={aktualizowanaWersja}
          zasoby={zasoby}
          ctxRenderu={ctxRenderu}
          onZatwierdz={() => zatwierdzAktualizacje(aktualizowanaWersja)}
          onAnuluj={() => ustawAktualizowanyCel(undefined)}
        />
      )}
      {oknoPrzeniesienia &&
        wybraneWpisy.length > 0 &&
        (() => {
          const zrodlowe: Szablon[] = [];
          const widziane = new Set<string>();
          for (const w of wybraneWpisy) {
            if (w.szablon && !widziane.has(w.szablon.id)) {
              widziane.add(w.szablon.id);
              zrodlowe.push(w.szablon);
            }
          }
          const dostepne =
            zrodlowe.length === 1
              ? projekt.szablony.filter((s) => s.id !== zrodlowe[0]!.id)
              : projekt.szablony;
          return (
            <OknoPrzeniesieniaKart
              liczbaKart={wybraneWpisy.length}
              szablonyZrodlowe={zrodlowe}
              dostepneSzablony={dostepne}
              onZatwierdz={przeniesWybraneNaSzablon}
              onAnuluj={() => ustawOknoPrzeniesienia(false)}
            />
          );
        })()}
      {oknoImportu && projekt.szablony.length > 0 && (
        <ImportDanych
          nazwaKartki={projekt.nazwa}
          szablony={projekt.szablony}
          rewersDlaSzablonu={(s) => {
            const rewersy = new Map((projekt.rewersy ?? []).map((r) => [r.id, r]));
            const talia =
              projekt.talie.find((tl) => tl.karty.some((k) => k.szablonId === s.id)) ??
              projekt.talie[0];
            return rewersKarty(rewersy, {}, s, talia ?? {});
          }}
          zasoby={projekt.zasoby}
          zamknij={() => ustawOknoImportu(false)}
          zapisz={(szablonId: string, wiersze: WartosciImportu[]) => {
            if (!szablonyPoId.has(szablonId) || wiersze.length === 0) return false;
            const noweIds: string[] = [];
            const docelowaWersja = edycja.wersja + 1;
            zmien((p) => {
              const uzyte = new Set(p.talie.flatMap((tl) => tl.karty.map((k) => k.id)));
              let n = uzyte.size + 1;
              const noweKarty: Karta[] = wiersze.map((w) => {
                while (uzyte.has(`k-${n}`)) n++;
                const id = `k-${n++}`;
                uzyte.add(id);
                noweIds.push(id);
                return {
                  id,
                  szablonId,
                  dane: { ...w.dane },
                  ilosc: w.ilosc,
                };
              });
              if (p.talie.length === 0) {
                return {
                  ...p,
                  talie: [{ id: 't-1', nazwa: p.nazwa, karty: noweKarty }],
                };
              }
              const celTalia =
                p.talie.find((tl) => tl.karty.some((k) => k.szablonId === szablonId)) ??
                p.talie[0]!;
              return {
                ...p,
                talie: p.talie.map((tl) =>
                  tl.id === celTalia.id ? { ...tl, karty: [...tl.karty, ...noweKarty] } : tl,
                ),
              };
            });
            if (noweIds[0]) ustawZaznaczone([noweIds[0]]);
            ustawWersjeKomunikatu(docelowaWersja);
            pokazKomunikat({
              tekst: t('tabelaImport.zaimportowano', { liczba: wiersze.length }),
              akcja: {
                etykieta: t('pasek.cofnij'),
                wykonaj: () => {
                  ustawWersjeKomunikatu(undefined);
                  edycja.cofnij();
                },
              },
            });
            return true;
          }}
        />
      )}
      {oknoNowegoSzablonu && (
        <OknoNowySzablon
          zamknij={() => ustawOknoNowegoSzablonu(false)}
          onUtworzono={(wynik) => {
            odswiezSzablonyBiblioteki();
            if (!edycja.niezapisane) {
              window.location.hash = `#/szablon/${encodeURIComponent(wynik.id)}?powrot=${powrotKarty}`;
            }
          }}
        />
      )}
      {wersjaKomunikatu === edycja.wersja && pasekKomunikatu}
    </div>
  );
}
