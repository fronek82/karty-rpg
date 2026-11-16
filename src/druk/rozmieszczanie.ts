import type { Mm } from '../model/jednostki';
import type { Karta } from '../model/szablon';

/**
 * Rozmieszczanie kart na siatce slotów. Czyste funkcje, bez DOM – deterministyczny wynik.
 *
 * Bez grup: jedna siatka na stronę; karty przypięte idą pierwsze, reszta „pierwsze wolne miejsce”
 * (wiersz po wierszu), od największych – mniej dziur. Z grupami: każda grupa dostaje własne kolumny
 * (tyle, ile trzeba przy pełnej wysokości siatki), grupy obok siebie z odstępem w mm.
 */

export interface Egzemplarz {
  karta: Karta;
  /** Numer egzemplarza (0 … ilosc−1). */
  numer: number;
  /** Rozmiar w slotach. */
  kolumny: number;
  rzedy: number;
}

export interface UmieszczonaKarta extends Egzemplarz {
  strona: number;
  /** Pozycja w slotach względem lewego górnego rogu obszaru (regionu) karty. */
  kolumna: number;
  rzad: number;
  /** Przesunięcie regionu (mm) od początku siatki. */
  xRegionu: Mm;
  grupaId?: string;
}

export interface RegionGrupy {
  strona: number;
  grupaId: string;
  /** Przesunięcie (mm) od początku siatki. */
  x: Mm;
  kolumny: number;
}

export interface SiatkaStrony {
  /** Wymiary obszaru siatki (mm). */
  szer: Mm;
  wys: Mm;
  slot: { szerokosc: Mm; wysokosc: Mm };
}

export interface GrupaDoRozmieszczenia {
  id: string;
  kartyIds: string[];
}

export interface OpcjeRozmieszczenia {
  przypiete?: { kartaId: string; kolumna: number; rzad: number; strona?: number }[];
  grupy?: { lista: GrupaDoRozmieszczenia[]; odstep: Mm };
}

export interface WynikRozmieszczenia {
  karty: UmieszczonaKarta[];
  regiony: RegionGrupy[];
  liczbaStron: number;
  ostrzezenia: string[];
}

/** Rozwija karty talii w egzemplarze wg kolumny „Ilość”. */
export function egzemplarze(
  karty: Karta[],
  rozmiar: (k: Karta) => { kolumny: number; rzedy: number },
): Egzemplarz[] {
  const wynik: Egzemplarz[] = [];
  for (const k of karty) {
    const r = rozmiar(k);
    for (let n = 0; n < Math.max(0, Math.floor(k.ilosc)); n++)
      wynik.push({ karta: k, numer: n, ...r });
  }
  return wynik;
}

class Zajetosc {
  private readonly komorki: boolean[];
  constructor(
    readonly kolumny: number,
    readonly rzedy: number,
  ) {
    this.komorki = new Array<boolean>(kolumny * rzedy).fill(false);
  }
  wolne(k: number, r: number, w: number, h: number): boolean {
    if (k < 0 || r < 0 || k + w > this.kolumny || r + h > this.rzedy) return false;
    for (let y = r; y < r + h; y++)
      for (let x = k; x < k + w; x++) if (this.komorki[y * this.kolumny + x]) return false;
    return true;
  }
  zajmij(k: number, r: number, w: number, h: number): void {
    for (let y = r; y < r + h; y++)
      for (let x = k; x < k + w; x++) this.komorki[y * this.kolumny + x] = true;
  }
  /** Pierwsze wolne miejsce: wiersz po wierszu albo kolumna po kolumnie. */
  znajdz(w: number, h: number, kolumnami: boolean): { k: number; r: number } | undefined {
    const zew = kolumnami ? this.kolumny : this.rzedy;
    const wew = kolumnami ? this.rzedy : this.kolumny;
    for (let a = 0; a < zew; a++) {
      for (let b = 0; b < wew; b++) {
        const k = kolumnami ? a : b;
        const r = kolumnami ? b : a;
        if (this.wolne(k, r, w, h)) return { k, r };
      }
    }
    return undefined;
  }
}

/** Od największych (pole), przy remisie – kolejność z talii (sortowanie stabilne). */
const odNajwiekszych = (a: Egzemplarz, b: Egzemplarz) => b.kolumny * b.rzedy - a.kolumny * a.rzedy;

export function rozmiescKarty(
  lista: Egzemplarz[],
  siatka: SiatkaStrony,
  opcje: OpcjeRozmieszczenia = {},
): WynikRozmieszczenia {
  const kolumny = Math.floor(siatka.szer / siatka.slot.szerokosc + 1e-6);
  const rzedy = Math.floor(siatka.wys / siatka.slot.wysokosc + 1e-6);
  const ostrzezenia: string[] = [];
  if (kolumny < 1 || rzedy < 1) {
    return { karty: [], regiony: [], liczbaStron: 0, ostrzezenia: ['siatka-za-mala'] };
  }
  const zaDuze = lista.filter((e) => e.kolumny > kolumny || e.rzedy > rzedy);
  if (zaDuze.length > 0)
    ostrzezenia.push(
      `karta-wieksza-niz-strona:${[...new Set(zaDuze.map((e) => e.karta.id))].join(',')}`,
    );
  const doRozmieszczenia = lista.filter((e) => !zaDuze.includes(e));
  if (opcje.grupy && opcje.przypiete && opcje.przypiete.length > 0) {
    ostrzezenia.push('przypiecia-ignorowane-przy-grupach');
  }
  return opcje.grupy
    ? rozmiescGrupami(doRozmieszczenia, siatka, rzedy, opcje.grupy, ostrzezenia)
    : rozmiescBezGrup(doRozmieszczenia, kolumny, rzedy, opcje.przypiete ?? [], ostrzezenia);
}

function rozmiescBezGrup(
  lista: Egzemplarz[],
  kolumny: number,
  rzedy: number,
  przypiete: NonNullable<OpcjeRozmieszczenia['przypiete']>,
  ostrzezenia: string[],
): WynikRozmieszczenia {
  const strony: Zajetosc[] = [];
  const strona = (n: number) => {
    while (strony.length <= n) strony.push(new Zajetosc(kolumny, rzedy));
    return strony[n]!;
  };
  const wynik: UmieszczonaKarta[] = [];
  const pozostale = [...lista];

  for (const p of przypiete) {
    const i = pozostale.findIndex((e) => e.karta.id === p.kartaId);
    if (i < 0) {
      ostrzezenia.push(`przypiecie-bez-karty:${p.kartaId}`);
      continue;
    }
    const e = pozostale[i]!;
    if ((p.strona ?? 0) < 0 || !Number.isInteger(p.strona ?? 0)) {
      ostrzezenia.push(`przypiecie-zla-strona:${p.kartaId}`);
      continue;
    }
    const z = strona(p.strona ?? 0);
    if (!z.wolne(p.kolumna, p.rzad, e.kolumny, e.rzedy)) {
      ostrzezenia.push(`przypiecie-koliduje:${p.kartaId}@${p.kolumna},${p.rzad}`);
      continue;
    }
    z.zajmij(p.kolumna, p.rzad, e.kolumny, e.rzedy);
    wynik.push({ ...e, strona: p.strona ?? 0, kolumna: p.kolumna, rzad: p.rzad, xRegionu: 0 });
    pozostale.splice(i, 1);
  }

  for (const e of [...pozostale].sort(odNajwiekszych)) {
    for (let n = 0; ; n++) {
      const z = strona(n);
      const m = z.znajdz(e.kolumny, e.rzedy, false);
      if (m) {
        z.zajmij(m.k, m.r, e.kolumny, e.rzedy);
        wynik.push({ ...e, strona: n, kolumna: m.k, rzad: m.r, xRegionu: 0 });
        break;
      }
    }
  }
  return {
    karty: wynik,
    regiony: [],
    liczbaStron: Math.max(strony.length, wynik.length > 0 ? 1 : 0),
    ostrzezenia,
  };
}

function rozmiescGrupami(
  lista: Egzemplarz[],
  siatka: SiatkaStrony,
  rzedy: number,
  grupy: NonNullable<OpcjeRozmieszczenia['grupy']>,
  ostrzezenia: string[],
): WynikRozmieszczenia {
  const wynik: UmieszczonaKarta[] = [];
  const regiony: RegionGrupy[] = [];
  const slot = siatka.slot.szerokosc;
  let strona = 0;
  let x = 0; // zajęta szerokość bieżącej strony (mm)

  // Karta w kilku grupach należy do pierwszej (inaczej jej ilość by się zwielokrotniła).
  const przydzial = new Map<string, string>();
  for (const g of grupy.lista) {
    for (const id of g.kartyIds) {
      if (przydzial.has(id)) ostrzezenia.push(`karta-w-wielu-grupach:${id}`);
      else przydzial.set(id, g.id);
    }
  }
  // Karty spoza grup trafiają do grupy bez nagłówka na końcu.
  const wGrupach = new Set(przydzial.keys());
  const lista2 = grupy.lista.map((g) => ({
    ...g,
    kartyIds: g.kartyIds.filter((id) => przydzial.get(id) === g.id),
  }));
  const bezGrupy = lista.filter((e) => !wGrupach.has(e.karta.id));
  if (bezGrupy.length > 0)
    lista2.push({ id: '', kartyIds: [...new Set(bezGrupy.map((e) => e.karta.id))] });

  for (const g of lista2) {
    let karty = lista.filter((e) => g.kartyIds.includes(e.karta.id)).sort(odNajwiekszych);
    while (karty.length > 0) {
      const sloty = karty.reduce((s, e) => s + e.kolumny * e.rzedy, 0);
      const najszersza = Math.max(...karty.map((e) => e.kolumny));
      const odstep = x > 0 ? grupy.odstep : 0;
      const miejsce = Math.floor((siatka.szer - x - odstep) / slot + 1e-6);
      const pelnaStrona = Math.floor(siatka.szer / slot + 1e-6);
      const potrzeba = Math.max(najszersza, Math.ceil(sloty / rzedy));
      // Grupa, która nie zmieści się tu w całości, a zmieściłaby się na pustej stronie – zaczyna
      // się na następnej (nie dzielimy jej bez potrzeby).
      if (miejsce < najszersza || (x > 0 && potrzeba > miejsce && potrzeba <= pelnaStrona)) {
        // Brak miejsca na tej stronie – grupa zaczyna się na następnej.
        strona++;
        x = 0;
        continue;
      }
      let k = Math.min(miejsce, Math.max(najszersza, Math.ceil(sloty / rzedy)));
      // Przy dziurach (mieszane rozmiary) poszerzamy region, dopóki jest miejsce.
      let ulozenie = ulozWRegionie(karty, k, rzedy);
      while (ulozenie.pozostale.length > 0 && k < miejsce) {
        k++;
        ulozenie = ulozWRegionie(karty, k, rzedy);
      }
      const xRegionu = x + odstep;
      if (g.id) regiony.push({ strona, grupaId: g.id, x: xRegionu, kolumny: k });
      for (const u of ulozenie.ulozone) {
        wynik.push({
          ...u.e,
          strona,
          kolumna: u.k,
          rzad: u.r,
          xRegionu,
          ...(g.id ? { grupaId: g.id } : {}),
        });
      }
      x = xRegionu + k * slot;
      karty = ulozenie.pozostale;
      if (karty.length > 0) {
        strona++;
        x = 0;
      }
    }
  }
  if (ostrzezenia.length > 0 && wynik.length === 0)
    return { karty: [], regiony, liczbaStron: 0, ostrzezenia };
  return { karty: wynik, regiony, liczbaStron: wynik.length > 0 ? strona + 1 : 0, ostrzezenia };
}

function ulozWRegionie(karty: Egzemplarz[], kolumny: number, rzedy: number) {
  const z = new Zajetosc(kolumny, rzedy);
  const ulozone: { e: Egzemplarz; k: number; r: number }[] = [];
  const pozostale: Egzemplarz[] = [];
  for (const e of karty) {
    // W grupie kolumna po kolumnie – grupa rośnie w prawo jak na arkuszu stanów.
    const m = z.znajdz(e.kolumny, e.rzedy, true);
    if (m) {
      z.zajmij(m.k, m.r, e.kolumny, e.rzedy);
      ulozone.push({ e, k: m.k, r: m.r });
    } else pozostale.push(e);
  }
  return { ulozone, pozostale };
}
