import type { Mm } from '../model/jednostki';
import { wymiaryStrony, type Arkusz, type LinieCiecia } from '../model/arkusz';
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
  ostrzezenia: OstrzezenieArkusza[];
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

/** Odcinki cięcia: każdy bok slotu osobno, wspólne boki sąsiednich kart tylko raz. */
export function odcinkiCiecia(
  karty: { x: Mm; y: Mm; kolumny: number; rzedy: number }[],
  slot: { szerokosc: Mm; wysokosc: Mm },
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

export function zbudujArkusz(arkusz: Arkusz, talia: Talia, ctx: KontekstArkusza): WynikArkusza {
  const u = arkusz.ustawienia;
  const strona = wymiaryStrony(u);
  const ostrzezenia: OstrzezenieArkusza[] = [];
  const szablon = (k: Karta) => ctx.szablony.get(k.szablonId);

  // Slot z pierwszego szablonu w trybie slotów (M1: wszystkie karty arkusza w siatce slotów).
  const zSlotem = talia.karty.map(szablon).find((s) => s?.rozmiar.tryb === 'sloty');
  const slot =
    zSlotem && zSlotem.rozmiar.tryb === 'sloty'
      ? zSlotem.rozmiar.slot
      : { szerokosc: 63, wysokosc: 88 };
  const karty = talia.karty.filter((k) => {
    const s = szablon(k);
    if (!s) ostrzezenia.push({ kartaId: k.id, komunikat: 'brak-szablonu' });
    else if (s.rozmiar.tryb !== 'sloty')
      ostrzezenia.push({ kartaId: k.id, komunikat: 'karta-poza-siatka-slotow' });
    return s?.rozmiar.tryb === 'sloty';
  });

  // Tytuł.
  const tytul = u.tytul ? napis(u.tytul.tekst, u.tytul.styl, undefined, ctx.czcionki) : undefined;
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

  // Grupy: wysokość pasa nagłówków zależy od szerokości grup, a ta od liczby rzędów – dwa przybliżenia.
  const grupy = u.grupy && talia.grupy && talia.grupy.length > 0 ? talia.grupy : undefined;
  const lista = egzemplarze(karty, (k) => {
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

  const poczatek = u.poczatekSiatki ?? { x: obszar.x, y: obszar.y + pas };
  const siatka = {
    szer: strona.szer - u.marginesy.prawo - poczatek.x,
    wys: strona.wys - u.marginesy.dol - poczatek.y,
    slot,
  };
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
  const rzedySiatki = Math.floor(siatka.wys / slot.wysokosc + 1e-6);

  // Karty renderujemy raz na kartę (i rozmiar) – egzemplarze są identyczne.
  const pamiec = new Map<string, Scena>();
  const scenaKarty = (k: Karta) => {
    let s = pamiec.get(k.id);
    if (!s) {
      const w = renderujKarte(szablon(k)!, k, {
        czcionki: ctx.czcionki,
        ...(ctx.obraz ? { obraz: ctx.obraz } : {}),
      });
      for (const o of w.ostrzezenia) ostrzezenia.push(ostrzezenieKarty(k, o));
      s = w.scena;
      pamiec.set(k.id, s);
    }
    return s;
  };

  const strony: Scena[] = [];
  for (let n = 0; n < rozmieszczenie.liczbaStron; n++) {
    const elementy: ElementSceny[] = [];
    const glify: Record<string, DefinicjaGlifu>[] = [];
    const naStronie = rozmieszczenie.karty.filter((c) => c.strona === n);
    const prostokaty = naStronie.map((c) => ({
      x: poczatek.x + c.xRegionu + c.kolumna * slot.szerokosc,
      y: poczatek.y + c.rzad * slot.wysokosc,
      kolumny: c.kolumny,
      rzedy: c.rzedy,
    }));
    naStronie.forEach((c, i) => {
      const s = scenaKarty(c.karta);
      glify.push(s.glify);
      elementy.push({
        typ: 'grupa',
        x: prostokaty[i]!.x,
        y: prostokaty[i]!.y,
        elementy: s.elementy,
      });
    });
    const odcinki = odcinkiCiecia(prostokaty, slot);
    for (const o of odcinki) elementy.push(liniaCiecia(o, u.linie));

    const dolSiatki = poczatek.y + rzedySiatki * slot.wysokosc;
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
    if (u.nozyczki && odcinki.length > 0) {
      const n = nozyczkiNaScenie(u.nozyczki, odcinki, pas, u.linie.kolor);
      if (n) elementy.push(n);
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
  return { strony, rozmieszczenie, poczatekSiatki: poczatek, slot, ostrzezenia };
}

function ostrzezenieKarty(k: Karta, o: Ostrzezenie): OstrzezenieArkusza {
  return {
    kartaId: k.id,
    komunikat: `${o.komunikat}:${o.pole}${o.szczegoly ? `:${o.szczegoly}` : ''}`,
  };
}

/**
 * Nożyczki na przedłużeniu `indeks`-tej linii cięcia (licząc rzeczywiste linie na stronie –
 * przy grupach z odstępami), poza obszarem kart, skierowane do środka.
 */
function nozyczkiNaScenie(
  n: NonNullable<Arkusz['ustawienia']['nozyczki']>,
  odcinki: { x1: Mm; y1: Mm; x2: Mm; y2: Mm }[],
  pasNaglowkow: Mm,
  kolor: string,
): ElementSceny | undefined {
  const r = n.rozmiar;
  const odstep = n.odstep + r / 2;
  const unikalne = (v: number[]) =>
    [...new Set(v.map((x) => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
  const pionowe = odcinki.filter((o) => o.x1 === o.x2);
  const poziome = odcinki.filter((o) => o.y1 === o.y2);
  const lewa = Math.min(...poziome.map((o) => Math.min(o.x1, o.x2)));
  const prawa = Math.max(...poziome.map((o) => Math.max(o.x1, o.x2)));
  const gora = Math.min(...pionowe.map((o) => Math.min(o.y1, o.y2)));
  const dol = Math.max(...pionowe.map((o) => Math.max(o.y1, o.y2)));
  let x: Mm;
  let y: Mm;
  let obrot: number;
  if (n.linia === 'pozioma') {
    const yy = unikalne(poziome.map((o) => o.y1))[n.indeks];
    if (yy === undefined) return undefined;
    y = yy;
    x = n.strona === 'poczatek' ? lewa - odstep : prawa + odstep;
    obrot = n.strona === 'poczatek' ? 0 : 180;
  } else {
    const xx = unikalne(pionowe.map((o) => o.x1))[n.indeks];
    if (xx === undefined) return undefined;
    x = xx;
    // Nad siatką – ponad pasem nagłówków grup.
    y = n.strona === 'poczatek' ? gora - pasNaglowkow - odstep : dol + odstep;
    obrot = n.strona === 'poczatek' ? 90 : -90;
  }
  return {
    typ: 'grupa',
    x,
    y,
    obrot,
    elementy: [
      { typ: 'sciezka', kontur: konturIkony('nozyczki', -r / 2, -r / 2, r), wypelnienie: kolor },
    ],
  };
}
