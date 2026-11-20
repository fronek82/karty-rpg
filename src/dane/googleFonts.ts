import { t } from '../i18n';
import type { OpisZasobu } from '../model/projekt';
import type { WariantCzcionki } from '../model/szablon';
import type { Czcionka } from '../silnik/czcionki';
import { wgrajCzcionke, type WgranaCzcionka } from './czcionki';
import { BladDanych } from './schemat';

/** Zestaw polskich znaków diakrytycznych weryfikowanych dla krojów z katalogu. */
export const POLSKIE_ZNAKI = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ';

export type KategoriaGoogleFonts = 'ozdobna' | 'szeryfowa' | 'bezszeryfowa';

export interface WariantKataloguGoogle {
  wariant: WariantCzcionki;
  /** Nazwa statycznego pliku TTF w repozytorium `google/fonts`. */
  plik: string;
}

export interface PozycjaKataloguGoogle {
  id: string;
  rodzina: string;
  kategoria: KategoriaGoogleFonts;
  autor: string;
  licencja: 'SIL OFL 1.1';
  /** Podkatalog w `google/fonts/ofl/<katalog>`. */
  katalog: string;
  /** Zweryfikowane pokrycie polskich znaków (`latin-ext` w METADATA.pb). */
  polskieZnaki: true;
  warianty: readonly WariantKataloguGoogle[];
}

/**
 * Kuratorowany katalog krojów Google Fonts (M4-6): wyłącznie rodziny z udokumentowaną licencją
 * SIL OFL 1.1, zweryfikowanym zestawem `latin-ext` (polskie znaki) oraz statycznymi plikami TTF
 * obsługiwanymi przez fontkit w podglądzie SVG i PDF. Pełna lista źródeł w `LICENCJE.md`.
 */
export const KATALOG_GOOGLE_FONTS: readonly PozycjaKataloguGoogle[] = [
  {
    id: 'almendra',
    rodzina: 'Almendra',
    kategoria: 'ozdobna',
    autor: 'Ana Sanfelippo',
    licencja: 'SIL OFL 1.1',
    katalog: 'almendra',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Almendra-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Almendra-Bold.ttf' },
      { wariant: 'kursywa', plik: 'Almendra-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'Almendra-BoldItalic.ttf' },
    ],
  },
  {
    id: 'medievalsharp',
    rodzina: 'MedievalSharp',
    kategoria: 'ozdobna',
    autor: 'Wojciech Kalinowski',
    licencja: 'SIL OFL 1.1',
    katalog: 'medievalsharp',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'MedievalSharp.ttf' }],
  },
  {
    id: 'metamorphous',
    rodzina: 'Metamorphous',
    kategoria: 'ozdobna',
    autor: 'Sorkin Type Co (James Grieshaber)',
    licencja: 'SIL OFL 1.1',
    katalog: 'metamorphous',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Metamorphous-Regular.ttf' }],
  },
  {
    id: 'pirata-one',
    rodzina: 'Pirata One',
    kategoria: 'ozdobna',
    autor: 'Rodrigo Fuenzalida, Nicolas Massi',
    licencja: 'SIL OFL 1.1',
    katalog: 'pirataone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'PirataOne-Regular.ttf' }],
  },
  {
    id: 'marcellus',
    rodzina: 'Marcellus',
    kategoria: 'szeryfowa',
    autor: 'Astigmatic',
    licencja: 'SIL OFL 1.1',
    katalog: 'marcellus',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Marcellus-Regular.ttf' }],
  },
  {
    id: 'caudex',
    rodzina: 'Caudex',
    kategoria: 'szeryfowa',
    autor: 'Nidud',
    licencja: 'SIL OFL 1.1',
    katalog: 'caudex',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Caudex-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Caudex-Bold.ttf' },
      { wariant: 'kursywa', plik: 'Caudex-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'Caudex-BoldItalic.ttf' },
    ],
  },
  {
    id: 'crimson-text',
    rodzina: 'Crimson Text',
    kategoria: 'szeryfowa',
    autor: 'Sebastian Kosch',
    licencja: 'SIL OFL 1.1',
    katalog: 'crimsontext',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'CrimsonText-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'CrimsonText-Bold.ttf' },
      { wariant: 'kursywa', plik: 'CrimsonText-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'CrimsonText-BoldItalic.ttf' },
    ],
  },
  {
    id: 'spectral',
    rodzina: 'Spectral',
    kategoria: 'szeryfowa',
    autor: 'Production Type',
    licencja: 'SIL OFL 1.1',
    katalog: 'spectral',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Spectral-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Spectral-Bold.ttf' },
      { wariant: 'kursywa', plik: 'Spectral-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'Spectral-BoldItalic.ttf' },
    ],
  },
  {
    id: 'gentium-book-plus',
    rodzina: 'Gentium Book Plus',
    kategoria: 'szeryfowa',
    autor: 'SIL International',
    licencja: 'SIL OFL 1.1',
    katalog: 'gentiumbookplus',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'GentiumBookPlus-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'GentiumBookPlus-Bold.ttf' },
      { wariant: 'kursywa', plik: 'GentiumBookPlus-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'GentiumBookPlus-BoldItalic.ttf' },
    ],
  },
  {
    id: 'pt-serif',
    rodzina: 'PT Serif',
    kategoria: 'szeryfowa',
    autor: 'ParaType',
    licencja: 'SIL OFL 1.1',
    katalog: 'ptserif',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'PT_Serif-Web-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'PT_Serif-Web-Bold.ttf' },
      { wariant: 'kursywa', plik: 'PT_Serif-Web-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'PT_Serif-Web-BoldItalic.ttf' },
    ],
  },
  {
    id: 'fira-sans',
    rodzina: 'Fira Sans',
    kategoria: 'bezszeryfowa',
    autor: 'Carrois Apostrophe',
    licencja: 'SIL OFL 1.1',
    katalog: 'firasans',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'FiraSans-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'FiraSans-Bold.ttf' },
      { wariant: 'kursywa', plik: 'FiraSans-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'FiraSans-BoldItalic.ttf' },
    ],
  },
  {
    id: 'lato',
    rodzina: 'Lato',
    kategoria: 'bezszeryfowa',
    autor: 'Łukasz Dziedzic',
    licencja: 'SIL OFL 1.1',
    katalog: 'lato',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Lato-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Lato-Bold.ttf' },
      { wariant: 'kursywa', plik: 'Lato-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'Lato-BoldItalic.ttf' },
    ],
  },
];

/** Adresy pobierania pliku TTF wariantu (CDN jsDelivr z zapasowym raw.githubusercontent.com). */
export function adresyWariantuGoogle(
  pozycja: Pick<PozycjaKataloguGoogle, 'katalog'>,
  wariant: Pick<WariantKataloguGoogle, 'plik'>,
): readonly string[] {
  const sciezka = `ofl/${pozycja.katalog}/${encodeURIComponent(wariant.plik)}`;
  return [
    `https://cdn.jsdelivr.net/gh/google/fonts@main/${sciezka}`,
    `https://raw.githubusercontent.com/google/fonts/main/${sciezka}`,
  ];
}

/** Warianty rodziny, których jeszcze nie ma w bibliotece zasobów projektu. */
export function brakujaceWariantyRodziny(
  pozycja: PozycjaKataloguGoogle,
  zasoby: readonly OpisZasobu[],
): readonly WariantKataloguGoogle[] {
  const obecne = new Set(
    zasoby.flatMap((z) =>
      z.rodzaj === 'czcionka' && z.rodzina === pozycja.rodzina ? [z.wariant] : [],
    ),
  );
  return pozycja.warianty.filter((w) => !obecne.has(w.wariant));
}

/** Czy wszystkie warianty tej rodziny z katalogu są już zapisane lokalnie w projekcie. */
export function czyRodzinaDodana(
  pozycja: PozycjaKataloguGoogle,
  zasoby: readonly OpisZasobu[],
): boolean {
  return brakujaceWariantyRodziny(pozycja, zasoby).length === 0;
}

/** Sprawdza, czy wczytana czcionka zawiera komplet polskich znaków diakrytycznych. */
export function maPolskieZnaki(czcionka: Pick<Czcionka, 'brakujaceZnaki'>): boolean {
  return czcionka.brakujaceZnaki(POLSKIE_ZNAKI).length === 0;
}

/** Domyślny limit czasu pojedynczego żądania pobrania pliku TTF (ms). */
export const LIMIT_CZASU_POBIERANIA_MS = 15_000;

export type FunkcjaPobierania = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<Pick<Response, 'ok' | 'status' | 'arrayBuffer'>>;

function bladAnulowania(): Error {
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
}

function przygotujSygnal(
  sygnalZewnetrzny: AbortSignal | undefined,
  limitCzasuMs: number,
): { signal: AbortSignal; czyPrzekroczonoCzas: () => boolean; zwolnij: () => void } {
  const kontroler = new AbortController();
  let przekroczonoCzas = false;
  const naZewnetrzne = () => kontroler.abort();
  if (sygnalZewnetrzny?.aborted) {
    kontroler.abort();
  } else {
    sygnalZewnetrzny?.addEventListener('abort', naZewnetrzne, { once: true });
  }
  const timer =
    limitCzasuMs > 0 && Number.isFinite(limitCzasuMs)
      ? setTimeout(() => {
          przekroczonoCzas = true;
          kontroler.abort();
        }, limitCzasuMs)
      : undefined;
  return {
    signal: kontroler.signal,
    czyPrzekroczonoCzas: () => przekroczonoCzas,
    zwolnij: () => {
      if (timer !== undefined) clearTimeout(timer);
      sygnalZewnetrzny?.removeEventListener('abort', naZewnetrzne);
    },
  };
}

async function pobierzIZwalidujWariant(
  pozycja: PozycjaKataloguGoogle,
  wariant: WariantKataloguGoogle,
  zajete: ReadonlySet<string>,
  pobierz: FunkcjaPobierania,
  sygnal: AbortSignal | undefined,
  limitCzasuMs: number,
): Promise<WgranaCzcionka> {
  let ostatniBlad = '';
  for (const url of adresyWariantuGoogle(pozycja, wariant)) {
    if (sygnal?.aborted) throw bladAnulowania();
    const { signal, czyPrzekroczonoCzas, zwolnij } = przygotujSygnal(sygnal, limitCzasuMs);
    try {
      const res = await pobierz(url, { signal });
      if (sygnal?.aborted) throw bladAnulowania();
      if (!res.ok) {
        ostatniBlad = `HTTP ${res.status}`;
        continue;
      }
      const bajty = new Uint8Array(await res.arrayBuffer());
      if (sygnal?.aborted) throw bladAnulowania();
      const w = wgrajCzcionke(wariant.plik, bajty, { zrodlo: 'google', zajete });
      return {
        ...w,
        opis: {
          ...w.opis,
          rodzina: pozycja.rodzina,
          wariant: wariant.wariant,
          zrodlo: 'google',
        },
      };
    } catch (e) {
      if (sygnal?.aborted) throw bladAnulowania();
      ostatniBlad = czyPrzekroczonoCzas()
        ? t('googleFonts.przekroczonoCzas')
        : e instanceof Error
          ? e.message
          : String(e);
    } finally {
      zwolnij();
    }
  }
  throw new BladDanych(
    t('googleFonts.bladPobrania', {
      rodzina: pozycja.rodzina,
      szczegoly: ostatniBlad || t('googleFonts.brakPolaczenia'),
    }),
  );
}

/**
 * Pobiera brakujące warianty wybranej rodziny z katalogu Google Fonts, weryfikuje je przez fontkit
 * (przełączając się na zapasowy adres także przy uszkodzonym pliku lub przekroczeniu czasu) i zwraca
 * gotowe zasoby lokalne z `zrodlo: 'google'`. Operacja jest atomowa – błąd dowolnego wariantu
 * przerywa całość czytelnym błędem `BladDanych` bez zapisywania częściowych plików.
 */
export async function pobierzRodzineGoogle(
  pozycja: PozycjaKataloguGoogle,
  {
    zasoby = [],
    pobierz = (url, init) => fetch(url, init),
    signal,
    limitCzasuMs = LIMIT_CZASU_POBIERANIA_MS,
  }: {
    zasoby?: readonly OpisZasobu[];
    pobierz?: FunkcjaPobierania;
    signal?: AbortSignal;
    limitCzasuMs?: number;
  } = {},
): Promise<WgranaCzcionka[]> {
  const doPobrania = brakujaceWariantyRodziny(pozycja, zasoby);
  if (doPobrania.length === 0) return [];
  const zajete = new Set(zasoby.map((z) => z.id));
  const wynik: WgranaCzcionka[] = [];
  for (const wariant of doPobrania) {
    if (signal?.aborted) throw bladAnulowania();
    const w = await pobierzIZwalidujWariant(
      pozycja,
      wariant,
      zajete,
      pobierz,
      signal,
      limitCzasuMs,
    );
    zajete.add(w.opis.id);
    wynik.push(w);
  }
  return wynik;
}
