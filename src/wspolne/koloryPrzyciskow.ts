import type { Motyw } from '../ui/motyw';

/** Klucz w localStorage dla własnych kolorów przycisków (osobno dla motywu jasnego i ciemnego). */
export const KLUCZ_KOLOROW_PRZYCISKOW = 'karty.koloryPrzyciskow';

export type RolaKoloru = 'wlasne' | 'gra' | 'awers' | 'rewers';
export type TrybTekstuPrzycisku = 'dark' | 'light';

export interface ZestawKolorowMotywu {
  wlasne: string;
  gra: string;
  awers: string;
  rewers: string;
  tekst: TrybTekstuPrzycisku;
}

export interface ProbkaKoloru {
  hex: string;
  nazwaPl: string;
  nazwaEn: string;
}

/** 13 kolorów z palety motywów do wyboru w Ustawieniach. */
export const PALETA_PRZYCISKOW: readonly ProbkaKoloru[] = [
  { hex: '#df8973', nazwaPl: 'Terakota', nazwaEn: 'Terracotta' },
  { hex: '#dc9571', nazwaPl: 'Brzoskwinia', nazwaEn: 'Peach' },
  { hex: '#669ca6', nazwaPl: 'Turkus łupkowy', nazwaEn: 'Slate teal' },
  { hex: '#1eabb8', nazwaPl: 'Żywy cyjan', nazwaEn: 'Vivid cyan' },
  { hex: '#9ac183', nazwaPl: 'Szałwia', nazwaEn: 'Sage green' },
  { hex: '#d3b989', nazwaPl: 'Piaskowe złoto', nazwaEn: 'Sand gold' },
  { hex: '#eaa448', nazwaPl: 'Ciepła ochra', nazwaEn: 'Warm ochre' },
  { hex: '#ba6f84', nazwaPl: 'Śliwkowy róż', nazwaEn: 'Plum rose' },
  { hex: '#d57b7e', nazwaPl: 'Róż koralowy', nazwaEn: 'Coral rose' },
  { hex: '#3688a9', nazwaPl: 'Morski błękit', nazwaEn: 'Ocean blue' },
  { hex: '#3f758c', nazwaPl: 'Stalowy błękit', nazwaEn: 'Steel blue' },
  { hex: '#8ec1cd', nazwaPl: 'Jasny błękit', nazwaEn: 'Light cyan' },
  { hex: '#7db3ce', nazwaPl: 'Błękit nieba', nazwaEn: 'Sky blue' },
];

export const DOMYSLNE_KOLORY_PRZYCISKOW: Record<Motyw, ZestawKolorowMotywu> = {
  light: {
    wlasne: '#df8973',
    gra: '#669ca6',
    awers: '#9ac183',
    rewers: '#eaa448',
    tekst: 'light',
  },
  dark: {
    wlasne: '#dc9571',
    gra: '#1eabb8',
    awers: '#9ac183',
    rewers: '#d3b989',
    tekst: 'dark',
  },
};

export const KOLOR_TEKSTU_PRZYCISKU: Record<TrybTekstuPrzycisku, string> = {
  dark: '#1e202c',
  light: '#ffffff',
};

type ZapisaneKolory = Partial<Record<Motyw, Partial<ZestawKolorowMotywu>>>;

const WZOR_HEX = /^#[0-9a-f]{6}$/i;
const ZMIENNE_CSS = [
  '--krok-wlasne-1',
  '--krok-wlasne-2',
  '--krok-wlasne-3',
  '--krok-wlasne-4',
  '--krok-gra-1',
  '--krok-gra-2',
  '--strona-awers',
  '--strona-rewers',
  '--krok-tekst',
  '--strona-tekst',
] as const;

let pamiecSesji: ZapisaneKolory | undefined;
const sluchacze = new Set<() => void>();

function czyHex(v: unknown): v is string {
  return typeof v === 'string' && WZOR_HEX.test(v);
}

function czyTrybTekstu(v: unknown): v is TrybTekstuPrzycisku {
  return v === 'dark' || v === 'light';
}

function oczyscMotyw(raw: unknown): Partial<ZestawKolorowMotywu> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const wynik: Partial<ZestawKolorowMotywu> = {};
  if (czyHex(o.wlasne)) wynik.wlasne = o.wlasne.toLowerCase();
  if (czyHex(o.gra)) wynik.gra = o.gra.toLowerCase();
  if (czyHex(o.awers)) wynik.awers = o.awers.toLowerCase();
  if (czyHex(o.rewers)) wynik.rewers = o.rewers.toLowerCase();
  if (czyTrybTekstu(o.tekst)) wynik.tekst = o.tekst;
  return Object.keys(wynik).length > 0 ? wynik : undefined;
}

function odczytajZapisane(): ZapisaneKolory {
  if (pamiecSesji) return pamiecSesji;
  try {
    const raw = window.localStorage.getItem(KLUCZ_KOLOROW_PRZYCISKOW);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const o = parsed as Record<string, unknown>;
    const wynik: ZapisaneKolory = {};
    const light = oczyscMotyw(o.light);
    const dark = oczyscMotyw(o.dark);
    if (light) wynik.light = light;
    if (dark) wynik.dark = dark;
    return wynik;
  } catch {
    return {};
  }
}

function zapisz(dane: ZapisaneKolory): void {
  pamiecSesji = undefined;
  try {
    if (!dane.light && !dane.dark) {
      window.localStorage.removeItem(KLUCZ_KOLOROW_PRZYCISKOW);
    } else {
      window.localStorage.setItem(KLUCZ_KOLOROW_PRZYCISKOW, JSON.stringify(dane));
    }
  } catch {
    pamiecSesji = dane;
  }
}

function aktualnyMotywDom(): Motyw {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function powiadom(motyw?: Motyw): void {
  if (typeof document !== 'undefined') {
    zastosujKoloryPrzyciskow(motyw ?? aktualnyMotywDom());
  }
  sluchacze.forEach((s) => s());
}

/** Zwraca pełny zestaw aktywnych kolorów przycisków dla wskazanego motywu. */
export function odczytajKoloryMotywu(motyw: Motyw): ZestawKolorowMotywu {
  const zapisane = odczytajZapisane()[motyw];
  return { ...DOMYSLNE_KOLORY_PRZYCISKOW[motyw], ...zapisane };
}

/** Czy motyw ma jakiekolwiek nadpisane kolory względem domyślnych. */
export function czyZmienioneKolory(motyw: Motyw): boolean {
  const aktywne = odczytajKoloryMotywu(motyw);
  const domyslne = DOMYSLNE_KOLORY_PRZYCISKOW[motyw];
  return (
    aktywne.wlasne !== domyslne.wlasne ||
    aktywne.gra !== domyslne.gra ||
    aktywne.awers !== domyslne.awers ||
    aktywne.rewers !== domyslne.rewers ||
    aktywne.tekst !== domyslne.tekst
  );
}

/** Nakłada wybrane kolory na zmienne CSS elementu `<html>` (albo czyści nadpisania przy domyślnych). */
export function zastosujKoloryPrzyciskow(motyw: Motyw): void {
  const styl = document.documentElement.style;
  const nadpisania = odczytajZapisane()[motyw];
  if (!nadpisania) {
    for (const zm of ZMIENNE_CSS) styl.removeProperty(zm);
    return;
  }
  const k = { ...DOMYSLNE_KOLORY_PRZYCISKOW[motyw], ...nadpisania };
  styl.setProperty('--krok-wlasne-1', k.wlasne);
  styl.setProperty('--krok-wlasne-2', k.wlasne);
  styl.setProperty('--krok-wlasne-3', k.wlasne);
  styl.setProperty('--krok-wlasne-4', k.wlasne);
  styl.setProperty('--krok-gra-1', k.gra);
  styl.setProperty('--krok-gra-2', k.gra);
  styl.setProperty('--strona-awers', k.awers);
  styl.setProperty('--strona-rewers', k.rewers);
  const kolorTekstu = KOLOR_TEKSTU_PRZYCISKU[k.tekst];
  styl.setProperty('--krok-tekst', kolorTekstu);
  styl.setProperty('--strona-tekst', kolorTekstu);
}

/** Zapisuje nowy kolor dla wskazanej roli w danym motywie i od razu go stosuje. */
export function ustawKolorPrzycisku(motyw: Motyw, rola: RolaKoloru, hex: string): void {
  if (!czyHex(hex)) return;
  const dane = odczytajZapisane();
  dane[motyw] = { ...dane[motyw], [rola]: hex.toLowerCase() };
  zapisz(dane);
  powiadom(motyw);
}

/** Zapisuje kolor napisu (ciemny / biały) na przyciskach dla danego motywu. */
export function ustawTekstPrzycisku(motyw: Motyw, tryb: TrybTekstuPrzycisku): void {
  const dane = odczytajZapisane();
  dane[motyw] = { ...dane[motyw], tekst: tryb };
  zapisz(dane);
  powiadom(motyw);
}

/** Przywraca domyślne kolory przycisków dla wskazanego motywu. */
export function przywrocDomyslneKolory(motyw: Motyw): void {
  const dane = odczytajZapisane();
  delete dane[motyw];
  zapisz(dane);
  powiadom(motyw);
}

export function subskrybujKoloryPrzyciskow(cb: () => void): () => void {
  sluchacze.add(cb);
  return () => sluchacze.delete(cb);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === KLUCZ_KOLOROW_PRZYCISKOW) powiadom();
  });
}
