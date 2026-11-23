import {
  kluczMiniaturyRewersu,
  kluczMiniaturySzablonu,
  type PodsumowanieProjektu,
  type WpisAwersuZProjektu,
  type WpisRewersuZProjektu,
} from '../../dane/baza';
import { duplikujRewersWProjekcie, usunRewers } from '../../dane/rewers';
import { duplikujSzablonWProjekcie } from '../../dane/szablon';
import { t } from '../../i18n';
import { baza } from '../bazaUI';

/** Pozycja „Moich szablonów”: szablon awersu albo rewers zapisany w którymś projekcie. */
export type PozycjaSzablonu =
  | {
      klucz: string;
      rodzaj: 'awers';
      nazwa: string;
      zmieniono: string;
      href: string;
      awers: WpisAwersuZProjektu;
      szablonPodglad: { projektId: string; szablonId: string };
    }
  | {
      klucz: string;
      rodzaj: 'rewers';
      nazwa: string;
      zmieniono: string;
      href: string;
      rewers: WpisRewersuZProjektu;
      rewersPodglad: { projektId: string; rewersId: string };
    };

/** Element listy do usunięcia: projekt („Moje projekty”) albo szablon/rewers („Moje szablony”). */
export type CelUsuniecia =
  | { rodzaj: 'projekt'; projekt: PodsumowanieProjektu }
  | { rodzaj: 'szablon'; pozycja: PozycjaSzablonu };

/** Pozycje „Moich szablonów” od najnowszej zmiany; identyczne kopie rewersów – raz. */
export function pozycjeSzablonow(
  awersy: readonly WpisAwersuZProjektu[],
  rewersy: readonly WpisRewersuZProjektu[],
): PozycjaSzablonu[] {
  const wynik: PozycjaSzablonu[] = [];
  for (const a of awersy) {
    wynik.push({
      klucz: kluczMiniaturySzablonu(a.projektId, a.szablonId),
      rodzaj: 'awers',
      nazwa: a.szablonNazwa,
      zmieniono: a.zmieniono ?? '',
      href: `#/projekt/${encodeURIComponent(a.projektId)}/szablon/${encodeURIComponent(a.szablonId)}`,
      awers: a,
      szablonPodglad: { projektId: a.projektId, szablonId: a.szablonId },
    });
  }
  // Pomijamy tylko identyczne kopie; rewersy o tej samej nazwie i innej treści zostają.
  const widzianeRewersy = new Set<string>();
  for (const r of rewersy) {
    if (widzianeRewersy.has(r.kluczTresci)) continue;
    widzianeRewersy.add(r.kluczTresci);
    wynik.push({
      klucz: kluczMiniaturyRewersu(r.projektId, r.rewersId),
      rodzaj: 'rewers',
      nazwa: r.nazwa,
      zmieniono: r.zmieniono ?? '',
      href: `#/projekt/${encodeURIComponent(r.projektId)}/rewers/${encodeURIComponent(r.rewersId)}`,
      rewers: r,
      rewersPodglad: { projektId: r.projektId, rewersId: r.rewersId },
    });
  }
  return wynik.sort((a, b) => b.zmieniono.localeCompare(a.zmieniono));
}

/** Wczytuje pozycje „Moich szablonów” z bazy. */
export async function wczytajPozycjeSzablonow(): Promise<PozycjaSzablonu[]> {
  const [a, r] = await Promise.all([
    baza().szablonyAwersowZProjektow(),
    baza().rewersyZProjektow(),
  ]);
  return pozycjeSzablonow(a, r);
}

export type Sortowanie = 'zmiana-nowe' | 'zmiana-stare' | 'nazwa-az' | 'nazwa-za';
export const SORTOWANIA: readonly Sortowanie[] = [
  'zmiana-nowe',
  'zmiana-stare',
  'nazwa-az',
  'nazwa-za',
];

/** Normalizacja do wyszukiwania: małe litery, bez znaków diakrytycznych (ł → l). */
const doSzukania = (s: string) =>
  s.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');

/** Filtr po fragmencie nazwy i sortowanie (nazwa według języka, data zmiany). */
export function filtrujISortuj<T extends { nazwa: string; zmieniono: string }>(
  lista: readonly T[],
  fraza: string,
  sortowanie: Sortowanie,
): T[] {
  const szukane = doSzukania(fraza.trim());
  const wynik = szukane ? lista.filter((x) => doSzukania(x.nazwa).includes(szukane)) : [...lista];
  const nazwy = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  const porownaj: Record<Sortowanie, (a: T, b: T) => number> = {
    'zmiana-nowe': (a, b) => b.zmieniono.localeCompare(a.zmieniono),
    'zmiana-stare': (a, b) => a.zmieniono.localeCompare(b.zmieniono),
    'nazwa-az': (a, b) => nazwy.compare(a.nazwa, b.nazwa),
    'nazwa-za': (a, b) => nazwy.compare(b.nazwa, a.nazwa),
  };
  return wynik.sort(porownaj[sortowanie]);
}

export const nazwaCelu = (cel: CelUsuniecia) =>
  cel.rodzaj === 'projekt' ? cel.projekt.nazwa : cel.pozycja.nazwa;

/** Projekt w bazie, którego dotyczy usunięcie (do migawki „Cofnij”). */
export const projektCelu = (cel: CelUsuniecia) =>
  cel.rodzaj === 'projekt'
    ? cel.projekt.id
    : cel.pozycja.rodzaj === 'rewers'
      ? cel.pozycja.rewers.projektId
      : cel.pozycja.awers.projektId;

/**
 * Usuwa projekt (jego szablony i rewersy zostają w „Moich szablonach”) albo jeden szablon/rewers
 * (samodzielny projekt szablonu znika w całości). Szablonu awersu, którego używają karty projektu,
 * nie usuwa (projekt by się zepsuł) – zwraca wtedy `false`.
 */
export async function usunCel(cel: CelUsuniecia): Promise<boolean> {
  if (cel.rodzaj === 'projekt') {
    await baza().usunProjekt(cel.projekt.id);
    return true;
  }
  const poz = cel.pozycja;
  if (poz.rodzaj === 'rewers') {
    const { projekt, zasoby } = await baza().wczytaj(poz.rewers.projektId);
    if (poz.rewers.projektRewersowy && (projekt.rewersy?.length ?? 0) <= 1) {
      await baza().usun(poz.rewers.projektId);
      return true;
    }
    await baza().zapisz(usunRewers(projekt, poz.rewers.rewersId), zasoby);
    await baza()
      .usunMiniature(poz.klucz)
      .catch(() => undefined);
    await baza().usunPustySchowek(poz.rewers.projektId);
    return true;
  }
  const { projekt, zasoby } = await baza().wczytaj(poz.awers.projektId);
  const karty = projekt.talie.flatMap((tl) => tl.karty);
  if (karty.some((k) => k.szablonId === poz.awers.szablonId)) return false;
  if (projekt.szablony.length <= 1 && (projekt.rewersy?.length ?? 0) === 0 && !karty.length) {
    await baza().usun(poz.awers.projektId);
    return true;
  }
  const reszta = projekt.szablony.filter((s) => s.id !== poz.awers.szablonId);
  await baza().zapisz(
    { ...projekt, zmieniono: new Date().toISOString(), szablony: reszta },
    zasoby,
  );
  await baza()
    .usunMiniature(poz.klucz)
    .catch(() => undefined);
  await baza().usunPustySchowek(poz.awers.projektId);
  return true;
}

/**
 * Usuwa elementy po kolei i zwraca migawkę stanu sprzed usunięcia – `przywroc` odtwarza wszystkie
 * naraz (z miniaturami, rewersami i powiązaniami). Po błędzie w trakcie przywraca to, co usunięto.
 * `usuniete` / `pominiete` – elementy usunięte i pominięte (szablony używane przez karty).
 */
export async function usunZCofaniem(cele: readonly CelUsuniecia[]): Promise<{
  przywroc: () => Promise<void>;
  usuniete: CelUsuniecia[];
  pominiete: CelUsuniecia[];
}> {
  const migawka = await baza().migawka(cele.map(projektCelu));
  const przywroc = () => baza().przywroc(migawka);
  const usuniete: CelUsuniecia[] = [];
  const pominiete: CelUsuniecia[] = [];
  try {
    for (const cel of cele) ((await usunCel(cel)) ? usuniete : pominiete).push(cel);
  } catch (e) {
    await przywroc().catch(() => undefined);
    throw e;
  }
  return { przywroc, usuniete, pominiete };
}

const sufiksKopii = (n: number) => (n === 1 ? t('szablon.kopia') : t('szablon.kopiaNumer', { n }));

/** Kopia szablonu/rewersu z dopiskiem „(kopia)” obok oryginału, w tym samym projekcie. */
export async function duplikujPozycje(poz: PozycjaSzablonu): Promise<string> {
  const projektId = poz.rodzaj === 'rewers' ? poz.rewers.projektId : poz.awers.projektId;
  const { projekt } = await baza().wczytaj(projektId);
  const wynik =
    poz.rodzaj === 'rewers'
      ? duplikujRewersWProjekcie(projekt, poz.rewers.rewersId, sufiksKopii)
      : duplikujSzablonWProjekcie(projekt, poz.awers.szablonId, sufiksKopii);
  if (!wynik.id) throw new Error(t('dane.brakProjektuWBazie', { id: projektId }));
  await baza().zapisz(wynik.projekt);
  const kopia =
    poz.rodzaj === 'rewers'
      ? wynik.projekt.rewersy?.find((r) => r.id === wynik.id)
      : wynik.projekt.szablony.find((s) => s.id === wynik.id);
  return kopia?.nazwa ?? poz.nazwa;
}

/** Brakujące miniatury kart do dorysowania (awers lub rewers konkretnego projektu). */
export type BrakujacaMiniatura =
  | { rodzaj: 'rewers'; klucz: string; projektId: string; rewersId: string }
  | { rodzaj: 'szablon'; klucz: string; projektId: string; szablonId: string };

export const brakujacaDlaPozycji = (poz: PozycjaSzablonu): BrakujacaMiniatura =>
  poz.rodzaj === 'rewers'
    ? { rodzaj: 'rewers', klucz: poz.klucz, ...poz.rewersPodglad }
    : { rodzaj: 'szablon', klucz: poz.klucz, ...poz.szablonPodglad };

/**
 * Rysuje i zapisuje brakujące miniatury (silnik ładowany leniwie). Błędy pojedynczych miniatur są
 * pomijane. `aktywny()` = false przerywa pracę (np. po odmontowaniu).
 */
export async function dorysujMiniatury(
  brakujace: readonly BrakujacaMiniatura[],
  aktywny: () => boolean,
  gotowa: (klucz: string) => void,
): Promise<Map<string, string>> {
  const { zapiszMiniatureRewersu, zapiszMiniatureSzablonu } = await import('../miniaturaRewersu');
  const nowe = new Map<string, string>();
  const projekty = new Map<string, Awaited<ReturnType<ReturnType<typeof baza>['wczytaj']>>>();
  for (const b of brakujace) {
    if (!aktywny()) break;
    try {
      let wczytany = projekty.get(b.projektId);
      if (!wczytany) {
        wczytany = await baza().wczytaj(b.projektId);
        projekty.set(b.projektId, wczytany);
      }
      if (!aktywny()) break;
      const svg =
        b.rodzaj === 'rewers'
          ? await zapiszMiniatureRewersu(wczytany.projekt, wczytany.zasoby, b.rewersId)
          : await zapiszMiniatureSzablonu(wczytany.projekt, wczytany.zasoby, b.szablonId);
      if (svg) nowe.set(b.klucz, svg);
    } catch {
      // Miniatura się nie udała – kafelek zostaje z zastępczym symbolem.
    }
    gotowa(b.klucz);
  }
  return nowe;
}

/** Adres `data:` miniatury SVG zapisanej w bazie. */
export const adresMiniatury = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
