import { t } from '../i18n';
import type { OpisZasobu } from '../model/projekt';
import type { WariantCzcionki } from '../model/szablon';
import type { Czcionka } from '../silnik/czcionki';
import { wgrajCzcionke, type WgranaCzcionka } from './czcionki';
import { BladDanych } from './schemat';

/** Zestaw polskich znaków diakrytycznych weryfikowanych dla krojów z katalogu. */
export const POLSKIE_ZNAKI = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ';

export type KategoriaGoogleFonts =
  'ozdobna' | 'szeryfowa' | 'bezszeryfowa' | 'pisana' | 'maszynowa';

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
 * Kuratorowany katalog krojów Google Fonts: wyłącznie rodziny z udokumentowaną licencją
 * SIL OFL 1.1, zweryfikowanym zestawem `latin-ext` (polskie znaki) oraz statycznymi plikami TTF
 * obsługiwanymi przez fontkit w podglądzie SVG i PDF. Pełna lista źródeł w `LICENCJE.md`.
 */
export const KATALOG_GOOGLE_FONTS: readonly PozycjaKataloguGoogle[] = [
  // ---------- Ozdobne ----------
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
    id: 'almendra-display',
    rodzina: 'Almendra Display',
    kategoria: 'ozdobna',
    autor: 'Ana Sanfelippo',
    licencja: 'SIL OFL 1.1',
    katalog: 'almendradisplay',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'AlmendraDisplay-Regular.ttf' }],
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
    id: 'germania-one',
    rodzina: 'Germania One',
    kategoria: 'ozdobna',
    autor: 'John Vargas Beltrán',
    licencja: 'SIL OFL 1.1',
    katalog: 'germaniaone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'GermaniaOne-Regular.ttf' }],
  },
  {
    id: 'yatra-one',
    rodzina: 'Yatra One',
    kategoria: 'ozdobna',
    autor: 'Catherine Leigh Schmidt',
    licencja: 'SIL OFL 1.1',
    katalog: 'yatraone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'YatraOne-Regular.ttf' }],
  },
  {
    id: 'rye',
    rodzina: 'Rye',
    kategoria: 'ozdobna',
    autor: 'Nicole Fally',
    licencja: 'SIL OFL 1.1',
    katalog: 'rye',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Rye-Regular.ttf' }],
  },
  {
    id: 'sancreek',
    rodzina: 'Sancreek',
    kategoria: 'ozdobna',
    autor: 'Vernon Adams',
    licencja: 'SIL OFL 1.1',
    katalog: 'sancreek',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Sancreek-Regular.ttf' }],
  },
  {
    id: 'new-rocker',
    rodzina: 'New Rocker',
    kategoria: 'ozdobna',
    autor: 'Impallari Type',
    licencja: 'SIL OFL 1.1',
    katalog: 'newrocker',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'NewRocker-Regular.ttf' }],
  },
  {
    id: 'metal-mania',
    rodzina: 'Metal Mania',
    kategoria: 'ozdobna',
    autor: 'Open Window',
    licencja: 'SIL OFL 1.1',
    katalog: 'metalmania',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'MetalMania-Regular.ttf' }],
  },
  {
    id: 'creepster',
    rodzina: 'Creepster',
    kategoria: 'ozdobna',
    autor: 'Sideshow',
    licencja: 'SIL OFL 1.1',
    katalog: 'creepster',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Creepster-Regular.ttf' }],
  },
  {
    id: 'abril-fatface',
    rodzina: 'Abril Fatface',
    kategoria: 'ozdobna',
    autor: 'TypeTogether',
    licencja: 'SIL OFL 1.1',
    katalog: 'abrilfatface',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'AbrilFatface-Regular.ttf' }],
  },
  {
    id: 'yeseva-one',
    rodzina: 'Yeseva One',
    kategoria: 'ozdobna',
    autor: 'Jovanny Lemonad',
    licencja: 'SIL OFL 1.1',
    katalog: 'yesevaone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'YesevaOne-Regular.ttf' }],
  },
  {
    id: 'righteous',
    rodzina: 'Righteous',
    kategoria: 'ozdobna',
    autor: 'Astigmatic',
    licencja: 'SIL OFL 1.1',
    katalog: 'righteous',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Righteous-Regular.ttf' }],
  },
  {
    id: 'audiowide',
    rodzina: 'Audiowide',
    kategoria: 'ozdobna',
    autor: 'Astigmatic',
    licencja: 'SIL OFL 1.1',
    katalog: 'audiowide',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Audiowide-Regular.ttf' }],
  },
  {
    id: 'silkscreen',
    rodzina: 'Silkscreen',
    kategoria: 'ozdobna',
    autor: 'Jason Kottke',
    licencja: 'SIL OFL 1.1',
    katalog: 'silkscreen',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Silkscreen-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Silkscreen-Bold.ttf' },
    ],
  },
  {
    id: 'press-start-2p',
    rodzina: 'Press Start 2P',
    kategoria: 'ozdobna',
    autor: 'CodeMan38',
    licencja: 'SIL OFL 1.1',
    katalog: 'pressstart2p',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'PressStart2P-Regular.ttf' }],
  },
  // ---------- Szeryfowe ----------
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
    id: 'marcellus-sc',
    rodzina: 'Marcellus SC',
    kategoria: 'szeryfowa',
    autor: 'Astigmatic',
    licencja: 'SIL OFL 1.1',
    katalog: 'marcellussc',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'MarcellusSC-Regular.ttf' }],
  },
  {
    id: 'alegreya-sc',
    rodzina: 'Alegreya SC',
    kategoria: 'szeryfowa',
    autor: 'Juan Pablo del Peral, HT Fonts',
    licencja: 'SIL OFL 1.1',
    katalog: 'alegreyasc',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'AlegreyaSC-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'AlegreyaSC-Bold.ttf' },
      { wariant: 'kursywa', plik: 'AlegreyaSC-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'AlegreyaSC-BoldItalic.ttf' },
    ],
  },
  {
    id: 'cormorant-sc',
    rodzina: 'Cormorant SC',
    kategoria: 'szeryfowa',
    autor: 'Christian Thalmann',
    licencja: 'SIL OFL 1.1',
    katalog: 'cormorantsc',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'CormorantSC-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'CormorantSC-Bold.ttf' },
    ],
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
    id: 'cardo',
    rodzina: 'Cardo',
    kategoria: 'szeryfowa',
    autor: 'David Perry',
    licencja: 'SIL OFL 1.1',
    katalog: 'cardo',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Cardo-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Cardo-Bold.ttf' },
      { wariant: 'kursywa', plik: 'Cardo-Italic.ttf' },
    ],
  },
  {
    id: 'old-standard-tt',
    rodzina: 'Old Standard TT',
    kategoria: 'szeryfowa',
    autor: 'Alexey Kryukov',
    licencja: 'SIL OFL 1.1',
    katalog: 'oldstandardtt',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'OldStandard-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'OldStandard-Bold.ttf' },
      { wariant: 'kursywa', plik: 'OldStandard-Italic.ttf' },
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
    id: 'gentium-plus',
    rodzina: 'Gentium Plus',
    kategoria: 'szeryfowa',
    autor: 'SIL International',
    licencja: 'SIL OFL 1.1',
    katalog: 'gentiumplus',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'GentiumPlus-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'GentiumPlus-Bold.ttf' },
      { wariant: 'kursywa', plik: 'GentiumPlus-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'GentiumPlus-BoldItalic.ttf' },
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
    id: 'ibm-plex-serif',
    rodzina: 'IBM Plex Serif',
    kategoria: 'szeryfowa',
    autor: 'Mike Abbink, Bold Monday',
    licencja: 'SIL OFL 1.1',
    katalog: 'ibmplexserif',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'IBMPlexSerif-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'IBMPlexSerif-Bold.ttf' },
      { wariant: 'kursywa', plik: 'IBMPlexSerif-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'IBMPlexSerif-BoldItalic.ttf' },
    ],
  },
  // ---------- Bezszeryfowe ----------
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
  {
    id: 'alegreya-sans',
    rodzina: 'Alegreya Sans',
    kategoria: 'bezszeryfowa',
    autor: 'Juan Pablo del Peral, HT Fonts',
    licencja: 'SIL OFL 1.1',
    katalog: 'alegreyasans',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'AlegreyaSans-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'AlegreyaSans-Bold.ttf' },
      { wariant: 'kursywa', plik: 'AlegreyaSans-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'AlegreyaSans-BoldItalic.ttf' },
    ],
  },
  {
    id: 'philosopher',
    rodzina: 'Philosopher',
    kategoria: 'bezszeryfowa',
    autor: 'Jovanny Lemonad',
    licencja: 'SIL OFL 1.1',
    katalog: 'philosopher',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Philosopher-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Philosopher-Bold.ttf' },
      { wariant: 'kursywa', plik: 'Philosopher-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'Philosopher-BoldItalic.ttf' },
    ],
  },
  {
    id: 'barlow',
    rodzina: 'Barlow',
    kategoria: 'bezszeryfowa',
    autor: 'Jeremy Tribby',
    licencja: 'SIL OFL 1.1',
    katalog: 'barlow',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Barlow-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Barlow-Bold.ttf' },
      { wariant: 'kursywa', plik: 'Barlow-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'Barlow-BoldItalic.ttf' },
    ],
  },
  {
    id: 'barlow-condensed',
    rodzina: 'Barlow Condensed',
    kategoria: 'bezszeryfowa',
    autor: 'Jeremy Tribby',
    licencja: 'SIL OFL 1.1',
    katalog: 'barlowcondensed',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'BarlowCondensed-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'BarlowCondensed-Bold.ttf' },
      { wariant: 'kursywa', plik: 'BarlowCondensed-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'BarlowCondensed-BoldItalic.ttf' },
    ],
  },
  {
    id: 'pt-sans',
    rodzina: 'PT Sans',
    kategoria: 'bezszeryfowa',
    autor: 'ParaType',
    licencja: 'SIL OFL 1.1',
    katalog: 'ptsans',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'PT_Sans-Web-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'PT_Sans-Web-Bold.ttf' },
      { wariant: 'kursywa', plik: 'PT_Sans-Web-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'PT_Sans-Web-BoldItalic.ttf' },
    ],
  },
  // ---------- Pisane i kaligrafia ----------
  {
    id: 'eagle-lake',
    rodzina: 'Eagle Lake',
    kategoria: 'pisana',
    autor: 'Astigmatic',
    licencja: 'SIL OFL 1.1',
    katalog: 'eaglelake',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'EagleLake-Regular.ttf' }],
  },
  {
    id: 'fondamento',
    rodzina: 'Fondamento',
    kategoria: 'pisana',
    autor: 'Astigmatic',
    licencja: 'SIL OFL 1.1',
    katalog: 'fondamento',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Fondamento-Regular.ttf' },
      { wariant: 'kursywa', plik: 'Fondamento-Italic.ttf' },
    ],
  },
  {
    id: 'quintessential',
    rodzina: 'Quintessential',
    kategoria: 'pisana',
    autor: 'Astigmatic',
    licencja: 'SIL OFL 1.1',
    katalog: 'quintessential',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Quintessential-Regular.ttf' }],
  },
  {
    id: 'berkshire-swash',
    rodzina: 'Berkshire Swash',
    kategoria: 'pisana',
    autor: 'Astigmatic',
    licencja: 'SIL OFL 1.1',
    katalog: 'berkshireswash',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'BerkshireSwash-Regular.ttf' }],
  },
  {
    id: 'patrick-hand',
    rodzina: 'Patrick Hand',
    kategoria: 'pisana',
    autor: 'Patrick Wagesreiter',
    licencja: 'SIL OFL 1.1',
    katalog: 'patrickhand',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'PatrickHand-Regular.ttf' }],
  },
  {
    id: 'kalam',
    rodzina: 'Kalam',
    kategoria: 'pisana',
    autor: 'Indian Type Foundry',
    licencja: 'SIL OFL 1.1',
    katalog: 'kalam',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Kalam-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Kalam-Bold.ttf' },
    ],
  },
  {
    id: 'amatic-sc',
    rodzina: 'Amatic SC',
    kategoria: 'pisana',
    autor: 'Vernon Adams, Ben Nathan, Thomas Jockin',
    licencja: 'SIL OFL 1.1',
    katalog: 'amaticsc',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'AmaticSC-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'AmaticSC-Bold.ttf' },
    ],
  },
  {
    id: 'courgette',
    rodzina: 'Courgette',
    kategoria: 'pisana',
    autor: 'Karolina Lach',
    licencja: 'SIL OFL 1.1',
    katalog: 'courgette',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Courgette-Regular.ttf' }],
  },
  {
    id: 'great-vibes',
    rodzina: 'Great Vibes',
    kategoria: 'pisana',
    autor: 'Robert Leuschke',
    licencja: 'SIL OFL 1.1',
    katalog: 'greatvibes',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'GreatVibes-Regular.ttf' }],
  },
  {
    id: 'marck-script',
    rodzina: 'Marck Script',
    kategoria: 'pisana',
    autor: 'Denis Masharov',
    licencja: 'SIL OFL 1.1',
    katalog: 'marckscript',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'MarckScript-Regular.ttf' }],
  },
  // ---------- Maszynowe ----------
  {
    id: 'ibm-plex-mono',
    rodzina: 'IBM Plex Mono',
    kategoria: 'maszynowa',
    autor: 'Mike Abbink, Bold Monday',
    licencja: 'SIL OFL 1.1',
    katalog: 'ibmplexmono',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'IBMPlexMono-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'IBMPlexMono-Bold.ttf' },
      { wariant: 'kursywa', plik: 'IBMPlexMono-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'IBMPlexMono-BoldItalic.ttf' },
    ],
  },
  {
    id: 'space-mono',
    rodzina: 'Space Mono',
    kategoria: 'maszynowa',
    autor: 'Colophon Foundry',
    licencja: 'SIL OFL 1.1',
    katalog: 'spacemono',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'SpaceMono-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'SpaceMono-Bold.ttf' },
      { wariant: 'kursywa', plik: 'SpaceMono-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'SpaceMono-BoldItalic.ttf' },
    ],
  },
  {
    id: 'courier-prime',
    rodzina: 'Courier Prime',
    kategoria: 'maszynowa',
    autor: 'Alan Dague-Greene',
    licencja: 'SIL OFL 1.1',
    katalog: 'courierprime',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'CourierPrime-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'CourierPrime-Bold.ttf' },
      { wariant: 'kursywa', plik: 'CourierPrime-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'CourierPrime-BoldItalic.ttf' },
    ],
  },
  {
    id: 'vt323',
    rodzina: 'VT323',
    kategoria: 'maszynowa',
    autor: 'Peter Hull',
    licencja: 'SIL OFL 1.1',
    katalog: 'vt323',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'VT323-Regular.ttf' }],
  },
];

/** Zapasowa generyczna rodzina CSS dla kategorii kroju (gdy podgląd jeszcze się ładuje lub brak sieci). */
export function zapasowaRodzinaKategorii(kategoria: KategoriaGoogleFonts): string {
  switch (kategoria) {
    case 'bezszeryfowa':
      return 'sans-serif';
    case 'pisana':
      return 'cursive';
    case 'maszynowa':
      return 'monospace';
    case 'ozdobna':
    case 'szeryfowa':
      return 'serif';
  }
}

/**
 * Adresy arkuszy CSS2 Google Fonts ograniczone parametrem `text=` wyłącznie do znaków próbki,
 * aby podgląd kroju przed pobraniem zużywał minimalną ilość danych i nie zapisywał zasobów w projekcie.
 */
export function adresyPodgladuGoogleFonts(
  rodziny: readonly string[],
  probka: string,
  rozmiarPorcji = 14,
): string[] {
  const znaki = [...new Set(probka)].join('');
  if (rodziny.length === 0 || !znaki) return [];
  const krok = Math.max(1, Math.floor(rozmiarPorcji));
  const tekst = encodeURIComponent(znaki);
  const adresy: string[] = [];
  for (let i = 0; i < rodziny.length; i += krok) {
    const porcja = rodziny.slice(i, i + krok);
    const parametry = porcja
      .map((r) => `family=${encodeURIComponent(r).replace(/%20/g, '+')}`)
      .join('&');
    adresy.push(`https://fonts.googleapis.com/css2?${parametry}&text=${tekst}&display=swap`);
  }
  return adresy;
}

/** Adresy pobierania pliku TTF wariantu (CDN jsDelivr z zapasowym raw.githubusercontent.com). */
export function adresyWariantuGoogle(
  pozycja: Pick<PozycjaKataloguGoogle, 'katalog'>,
  wariant: Pick<WariantKataloguGoogle, 'plik'>,
): readonly string[] {
  const sciezkaPliku = wariant.plik.split('/').map(encodeURIComponent).join('/');
  const sciezka = `ofl/${pozycja.katalog}/${sciezkaPliku}`;
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
