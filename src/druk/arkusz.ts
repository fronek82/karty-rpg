import type { Mm } from '../model/jednostki';
import {
  MIESZANE_DOMYSLNE,
  SLOT_DOMYSLNY,
  pasujeDoSlotu as wymiarPasujeDoSlotu,
  polozenieKarty,
  wymiaryStrony,
  type Arkusz,
  type LinieCiecia,
  type TytulArkusza,
  wymiaryUkladu,
} from '../model/arkusz';
import {
  wymiaryKarty,
  type Karta,
  type StylTekstu,
  type Szablon,
  type Talia,
} from '../model/szablon';
import type { RejestrCzcionek } from '../silnik/czcionki';
import { konturIkony } from '../silnik/ikony';
import { renderujKarte, type InformacjaOObrazie, type Ostrzezenie } from '../silnik/karta';
import {
  kolorSceny,
  polaczGlify,
  type DefinicjaGlifu,
  type ElementSceny,
  type Scena,
} from '../silnik/scena';
import { tekstNaScene, ulozTekst } from '../silnik/tekst';
import {
  odcinkiCieciaProstokatow,
  ulozPasy,
  type KartaDoPasow,
  type Pas,
  type UmieszczonaWPasie,
  type WolneMiejsce,
} from './pasy';
import { egzemplarze, rozmiescKarty, type WynikRozmieszczenia } from './rozmieszczanie';

/**
 * Arkusz „Druk w domu”: karty talii rozmieszczone na stronach, wspólne linie cięcia,
 * tytuł (poziomy lub pionowy), nagłówki grup z opisem i nożyczki. Wynik: jedna scena na stronę –
 * ta sama trafia do podglądu (SVG) i do PDF.
 */

export interface KontekstArkusza {
  czcionki: RejestrCzcionek;
  szablony: Map<string, Szablon>;
  obraz?: (zasob: string) => InformacjaOObrazie | undefined;
  /**
   * Pamięć wyrenderowanych kart między wywołaniami (edytor: zmiana jednej karty nie renderuje
   * pozostałych). Klucz – obiekt karty (niezmienny); ważna tylko dla tych samych czcionek,
   * szablonów i obrazów – przy ich zmianie wołający tworzy nową.
   */
  pamiecKart?: WeakMap<Karta, { scena: Scena; ostrzezenia: Ostrzezenie[] }>;
}

export interface OstrzezenieArkusza {
  kartaId?: string;
  komunikat: string;
}

export interface WynikArkusza {
  strony: Scena[];
  rozmieszczenie: WynikRozmieszczenia;
  /** Lewy górny róg siatki (mm od rogu strony). */
  poczatekSiatki: { x: Mm; y: Mm };
  slot: { szerokosc: Mm; wysokosc: Mm };
  /** Siatka w slotach; `grupy` – karty w kolumnach grup (przypięcia wtedy nie działają). */
  siatka: { kolumny: number; rzedy: number; grupy: boolean };
  /**
   * Przesunięcie (mm) kolumny `kolumna` na stronie `strona` przez odstępy nagłówków grup
   * i odstępy między kartami własnego układu.
   */
  odstepKolumny: (strona: number, kolumna: number) => Mm;
  /** Przesunięcie (mm) rzędu `rzad` przez odstępy między kartami własnego układu. */
  odstepRzedu: (rzad: number) => Mm;
  /** Odstępy między kartami własnego układu (0 – układ automatyczny). */
  odstep: { x: Mm; y: Mm };
  /** Ręczne nagłówki grup na stronach (mm od rogu strony) – do warstwy edytora. */
  naglowki: { id: string; strona: number; x: Mm; y: Mm; szer: Mm; wys: Mm }[];
  /** Tytuł po dopasowaniu: rozmiar czcionki i długość napisu (mm). */
  tytul?: { rozmiar: Mm; dlugosc: Mm };
  /** Tylko przy `rozmiary: 'mieszane'` – układ pasów; `rozmieszczenie` i `siatka` są wtedy puste. */
  mieszane?: WynikMieszane;
  ostrzezenia: OstrzezenieArkusza[];
}

/** Układ kart w pasach (mm od rogu strony). */
export interface WynikMieszane {
  /** Obszar kart: strona minus marginesy, tytuł. */
  obszar: { x: Mm; y: Mm; szer: Mm; wys: Mm };
  karty: (UmieszczonaWPasie & { karta: Karta })[];
  pasy: Pas[];
  wolne: WolneMiejsce[];
  /** Egzemplarze (klucze), które nie mieszczą się na stronie. */
  pominiete: string[];
}

/** Identyfikatory kart w kolejności widocznej na kartce (strony, pasy, od lewej) – bez powtórzeń. */
export function kolejnoscWidoczna(m: Pick<WynikMieszane, 'karty'>): string[] {
  return [...new Set(m.karty.map((k) => k.kartaId))];
}

/** Karty kartki w kolejności rozmieszczania własnego: `kolejnosc` arkusza, potem reszta talii. */
export function kolejnoscKart(arkusz: Pick<Arkusz, 'kolejnosc'>, karty: Karta[]): Karta[] {
  const mapa = new Map(karty.map((k) => [k.id, k]));
  const wynik: Karta[] = [];
  for (const id of arkusz.kolejnosc ?? []) {
    const k = mapa.get(id);
    if (k) {
      wynik.push(k);
      mapa.delete(id);
    }
  }
  for (const k of karty) if (mapa.has(k.id)) wynik.push(k);
  return wynik;
}

interface Napis {
  elementy: ElementSceny[];
  glify: Record<string, DefinicjaGlifu>;
  szer: Mm;
  wys: Mm;
}

function napis(
  tekst: string,
  styl: StylTekstu,
  szer: Mm | undefined,
  czcionki: RejestrCzcionek,
): Napis {
  const glify: Record<string, DefinicjaGlifu> = {};
  if (tekst.trim() === '') return { elementy: [], glify, szer: 0, wys: 0 };
  const u = ulozTekst([{ tekst, styl }], szer, czcionki);
  const ramka = { x: 0, y: 0, szer: szer ?? u.szerokosc, wys: u.wysokosc };
  const elementy = tekstNaScene(
    u,
    ramka,
    styl.wyrownanie ?? 'lewo',
    'poczatek',
    glify,
    styl.obwodka,
  );
  return { elementy, glify, szer: u.szerokosc, wys: u.wysokosc };
}

/**
 * Tytuł nie dłuższy niż `limit` (mm): dłuższy jest zmniejszany (kilka przybliżeń – szerokość nie
 * musi rosnąć liniowo z rozmiarem). `miesci` – czy po dopasowaniu mieści się w limicie.
 */
function dopasujTytul(
  tt: TytulArkusza,
  tytul: Napis,
  limit: Mm,
  czcionki: RejestrCzcionek,
): { tytul: Napis; rozmiar: Mm; miesci: boolean } {
  let wynik = tytul;
  let rozmiar = tt.styl.rozmiar;
  if (limit <= 0) return { tytul, rozmiar, miesci: false };
  if (tytul.szer > limit) {
    let skala = 1;
    for (let i = 0; i < 4 && wynik.szer > limit + 1e-6 && skala > 0.25; i++) {
      skala = Math.max(0.25, skala * (limit / wynik.szer) * (i === 0 ? 1 : 0.995));
      const styl = { ...tt.styl, rozmiar: tt.styl.rozmiar * skala };
      wynik = napis(tt.tekst, styl, undefined, czcionki);
      rozmiar = styl.rozmiar;
    }
  }
  return { tytul: wynik, rozmiar, miesci: wynik.szer <= limit + 1e-6 };
}

/** Karta wyrenderowana raz na kartę (egzemplarze są identyczne); ostrzeżenia karty dopisywane raz. */
function fabrykaScenKart(
  ctx: KontekstArkusza,
  szablon: (k: Karta) => Szablon | undefined,
  ostrzezenia: OstrzezenieArkusza[],
) {
  const pamiec = new Map<string, Scena>();
  return (k: Karta) => {
    let s = pamiec.get(k.id);
    if (!s) {
      let w = ctx.pamiecKart?.get(k);
      if (!w) {
        w = renderujKarte(szablon(k)!, k, {
          czcionki: ctx.czcionki,
          ...(ctx.obraz ? { obraz: ctx.obraz } : {}),
        });
        ctx.pamiecKart?.set(k, w);
      }
      for (const o of w.ostrzezenia) ostrzezenia.push(ostrzezenieKarty(k, o));
      s = w.scena;
      pamiec.set(k.id, s);
    }
    return s;
  };
}

/** Odcinki cięcia: każdy bok slotu osobno, wspólne boki sąsiednich kart tylko raz. */
export function odcinkiCiecia(
  karty: {
    x: Mm;
    y: Mm;
    kolumny: number;
    rzedy: number;
    /** Położenie i wymiar samej karty – przy odstępach obrys biegnie wokół niej. */
    karta?: { x: Mm; y: Mm; szer: Mm; wys: Mm };
  }[],
  slot: { szerokosc: Mm; wysokosc: Mm },
  /** Odstępy między kartami własnego układu – karta zajmująca kilka slotów obejmuje też odstępy. */
  odstep: { x: Mm; y: Mm } = { x: 0, y: 0 },
  /** Obrys każdej karty osobno, wokół samej karty (a nie wokół slotu). */
  wokolKarty = false,
): { x1: Mm; y1: Mm; x2: Mm; y2: Mm }[] {
  const mapa = new Map<string, { x1: Mm; y1: Mm; x2: Mm; y2: Mm }>();
  const k = (v: number) => Math.round(v * 1000);
  const dodaj = (x1: Mm, y1: Mm, x2: Mm, y2: Mm) => {
    const klucz = `${k(x1)},${k(y1)},${k(x2)},${k(y2)}`;
    if (!mapa.has(klucz)) mapa.set(klucz, { x1, y1, x2, y2 });
  };
  for (const c of karty) {
    const sz = slot.szerokosc;
    const wy = slot.wysokosc;
    if (wokolKarty || odstep.x > 0 || odstep.y > 0) {
      // Karty z odstępami nie mają wspólnych boków – obrys każdej osobno, wokół samej karty.
      const r = c.karta ?? {
        x: c.x,
        y: c.y,
        szer: c.kolumny * sz + (c.kolumny - 1) * odstep.x,
        wys: c.rzedy * wy + (c.rzedy - 1) * odstep.y,
      };
      dodaj(r.x, r.y, r.x + r.szer, r.y);
      dodaj(r.x, r.y + r.wys, r.x + r.szer, r.y + r.wys);
      dodaj(r.x, r.y, r.x, r.y + r.wys);
      dodaj(r.x + r.szer, r.y, r.x + r.szer, r.y + r.wys);
      continue;
    }
    for (let i = 0; i < c.kolumny; i++) {
      dodaj(c.x + i * sz, c.y, c.x + (i + 1) * sz, c.y);
      dodaj(c.x + i * sz, c.y + c.rzedy * wy, c.x + (i + 1) * sz, c.y + c.rzedy * wy);
    }
    for (let j = 0; j < c.rzedy; j++) {
      dodaj(c.x, c.y + j * wy, c.x, c.y + (j + 1) * wy);
      dodaj(c.x + c.kolumny * sz, c.y + j * wy, c.x + c.kolumny * sz, c.y + (j + 1) * wy);
    }
  }
  return [...mapa.values()].sort(
    (a, b) => a.y1 - b.y1 || a.x1 - b.x1 || a.y2 - b.y2 || a.x2 - b.x2,
  );
}

/** Linia przerywana z wzorem wyśrodkowanym na odcinku (kreski zaczynają i kończą się symetrycznie). */
function liniaCiecia(o: { x1: Mm; y1: Mm; x2: Mm; y2: Mm }, l: LinieCiecia): ElementSceny {
  const dlugosc = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
  const okres = l.kreska + l.przerwa;
  if (!(l.kreska > 0) || !(l.przerwa > 0)) {
    // Bez wzoru (np. kreska 0) – linia ciągła.
    return { typ: 'linia', ...o, obrys: { kolor: l.kolor, grubosc: l.grubosc } };
  }
  const n = Math.max(1, Math.floor((dlugosc + l.przerwa) / okres));
  const wzor = n * l.kreska + (n - 1) * l.przerwa;
  const poczatek = (dlugosc - wzor) / 2;
  return {
    typ: 'linia',
    ...o,
    obrys: {
      kolor: l.kolor,
      grubosc: l.grubosc,
      kreska: [l.kreska, l.przerwa],
      fazaKreski: (okres - (poczatek % okres)) % okres,
    },
  };
}

/** Zamienia kolory sceny na szarości (luminancja). */
export function wSkaliSzarosci(elementy: ElementSceny[]): ElementSceny[] {
  const szary = (k: string) => {
    const c = kolorSceny(k);
    const v = Math.round(
      0.299 * parseInt(c.slice(1, 3), 16) +
        0.587 * parseInt(c.slice(3, 5), 16) +
        0.114 * parseInt(c.slice(5, 7), 16),
    );
    const h = v.toString(16).padStart(2, '0');
    return `#${h}${h}${h}`;
  };
  const obr = <T extends { kolor: string } | undefined>(o: T): T =>
    o ? { ...o, kolor: szary(o.kolor) } : o;
  return elementy.map((e): ElementSceny => {
    switch (e.typ) {
      case 'grupa':
        return { ...e, elementy: wSkaliSzarosci(e.elementy) };
      case 'tekst':
        return { ...e, kolor: szary(e.kolor), ...(e.obwodka ? { obwodka: obr(e.obwodka) } : {}) };
      case 'linia':
        return { ...e, obrys: obr(e.obrys) };
      case 'obraz':
        return e;
      default:
        return {
          ...e,
          ...(e.wypelnienie ? { wypelnienie: szary(e.wypelnienie) } : {}),
          ...(e.obrys ? { obrys: obr(e.obrys) } : {}),
        };
    }
  });
}

/**
 * Slot kartki: z ustawień albo z szablonu pierwszej karty (tryb slotów – slot, mm – wymiar
 * karty), a bez kart – domyślny 63×88 mm.
 */
export function slotKartki(
  arkusz: Arkusz,
  talia: Talia | undefined,
  szablony: ReadonlyMap<string, Szablon>,
): { szerokosc: Mm; wysokosc: Mm } {
  if (arkusz.ustawienia.slot) return arkusz.ustawienia.slot;
  const s = (talia?.karty ?? []).map((k) => szablony.get(k.szablonId)).find(Boolean);
  if (!s) return { ...SLOT_DOMYSLNY };
  return s.rozmiar.tryb === 'sloty'
    ? s.rozmiar.slot
    : { szerokosc: s.rozmiar.szerokosc, wysokosc: s.rozmiar.wysokosc };
}

export function zbudujArkusz(arkusz: Arkusz, talia: Talia, ctx: KontekstArkusza): WynikArkusza {
  const u = arkusz.ustawienia;
  const strona = wymiaryStrony(u);
  const ostrzezenia: OstrzezenieArkusza[] = [];
  const szablon = (k: Karta) => ctx.szablony.get(k.szablonId);

  const slot = slotKartki(arkusz, talia, ctx.szablony);
  const dop = u.dopasowanie;
  // Mieszane rozmiary: każda karta ma swój wymiar, własny układ (stała siatka) jest wyłączony.
  const mieszane = u.rozmiary === 'mieszane';
  const karty = talia.karty.filter((k) => {
    const s = szablon(k);
    if (!s) ostrzezenia.push({ kartaId: k.id, komunikat: 'brak-szablonu' });
    else if (mieszane) return true;
    // Karta w mm zajmuje jeden slot (kartka ma slot = wymiar karty), karta w slotach – całe sloty
    // kartki; inny wymiar karty / slotu – ostrzeżenie.
    else if (!wymiarPasujeDoSlotu(s.rozmiar.tryb === 'mm' ? s.rozmiar : s.rozmiar.slot, slot, dop))
      ostrzezenia.push({ kartaId: k.id, komunikat: 'karta-inny-rozmiar' });
    return s !== undefined;
  });

  // Tytuł.
  // Pusty tytuł („bez tytułu” w edytorze) – bez paska tytułu.
  // Własny układ: stała siatka od zadanego miejsca – bez tytułu, nagłówków grup i nożyczek.
  const uklad = mieszane ? undefined : u.uklad;
  let tytul =
    !uklad && u.tytul && u.tytul.tekst.trim()
      ? napis(u.tytul.tekst, u.tytul.styl, undefined, ctx.czcionki)
      : undefined;
  const obszar = {
    x: u.marginesy.lewo,
    y: u.marginesy.gora,
    szer: strona.szer - u.marginesy.lewo - u.marginesy.prawo,
    wys: strona.wys - u.marginesy.gora - u.marginesy.dol,
  };
  if (u.tytul && tytul) {
    const pas = tytul.wys + u.tytul.odstep;
    if (u.tytul.polozenie === 'gora') {
      obszar.y += pas;
      obszar.wys -= pas;
    } else {
      obszar.x += pas;
      obszar.szer -= pas;
    }
  }

  if (mieszane) {
    return zbudujMieszane({ arkusz, talia, ctx, karty, szablon, slot, obszar, tytul, ostrzezenia });
  }

  // Grupy: wysokość pasa nagłówków zależy od szerokości grup, a ta od liczby rzędów – dwa przybliżenia.
  const grupy =
    !uklad && u.grupy && talia.grupy && talia.grupy.length > 0 ? talia.grupy : undefined;
  const lista = egzemplarze(karty, (k) => {
    if (szablon(k)!.rozmiar.tryb === 'mm') return { kolumny: 1, rzedy: 1 };
    const { szer, wys } = wymiaryKarty(szablon(k)!, k);
    // Karta mniejsza niż slot zajmuje cały slot (inaczej rozmiar 0 dałby nakładanie).
    return {
      kolumny: Math.max(1, Math.round(szer / slot.szerokosc)),
      rzedy: Math.max(1, Math.round(wys / slot.wysokosc)),
    };
  });
  let pas = 0;
  if (grupy && u.grupy) {
    for (let i = 0; i < 2; i++) {
      const rzedy = Math.max(1, Math.floor((obszar.wys - pas) / slot.wysokosc + 1e-6));
      pas = 0;
      for (const g of grupy) {
        const sloty = lista
          .filter((e) => g.karty.includes(e.karta.id))
          .reduce((s, e) => s + e.kolumny * e.rzedy, 0);
        const szer = Math.max(1, Math.ceil(sloty / rzedy)) * slot.szerokosc;
        const h =
          napis(g.naglowek, u.grupy.styl, szer, ctx.czcionki).wys +
          napis(g.opis ?? '', u.grupy.stylOpisu, szer, ctx.czcionki).wys;
        pas = Math.max(pas, h + u.grupy.odstepOdKart);
      }
    }
  }

  // Ręczne nagłówki grup (edytor kartki): pas nad siatką i odstępy przesuwające kolumny.
  const naglowki =
    !uklad && !grupy && u.grupy && arkusz.naglowki && arkusz.naglowki.length > 0
      ? arkusz.naglowki
      : undefined;
  const stylGrup = u.grupy;
  if (naglowki && stylGrup) {
    // Nagłówek bez tekstu i opisu to sam odstęp przed grupą – nie zajmuje pasa nad siatką.
    for (const h of naglowki.filter((x) => x.naglowek.trim() || x.opis?.trim())) {
      const szer = h.kolumny * slot.szerokosc;
      const wys =
        napis(h.naglowek, stylGrup.styl, szer, ctx.czcionki).wys +
        napis(h.opis ?? '', stylGrup.stylOpisu, szer, ctx.czcionki).wys;
      pas = Math.max(pas, wys + stylGrup.odstepOdKart);
    }
  }
  const odstep = { x: uklad?.odstepPoziomy ?? 0, y: uklad?.odstepPionowy ?? 0 };
  const odstepKolumny = (s: number, kolumna: number): Mm =>
    kolumna * odstep.x +
    (naglowki ?? [])
      .filter((h) => h.strona === s && h.kolumna <= kolumna)
      .reduce((suma, h) => suma + (h.odstepPrzed ?? 0), 0);
  const odstepRzedu = (rzad: number): Mm => rzad * odstep.y;
  const najwiekszyOdstep = Math.max(
    0,
    ...(naglowki ?? []).map((h) =>
      (naglowki ?? [])
        .filter((x) => x.strona === h.strona)
        .reduce((suma, x) => suma + (x.odstepPrzed ?? 0), 0),
    ),
  );

  const poczatek = uklad
    ? { x: uklad.lewo, y: uklad.gora }
    : (u.poczatekSiatki ?? { x: obszar.x, y: obszar.y + pas });
  // Własny układ – siatka dokładnie kolumny × rzędy (odstępy liczone osobno).
  const siatka = uklad
    ? {
        szer: uklad.kolumny * slot.szerokosc,
        wys: uklad.rzedy * slot.wysokosc,
        slot,
      }
    : {
        // Odstępy między grupami zabierają miejsce w poziomie (najwięcej na którejkolwiek stronie).
        szer: strona.szer - u.marginesy.prawo - poczatek.x - najwiekszyOdstep,
        wys: strona.wys - u.marginesy.dol - poczatek.y,
        slot,
      };
  if (uklad) {
    const w = wymiaryUkladu(uklad, slot, strona);
    if (w.prawo < -1e-6 || w.dol < -1e-6) ostrzezenia.push({ komunikat: 'uklad-poza-papierem' });
  }
  const rozmieszczenie = rozmiescKarty(lista, siatka, {
    ...(arkusz.przypiete ? { przypiete: arkusz.przypiete } : {}),
    ...(grupy && u.grupy
      ? {
          grupy: {
            lista: grupy.map((g) => ({ id: g.id, kartyIds: g.karty })),
            odstep: u.grupy.odstep,
          },
        }
      : {}),
  });
  for (const o of rozmieszczenie.ostrzezenia) ostrzezenia.push({ komunikat: o });
  const rzedySiatki = Math.max(0, Math.floor(siatka.wys / slot.wysokosc + 1e-6));
  // Strona za mała na choćby jeden slot (np. karta większa niż papier) – ostrzeżenie kartki.
  if (rzedySiatki < 1 || Math.floor(siatka.szer / slot.szerokosc + 1e-6) < 1)
    ostrzezenia.push({ komunikat: 'brak-slotow-na-stronie' });

  let rozmiarTytulu = u.tytul?.styl.rozmiar ?? 0;
  // Tytuł nie dłuższy niż bok siatki (minus miejsce na nożyczki na tej samej krawędzi).
  if (u.tytul && tytul && tytul.szer > 0) {
    const kolumnySiatki = Math.floor(siatka.szer / slot.szerokosc + 1e-6);
    const n = u.nozyczki;
    const zapas = n ? n.rozmiar / 2 + 1 : 0;
    let limit: Mm;
    if (u.tytul.polozenie === 'lewo') {
      limit = rzedySiatki * slot.wysokosc;
      if (n?.linia === 'pozioma' && n.strona === 'poczatek' && n.indeks <= rzedySiatki)
        limit = Math.min(limit, (rzedySiatki - n.indeks) * slot.wysokosc - zapas);
    } else {
      limit = kolumnySiatki * slot.szerokosc;
      if (n?.linia === 'pionowa' && n.strona === 'poczatek' && n.indeks <= kolumnySiatki)
        limit = Math.min(limit, n.indeks * slot.szerokosc - zapas);
    }
    const d = dopasujTytul(u.tytul, tytul, limit, ctx.czcionki);
    tytul = d.tytul;
    rozmiarTytulu = d.rozmiar;
    if (!d.miesci) ostrzezenia.push({ komunikat: 'tytul-nie-miesci-sie' });
  }

  const scenaKarty = fabrykaScenKart(ctx, szablon, ostrzezenia);

  const strony: Scena[] = [];
  const geometriaNaglowkow: WynikArkusza['naglowki'] = [];
  const liczbaStron = Math.max(rozmieszczenie.liczbaStron, arkusz.liczbaStron ?? 0);
  for (let n = 0; n < liczbaStron; n++) {
    const elementy: ElementSceny[] = [];
    const glify: Record<string, DefinicjaGlifu>[] = [];
    const naStronie = rozmieszczenie.karty.filter((c) => c.strona === n);
    const prostokaty = naStronie.map((c) => {
      const x = poczatek.x + c.xRegionu + odstepKolumny(n, c.kolumna) + c.kolumna * slot.szerokosc;
      const y = poczatek.y + c.rzad * slot.wysokosc + odstepRzedu(c.rzad);
      // Karta na środku obszaru swoich slotów (z odstępami między nimi) – bez skalowania:
      // karta w mm mniejsza niż slot albo karta wieloslotowa przy odstępach własnego układu.
      const { szer, wys } = wymiaryKarty(szablon(c.karta)!, c.karta);
      const obszarX = c.kolumny * slot.szerokosc + (c.kolumny - 1) * odstep.x;
      const obszarY = c.rzedy * slot.wysokosc + (c.rzedy - 1) * odstep.y;
      return {
        x,
        y,
        kolumny: c.kolumny,
        rzedy: c.rzedy,
        karta: {
          ...polozenieKarty({ x, y, szer: obszarX, wys: obszarY }, { szer, wys }, dop),
          szer,
          wys,
        },
        obszar: { x, y, szer: obszarX, wys: obszarY },
      };
    });
    // Tło do krawędzi slotu: przy przesunięciu druku względem perforacji nie widać papieru.
    // Wszystkie tła przed kartami – tło sąsiedniego slotu nie zakryje wystającej (≤ 0,5 mm) karty.
    if (dop?.tloDoSlotu)
      naStronie.forEach((c, i) => {
        const sz = szablon(c.karta)!;
        const ob = prostokaty[i]!.obszar;
        if (sz.tlo)
          elementy.push({
            typ: 'prostokat',
            x: ob.x,
            y: ob.y,
            szer: ob.szer,
            wys: ob.wys,
            ...(sz.promienRogow ? { promien: sz.promienRogow } : {}),
            wypelnienie: sz.tlo,
          });
      });
    naStronie.forEach((c, i) => {
      const s = scenaKarty(c.karta);
      glify.push(s.glify);
      const k = prostokaty[i]!.karta;
      elementy.push({ typ: 'grupa', x: k.x, y: k.y, elementy: s.elementy });
    });
    // Strefa bezpieczeństwa (np. przycięcie w punkcie foto): karta nie powinna w nią wchodzić.
    const mb = u.marginesBezpieczenstwa ?? 0;
    if (mb > 0) {
      naStronie.forEach((c, i) => {
        const k = prostokaty[i]!.karta;
        if (
          k.x < mb - 1e-6 ||
          k.y < mb - 1e-6 ||
          k.x + k.szer > strona.szer - mb + 1e-6 ||
          k.y + k.wys > strona.wys - mb + 1e-6
        )
          ostrzezenia.push({ kartaId: c.karta.id, komunikat: 'karta-w-strefie-przyciecia' });
      });
    }
    const odcinki =
      uklad && !uklad.linieCiecia
        ? []
        : odcinkiCiecia(prostokaty, slot, odstep, dop?.linie === 'karta');
    for (const o of odcinki) elementy.push(liniaCiecia(o, u.linie));

    const dolSiatki = poczatek.y + rzedySiatki * slot.wysokosc + odstepRzedu(rzedySiatki - 1);
    if (u.tytul && tytul) {
      glify.push(tytul.glify);
      elementy.push(
        u.tytul.polozenie === 'lewo'
          ? {
              typ: 'grupa',
              x: poczatek.x - u.tytul.odstep - tytul.wys,
              y: dolSiatki,
              obrot: -90,
              elementy: tytul.elementy,
            }
          : {
              typ: 'grupa',
              x: poczatek.x,
              y: poczatek.y - pas - u.tytul.odstep - tytul.wys,
              elementy: tytul.elementy,
            },
      );
    }
    if (grupy && u.grupy) {
      for (const r of rozmieszczenie.regiony.filter((r) => r.strona === n)) {
        const g = grupy.find((x) => x.id === r.grupaId);
        if (!g) continue;
        const szer = r.kolumny * slot.szerokosc;
        const naglowek = napis(g.naglowek, u.grupy.styl, szer, ctx.czcionki);
        const opis = napis(g.opis ?? '', u.grupy.stylOpisu, szer, ctx.czcionki);
        glify.push(naglowek.glify, opis.glify);
        if (naglowek.wys + opis.wys + u.grupy.odstepOdKart > pas + 1e-6) {
          ostrzezenia.push({ komunikat: `naglowek-grupy-nie-miesci-sie:${g.id}` });
        }
        const x = poczatek.x + r.x;
        const y = poczatek.y - pas;
        elementy.push({ typ: 'grupa', x, y, elementy: naglowek.elementy });
        elementy.push({ typ: 'grupa', x, y: y + naglowek.wys, elementy: opis.elementy });
      }
    }
    if (naglowki && stylGrup) {
      for (const h of naglowki.filter((x) => x.strona === n)) {
        const szer = h.kolumny * slot.szerokosc;
        const naglowek = napis(h.naglowek, stylGrup.styl, szer, ctx.czcionki);
        const opis = napis(h.opis ?? '', stylGrup.stylOpisu, szer, ctx.czcionki);
        const x = poczatek.x + odstepKolumny(n, h.kolumna) + h.kolumna * slot.szerokosc;
        const y = poczatek.y - pas;
        if (h.naglowek.trim() || h.opis?.trim()) {
          glify.push(naglowek.glify, opis.glify);
          elementy.push({ typ: 'grupa', x, y, elementy: naglowek.elementy });
          elementy.push({ typ: 'grupa', x, y: y + naglowek.wys, elementy: opis.elementy });
        }
        geometriaNaglowkow.push({
          id: h.id,
          strona: n,
          x,
          y,
          szer,
          wys: Math.max(pas - stylGrup.odstepOdKart, naglowek.wys + opis.wys),
        });
      }
    }
    if (!uklad && u.nozyczki && odcinki.length > 0) {
      const n = nozyczkiNaScenie(u.nozyczki, odcinki, pas, u.linie);
      if (n) elementy.push(...n);
      else
        ostrzezenia.push({
          komunikat: `nozyczki-poza-siatka:${u.nozyczki.linia}:${u.nozyczki.indeks}`,
        });
    }
    strony.push({
      szer: strona.szer,
      wys: strona.wys,
      elementy: u.czarnoBialy ? wSkaliSzarosci(elementy) : elementy,
      glify: polaczGlify(...glify),
    });
  }
  return {
    strony,
    rozmieszczenie,
    poczatekSiatki: poczatek,
    slot,
    odstepKolumny,
    odstepRzedu,
    odstep,
    naglowki: geometriaNaglowkow,
    siatka: {
      kolumny: Math.max(0, Math.floor(siatka.szer / slot.szerokosc + 1e-6)),
      rzedy: rzedySiatki,
      grupy: !!(grupy && u.grupy),
    },
    ...(tytul && u.tytul ? { tytul: { rozmiar: rozmiarTytulu, dlugosc: tytul.szer } } : {}),
    ostrzezenia,
  };
}

/**
 * Arkusz w trybie mieszanych rozmiarów: karty o własnych wymiarach ułożone w pasach (`pasy.ts`),
 * wspólne linie cięcia scalone. Tło do slotu i luz nie mają tu zastosowania (karta zajmuje
 * dokładnie swój wymiar), przypięcia slotów, nagłówki ręczne i własny układ są ignorowane.
 */
function zbudujMieszane(w: {
  arkusz: Arkusz;
  talia: Talia;
  ctx: KontekstArkusza;
  karty: Karta[];
  szablon: (k: Karta) => Szablon | undefined;
  slot: { szerokosc: Mm; wysokosc: Mm };
  obszar: { x: Mm; y: Mm; szer: Mm; wys: Mm };
  tytul: Napis | undefined;
  ostrzezenia: OstrzezenieArkusza[];
}): WynikArkusza {
  const { arkusz, talia, ctx, szablon, slot, obszar, ostrzezenia } = w;
  let { tytul } = w;
  const u = arkusz.ustawienia;
  const strona = wymiaryStrony(u);
  const opcje = u.mieszane ?? MIESZANE_DOMYSLNE;
  const stylGrup = u.grupy;

  // Grupy talii: każda zaczyna nowy pas, nagłówek nad nim (styl jak w układzie siatki).
  const grupy = stylGrup && talia.grupy && talia.grupy.length > 0 ? talia.grupy : undefined;
  const naglowekGrupy = (g: { naglowek: string; opis?: string }) => ({
    naglowek: napis(g.naglowek, stylGrup!.styl, obszar.szer, ctx.czcionki),
    opis: napis(g.opis ?? '', stylGrup!.stylOpisu, obszar.szer, ctx.czcionki),
  });
  const wysNaglowka = new Map<string, number>();
  for (const g of grupy ?? []) {
    const n = naglowekGrupy(g);
    wysNaglowka.set(g.id, n.naglowek.wys + n.opis.wys + stylGrup!.odstepOdKart);
  }
  const grupaKarty = new Map<string, string>();
  for (const g of grupy ?? []) for (const id of g.karty) grupaKarty.set(id, g.id);

  // Egzemplarze w kolejności rozmieszczania (przy „najwięksi” pasy.ts sortuje je sam).
  const uporzadkowane = opcje.kolejnosc === 'wlasna' ? kolejnoscKart(arkusz, w.karty) : w.karty;
  const wejscie: KartaDoPasow[] = egzemplarze(uporzadkowane, () => ({ kolumny: 1, rzedy: 1 })).map(
    (e) => {
      const { szer, wys } = wymiaryKarty(szablon(e.karta)!, e.karta);
      const grupaId = grupaKarty.get(e.karta.id);
      return {
        klucz: `${e.karta.id}#${e.numer}`,
        kartaId: e.karta.id,
        numer: e.numer,
        szer,
        wys,
        ...(grupaId ? { grupaId } : {}),
      };
    },
  );
  const uklad = ulozPasy(wejscie, {
    obszar,
    odstep: opcje.odstep,
    obracaj: opcje.obracaj,
    grupujRozmiary: opcje.grupujRozmiary,
    kolejnosc: opcje.kolejnosc,
    ...(grupy
      ? { grupy: grupy.map((g) => ({ id: g.id, naglowek: wysNaglowka.get(g.id) ?? 0 })) }
      : {}),
  });
  const kartaPoId = new Map(w.karty.map((k) => [k.id, k]));
  for (const klucz of uklad.pominiete) {
    const kartaId = klucz.slice(0, klucz.lastIndexOf('#'));
    ostrzezenia.push({ kartaId, komunikat: 'karta-wieksza-niz-strona' });
  }
  const liczbaStron = Math.max(1, uklad.liczbaStron);
  // Współrzędne na stronie (mm od rogu).
  const karty = uklad.karty.map((k) => ({
    ...k,
    x: obszar.x + k.x,
    y: obszar.y + k.y,
    karta: kartaPoId.get(k.kartaId)!,
  }));
  const pasy = uklad.pasy.map((p) => ({
    ...p,
    y: obszar.y + p.y,
    ...(p.naglowek ? { naglowek: { ...p.naglowek, y: obszar.y + p.naglowek.y } } : {}),
  }));
  const wolne = uklad.wolne.map((x) => ({ ...x, x: obszar.x + x.x, y: obszar.y + x.y }));

  // Tytuł: wzdłuż boku obszaru kart.
  let rozmiarTytulu = u.tytul?.styl.rozmiar ?? 0;
  if (u.tytul && tytul && tytul.szer > 0) {
    const limit = u.tytul.polozenie === 'lewo' ? obszar.wys : obszar.szer;
    const d = dopasujTytul(u.tytul, tytul, limit, ctx.czcionki);
    tytul = d.tytul;
    rozmiarTytulu = d.rozmiar;
    if (!d.miesci) ostrzezenia.push({ komunikat: 'tytul-nie-miesci-sie' });
  }

  const scenaKarty = fabrykaScenKart(ctx, szablon, ostrzezenia);
  const strony: Scena[] = [];
  for (let n = 0; n < liczbaStron; n++) {
    const elementy: ElementSceny[] = [];
    const glify: Record<string, DefinicjaGlifu>[] = [];
    const naStronie = karty.filter((c) => c.strona === n);
    for (const c of naStronie) {
      const s = scenaKarty(c.karta);
      glify.push(s.glify);
      // Obrót o 90° zgodnie z ruchem wskazówek: obrócona karta zajmuje (wys × szer) od (x, y).
      elementy.push(
        c.obrocona
          ? { typ: 'grupa', x: c.x + c.szer, y: c.y, obrot: 90, elementy: s.elementy }
          : { typ: 'grupa', x: c.x, y: c.y, elementy: s.elementy },
      );
    }
    // Strefa bezpieczeństwa (np. przycięcie w punkcie foto): karta nie powinna w nią wchodzić.
    const mb = u.marginesBezpieczenstwa ?? 0;
    if (mb > 0) {
      for (const c of naStronie) {
        if (
          c.x < mb - 1e-6 ||
          c.y < mb - 1e-6 ||
          c.x + c.szer > strona.szer - mb + 1e-6 ||
          c.y + c.wys > strona.wys - mb + 1e-6
        )
          ostrzezenia.push({ kartaId: c.kartaId, komunikat: 'karta-w-strefie-przyciecia' });
      }
    }
    const odcinki = odcinkiCieciaProstokatow(naStronie);
    for (const o of odcinki) elementy.push(liniaCiecia(o, u.linie));

    if (u.tytul && tytul) {
      glify.push(tytul.glify);
      elementy.push(
        u.tytul.polozenie === 'lewo'
          ? {
              typ: 'grupa',
              x: obszar.x - u.tytul.odstep - tytul.wys,
              y: obszar.y + obszar.wys,
              obrot: -90,
              elementy: tytul.elementy,
            }
          : {
              typ: 'grupa',
              x: obszar.x,
              y: obszar.y - u.tytul.odstep - tytul.wys,
              elementy: tytul.elementy,
            },
      );
    }
    if (stylGrup) {
      for (const p of pasy.filter((x) => x.strona === n && x.naglowek)) {
        const g = grupy?.find((x) => x.id === p.naglowek!.grupaId);
        if (!g) continue;
        const nag = naglowekGrupy(g);
        if (nag.naglowek.wys + nag.opis.wys + stylGrup.odstepOdKart > p.naglowek!.wys + 1e-6)
          ostrzezenia.push({ komunikat: `naglowek-grupy-nie-miesci-sie:${g.id}` });
        glify.push(nag.naglowek.glify, nag.opis.glify);
        elementy.push({
          typ: 'grupa',
          x: obszar.x,
          y: p.naglowek!.y,
          elementy: nag.naglowek.elementy,
        });
        elementy.push({
          typ: 'grupa',
          x: obszar.x,
          y: p.naglowek!.y + nag.naglowek.wys,
          elementy: nag.opis.elementy,
        });
      }
    }
    if (u.nozyczki && odcinki.length > 0) {
      const nz = nozyczkiNaScenie(u.nozyczki, odcinki, 0, u.linie);
      if (nz) elementy.push(...nz);
      else
        ostrzezenia.push({
          komunikat: `nozyczki-poza-siatka:${u.nozyczki.linia}:${u.nozyczki.indeks}`,
        });
    }
    strony.push({
      szer: strona.szer,
      wys: strona.wys,
      elementy: u.czarnoBialy ? wSkaliSzarosci(elementy) : elementy,
      glify: polaczGlify(...glify),
    });
  }
  return {
    strony,
    rozmieszczenie: { karty: [], regiony: [], liczbaStron, ostrzezenia: [] },
    poczatekSiatki: { x: obszar.x, y: obszar.y },
    slot,
    siatka: { kolumny: 0, rzedy: 0, grupy: false },
    odstepKolumny: () => 0,
    odstepRzedu: () => 0,
    odstep: { x: 0, y: 0 },
    naglowki: [],
    mieszane: { obszar, karty, pasy, wolne, pominiete: uklad.pominiete },
    ...(tytul && u.tytul ? { tytul: { rozmiar: rozmiarTytulu, dlugosc: tytul.szer } } : {}),
    ostrzezenia,
  };
}

function ostrzezenieKarty(k: Karta, o: Ostrzezenie): OstrzezenieArkusza {
  return {
    kartaId: k.id,
    komunikat: `${o.komunikat}:${o.pole}${o.szczegoly ? `:${o.szczegoly}` : ''}`,
  };
}

/**
 * Nożyczki na przedłużeniu `indeks`-tej linii cięcia (licząc rzeczywiste linie na stronie –
 * przy grupach z odstępami), poza obszarem kart, skierowane do środka. Od nożyczek do krawędzi
 * siatki biegnie przerywana linia prowadząca – jak w oryginale.
 */
function nozyczkiNaScenie(
  n: NonNullable<Arkusz['ustawienia']['nozyczki']>,
  odcinki: { x1: Mm; y1: Mm; x2: Mm; y2: Mm }[],
  pasNaglowkow: Mm,
  linie: LinieCiecia,
): ElementSceny[] | undefined {
  const r = n.rozmiar;
  const odstep = n.odstep + r / 2;
  const unikalne = (v: number[]) =>
    [...new Set(v.map((x) => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
  const pionowe = odcinki.filter((o) => o.x1 === o.x2);
  const poziome = odcinki.filter((o) => o.y1 === o.y2);
  let x: Mm;
  let y: Mm;
  let obrot: number;
  let prowadzaca: { x1: Mm; y1: Mm; x2: Mm; y2: Mm };
  if (n.linia === 'pozioma') {
    const yy = unikalne(poziome.map((o) => o.y1))[n.indeks];
    if (yy === undefined) return undefined;
    // Krawędź siatki na tej linii: skrajny odcinek leżący na niej.
    const naLinii = poziome.filter((o) => Math.abs(o.y1 - yy) < 1e-3);
    const lewa = Math.min(...naLinii.map((o) => Math.min(o.x1, o.x2)));
    const prawa = Math.max(...naLinii.map((o) => Math.max(o.x1, o.x2)));
    y = yy;
    x = n.strona === 'poczatek' ? lewa - odstep : prawa + odstep;
    obrot = n.strona === 'poczatek' ? 0 : 180;
    prowadzaca =
      n.strona === 'poczatek'
        ? { x1: x + r / 2, y1: y, x2: lewa, y2: y }
        : { x1: prawa, y1: y, x2: x - r / 2, y2: y };
  } else {
    const xx = unikalne(pionowe.map((o) => o.x1))[n.indeks];
    if (xx === undefined) return undefined;
    const naLinii = pionowe.filter((o) => Math.abs(o.x1 - xx) < 1e-3);
    const gora = Math.min(...naLinii.map((o) => Math.min(o.y1, o.y2)));
    const dol = Math.max(...naLinii.map((o) => Math.max(o.y1, o.y2)));
    x = xx;
    // Nad siatką – ponad pasem nagłówków grup.
    y = n.strona === 'poczatek' ? gora - pasNaglowkow - odstep : dol + odstep;
    obrot = n.strona === 'poczatek' ? 90 : -90;
    prowadzaca =
      n.strona === 'poczatek'
        ? // Nad siatką linia kończy się nad pasem nagłówków grup – nie przecina napisów.
          { x1: x, y1: y + r / 2, x2: x, y2: gora - pasNaglowkow }
        : { x1: x, y1: dol, x2: x, y2: y - r / 2 };
  }
  const wynik: ElementSceny[] = [];
  if (Math.hypot(prowadzaca.x2 - prowadzaca.x1, prowadzaca.y2 - prowadzaca.y1) > linie.kreska)
    wynik.push(liniaCiecia(prowadzaca, linie));
  wynik.push({
    typ: 'grupa',
    x,
    y,
    obrot,
    elementy: [
      {
        typ: 'sciezka',
        kontur: konturIkony('nozyczki', -r / 2, -r / 2, r),
        wypelnienie: linie.kolor,
      },
    ],
  });
  return wynik;
}

/** Sufiks zasobu obrazu w skali szarości (tryb czarno-biały arkusza). */
export const SUFIKS_SZARY = '#szary';

/**
 * Scena arkusza czarno-białego: obrazy wskazują szare wersje zasobów (`id#szary`), które
 * przygotowuje warstwa wczytująca zasoby. Wektory zamienia na szarości już `zbudujArkusz`.
 */
export function zSzarymiObrazami(scena: Scena): Scena {
  const zmien = (elementy: ElementSceny[]): ElementSceny[] =>
    elementy.map((e) =>
      e.typ === 'obraz'
        ? { ...e, zasob: e.zasob + SUFIKS_SZARY }
        : e.typ === 'grupa'
          ? { ...e, elementy: zmien(e.elementy) }
          : e,
    );
  return { ...scena, elementy: zmien(scena.elementy) };
}

/**
 * Wydruk testowy kartki: ta sama siatka co na kartce (z odstępami własnego układu), ale zamiast
 * kart same obrysy slotów z numerami i krzyżykami na środkach – do sprawdzenia, czy wydruk trafia
 * w perforację (z kalibracją przesunięcia jak zwykły PDF). Jedna strona.
 */
export function stronaTestowa(arkusz: Arkusz, talia: Talia, ctx: KontekstArkusza): Scena {
  // Prawdziwa talia: ten sam slot (z szablonu kart) i ten sam pas nagłówków co na kartce.
  const w = zbudujArkusz({ ...arkusz, liczbaStron: 1 }, talia, ctx);
  const { szer, wys } = wymiaryStrony(arkusz.ustawienia);
  const elementy: ElementSceny[] = [];
  const glify: Record<string, DefinicjaGlifu>[] = [];
  const obrys = { kolor: '#000000', grubosc: 0.2 };
  const krzyzyk = { kolor: '#000000', grubosc: 0.15 };
  const styl: StylTekstu = { czcionka: 'tytul', rozmiar: 4, kolor: '#000000' };
  const s = w.slot;
  // Pola: cała siatka; przy grupach talii (kolumny przesunięte regionami) – miejsca kart strony 1.
  const pola = w.mieszane
    ? // Mieszane rozmiary: obrysy kart pierwszej strony (karta zajmuje dokładnie swój wymiar).
      w.mieszane.karty
        .filter((c) => c.strona === 0)
        .map((c) => ({ x: c.x, y: c.y, szer: c.szer, wys: c.wys }))
    : w.siatka.grupy
      ? w.rozmieszczenie.karty
          .filter((c) => c.strona === 0)
          .map((c) => ({
            x:
              w.poczatekSiatki.x +
              c.xRegionu +
              w.odstepKolumny(0, c.kolumna) +
              c.kolumna * s.szerokosc,
            y: w.poczatekSiatki.y + c.rzad * s.wysokosc + w.odstepRzedu(c.rzad),
            szer: c.kolumny * s.szerokosc,
            wys: c.rzedy * s.wysokosc,
          }))
      : Array.from({ length: w.siatka.rzedy * w.siatka.kolumny }, (_, i) => {
          const k = i % w.siatka.kolumny;
          const r = Math.floor(i / w.siatka.kolumny);
          return {
            x: w.poczatekSiatki.x + w.odstepKolumny(0, k) + k * s.szerokosc,
            y: w.poczatekSiatki.y + r * s.wysokosc + w.odstepRzedu(r),
            szer: s.szerokosc,
            wys: s.wysokosc,
          };
        });
  // Obrysy wokół karty (nie slotu): rozmiar karty z pierwszego szablonu talii w trybie mm.
  const dop = arkusz.ustawienia.dopasowanie;
  const wzor = talia.karty
    .map((k) => ctx.szablony.get(k.szablonId))
    .find((x) => x?.rozmiar.tryb === 'mm');
  const rozmiarKarty =
    !w.mieszane && dop?.linie === 'karta' && wzor ? wymiaryKarty(wzor) : undefined;
  pola.forEach((slotPola, i) => {
    const p =
      rozmiarKarty &&
      slotPola.szer >= rozmiarKarty.szer - 1e-6 &&
      slotPola.wys >= rozmiarKarty.wys - 1e-6
        ? { ...polozenieKarty(slotPola, rozmiarKarty, dop), ...rozmiarKarty }
        : slotPola;
    elementy.push({ typ: 'prostokat', ...p, obrys });
    const cx = p.x + p.szer / 2;
    const cy = p.y + p.wys / 2;
    const d = Math.min(5, p.szer / 6, p.wys / 6);
    elementy.push({ typ: 'linia', x1: cx - d, y1: cy, x2: cx + d, y2: cy, obrys: krzyzyk });
    elementy.push({ typ: 'linia', x1: cx, y1: cy - d, x2: cx, y2: cy + d, obrys: krzyzyk });
    const nr = napis(String(i + 1), styl, undefined, ctx.czcionki);
    glify.push(nr.glify);
    elementy.push({ typ: 'grupa', x: p.x + 1.5, y: p.y + 1, elementy: nr.elementy });
  });
  return { szer, wys, elementy, glify: polaczGlify(...glify) };
}

/**
 * Kalibracja drukarki: przesunięcie zawartości strony o (x, y) mm (+ w prawo / w dół). Tylko PDF –
 * podgląd zostaje bez przesunięcia.
 */
export function przesunScene(scena: Scena, p: { x: Mm; y: Mm }): Scena {
  if (!p.x && !p.y) return scena;
  return { ...scena, elementy: [{ typ: 'grupa', x: p.x, y: p.y, elementy: scena.elementy }] };
}
