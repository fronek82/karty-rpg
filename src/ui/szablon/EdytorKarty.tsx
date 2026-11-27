import { useEffect, useMemo, useRef, useState } from 'react';
import {
  czcionkiSzablonu,
  dodajRewersZPaczki,
  eksportujRewers,
  eksportujSzablon,
  importujRewers,
  importujSzablon,
  ROZSZERZENIE_SZABLONU,
} from '../../dane/archiwum';
import { ustawStalyObraz } from '../../dane/edycja';
import { opisObrazu } from '../../dane/obrazy';
import { ustawPodklad, usunPodklad } from '../../dane/podklad';
import {
  duplikujRewersWProjekcie,
  przypiszRewers,
  rewersJakoSzablon,
  przodRewersu,
  rewersZPrzykladami,
  szablonDoRewersu,
  unikalnaNazwa,
  ustawStalyObrazRewersu,
  ustawTekstureRewersu,
  zmienRewers,
} from '../../dane/rewers';
import {
  danePodgladu,
  duplikujSzablonWProjekcie,
  kluczeDanychKart,
  zmienSzablon,
  znajdzWezel,
} from '../../dane/szablon';
import {
  czyProjektWlasny,
  dodajSzablonZKartka,
  kartkaDlaSzablonu,
  zmienRozmiarSzablonu,
} from '../../dane/wlasneKarty';
import { t } from '../../i18n';
import type { DaneZasobow, Projekt } from '../../model/projekt';
import { wymiaryKarty, type Rewers, type Szablon } from '../../model/szablon';
import { dopasujZawartosc, opisRozmiaru, powiazania, type Powiazanie } from '../../dane/zgodnosc';
import { renderujKarte, renderujRewers } from '../../silnik/karta';
import { RODZAJE_REWERSU } from './PozycjeMenuDodaj';
import { przygotujPlikObrazu } from '../obrazyUI';
import { nazwaPliku } from '../pliki';
import type { ProjektWEdycji } from '../useProjekt';
import { DostawcaKolorowProjektu } from './koloryProjektu';
import {
  EdytorDrzewa,
  type PlikSzablonuEdytora,
  type RysujPodglad,
  type UstawieniaEdytoraDrzewa,
} from './EdytorDrzewa';
import { DodatkiTeksturyTylu, WgrywanieTekstury } from './TeksturaTylu';
import { PanelKarty, type StronaKarty, type WymiaryKarty } from './PanelKarty';
import { OknoZmianyRozmiaru, useDopasowanieZawartosci, WyborDopasowania } from './ZmianaRozmiaru';

type Obraz = { dane: Uint8Array; szerokosc: number; wysokosc: number };
type WynikZZasobami = { projekt: Projekt; dane: DaneZasobow };

/** Podgląd przodu: karta z danymi przykładowymi (silnik jak na kartce i w PDF). */
const rysujPrzod: RysujPodglad = (klucz, ctx) => {
  const sz = JSON.parse(klucz) as Szablon;
  return renderujKarte(sz, { dane: danePodgladu(sz) }, ctx);
};
/** Podgląd tyłu: pola powiązane z przodem (ta sama nazwa) pokazują wartości przykładowe przodu. */
const rysujTyl: RysujPodglad = (klucz, ctx) => {
  const { rewers, przod } = JSON.parse(klucz) as {
    rewers: Rewers;
    przod?: Pick<Szablon, 'korzen' | 'warianty' | 'przyklad'>;
  };
  return renderujRewers(
    rewers,
    ctx,
    przod
      ? {
          awers: {
            szablon: przod as Szablon,
            dane: danePodgladu(przod as Szablon),
          },
        }
      : undefined,
  );
};

/**
 * Konfiguracja strony karty: wszystko, czym różnią się edytory przodu i tyłu. Sam edytor
 * (`EdytorKarty` → `EdytorDrzewa` + `PanelKarty`) jest jeden.
 */
interface KonfiguracjaStrony {
  /** Segment adresu edytora (`#/projekt/<id>/<segment>/<id>`) – bez zmian w formacie adresów. */
  segment: 'szablon' | 'rewers';
  /** Edytowana karta jako szablon (tył – widok rewersu). */
  znajdz: (p: Projekt, id: string) => Szablon | undefined;
  zmienSzablon: (p: Projekt, id: string, f: (s: Szablon) => Szablon) => Projekt;
  /** Nowe wymiary (mm) i rogi; `p` bez zmian – rozmiar odrzucony (np. nie mieści się na kartce). */
  zmienWymiary: (p: Projekt, id: string, w: WymiaryKarty) => Projekt;
  /** Nazwy kart tej strony w projekcie (unikalna nazwa kopii). */
  nazwy: (p: Projekt) => string[];
  duplikuj: (
    p: Projekt,
    id: string,
    sufiks: (n: number) => string,
  ) => { projekt: Projekt; id: string };
  eksportuj: (
    p: Projekt,
    d: DaneZasobow,
    id: string,
  ) => { bajty: Uint8Array; ostrzezenia: string[] };
  /** Plik szablonu (przód lub tył) wczytany jako nowa karta tej strony. */
  importuj: (
    p: Projekt,
    d: DaneZasobow,
    bajty: Uint8Array,
  ) => WynikZZasobami & { id: string; ostrzezenia: string[] };
  ustawStalyObraz: (
    p: Projekt,
    d: DaneZasobow,
    id: string,
    poleId: string,
    plik: string,
    obraz: Obraz,
  ) => WynikZZasobami;
  kluczRysunku: (p: Projekt, id: string, widoczny: Szablon) => string;
  rysuj: RysujPodglad;
  przedrostekSvg: string;
  miniatura: 'szablon' | 'rewers';
  bezDanych: boolean;
  rodzajeDodaj?: UstawieniaEdytoraDrzewa['rodzajeDodaj'];
  adresPowrotu: (p: Projekt, id: string) => string;
  teksty: () => UstawieniaEdytoraDrzewa['teksty'] & {
    otworzKopie: (nazwa: string) => string;
    zaimportowano: (nazwa: string) => string;
    tytulPanelu: string;
    opisPanelu: string;
  };
}

const sufiksKopii = (n: number) => (n === 1 ? t('szablon.kopia') : t('szablon.kopiaNumer', { n }));

export const STRONY: Record<StronaKarty, KonfiguracjaStrony> = {
  przod: {
    segment: 'szablon',
    znajdz: (p, id) => p.szablony.find((s) => s.id === id),
    nazwy: (p) => p.szablony.map((s) => s.nazwa),
    zmienSzablon,
    zmienWymiary: (p, id, w) => {
      const s = p.szablony.find((x) => x.id === id);
      if (!s) return p;
      let q = p;
      if (
        s.rozmiar.tryb === 'mm' &&
        (s.rozmiar.szerokosc !== w.szer || s.rozmiar.wysokosc !== w.wys)
      ) {
        q = zmienRozmiarSzablonu(p, id, w.szer, w.wys);
        if (q === p) return p;
      }
      return (s.promienRogow ?? 0) === w.promien
        ? q
        : zmienSzablon(q, id, (x) => ({ ...x, promienRogow: w.promien }));
    },
    duplikuj: (p, id, sufiks) => {
      const k = duplikujSzablonWProjekcie(p, id, sufiks);
      return {
        id: k.id,
        projekt: czyProjektWlasny(p) ? k.projekt : kartkaDlaSzablonu(k.projekt, k.id).projekt,
      };
    },
    eksportuj: eksportujSzablon,
    importuj: (p, d, bajty) => {
      // Każdy plik szablonu (także sam tył) wczytuje się jako nowy przód projektu.
      const w = dodajSzablonZKartka(p, d, importujSzablon(bajty));
      return {
        projekt: w.projekt,
        dane: w.zasoby,
        id: w.szablonId,
        ostrzezenia: [...(w.nowaKartka ? [t('szablony.dodanoKartke')] : []), ...w.ostrzezenia],
      };
    },
    ustawStalyObraz,
    // Zależy tylko od tego, co widać na karcie – zmiana nazwy nie rysuje karty od nowa.
    // Podkład ze wzoru nie bierze udziału w rysunku (jest tylko pod podglądem w edytorze).
    kluczRysunku: (_p, _id, w) =>
      JSON.stringify({ ...w, nazwa: '', podklad: undefined, liniePomocnicze: undefined }),
    rysuj: rysujPrzod,
    przedrostekSvg: 'sz-',
    miniatura: 'szablon',
    bezDanych: false,
    adresPowrotu: (p) =>
      czyProjektWlasny(p) ? '#/wlasne' : `#/projekt/${encodeURIComponent(p.id)}`,
    teksty: () => ({
      brak: t('szablon.brak'),
      tytul: t('szablon.tytulEdytora'),
      nazwa: t('szablon.nazwaSzablonu'),
      drzewo: t('szablon.struktura'),
      podglad: t('szablon.podglad'),
      pomocPodgladu: t('szablon.pomocPodgladu'),
      otworzKopie: (nazwa) => t('szablony.otworzKopie', { nazwa }),
      zaimportowano: (nazwa) => t('szablon.zaimportowano', { nazwa }),
      tytulPanelu: t('szablon.karta'),
      opisPanelu: t('szablon.kartaOpis'),
    }),
  },
  tyl: {
    segment: 'rewers',
    znajdz: (p, id) => {
      const r = p.rewersy?.find((x) => x.id === id);
      return r && rewersJakoSzablon(r);
    },
    nazwy: (p) => (p.rewersy ?? []).map((r) => r.nazwa),
    zmienSzablon: (p, id, f) =>
      zmienRewers(p, id, (r) => szablonDoRewersu(r, f(rewersJakoSzablon(r)))),
    zmienWymiary: (p, id, w) =>
      zmienRewers(p, id, (r) => {
        const x: Rewers = { ...r, rozmiar: { tryb: 'mm', szerokosc: w.szer, wysokosc: w.wys } };
        // Rogi bez zmiany (także „jak przód” w starych projektach) zostają nieustawione.
        if ((r.promienRogow ?? 0) !== w.promien) x.promienRogow = w.promien;
        return x;
      }),
    duplikuj: duplikujRewersWProjekcie,
    eksportuj: (p, d, id) => ({ bajty: eksportujRewers(p, d, id), ostrzezenia: [] }),
    importuj: (p, d, bajty) => {
      // Każdy plik szablonu (także przód) wczytuje się jako nowy tył projektu.
      const w = dodajRewersZPaczki(p, d, importujRewers(bajty));
      return { projekt: w.projekt, dane: w.dane, id: w.rewersId, ostrzezenia: [] };
    },
    ustawStalyObraz: ustawStalyObrazRewersu,
    kluczRysunku: (p, id, w) => {
      const r = p.rewersy?.find((x) => x.id === id);
      if (!r) return '';
      const przod = przodRewersu(p, id);
      return JSON.stringify({
        rewers: { ...rewersZPrzykladami(szablonDoRewersu(r, w)), nazwa: '' },
        // Z przodu tylko to, co wpływa na podgląd tyłu: pola (z wariantami) i wartości przykładowe.
        ...(przod
          ? {
              przod: {
                korzen: przod.korzen,
                ...(przod.warianty ? { warianty: przod.warianty } : {}),
                ...(przod.przyklad ? { przyklad: przod.przyklad } : {}),
              },
            }
          : {}),
      });
    },
    rysuj: rysujTyl,
    przedrostekSvg: 'rw-',
    miniatura: 'rewers',
    bezDanych: true,
    rodzajeDodaj: RODZAJE_REWERSU,
    adresPowrotu: (p, id) => {
      const r = p.rewersy?.find((x) => x.id === id);
      // Projekt samego tyłu (z kreatora) – powrót do wyboru nowego szablonu.
      return r &&
        czyProjektWlasny(p) &&
        p.talie.every((tl) => tl.karty.length === 0) &&
        p.szablony.length === 1 &&
        p.szablony[0]!.korzen.dzieci.length === 0 &&
        p.nazwa === r.nazwa
        ? '#/wlasne/nowy'
        : `#/projekt/${encodeURIComponent(p.id)}/drukuj`;
    },
    teksty: () => ({
      brak: t('rewers.brak'),
      tytul: t('rewers.tytulEdytora'),
      nazwa: t('rewers.nazwa'),
      drzewo: t('rewers.warstwy'),
      podglad: t('rewers.podgladEtykieta'),
      pomocPodgladu: t('rewers.pomocPodgladu'),
      otworzKopie: (nazwa) => t('rewers.otworzKopie', { nazwa }),
      zaimportowano: (nazwa) => t('rewers.zaimportowano', { nazwa }),
      tytulPanelu: t('rewers.tloIRamka'),
      opisPanelu: t('rewers.rozmiarOpis'),
    }),
  },
};

/**
 * Edytor karty – jeden dla przodu (szablon z danymi kart) i tyłu (rewers): drzewo elementów,
 * podgląd z zaznaczaniem i przeciąganiem, właściwości zaznaczenia (`EdytorDrzewa`) i ustawienia
 * całej karty (`PanelKarty`). Różnice stron – w `STRONY`.
 */
export function EdytorKarty({
  edycja,
  strona,
  id,
}: {
  edycja: ProjektWEdycji;
  strona: StronaKarty;
  id: string;
}) {
  const k = STRONY[strona];
  const { projekt, zmien } = edycja;
  const szablon = useMemo(() => k.znajdz(projekt, id), [k, projekt, id]);
  const rewers = strona === 'tyl' ? projekt.rewersy?.find((r) => r.id === id) : undefined;
  const przodTylu = useMemo(
    () => (rewers ? przodRewersu(projekt, id) : undefined),
    [rewers, projekt, id],
  );
  const [idKopii, ustawIdKopii] = useState('');
  const kopia = idKopii ? k.znajdz(projekt, idKopii) : undefined;
  const [bladRozmiaru, ustawBladRozmiaru] = useState(false);
  const [bladObrazu, ustawBladObrazu] = useState('');
  const idProjektu = encodeURIComponent(projekt.id);
  const adres = (x: string) => `#/projekt/${idProjektu}/${k.segment}/${encodeURIComponent(x)}`;
  const teksty = k.teksty();
  useZapisTyluWBibliotece(edycja, id, strona === 'tyl' && !!rewers);

  const zmienSz = (f: (s: Szablon) => Szablon, klucz?: string) =>
    zmien((p) => k.zmienSzablon(p, id, f), klucz ? { klucz: `${k.segment}:${klucz}` } : {});

  // Zmiana rozmiaru, orientacji lub rogów: z dopasowaniem zawartości; szablon powiązany z innymi
  // (tył przypisany do przodów, przód z tyłem) – najpierw okno z wyborem kopii.
  const [dopasowanie, ustawDopasowanie] = useDopasowanieZawartosci();
  const [pytanie, ustawPytanie] = useState<{ nowe: WymiaryKarty; powiazane: Powiazanie[] }>();
  const zastosujWymiary = (p: Projekt, celId: string, w: WymiaryKarty) => {
    const s = k.znajdz(p, celId);
    const q = s && k.zmienWymiary(p, celId, w);
    if (!s || !q || q === p) return p;
    return k.zmienSzablon(q, celId, (x) => dopasujZawartosc(x, wymiaryKarty(s), w, dopasowanie));
  };
  const zmienOryginal = (w: WymiaryKarty) => {
    // Karta, która nie zmieści się na stronie kartki – odrzucona (komunikat w panelu).
    const odrzucony = k.zmienWymiary(projekt, id, w) === projekt;
    ustawBladRozmiaru(odrzucony && !!szablon && !teSameWymiary(szablon, w));
    if (!odrzucony)
      zmien((p) => zastosujWymiary(p, id, w), { klucz: `${k.segment}:rozmiar-karty` });
  };
  const utworzKopieWRozmiarze = (w: WymiaryKarty) => {
    if (!szablon) return;
    let noweId = '';
    zmien((p) => {
      const d = k.duplikuj(p, id, sufiksKopii);
      noweId = d.id;
      const nazwa = unikalnaNazwa(
        t('zmianaRozmiaru.nazwaKopii', { nazwa: szablon.nazwa, rozmiar: opisRozmiaru(w) }),
        k.nazwy(p),
      );
      let q = k.zmienSzablon(d.projekt, noweId, (x) => ({ ...x, nazwa }));
      // Kopia nie jest przypisana do żadnych szablonów (kopia tyłu nie ma przypisań z założenia).
      if (strona === 'przod') q = przypiszRewers(q, { rodzaj: 'szablon', id: noweId }, undefined);
      return zastosujWymiary(q, noweId, w);
    });
    if (noweId) window.location.hash = adres(noweId);
  };
  const zmienWymiary = (w: WymiaryKarty) => {
    if (!szablon || teSameWymiary(szablon, w)) return;
    const powiazane = powiazania(projekt, strona, id);
    if (powiazane.length > 0) ustawPytanie({ nowe: w, powiazane });
    else zmienOryginal(w);
  };
  const stareWymiary: WymiaryKarty | undefined = szablon && {
    ...wymiaryKarty(szablon),
    promien: szablon.promienRogow ?? 0,
  };

  const wgrajStalyObraz = async (poleId: string, plik: File, sygnal: AbortSignal) => {
    const pole = szablon && znajdzWezel(szablon, poleId);
    if (!pole) return;
    const obraz = await przygotujPlikObrazu(plik);
    if (sygnal.aborted) return;
    await edycja.zmienZZasobami((p, d) => {
      const s = k.znajdz(p, id);
      return p.id === projekt.id && s && znajdzWezel(s, poleId)?.id === pole.id
        ? k.ustawStalyObraz(p, d, id, poleId, plik.name, obraz)
        : { projekt: p, dane: d };
    });
  };

  const plikSzablonu: PlikSzablonuEdytora = {
    eksportuj: () => ({
      ...k.eksportuj(projekt, edycja.dane, id),
      nazwa: nazwaPliku(szablon?.nazwa ?? '', ROZSZERZENIE_SZABLONU),
    }),
    importuj: async (bajty) => {
      let w: ReturnType<KonfiguracjaStrony['importuj']> | undefined;
      await edycja.zmienZZasobami((p, d) => {
        w = k.importuj(p, d, bajty);
        return { projekt: w.projekt, dane: w.dane };
      });
      const nowy = k.znajdz(w!.projekt, w!.id);
      return {
        adres: adres(w!.id),
        tekst: teksty.zaimportowano(nowy?.nazwa ?? ''),
        ostrzezenia: w!.ostrzezenia,
      };
    },
  };

  // Przód: „Zrób karty” dokłada kartkę dla szablonu; tył – przejście do Edytora kart.
  const robKarty = () => {
    let cel = `#/projekt/${idProjektu}`;
    if (strona === 'przod')
      zmien((p) => {
        const w = kartkaDlaSzablonu(p, id);
        cel = `#/projekt/${idProjektu}/kartka/${encodeURIComponent(w.arkuszId)}`;
        return w.projekt;
      });
    window.location.hash = cel;
  };

  const wczytajPodklad = async (f: File) => {
    ustawBladObrazu('');
    try {
      const { dane, ...wymiary } = await przygotujPlikObrazu(f);
      await edycja.zmienZZasobami((p, d) => {
        const opis = opisObrazu(f.name, dane, wymiary, new Set(p.zasoby.map((z) => z.id)));
        return ustawPodklad(p, d, id, { opis, dane });
      });
    } catch (e) {
      ustawBladObrazu(
        t('podklad.blad', { plik: f.name, powod: e instanceof Error ? e.message : String(e) }),
      );
    }
  };
  const wgrajTeksture = async (plik: File) => {
    ustawBladObrazu('');
    try {
      const obraz = await przygotujPlikObrazu(plik);
      await edycja.zmienZZasobami((p, d) => ustawTekstureRewersu(p, d, id, plik.name, obraz));
    } catch (e) {
      ustawBladObrazu(e instanceof Error ? e.message : String(e));
    }
  };
  const zmienTyl = (f: (r: Rewers) => Rewers, klucz: string) =>
    zmien((p) => zmienRewers(p, id, f), { klucz: `rewers:${klucz}` });
  const podklad = strona === 'przod' ? szablon?.podklad : undefined;

  return (
    <DostawcaKolorowProjektu edycja={edycja}>
      {pytanie && stareWymiary && (
        <OknoZmianyRozmiaru
          strona={strona}
          powiazane={pytanie.powiazane}
          stare={stareWymiary}
          nowe={pytanie.nowe}
          dopasowanie={dopasowanie}
          zmienDopasowanie={ustawDopasowanie}
          zdecyduj={(d) => {
            ustawPytanie(undefined);
            if (d === 'kopia') utworzKopieWRozmiarze(pytanie.nowe);
            else if (d === 'mimo') zmienOryginal(pytanie.nowe);
          }}
        />
      )}
      <EdytorDrzewa
        edycja={edycja}
        strona={strona}
        id={id}
        szablon={szablon}
        zmienSz={zmienSz}
        nowySzablon={() => {
          if (!szablon) return;
          let nowe = '';
          zmien((p) => {
            const w = STRONY.przod.duplikuj(p, p.szablony[0]?.id ?? id, sufiksKopii);
            nowe = w.id;
            const nazwa = unikalnaNazwa(
              szablon.nazwa,
              p.szablony.map((x) => x.nazwa),
            );
            return zmienSzablon(w.projekt, nowe, (s) => ({
              ...s,
              nazwa,
              korzen: { id: 'k', typ: 'swobodny', dzieci: [] },
              przyklad: undefined,
              podklad: undefined,
            }));
          });
          if (nowe) {
            window.location.hash = `#/projekt/${idProjektu}/szablon/${encodeURIComponent(nowe)}`;
          }
        }}
        czcionkiUzyte={szablon ? czcionkiSzablonu(rewers ?? szablon) : []}
        kluczRysunku={(w) => k.kluczRysunku(projekt, id, w)}
        rysuj={k.rysuj}
        przedrostekSvg={k.przedrostekSvg}
        miniatura={k.miniatura}
        bezDanych={k.bezDanych}
        {...(k.bezDanych ? {} : { zajeteKlucze: () => kluczeDanychKart(projekt, id) })}
        {...(k.rodzajeDodaj ? { rodzajeDodaj: k.rodzajeDodaj } : {})}
        teksty={teksty}
        zmienNazwe={(nazwa) => zmienSz((s) => ({ ...s, nazwa }), 'nazwa')}
        duplikuj={() => {
          let nowe = '';
          zmien((p) => {
            const w = k.duplikuj(p, id, sufiksKopii);
            nowe = w.id;
            return w.projekt;
          });
          ustawIdKopii(nowe);
        }}
        kopia={
          kopia && {
            adres: adres(kopia.id),
            tekst: teksty.otworzKopie(kopia.nazwa),
          }
        }
        adresPowrotu={k.adresPowrotu(projekt, id)}
        plikSzablonu={plikSzablonu}
        akcjaGlowna={
          <button type="button" className="glowny" onClick={robKarty}>
            {t('szablon.robKarty')}
          </button>
        }
        wgrajStalyObraz={wgrajStalyObraz}
        przodTylu={
          przodTylu && {
            szablon: przodTylu,
            zmienPrzyklad: (klucz, wartosc, grupuj) =>
              zmien(
                (p) =>
                  STRONY.przod.zmienSzablon(p, przodTylu.id, (s) => {
                    // Pusta wartość – bez wpisu (podgląd wraca do nazwy pola).
                    const { [klucz]: _stara, ...przyklad } = s.przyklad ?? {};
                    void _stara;
                    return {
                      ...s,
                      przyklad: wartosc ? { ...przyklad, [klucz]: wartosc } : przyklad,
                    };
                  }),
                grupuj ? { klucz: `rewers:przyklad-przodu:${klucz}` } : {},
              ),
          }
        }
        podklad={
          strona === 'przod' && szablon
            ? {
                podklad,
                adres: podklad ? edycja.zasoby.zasoby.obrazy.get(podklad.zasob)?.adres : undefined,
                blad: bladObrazu,
                wczytaj: (f) => void wczytajPodklad(f),
                zmien: (f) =>
                  zmienSz((x) => (x.podklad ? { ...x, podklad: f(x.podklad) } : x), 'podklad'),
                usun: () => void edycja.zmienZZasobami((p, d) => usunPodklad(p, d, id)),
              }
            : undefined
        }
        panelKarty={(kontekst) => (
          <PanelKarty
            k={kontekst}
            tytul={teksty.tytulPanelu}
            opis={teksty.opisPanelu}
            zmienWymiary={zmienWymiary}
            dopasowanieZawartosci={
              <WyborDopasowania
                wartosc={dopasowanie}
                zmien={ustawDopasowanie}
                nazwa="dopasowanie-panel"
              />
            }
            bladRozmiaru={bladRozmiaru ? t('szablon.rozmiarNieMiesci') : undefined}
            bezDanych={k.bezDanych}
            rogiJakPrzod={!!rewers && rewers.promienRogow === undefined}
            zajeteKlucze={() => (k.bezDanych ? [] : kluczeDanychKart(projekt, id))}
            {...(rewers
              ? {
                  wgrywanieObrazu: (
                    <WgrywanieTekstury wgraj={(f) => void wgrajTeksture(f)} blad={bladObrazu} />
                  ),
                  dodatkiObrazu: <DodatkiTeksturyTylu rewers={rewers} zmien={zmienTyl} />,
                }
              : {})}
          />
        )}
      />
    </DostawcaKolorowProjektu>
  );
}

const teSameWymiary = (s: Szablon, w: WymiaryKarty) =>
  s.rozmiar.tryb === 'mm' &&
  s.rozmiar.szerokosc === w.szer &&
  s.rozmiar.wysokosc === w.wys &&
  (s.promienRogow ?? 0) === w.promien;

/**
 * Tył zaprojektowany w edytorze trafia do biblioteki tyłów przeglądarki (po zapisaniu oraz przy
 * opuszczeniu edytora bez niezapisanych zmian), żeby można go było wybrać przy dowolnej karcie.
 */
function useZapisTyluWBibliotece(edycja: ProjektWEdycji, rewersId: string, aktywny: boolean) {
  const { projekt, dane, niezapisane, zapis, wersja } = edycja;
  const aktualny = useRef<{ projekt: Projekt; dane: DaneZasobow } | undefined>(undefined);
  // Zapis ręczny: przy wyjściu do biblioteki trafia tylko stan zapisany w projekcie.
  useEffect(() => {
    aktualny.current = aktywny && !niezapisane ? { projekt, dane } : undefined;
  }, [projekt, dane, niezapisane, aktywny]);
  useEffect(() => {
    if (!aktywny || zapis.stan !== 'zapisano') return;
    void import('../rewersyGlobalne')
      .then(({ zapiszRewersGlobalnie }) => zapiszRewersGlobalnie(projekt, dane, rewersId))
      .catch(() => undefined);
  }, [zapis.stan, wersja, dane, projekt, aktywny, rewersId]);
  useEffect(
    () => () => {
      const stan = aktualny.current;
      if (!stan) return;
      void import('../rewersyGlobalne')
        .then(({ zapiszRewersGlobalnie }) =>
          zapiszRewersGlobalnie(stan.projekt, stan.dane, rewersId),
        )
        .catch(() => undefined);
    },
    [rewersId],
  );
}
