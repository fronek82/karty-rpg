import type { Mm } from '../model/jednostki';

/**
 * Mieszane rozmiary kart na kartce (M2b-2): układ w pasach. Czyste funkcje, bez DOM –
 * deterministyczny wynik; współrzędne w mm względem lewego górnego rogu obszaru kart.
 *
 * Karty trafiają do pasów poziomych (wysokość pasa = pierwsza karta pasa, wyrównanie do góry), więc
 * cięcie jest „gilotynowe”: najpierw wzdłuż pasów, potem w pasie. Opcjonalnie karty obracane o 90°.
 * Każda grupa talii zaczyna nowy pas (z miejscem na nagłówek nad nim).
 */

const E = 1e-6;
/** Najmniejsze wolne miejsce (mm) wskazywane w edytorze jako „wolne”. */
const MIN_WOLNE: Mm = 15;

export interface KartaDoPasow {
  /** Unikalny klucz egzemplarza (np. `idKarty#numer`). */
  klucz: string;
  kartaId: string;
  numer: number;
  czesc?: number;
  szer: Mm;
  wys: Mm;
  grupaId?: string;
}

export interface OpcjePasow {
  /** Obszar kart (mm). */
  obszar: { szer: Mm; wys: Mm };
  /** Odstęp między kartami w pasie i między pasami. */
  odstep: Mm;
  obracaj: boolean;
  /** Tylko przy `najwieksze`: pas z kartami tej samej wysokości ma pierwszeństwo. */
  grupujRozmiary: boolean;
  /**
   * `najwieksze` – karty (w obrębie grupy) od najwyższych, potem najszerszych, każda w pierwszym
   * pasie, w którym się mieści (na końcu pasa, a gdy tam brak miejsca – pod węższą, niższą kartą
   * pasa); `wlasna` – dokładnie w kolejności wejścia, tylko w ostatnim pasie
   * grupy (kolejność na kartce = kolejność listy).
   */
  kolejnosc: 'najwieksze' | 'wlasna';
  /** Grupy w kolejności; karty bez grupy (albo z nieznaną) trafiają na koniec. */
  grupy?: { id: string; naglowek: Mm }[];
}

export interface UmieszczonaWPasie {
  klucz: string;
  kartaId: string;
  numer: number;
  czesc?: number;
  strona: number;
  /** Lewy górny róg i wymiar po ewentualnym obrocie. */
  x: Mm;
  y: Mm;
  szer: Mm;
  wys: Mm;
  obrocona: boolean;
  /** Numer pasa na stronie (od 0). */
  pas: number;
  grupaId?: string;
}

export interface Pas {
  strona: number;
  y: Mm;
  wys: Mm;
  grupaId?: string;
  /** Miejsce na nagłówek grupy nad pasem (tylko pierwszy pas grupy). */
  naglowek?: { y: Mm; wys: Mm; grupaId: string };
}

export interface WolneMiejsce {
  strona: number;
  x: Mm;
  y: Mm;
  szer: Mm;
  wys: Mm;
  /** Klucz karty, po której w kolejności własnej wstawić nową (brak – na początek strony/końca). */
  poKluczu?: string;
}

export interface WynikPasow {
  karty: UmieszczonaWPasie[];
  pasy: Pas[];
  liczbaStron: number;
  /** Klucze kart, które nie mieszczą się nawet na pustej stronie. */
  pominiete: string[];
  wolne: WolneMiejsce[];
}

/** Kolumna pasa: pierwsza karta (szerokość kolumny) i karty ułożone pod nią (od góry pasa). */
interface Kolumna {
  x: Mm;
  szer: Mm;
  uzyteY: Mm;
  ostatni: string;
}

interface PasRoboczy extends Pas {
  uzyte: Mm;
  karty: UmieszczonaWPasie[];
  kolumny: Kolumna[];
}

const rowne = (a: Mm, b: Mm) => Math.abs(a - b) < 1e-3;

/** Kolejność od największych: wyższe, potem szersze; remis – kolejność wejścia (stabilnie). */
export function posortujOdNajwiekszych<T extends { wys: Mm; szer: Mm }>(karty: T[]): T[] {
  return karty
    .map((k, i) => ({ k, i }))
    .sort((a, b) => b.k.wys - a.k.wys || b.k.szer - a.k.szer || a.i - b.i)
    .map((x) => x.k);
}

export function ulozPasy(wejscie: KartaDoPasow[], o: OpcjePasow): WynikPasow {
  const { obszar, odstep } = o;
  const grupy = o.grupy ?? [];
  const idGrup = new Set(grupy.map((g) => g.id));
  const kolejneGrupy: { id?: string; naglowek: Mm }[] = [
    ...grupy,
    { naglowek: 0 }, // bez grupy
  ];

  const pasy: PasRoboczy[] = [];
  const pominiete: string[] = [];
  let strona = 0;
  let koniec = 0; // dolna krawędź ostatniego pasa na bieżącej stronie
  let pasyStrony: PasRoboczy[] = [];
  let juzNaStronie = false;

  const nowaStrona = () => {
    strona++;
    koniec = 0;
    pasyStrony = [];
    juzNaStronie = false;
  };

  for (const g of kolejneGrupy) {
    let karty = wejscie.filter((k) =>
      g.id === undefined ? !k.grupaId || !idGrup.has(k.grupaId) : k.grupaId === g.id,
    );
    if (karty.length === 0) continue;
    if (o.kolejnosc === 'najwieksze') karty = posortujOdNajwiekszych(karty);
    let pierwszyPasGrupy = true;
    const pasyGrupy: PasRoboczy[] = [];

    const znajdz = (szer: Mm, wys: Mm): PasRoboczy | undefined => {
      const mieści = (p: PasRoboczy) =>
        wys <= p.wys + E && p.uzyte + (p.karty.length ? odstep : 0) + szer <= obszar.szer + E;
      // Tylko pasy bieżącej strony (nowa strona zaczyna się od pustych pasów).
      const naStronie = pasyGrupy.filter((p) => p.strona === strona);
      if (o.kolejnosc === 'wlasna') {
        const ostatni = naStronie.at(-1);
        return ostatni && mieści(ostatni) ? ostatni : undefined;
      }
      if (o.grupujRozmiary) {
        const taki = naStronie.find((p) => p.karty.some((k) => rowne(k.wys, wys)) && mieści(p));
        if (taki) return taki;
      }
      return naStronie.find(mieści);
    };

    const wstaw = (
      p: PasRoboczy,
      k: KartaDoPasow,
      szer: Mm,
      wys: Mm,
      obrocona: boolean,
      kolumna?: Kolumna,
    ) => {
      const x = kolumna ? kolumna.x : p.uzyte + (p.karty.length ? odstep : 0);
      const y = kolumna ? p.y + kolumna.uzyteY + odstep : p.y;
      const u: UmieszczonaWPasie = {
        klucz: k.klucz,
        kartaId: k.kartaId,
        numer: k.numer,
        ...(k.czesc ? { czesc: k.czesc } : {}),
        strona: p.strona,
        x,
        y,
        szer,
        wys,
        obrocona,
        pas: pasyStrony.indexOf(p),
        ...(k.grupaId ? { grupaId: k.grupaId } : {}),
      };
      if (kolumna) {
        kolumna.uzyteY = y - p.y + wys;
        kolumna.ostatni = k.klucz;
      } else {
        p.uzyte = u.x + szer;
        p.kolumny.push({ x, szer, uzyteY: wys, ostatni: k.klucz });
      }
      p.karty.push(u);
    };

    /**
     * Kolumna z miejscem pod swoimi kartami: „od największych” – w dowolnym pasie strony,
     * własna – tylko w ostatnim pasie grupy (kolejność listy; ten sam układ co przy odtworzeniu
     * widocznej kolejności).
     */
    const znajdzKolumne = (szer: Mm, wys: Mm) => {
      const naStronie = pasyGrupy.filter((x) => x.strona === strona);
      const kandydaci = o.kolejnosc === 'wlasna' ? naStronie.slice(-1) : naStronie;
      for (const p of kandydaci)
        for (const kol of p.kolumny)
          if (szer <= kol.szer + E && kol.uzyteY + odstep + wys <= p.wys + E) return { p, kol };
      return undefined;
    };

    for (const k of karty) {
      const opcje: { szer: Mm; wys: Mm; obrocona: boolean }[] = [
        { szer: k.szer, wys: k.wys, obrocona: false },
        ...(o.obracaj && !rowne(k.szer, k.wys)
          ? [{ szer: k.wys, wys: k.szer, obrocona: true }]
          : []),
      ];
      // 1. Istniejący pas grupy: bez obrotu (koniec pasa, potem pod kartą), dopiero potem
      // – gdy dozwolony – z obrotem (tak samo).
      let gotowe = false;
      for (const op of opcje) {
        const p = znajdz(op.szer, op.wys);
        if (p) {
          wstaw(p, k, op.szer, op.wys, op.obrocona);
          gotowe = true;
          break;
        }
        const m = znajdzKolumne(op.szer, op.wys);
        if (m) {
          wstaw(m.p, k, op.szer, op.wys, op.obrocona, m.kol);
          gotowe = true;
          break;
        }
      }
      if (gotowe) continue;
      // 2. Nowy pas pod spodem (z nagłówkiem, jeśli to pierwszy pas grupy), inaczej nowa strona.
      const naglowek = pierwszyPasGrupy ? g.naglowek : 0;
      const utworz = (op: { szer: Mm; wys: Mm; obrocona: boolean }) => {
        if (op.szer > obszar.szer + E) return undefined;
        const przerwa = pasyStrony.length ? odstep : 0;
        const y = koniec + przerwa + naglowek;
        if (y + op.wys > obszar.wys + E) return undefined;
        const p: PasRoboczy = {
          strona,
          y,
          wys: op.wys,
          ...(g.id !== undefined ? { grupaId: g.id } : {}),
          ...(naglowek > 0 && g.id !== undefined
            ? { naglowek: { y: koniec + przerwa, wys: naglowek, grupaId: g.id } }
            : {}),
          uzyte: 0,
          karty: [],
          kolumny: [],
        };
        return p;
      };
      let p: PasRoboczy | undefined;
      let wybrana = opcje[0]!;
      for (const op of opcje) {
        p = utworz(op);
        wybrana = op;
        if (p) break;
      }
      if (!p && juzNaStronie) {
        nowaStrona();
        for (const op of opcje) {
          p = utworz(op);
          wybrana = op;
          if (p) break;
        }
      }
      if (!p) {
        pominiete.push(k.klucz);
        continue;
      }
      pasy.push(p);
      pasyStrony.push(p);
      pasyGrupy.push(p);
      koniec = p.y + p.wys;
      juzNaStronie = true;
      pierwszyPasGrupy = false;
      wstaw(p, k, wybrana.szer, wybrana.wys, wybrana.obrocona);
    }
    // Grupa kończy się: następna ma własne pasy (pasyGrupy jest tworzone od nowa w pętli).
  }

  const karty = pasy.flatMap((p) => p.karty);
  const liczbaStron = pasy.length ? Math.max(...pasy.map((p) => p.strona)) + 1 : 1;
  return {
    karty,
    pasy: pasy.map(({ uzyte: _u, karty: _k, kolumny: _c, ...p }) => (void [_u, _k, _c], p)),
    liczbaStron,
    pominiete,
    wolne: wolneMiejsca(pasy, obszar, odstep, liczbaStron, o.kolejnosc === 'najwieksze'),
  };
}

/**
 * Wolne prostokąty: reszta pasa za ostatnią kartą, miejsce pod niższymi kartami pasa i reszta
 * strony pod ostatnim pasem (większe niż `MIN_WOLNE` w obu wymiarach).
 */
function wolneMiejsca(
  pasy: PasRoboczy[],
  obszar: { szer: Mm; wys: Mm },
  odstep: Mm,
  liczbaStron: number,
  najwieksze: boolean,
): WolneMiejsce[] {
  const wynik: WolneMiejsce[] = [];
  const dodaj = (w: WolneMiejsce) => {
    if (w.szer >= MIN_WOLNE && w.wys >= MIN_WOLNE) wynik.push(w);
  };
  for (let s = 0; s < liczbaStron; s++) {
    const naStronie = pasy.filter((p) => p.strona === s);
    for (const p of naStronie) {
      const ostatnia = p.karty.at(-1);
      // Pod kartami pasa: tylko gdy algorytm może tam coś ułożyć („od największych”).
      // Pod kartami: „od największych” w każdym pasie; własna – tylko w ostatnim pasie grupy.
      const ostatniGrupy = !pasy.some(
        (x) => x.grupaId === p.grupaId && pasy.indexOf(x) > pasy.indexOf(p),
      );
      if (najwieksze || ostatniGrupy)
        for (const kol of p.kolumny) {
          dodaj({
            strona: s,
            x: kol.x,
            y: p.y + kol.uzyteY + odstep,
            szer: kol.szer,
            wys: p.wys - kol.uzyteY - odstep,
            poKluczu: kol.ostatni,
          });
        }
      const x = p.uzyte + (p.karty.length ? odstep : 0);
      dodaj({
        strona: s,
        x,
        y: p.y,
        szer: obszar.szer - x,
        wys: p.wys,
        ...(ostatnia ? { poKluczu: ostatnia.klucz } : {}),
      });
    }
    const dol = naStronie.at(-1);
    const y = dol ? dol.y + dol.wys + odstep : 0;
    const ostatniaNaStronie = dol?.karty.at(-1);
    dodaj({
      strona: s,
      x: 0,
      y,
      szer: obszar.szer,
      wys: obszar.wys - y,
      ...(ostatniaNaStronie ? { poKluczu: ostatniaNaStronie.klucz } : {}),
    });
  }
  return wynik;
}

export interface Odcinek {
  x1: Mm;
  y1: Mm;
  x2: Mm;
  y2: Mm;
}

/**
 * Linie cięcia prostokątów kart: każdy bok jako odcinek, odcinki współliniowe, które się stykają
 * albo nakładają, scalone w jeden – wspólna krawędź sąsiednich kart to jedna linia.
 */
export function odcinkiCieciaProstokatow(
  prostokaty: { x: Mm; y: Mm; szer: Mm; wys: Mm }[],
): Odcinek[] {
  return scalOdcinkiCiecia(
    prostokaty.flatMap(({ x, y, szer, wys }) => [
      { x1: x, y1: y, x2: x + szer, y2: y },
      { x1: x, y1: y + wys, x2: x + szer, y2: y + wys },
      { x1: x, y1: y, x2: x, y2: y + wys },
      { x1: x + szer, y1: y, x2: x + szer, y2: y + wys },
    ]),
  );
}

export function scalOdcinkiCiecia(odcinki: Odcinek[]): Odcinek[] {
  const klucz = (v: number) => Math.round(v * 1000);
  type Linie = Map<number, { stala: number; przedzialy: [number, number][] }>;
  const poziome: Linie = new Map();
  const pionowe: Linie = new Map();
  const dodaj = (m: Linie, stala: number, od: number, do_: number) => {
    const k = klucz(stala);
    (m.get(k) ?? m.set(k, { stala, przedzialy: [] }).get(k)!).przedzialy.push([od, do_]);
  };
  for (const o of odcinki) {
    if (o.y1 === o.y2) dodaj(poziome, o.y1, o.x1, o.x2);
    else dodaj(pionowe, o.x1, o.y1, o.y2);
  }
  const scal = (m: Linie, poziomo: boolean): Odcinek[] =>
    [...m.values()].flatMap(({ stala, przedzialy }) => {
      const posortowane = [...przedzialy].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const scalone: [number, number][] = [];
      for (const p of posortowane) {
        const ostatni = scalone.at(-1);
        if (ostatni && p[0] <= ostatni[1] + 1e-3) ostatni[1] = Math.max(ostatni[1], p[1]);
        else scalone.push([p[0], p[1]]);
      }
      return scalone.map(([a, b]) =>
        poziomo ? { x1: a, y1: stala, x2: b, y2: stala } : { x1: stala, y1: a, x2: stala, y2: b },
      );
    });
  return [...scal(poziome, true), ...scal(pionowe, false)].sort(
    (a, b) => a.y1 - b.y1 || a.x1 - b.x1 || a.y2 - b.y2 || a.x2 - b.x2,
  );
}
