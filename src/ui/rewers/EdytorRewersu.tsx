import { useEffect, useMemo, useRef, useState } from 'react';
import {
  duplikujRewersWProjekcie,
  rewersJakoSzablon,
  szablonDoRewersu,
  ustawStalyObrazRewersu,
  ustawTekstureRewersu,
  zmienRewers,
} from '../../dane/rewers';
import {
  doPoprzedniegoKontenera,
  dostosujDoSwobodnego,
  duplikujWezel,
  nowyWezel,
  opakuj,
  przesunWezel,
  rodzicWezla,
  skopiujStyl,
  ukladZWezlow,
  usunWezly,
  wklejStyl,
  wstawWezel,
  wszystkieWezly,
  wyzej,
  zmienKolejnoscRysowania,
  zmienTypKontenera,
  zmienTypPola,
  zmienWezel,
  znajdzWezel,
  type RodzajNowego,
  type SkopiowanyStyl,
} from '../../dane/szablon';
import { roleProjektu } from '../../dane/edycja';
import { czcionkiSzablonu } from '../../dane/archiwum';
import { czyProjektWlasny } from '../../dane/wlasneKarty';
import { t, tJesliJest } from '../../i18n';
import {
  DOMYSLNE_TLO_KARTY,
  DOMYSLNY_KOLOR_TEKSTU,
  czyKontener,
  rozwinOdstepy,
  type Kontener,
  type Pole,
  type Rewers,
  type Szablon,
  type TrybTla,
  type Wezel,
} from '../../model/szablon';
import { renderujRewers } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import { PoleLiczby } from '../kartka/PoleLiczby';
import { NarzedziaPaska } from '../NaglowekAplikacji';
import { przygotujPlikObrazu } from '../obrazy';
import { tekstOstrzezenia } from '../ostrzezenia';
import { useCzcionkiGlobalne, useSynchronizujCzcionkiGlobalne } from '../zasobyGlobalne';
import { DrzewoSzablonu, nazwaWezla } from '../szablon/DrzewoSzablonu';
import { ElementyWlasneKontekst } from '../szablon/elementyWlasne';
import { Lista, Sekcja, Wybor } from '../szablon/Kontrolki';
import { NakladkaSwobodna } from '../szablon/NakladkaSwobodna';
import { PanelWezla } from '../szablon/PanelWezla';
import { PoleRamki } from '../szablon/PanelWygladu';
import { PanelWyrownania } from '../szablon/PanelWyrownania';
import {
  budujCele,
  celSkalowania,
  SIATKA_DOMYSLNA,
  skalujZaznaczenie,
  zastosujZmiany,
  type Cel,
  type ZmianaPola,
} from '../szablon/swobodnyMysz';
import { upuscWezel } from '../szablon/upuszczanie';
import { useGestSwobodny } from '../szablon/useGestSwobodny';
import { Liczba } from '../szablon/Kontrolki';
import { tekstZapisu, type ProjektWEdycji } from '../useProjekt';

const RODZAJE_REWERSE: RodzajNowego[] = [
  'tekst',
  'wartosc',
  'obraz',
  'ikona',
  'separator',
  'separator-zakonczenia',
  'separator-motyw',
  'swobodny',
  'kolumna',
  'wiersz',
  'warstwy',
];

const wPolu = (e: Element | null) =>
  !!e &&
  (e.matches('input, textarea, select, [contenteditable="true"]') || !!e.closest('[role="menu"]'));

function usePodgladRewersu(kluczRysunku: string, zasoby: ProjektWEdycji['zasoby']['zasoby']) {
  return useMemo(() => {
    if (!kluczRysunku) return undefined;
    const rev = JSON.parse(kluczRysunku) as Rewers;
    try {
      const w = renderujRewers(rev, {
        czcionki: zasoby.czcionki,
        obraz: (id) => zasoby.obrazy.get(id)?.info,
        ...(zasoby.elementy ? { elementy: zasoby.elementy } : {}),
      });
      return {
        ...w,
        svg: scenaDoSvg(w.scena, {
          adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
          przedrostekId: 'rw-',
        }),
      };
    } catch (e) {
      return { blad: e instanceof Error ? e.message : String(e) };
    }
  }, [kluczRysunku, zasoby.czcionki, zasoby.obrazy, zasoby.elementy]);
}

/**
 * Edytor warstwowego rewersu karty: drzewo warstw, swobodny podgląd z przyciąganiem,
 * właściwości tła (4 tryby obrazu), czcionek, ramek i grafik wektorowych.
 */
export function EdytorRewersu({ edycja, rewersId }: { edycja: ProjektWEdycji; rewersId: string }) {
  const { projekt, zmien } = edycja;
  const rewers = projekt.rewersy?.find((r) => r.id === rewersId);
  const { rodzinyGlobalne } = useCzcionkiGlobalne(projekt);
  useSynchronizujCzcionkiGlobalne(edycja, rodzinyGlobalne, rewers ? czcionkiSzablonu(rewers) : []);
  const [zazn, ustawZazn] = useState<string[]>([]);
  const [menuDodaj, ustawMenuDodaj] = useState(false);
  const [schowek, ustawSchowek] = useState<SkopiowanyStyl>();
  const drzewo = useRef<HTMLDivElement>(null);
  const kartaRef = useRef<HTMLDivElement>(null);
  const plikTekstury = useRef<HTMLInputElement>(null);
  const [tmp, ustawTmp] = useState<Map<string, ZmianaPola> | undefined>();
  const [przyciaganie, ustawPrzyciaganie] = useState({ siatka: SIATKA_DOMYSLNA, obiekty: true });
  const [idKopii, ustawIdKopii] = useState('');
  const [bladTekstury, ustawBladTekstury] = useState('');
  const kopia = projekt.rewersy?.find((r) => r.id === idKopii);
  const idProjektu = encodeURIComponent(projekt.id);

  // Każdy zaprojektowany w edytorze rewers trafia automatycznie do biblioteki rewersów
  // (po zapisaniu oraz przy opuszczeniu edytora), żeby można go było wybrać przy dowolnej karcie.
  const aktualnyDoZapisu = useRef<
    { projekt: typeof projekt; dane: typeof edycja.dane } | undefined
  >(undefined);
  useEffect(() => {
    aktualnyDoZapisu.current = rewers ? { projekt, dane: edycja.dane } : undefined;
  }, [projekt, edycja.dane, rewers]);
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
  const aktywne = szablon ? zazn.filter((id) => znajdzWezel(szablon, id)) : [];
  const jeden = szablon && aktywne.length === 1 ? znajdzWezel(szablon, aktywne[0]!) : undefined;

  const zmienRev = (f: (r: Rewers) => Rewers, klucz?: string) =>
    zmien((p) => zmienRewers(p, rewersId, f), klucz ? { klucz: `rewers:${klucz}` } : {});
  const zmienSz = (f: (s: Szablon) => Szablon, klucz?: string) =>
    zmienRev((r) => szablonDoRewersu(r, f(rewersJakoSzablon(r))), klucz);

  const wybierz = (id: string, dodajDo: boolean) =>
    ustawZazn((z) => (dodajDo ? (z.includes(id) ? z.filter((x) => x !== id) : [...z, id]) : [id]));
  const fokusWDrzewie = (id: string) =>
    requestAnimationFrame(() =>
      drzewo.current?.querySelector<HTMLElement>(`[data-wezel="${CSS.escape(id)}"]`)?.focus(),
    );

  const zasoby = edycja.zasoby.zasoby;
  const widocznySzablon = szablon && tmp ? zastosujZmiany(szablon, tmp) : szablon;
  const widocznyRewers =
    rewers && widocznySzablon
      ? { ...szablonDoRewersu(rewers, widocznySzablon), nazwa: '' }
      : undefined;
  const kluczRysunku = widocznyRewers ? JSON.stringify(widocznyRewers) : '';
  const podglad = usePodgladRewersu(kluczRysunku, zasoby);
  const wezlyPoId = useMemo(
    () => new Map(szablon ? wszystkieWezly(szablon).map((w) => [w.id, w] as const) : []),
    [szablon],
  );
  const wezlyKarty = podglad && 'wezly' in podglad ? podglad.wezly : undefined;
  const uklad = useMemo(() => (wezlyKarty ? ukladZWezlow(wezlyKarty) : undefined), [wezlyKarty]);

  const gest = useGestSwobodny({
    szablon,
    wezly: wezlyKarty,
    zaznaczone: aktywne,
    ustawZazn,
    karta: kartaRef,
    szerMm: rewers ? rewers.rozmiar.szerokosc : 1,
    przyciaganie,
    ustawTmp,
    upusc: (cel) => zmienSz((s) => upuscWezel(s, cel)),
    zatwierdz: (zmiany, klucz) => zmienSz((s) => zastosujZmiany(s, zmiany), klucz),
  });

  const cel = jeden ?? szablon?.korzen;
  const dodaj = (r: RodzajNowego) => {
    if (!cel) return;
    let noweId = '';
    zmienSz((s) => {
      const c = znajdzWezel(s, cel.id) ?? s.korzen;
      const rodzic = czyKontener(c) ? c : rodzicWezla(s, c.id)?.rodzic;
      const w = nowyWezel(s, r, t(`wezel.${r}`), {
        wWierszu: rodzic?.typ === 'wiersz',
        bezKlucza: true,
      });
      const nowy = rodzic?.typ === 'swobodny' ? dostosujDoSwobodnego(w) : w;
      noweId = nowy.id;
      return wstawWezel(s, c.id, nowy);
    });
    if (noweId) ustawZazn([noweId]);
    ustawMenuDodaj(false);
  };
  const usun = () => {
    if (!szablon) return;
    const ids = aktywne.filter((id) => id !== szablon.korzen.id);
    if (ids.length === 0) return;
    const r = rodzicWezla(szablon, ids[0]!);
    const nastepny =
      r?.rodzic.dzieci.find((d, i) => i > r.indeks && !ids.includes(d.id)) ??
      [...(r?.rodzic.dzieci ?? [])]
        .reverse()
        .find((d, i, arr) => arr.length - 1 - i < r!.indeks && !ids.includes(d.id)) ??
      r?.rodzic;
    zmienSz((s) => usunWezly(s, ids));
    ustawZazn(nastepny ? [nastepny.id] : []);
    if (nastepny) fokusWDrzewie(nastepny.id);
  };
  const duplikuj = () => {
    if (!szablon || !jeden || jeden.id === szablon.korzen.id) return;
    let noweId = '';
    zmienSz((s) => {
      const d = duplikujWezel(s, jeden.id, t('szablon.kopia'));
      noweId = d.id;
      return d.szablon;
    });
    if (noweId) ustawZazn([noweId]);
  };
  const ruch = (f: (s: Szablon, id: string) => Szablon) => {
    if (!jeden) return;
    zmienSz((s) => f(s, jeden.id));
    fokusWDrzewie(jeden.id);
  };
  const opakujW = (typ: 'wiersz' | 'kolumna') => {
    if (aktywne.length === 0) return;
    let noweId = '';
    zmienSz((s) => {
      const o = opakuj(s, aktywne, typ, t(`wezel.${typ}`));
      noweId = o.id;
      return o.szablon;
    });
    if (noweId) ustawZazn([noweId]);
  };

  const przyciskDodaj = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuDodaj) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const poza = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && e.target !== przyciskDodaj.current)
        ustawMenuDodaj(false);
    };
    window.addEventListener('pointerdown', poza);
    return () => window.removeEventListener('pointerdown', poza);
  }, [menuDodaj]);
  const klawiszMenu = (e: React.KeyboardEvent) => {
    const pozycje = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = pozycje.indexOf(document.activeElement as HTMLElement);
    const kCel =
      e.key === 'ArrowDown'
        ? pozycje[(i + 1) % pozycje.length]
        : e.key === 'ArrowUp'
          ? pozycje[(i - 1 + pozycje.length) % pozycje.length]
          : e.key === 'Home'
            ? pozycje[0]
            : e.key === 'End'
              ? pozycje.at(-1)
              : undefined;
    if (kCel) {
      e.preventDefault();
      kCel.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      ustawMenuDodaj(false);
      przyciskDodaj.current?.focus();
    }
  };

  const klawisze = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const obsluzKlawisz = (e: KeyboardEvent) => {
    if (wPolu(document.activeElement)) return;
    if (gest.aktywny()) {
      if (e.key === 'Escape') gest.anuluj();
      if (!['Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) e.preventDefault();
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const wDrzewie = !!drzewo.current?.contains(document.activeElement);
    if (ctrl && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) edycja.ponow();
      else edycja.cofnij();
    } else if (ctrl && k === 'y') {
      e.preventDefault();
      edycja.ponow();
    } else if (ctrl && k === 'd') {
      e.preventDefault();
      duplikuj();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      usun();
    } else if (e.key === 'Escape') {
      if (!gest.anuluj()) ustawZazn([]);
    } else if (
      !e.altKey &&
      !ctrl &&
      kartaRef.current?.contains(document.activeElement) &&
      gest.strzalki(e)
    ) {
      e.preventDefault();
    } else if (
      wDrzewie &&
      ['ArrowUp', 'ArrowDown', 'Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(e.key)
    ) {
      e.preventDefault();
      const elementy = [...drzewo.current!.querySelectorAll<HTMLElement>('[data-wezel]')];
      const biezacy = document.activeElement as HTMLElement;
      const i = elementy.indexOf(biezacy);
      const id = biezacy.dataset.wezel;
      if (e.altKey && jeden && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        ruch((s, x) => przesunWezel(s, x, e.key === 'ArrowUp' ? -1 : 1));
        return;
      }
      let nast: HTMLElement | undefined;
      if (e.key === 'ArrowUp') nast = elementy[Math.max(0, i - 1)];
      else if (e.key === 'ArrowDown') nast = elementy[Math.min(elementy.length - 1, i + 1)];
      else if (e.key === 'Home') nast = elementy[0];
      else if (e.key === 'End') nast = elementy.at(-1);
      else if (e.key === 'ArrowLeft' && szablon && id) {
        const r = rodzicWezla(szablon, id);
        nast = r ? elementy.find((x) => x.dataset.wezel === r.rodzic.id) : undefined;
      } else if (e.key === 'ArrowRight' && szablon && id) {
        const w = wezlyPoId.get(id);
        const pierwsze = w && czyKontener(w) ? w.dzieci[0] : undefined;
        nast = pierwsze ? elementy.find((x) => x.dataset.wezel === pierwsze.id) : undefined;
      }
      if (nast?.dataset.wezel) {
        const nid = nast.dataset.wezel;
        if (e.shiftKey) ustawZazn((z) => (z.includes(nid) ? z : [...z, nid]));
        else ustawZazn([nid]);
        nast.focus();
      }
    } else if (wDrzewie && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      const id = (document.activeElement as HTMLElement).dataset.wezel;
      if (id) wybierz(id, ctrl);
    }
  };
  useEffect(() => {
    klawisze.current = obsluzKlawisz;
  });
  useEffect(() => {
    const f = (e: KeyboardEvent) => klawisze.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  if (!rewers || !szablon) {
    return (
      <section className="tresc">
        <h1>{t('rewers.brak')}</h1>
        <a href={`#/projekt/${idProjektu}`}>{t('szablon.wrocDoKartek')}</a>
      </section>
    );
  }

  const wgrajStalyObraz = async (poleId: string, plik: File, sygnal: AbortSignal) => {
    const pole = znajdzWezel(szablon, poleId);
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

  const wgrajTeksture = async (plik: File) => {
    ustawBladTekstury('');
    try {
      const obraz = await przygotujPlikObrazu(plik);
      await edycja.zmienZZasobami((p, d) => ustawTekstureRewersu(p, d, rewersId, plik.name, obraz));
    } catch (e) {
      ustawBladTekstury(e instanceof Error ? e.message : String(e));
    }
  };

  const { szer, wys } = { szer: rewers.rozmiar.szerokosc, wys: rewers.rozmiar.wysokosc };
  const celeZazn: Cel[] = wezlyKarty ? budujCele(szablon, wezlyKarty, aktywne) : [];
  const celUchwytow = celeZazn.length === aktywne.length ? celSkalowania(celeZazn) : undefined;
  const prostokatUchwytow =
    gest.stan?.rodzaj !== 'przesun' ? (celUchwytow?.lokalne ?? celUchwytow?.rect) : undefined;
  const rozmiarZaznaczenia =
    celUchwytow && celeZazn.length > 1 ? (
      <Sekcja tytul={t('nakladka.rozmiarZaznaczenia')} otwarta>
        {(['szer', 'wys'] as const).map((os) => (
          <Liczba
            key={os}
            etykieta={t(`nakladka.zaznaczenie.${os}`)}
            wartosc={Math.round(celUchwytow.rect[os] * 1000) / 1000}
            min={1}
            zmien={(wartosc) => {
              const rect = celUchwytow.rect;
              if (Math.abs(rect[os] - wartosc) < 0.0005) return;
              zmienSz(
                (s) =>
                  zastosujZmiany(
                    s,
                    skalujZaznaczenie(s, celeZazn, rect, { ...rect, [os]: wartosc }),
                  ),
                `rozmiar-zaznaczenia:${aktywne.join(',')}:${os}`,
              );
            }}
          />
        ))}
      </Sekcja>
    ) : undefined;
  const wyrownanie =
    celeZazn.length > 0 &&
    celeZazn.length === aktywne.length &&
    new Set(aktywne.map((id) => rodzicWezla(szablon, id)?.rodzic.id)).size === 1 ? (
      <PanelWyrownania
        cele={celeZazn}
        zastosuj={(zmiany) => zmienSz((x) => zastosujZmiany(x, zmiany))}
      />
    ) : undefined;

  const korzen = (id: string) => id === szablon.korzen.id;
  const rodzice = new Set(aktywne.map((id) => rodzicWezla(szablon, id)?.rodzic.id));
  const moznaOpakowac = aktywne.length > 0 && rodzice.size === 1 && !rodzice.has(undefined);
  const r1 = jeden && !korzen(jeden.id) ? rodzicWezla(szablon, jeden.id) : undefined;
  const moznaWyzej = !!r1 && r1.indeks > 0;
  const moznaNizej = !!r1 && r1.indeks < r1.rodzic.dzieci.length - 1;
  const poprzedni = r1 ? r1.rodzic.dzieci[r1.indeks - 1] : undefined;
  const moznaDoKontenera = !!poprzedni && czyKontener(poprzedni);
  const moznaWyjac = !!r1 && r1.rodzic.id !== szablon.korzen.id;
  const korzenZazn = !jeden || jeden.id === szablon.korzen.id;
  const zaznWezly = aktywne.map((id) => wezlyPoId.get(id)).filter((w): w is Wezel => !!w);
  const edytowany =
    zaznWezly.length > 0 &&
    !aktywne.includes(szablon.korzen.id) &&
    zaznWezly.every((w) => w.typ === zaznWezly[0]!.typ)
      ? zaznWezly[0]
      : undefined;
  const rodzicSw = (() => {
    if (!edytowany) return undefined;
    const rp = aktywne.map((id) => rodzicWezla(szablon, id)?.rodzic);
    const r = rp[0];
    return r?.typ === 'swobodny' && rp.every((x) => x?.id === r.id) ? r : undefined;
  })();
  const rozmiaryKotwicy = (id: string) => {
    const rodzic = rodzicWezla(szablon, id)?.rodzic;
    const e = wezlyKarty?.find((x) => x.id === id);
    const r = rodzic && wezlyKarty?.find((x) => x.id === rodzic.id);
    if (!e || !r || !rodzic) return undefined;
    const p = rozwinOdstepy(rodzic.padding);
    const zamienione = e.obrot === 90 || e.obrot === 270;
    return {
      ramka: { szer: r.lokalne.szer - p.lewo - p.prawo, wys: r.lokalne.wys - p.gora - p.dol },
      element: zamienione
        ? { szer: e.lokalne.wys, wys: e.lokalne.szer }
        : { szer: e.lokalne.szer, wys: e.lokalne.wys },
    };
  };
  const wymiary = (id: string) => wezlyKarty?.find((w) => w.id === id);

  const rodziny = [
    ...new Set([
      ...projekt.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [z.rodzina] : [])),
      ...rodzinyGlobalne,
    ]),
  ];
  const czcionki = [
    ...roleProjektu(projekt).map((r) => ({
      wartosc: r,
      tekst: t('wlasciwosci.rola', { rola: tJesliJest(`rola.${r}`) ?? r }),
    })),
    ...rodziny.map((r) => ({ wartosc: r, tekst: r })),
  ];
  const obrazy = projekt.zasoby.flatMap((z) =>
    z.rodzaj === 'obraz' ? [{ wartosc: z.id, tekst: z.nazwa }] : [],
  );
  const opcjeObrazyTla = [{ wartosc: '', tekst: t('dekoracje.brakTekstury') }, ...obrazy];
  if (rewers.teksturaTla && !opcjeObrazyTla.some((o) => o.wartosc === rewers.teksturaTla))
    opcjeObrazyTla.push({
      wartosc: rewers.teksturaTla,
      tekst: t('dekoracje.brakZasobu', { id: rewers.teksturaTla }),
    });

  return (
    <ElementyWlasneKontekst.Provider
      value={{
        elementy: projekt.biblioteka?.ozdobniki ?? [],
        adresBiblioteki: `#/projekt/${idProjektu}/biblioteka`,
        adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
      }}
    >
      <div className="edytor-szablonu">
        <header className="pasek-gorny" role="banner">
          <a href="#/" className="logo">
            {t('aplikacja.nazwa')}
          </a>
          <input
            className="nazwa-projektu"
            title={rewers.nazwa}
            aria-label={t('rewers.nazwa')}
            value={rewers.nazwa}
            onChange={(e) => zmienRev((r) => ({ ...r, nazwa: e.target.value }), 'nazwa')}
          />
          <span className="status-zapisu" role="status">
            {tekstZapisu(edycja.zapis)}
          </span>
          <span className="odstep" />
          <a className="przycisk" href={`#/projekt/${idProjektu}/biblioteka`}>
            {t('biblioteka.tytul')}
          </a>
          <button
            type="button"
            aria-label={t('kartka.cofnij')}
            disabled={!edycja.mozeCofnac}
            onClick={edycja.cofnij}
          >
            ↶
          </button>
          <button
            type="button"
            aria-label={t('kartka.ponow')}
            disabled={!edycja.mozePonowic}
            onClick={edycja.ponow}
          >
            ↷
          </button>
          <button
            type="button"
            onClick={() => {
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
          >
            {t('szablony.duplikuj')}
          </button>
          <a
            className="przycisk"
            href={
              czyProjektWlasny(projekt) &&
              projekt.talie.every((tl) => tl.karty.length === 0) &&
              projekt.szablony.length === 1 &&
              projekt.szablony[0]!.korzen.dzieci.length === 0 &&
              projekt.nazwa === rewers.nazwa
                ? '#/wlasne/nowy'
                : `#/projekt/${idProjektu}/drukuj`
            }
          >
            {t('pasek.powrot')}
          </a>
          <a className="przycisk glowny" href={`#/projekt/${idProjektu}`}>
            {t('szablon.robKarty')}
          </a>
          <NarzedziaPaska />
        </header>
        <h1 className="tylko-czytnik">{t('rewers.tytulEdytora')}</h1>
        <div role="status">
          {kopia && (
            <a href={`#/projekt/${idProjektu}/rewers/${encodeURIComponent(kopia.id)}`}>
              {t('rewers.otworzKopie', { nazwa: kopia.nazwa })}
            </a>
          )}
        </div>
        <div className="uklad-szablonu">
          <aside className="panel-drzewa" aria-label={t('rewers.warstwy')}>
            <h2>{t('rewers.warstwy')}</h2>
            <div ref={drzewo}>
              <DrzewoSzablonu korzen={szablon.korzen} zaznaczone={aktywne} wybierz={wybierz} />
            </div>
            <div className="akcje-drzewa">
              <div className="menu-dodaj">
                <button
                  ref={przyciskDodaj}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuDodaj}
                  onClick={() => ustawMenuDodaj((x) => !x)}
                >
                  {t('szablon.dodaj')}
                </button>
                {menuDodaj && (
                  <div
                    ref={menu}
                    className="menu-typu"
                    role="menu"
                    aria-label={t('szablon.dodaj')}
                    onKeyDown={klawiszMenu}
                  >
                    {RODZAJE_REWERSE.map((r) => (
                      <button
                        key={r}
                        type="button"
                        role="menuitem"
                        className="menu-pozycja"
                        onClick={() => dodaj(r)}
                      >
                        <span>{t(`wezel.${r}`)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={!moznaWyzej}
                onClick={() => ruch((s, id) => przesunWezel(s, id, -1))}
              >
                {t('szablon.wyzej')}
              </button>
              <button
                type="button"
                disabled={!moznaNizej}
                onClick={() => ruch((s, id) => przesunWezel(s, id, 1))}
              >
                {t('szablon.nizej')}
              </button>
              <button
                type="button"
                disabled={!moznaDoKontenera}
                onClick={() => ruch(doPoprzedniegoKontenera)}
              >
                {t('szablon.doKontenera')}
              </button>
              <button type="button" disabled={!moznaWyjac} onClick={() => ruch(wyzej)}>
                {t('szablon.wyjmij')}
              </button>
              <button type="button" disabled={!moznaOpakowac} onClick={() => opakujW('wiersz')}>
                {t('szablon.opakujWiersz')}
              </button>
              <button type="button" disabled={!moznaOpakowac} onClick={() => opakujW('kolumna')}>
                {t('szablon.opakujKolumne')}
              </button>
              <button type="button" disabled={!jeden || korzenZazn} onClick={duplikuj}>
                {t('kartka.duplikuj')}
              </button>
              <button
                type="button"
                className="niebezpieczny"
                disabled={aktywne.length === 0 || aktywne.includes(szablon.korzen.id)}
                onClick={usun}
              >
                {t('kartka.usun')}
              </button>
            </div>
            <p className="podpis">{t('szablon.pomocDrzewa')}</p>
          </aside>

          <section className="podglad-szablonu" aria-label={t('rewers.podgladEtykieta')}>
            {podglad && 'blad' in podglad ? (
              <p role="alert" className="uwaga">
                {t('szablon.bladPodgladu', { szczegoly: String(podglad.blad) })}
              </p>
            ) : (
              podglad && (
                <>
                  <div
                    ref={kartaRef}
                    className="karta-podgladu"
                    role="group"
                    aria-label={t('nakladka.opis')}
                    tabIndex={0}
                    style={{
                      aspectRatio: `${szer} / ${wys}`,
                      width: `min(100%, ${(szer / wys) * 70}vh)`,
                      touchAction: 'none',
                    }}
                    onPointerDown={gest.onPointerDown}
                    onPointerMove={gest.onPointerMove}
                    onPointerUp={gest.onPointerUp}
                    onPointerCancel={gest.onPointerCancel}
                    onLostPointerCapture={gest.onLostPointerCapture}
                  >
                    <div
                      className="svg-opakowanie"
                      dangerouslySetInnerHTML={{ __html: podglad.svg }}
                    />
                    {[...podglad.wezly]
                      .sort(
                        (a, b) => b.lokalne.szer * b.lokalne.wys - a.lokalne.szer * a.lokalne.wys,
                      )
                      .map((w) => {
                        const wezel = wezlyPoId.get(w.id);
                        if (!wezel) return null;
                        const r = w.obrys
                          ? {
                              x: w.obrys.x - w.lokalne.szer / 2,
                              y: w.obrys.y - w.lokalne.wys / 2,
                              szer: w.lokalne.szer,
                              wys: w.lokalne.wys,
                            }
                          : w;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            tabIndex={-1}
                            className={`obszar-wezla${aktywne.includes(w.id) ? ' zaznaczony' : ''}${czyKontener(wezel) ? ' kontener' : ''}`}
                            data-obszar={w.id}
                            aria-label={nazwaWezla(wezel)}
                            style={{
                              left: `${(r.x / szer) * 100}%`,
                              top: `${(r.y / wys) * 100}%`,
                              width: `${(r.szer / szer) * 100}%`,
                              height: `${(r.wys / wys) * 100}%`,
                              ...(w.obrys ? { transform: `rotate(${w.obrys.kat}deg)` } : {}),
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (e.detail === 0) wybierz(w.id, e.shiftKey);
                            }}
                          />
                        );
                      })}
                    <NakladkaSwobodna
                      szer={szer}
                      wys={wys}
                      stan={gest.stan}
                      siatka={przyciaganie.siatka}
                      prostokat={prostokatUchwytow}
                      obrot={celUchwytow?.lokalne ? celUchwytow.obrot : 0}
                      uchwytDown={gest.onUchwytDown}
                      uchwytKlawisz={(u, e) => {
                        if (e.altKey || e.ctrlKey || e.metaKey) return;
                        if (gest.strzalkiUchwytu(u, e)) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                    />
                  </div>
                  <div className="narzedzia-podgladu">
                    <fieldset>
                      <legend>{t('przyciaganie.tytul')}</legend>
                      <PoleLiczby
                        id="przyciaganie-siatka"
                        etykieta={t('przyciaganie.siatka')}
                        wartosc={przyciaganie.siatka}
                        min={0}
                        max={20}
                        krok={0.5}
                        zmien={(v) => ustawPrzyciaganie({ ...przyciaganie, siatka: v })}
                      />
                      <label className="pole-wyboru">
                        <input
                          type="checkbox"
                          checked={przyciaganie.obiekty}
                          onChange={(e) =>
                            ustawPrzyciaganie({ ...przyciaganie, obiekty: e.target.checked })
                          }
                        />{' '}
                        {t('przyciaganie.obiekty')}
                      </label>
                      <p className="podpis">{t('przyciaganie.alt')}</p>
                    </fieldset>
                  </div>
                  {podglad.ostrzezenia.length > 0 && (
                    <ul className="ostrzezenia-karty">
                      {podglad.ostrzezenia.map((o, i) => {
                        const w = znajdzWezel(szablon, o.pole);
                        return (
                          <li key={i}>
                            {tekstOstrzezenia({ ...o, pole: w ? nazwaWezla(w) : o.pole })}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )
            )}
            <p className="podpis">{t('rewers.pomocPodgladu')}</p>
          </section>

          <aside className="panel-edytora" aria-label={t('szablon.wlasciwosci')}>
            {rozmiarZaznaczenia}
            {edytowany ? (
              <>
                <h2>
                  {aktywne.length > 1
                    ? t('szablon.zaznaczono', { liczba: aktywne.length })
                    : nazwaWezla(edytowany)}
                </h2>
                <p className="akcje-stylu">
                  <button
                    type="button"
                    onClick={() => ustawSchowek(skopiujStyl(edytowany, szablon))}
                  >
                    {t('wlasciwosci.kopiujStyl')}
                  </button>
                  <button
                    type="button"
                    disabled={!schowek}
                    onClick={() =>
                      schowek &&
                      zmienSz((s) =>
                        aktywne.reduce(
                          (x, id) => zmienWezel(x, id, (w) => wklejStyl(w, schowek)),
                          s,
                        ),
                      )
                    }
                  >
                    {t('wlasciwosci.wklejStyl')}
                  </button>
                </p>
                <PanelWezla
                  key={aktywne.join(',')}
                  szablon={szablon}
                  wezel={edytowany}
                  zmienSzablon={zmienSz}
                  wiele={aktywne.length > 1}
                  wymiary={wymiary(edytowany.id)}
                  czcionki={czcionki}
                  obrazy={obrazy}
                  {...(aktywne.length === 1
                    ? {
                        wgrajStalyObraz: (plik: File, sygnal: AbortSignal) =>
                          wgrajStalyObraz(edytowany.id, plik, sygnal),
                      }
                    : {})}
                  zajeteKlucze={() => []}
                  bezDanych
                  {...(rodzicSw ? { rodzicSwobodny: rodzicSw } : {})}
                  rozmiaryKotwicy={rozmiaryKotwicy}
                  {...(wyrownanie ? { wyrownanie } : {})}
                  mozeNaSwobodny={!!wezlyKarty}
                  kolejnosc={(jak) => zmienSz((s) => zmienKolejnoscRysowania(s, edytowany.id, jak))}
                  zmienWezel={(f, klucz) =>
                    zmienSz(
                      (s) => aktywne.reduce((x, id) => zmienWezel(x, id, f), s),
                      klucz && `${klucz}:${aktywne.join(',')}`,
                    )
                  }
                  zmienTyp={(typ) =>
                    zmienSz((s) =>
                      aktywne.reduce(
                        (x, id) =>
                          czyKontener(edytowany)
                            ? zmienTypKontenera(x, id, typ as Kontener['typ'], uklad)
                            : zmienTypPola(x, id, typ as Pole['typ'], t(`wezel.${typ}`), [], true),
                        s,
                      ),
                    )
                  }
                  zmienPrzyklad={() => undefined}
                />
              </>
            ) : aktywne.length > 1 ? (
              <>
                <h2>{t('szablon.zaznaczono', { liczba: aktywne.length })}</h2>
                <p className="podpis">{t('szablon.wieleOpis')}</p>
                {wyrownanie && (
                  <fieldset className="polozenie">
                    <legend>
                      <strong>{t('polozenie.tytul')}</strong>
                    </legend>
                    {wyrownanie}
                  </fieldset>
                )}
              </>
            ) : (
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
                    zmien={(v) =>
                      zmienRev((r) => ({ ...r, rozmiar: { ...r.rozmiar, wysokosc: v } }), 'wys')
                    }
                  />
                </div>
                <div className="pole-panelu">
                  <label htmlFor="rewers-tlo-kolor">{t('kreator.kolor')}</label>
                  <input
                    id="rewers-tlo-kolor"
                    type="color"
                    value={rewers.tlo ?? DOMYSLNE_TLO_KARTY}
                    onChange={(e) => zmienRev((r) => ({ ...r, tlo: e.target.value }), 'tlo')}
                  />
                </div>
                <Sekcja tytul={t('dekoracje.tlo')} otwarta>
                  <Lista
                    etykieta={t('dekoracje.tekstura')}
                    opcje={opcjeObrazyTla}
                    wartosc={rewers.teksturaTla ?? ''}
                    zmien={(v) =>
                      zmienRev((r) => {
                        const x = { ...r };
                        if (v) x.teksturaTla = v;
                        else {
                          delete x.teksturaTla;
                          delete x.teksturaTryb;
                          delete x.teksturaKrycie;
                          delete x.teksturaZabarwienie;
                        }
                        return x;
                      })
                    }
                  />
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
                        if (f) void wgrajTeksture(f);
                      }}
                    />
                  </div>
                  {bladTekstury && (
                    <p role="alert" className="blad-pola">
                      {bladTekstury}
                    </p>
                  )}
                  {rewers.teksturaTla && (
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
                  )}
                </Sekcja>
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
                          zmienRev(
                            (r) => ({ ...r, ramka: { ...r.ramka!, odsuniecie: v } }),
                            'ramka-ods',
                          )
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
                            zmienRev(
                              (r) => ({ ...r, ramka: { ...r.ramka!, promien: v } }),
                              'ramka-prom',
                            )
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
            )}
          </aside>
        </div>
      </div>
    </ElementyWlasneKontekst.Provider>
  );
}
