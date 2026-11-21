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

export type GrupaGoogleFonts = 'ofl' | 'apache' | 'ufl';

export type LicencjaGoogleFonts = 'SIL OFL 1.1' | 'Apache 2.0' | 'Ubuntu Font License';

export interface WariantKataloguGoogle {
  wariant: WariantCzcionki;
  /** Ścieżka pliku TTF względem katalogu rodziny w repozytorium `google/fonts` (np. `Font-Regular.ttf` lub `static/Font-Regular.ttf`). */
  plik: string;
}

export interface PozycjaKataloguGoogle {
  id: string;
  rodzina: string;
  kategoria: KategoriaGoogleFonts;
  autor: string;
  licencja: LicencjaGoogleFonts;
  /** Grupa licencyjna w `google/fonts` (domyślnie `ofl`). */
  grupa?: GrupaGoogleFonts;
  /** Podkatalog w `google/fonts/<grupa>/<katalog>`. */
  katalog: string;
  /** Zweryfikowane pokrycie polskich znaków (`latin-ext` w metadanych Google Fonts). */
  polskieZnaki: boolean;
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
  {
    id: 'macondo',
    rodzina: 'Macondo',
    kategoria: 'ozdobna',
    autor: 'John Vargas Beltrán',
    licencja: 'SIL OFL 1.1',
    katalog: 'macondo',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Macondo-Regular.ttf' }],
  },
  {
    id: 'macondo-swash-caps',
    rodzina: 'Macondo Swash Caps',
    kategoria: 'ozdobna',
    autor: 'John Vargas Beltrán',
    licencja: 'SIL OFL 1.1',
    katalog: 'macondoswashcaps',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'MacondoSwashCaps-Regular.ttf' }],
  },
  {
    id: 'bangers',
    rodzina: 'Bangers',
    kategoria: 'ozdobna',
    autor: 'Vernon Adams',
    licencja: 'SIL OFL 1.1',
    katalog: 'bangers',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Bangers-Regular.ttf' }],
  },
  {
    id: 'bungee',
    rodzina: 'Bungee',
    kategoria: 'ozdobna',
    autor: 'David Jonathan Ross',
    licencja: 'SIL OFL 1.1',
    katalog: 'bungee',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Bungee-Regular.ttf' }],
  },
  {
    id: 'bungee-inline',
    rodzina: 'Bungee Inline',
    kategoria: 'ozdobna',
    autor: 'David Jonathan Ross',
    licencja: 'SIL OFL 1.1',
    katalog: 'bungeeinline',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'BungeeInline-Regular.ttf' }],
  },
  {
    id: 'bungee-shade',
    rodzina: 'Bungee Shade',
    kategoria: 'ozdobna',
    autor: 'David Jonathan Ross',
    licencja: 'SIL OFL 1.1',
    katalog: 'bungeeshade',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'BungeeShade-Regular.ttf' }],
  },
  {
    id: 'black-ops-one',
    rodzina: 'Black Ops One',
    kategoria: 'ozdobna',
    autor: 'James Grieshaber, Eben Sorkin',
    licencja: 'SIL OFL 1.1',
    katalog: 'blackopsone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'BlackOpsOne-Regular.ttf' }],
  },
  {
    id: 'russo-one',
    rodzina: 'Russo One',
    kategoria: 'ozdobna',
    autor: 'Jovanny Lemonad',
    licencja: 'SIL OFL 1.1',
    katalog: 'russoone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'RussoOne-Regular.ttf' }],
  },
  {
    id: 'alfa-slab-one',
    rodzina: 'Alfa Slab One',
    kategoria: 'ozdobna',
    autor: 'JM Solé',
    licencja: 'SIL OFL 1.1',
    katalog: 'alfaslabone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'AlfaSlabOne-Regular.ttf' }],
  },
  {
    id: 'bebas-neue',
    rodzina: 'Bebas Neue',
    kategoria: 'ozdobna',
    autor: 'Ryoichi Tsunekawa',
    licencja: 'SIL OFL 1.1',
    katalog: 'bebasneue',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'BebasNeue-Regular.ttf' }],
  },
  {
    id: 'anton',
    rodzina: 'Anton',
    kategoria: 'ozdobna',
    autor: 'Vernon Adams',
    licencja: 'SIL OFL 1.1',
    katalog: 'anton',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Anton-Regular.ttf' }],
  },
  {
    id: 'staatliches',
    rodzina: 'Staatliches',
    kategoria: 'ozdobna',
    autor: 'Brian LaRossa, Erica Carras',
    licencja: 'SIL OFL 1.1',
    katalog: 'staatliches',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Staatliches-Regular.ttf' }],
  },
  {
    id: 'stalinist-one',
    rodzina: 'Stalinist One',
    kategoria: 'ozdobna',
    autor: 'Alexey Maslov, Jovanny Lemonad',
    licencja: 'SIL OFL 1.1',
    katalog: 'stalinistone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'StalinistOne-Regular.ttf' }],
  },
  {
    id: 'goldman',
    rodzina: 'Goldman',
    kategoria: 'ozdobna',
    autor: 'Jaikishan Patel',
    licencja: 'SIL OFL 1.1',
    katalog: 'goldman',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Goldman-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Goldman-Bold.ttf' },
    ],
  },
  {
    id: 'chakra-petch',
    rodzina: 'Chakra Petch',
    kategoria: 'ozdobna',
    autor: 'Cadson Demak',
    licencja: 'SIL OFL 1.1',
    katalog: 'chakrapetch',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'ChakraPetch-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'ChakraPetch-Bold.ttf' },
      { wariant: 'kursywa', plik: 'ChakraPetch-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'ChakraPetch-BoldItalic.ttf' },
    ],
  },
  {
    id: 'rubik-mono-one',
    rodzina: 'Rubik Mono One',
    kategoria: 'ozdobna',
    autor: 'Hubert and Fischer',
    licencja: 'SIL OFL 1.1',
    katalog: 'rubikmonoone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'RubikMonoOne-Regular.ttf' }],
  },
  {
    id: 'rubik-glitch',
    rodzina: 'Rubik Glitch',
    kategoria: 'ozdobna',
    autor: 'NaN, Luke Prowse',
    licencja: 'SIL OFL 1.1',
    katalog: 'rubikglitch',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'RubikGlitch-Regular.ttf' }],
  },
  {
    id: 'nosifer',
    rodzina: 'Nosifer',
    kategoria: 'ozdobna',
    autor: 'Typomondo',
    licencja: 'SIL OFL 1.1',
    katalog: 'nosifer',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Nosifer-Regular.ttf' }],
  },
  {
    id: 'butcherman',
    rodzina: 'Butcherman',
    kategoria: 'ozdobna',
    autor: 'Typomondo',
    licencja: 'SIL OFL 1.1',
    katalog: 'butcherman',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Butcherman-Regular.ttf' }],
  },
  {
    id: 'eater',
    rodzina: 'Eater',
    kategoria: 'ozdobna',
    autor: 'Typomondo',
    licencja: 'SIL OFL 1.1',
    katalog: 'eater',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Eater-Regular.ttf' }],
  },
  {
    id: 'limelight',
    rodzina: 'Limelight',
    kategoria: 'ozdobna',
    autor: 'Nicole Fally, Sorkin Type',
    licencja: 'SIL OFL 1.1',
    katalog: 'limelight',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Limelight-Regular.ttf' }],
  },
  {
    id: 'poiret-one',
    rodzina: 'Poiret One',
    kategoria: 'ozdobna',
    autor: 'Denis Masharov',
    licencja: 'SIL OFL 1.1',
    katalog: 'poiretone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'PoiretOne-Regular.ttf' }],
  },
  {
    id: 'kelly-slab',
    rodzina: 'Kelly Slab',
    kategoria: 'ozdobna',
    autor: 'Denis Masharov',
    licencja: 'SIL OFL 1.1',
    katalog: 'kellyslab',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'KellySlab-Regular.ttf' }],
  },
  {
    id: 'lilita-one',
    rodzina: 'Lilita One',
    kategoria: 'ozdobna',
    autor: 'Juan Montoreano',
    licencja: 'SIL OFL 1.1',
    katalog: 'lilitaone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'LilitaOne-Regular.ttf' }],
  },
  {
    id: 'titan-one',
    rodzina: 'Titan One',
    kategoria: 'ozdobna',
    autor: 'Rodrigo Fuenzalida',
    licencja: 'SIL OFL 1.1',
    katalog: 'titanone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'TitanOne-Regular.ttf' }],
  },
  {
    id: 'passion-one',
    rodzina: 'Passion One',
    kategoria: 'ozdobna',
    autor: 'Fontstage',
    licencja: 'SIL OFL 1.1',
    katalog: 'passionone',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'PassionOne-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'PassionOne-Bold.ttf' },
    ],
  },
  {
    id: 'fugaz-one',
    rodzina: 'Fugaz One',
    kategoria: 'ozdobna',
    autor: 'LatinoType',
    licencja: 'SIL OFL 1.1',
    katalog: 'fugazone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'FugazOne-Regular.ttf' }],
  },
  {
    id: 'racing-sans-one',
    rodzina: 'Racing Sans One',
    kategoria: 'ozdobna',
    autor: 'Impallari Type',
    licencja: 'SIL OFL 1.1',
    katalog: 'racingsansone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'RacingSansOne-Regular.ttf' }],
  },
  {
    id: 'concert-one',
    rodzina: 'Concert One',
    kategoria: 'ozdobna',
    autor: 'Johan Kallas, Mihkel Virkus',
    licencja: 'SIL OFL 1.1',
    katalog: 'concertone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'ConcertOne-Regular.ttf' }],
  },
  {
    id: 'shrikhand',
    rodzina: 'Shrikhand',
    kategoria: 'ozdobna',
    autor: 'Jonny Pinhorn',
    licencja: 'SIL OFL 1.1',
    katalog: 'shrikhand',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Shrikhand-Regular.ttf' }],
  },
  {
    id: 'chonburi',
    rodzina: 'Chonburi',
    kategoria: 'ozdobna',
    autor: 'Cadson Demak',
    licencja: 'SIL OFL 1.1',
    katalog: 'chonburi',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Chonburi-Regular.ttf' }],
  },
  {
    id: 'rozha-one',
    rodzina: 'Rozha One',
    kategoria: 'ozdobna',
    autor: 'Indian Type Foundry',
    licencja: 'SIL OFL 1.1',
    katalog: 'rozhaone',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'RozhaOne-Regular.ttf' }],
  },
  {
    id: 'bowlby-one-sc',
    rodzina: 'Bowlby One SC',
    kategoria: 'ozdobna',
    autor: 'Vernon Adams',
    licencja: 'SIL OFL 1.1',
    katalog: 'bowlbyonesc',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'BowlbyOneSC-Regular.ttf' }],
  },
  {
    id: 'graduate',
    rodzina: 'Graduate',
    kategoria: 'ozdobna',
    autor: 'Eduardo Tunni',
    licencja: 'SIL OFL 1.1',
    katalog: 'graduate',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Graduate-Regular.ttf' }],
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
  {
    id: 'vollkorn-sc',
    rodzina: 'Vollkorn SC',
    kategoria: 'szeryfowa',
    autor: 'Friedrich Althausen',
    licencja: 'SIL OFL 1.1',
    katalog: 'vollkornsc',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'VollkornSC-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'VollkornSC-Bold.ttf' },
    ],
  },
  {
    id: 'noticia-text',
    rodzina: 'Noticia Text',
    kategoria: 'szeryfowa',
    autor: 'JM Solé',
    licencja: 'SIL OFL 1.1',
    katalog: 'noticiatext',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'NoticiaText-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'NoticiaText-Bold.ttf' },
      { wariant: 'kursywa', plik: 'NoticiaText-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'NoticiaText-BoldItalic.ttf' },
    ],
  },
  {
    id: 'forum',
    rodzina: 'Forum',
    kategoria: 'szeryfowa',
    autor: 'Denis Masharov',
    licencja: 'SIL OFL 1.1',
    katalog: 'forum',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Forum-Regular.ttf' }],
  },
  {
    id: 'kurale',
    rodzina: 'Kurale',
    kategoria: 'szeryfowa',
    autor: 'Eduardo Tunni',
    licencja: 'SIL OFL 1.1',
    katalog: 'kurale',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Kurale-Regular.ttf' }],
  },
  {
    id: 'rosarivo',
    rodzina: 'Rosarivo',
    kategoria: 'szeryfowa',
    autor: 'Pablo Ugerman',
    licencja: 'SIL OFL 1.1',
    katalog: 'rosarivo',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Rosarivo-Regular.ttf' },
      { wariant: 'kursywa', plik: 'Rosarivo-Italic.ttf' },
    ],
  },
  {
    id: 'sorts-mill-goudy',
    rodzina: 'Sorts Mill Goudy',
    kategoria: 'szeryfowa',
    autor: 'Barry Schwartz',
    licencja: 'SIL OFL 1.1',
    katalog: 'sortsmillgoudy',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'SortsMillGoudy-Regular.ttf' },
      { wariant: 'kursywa', plik: 'SortsMillGoudy-Italic.ttf' },
    ],
  },
  {
    id: 'bree-serif',
    rodzina: 'Bree Serif',
    kategoria: 'szeryfowa',
    autor: 'TypeTogether',
    licencja: 'SIL OFL 1.1',
    katalog: 'breeserif',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'BreeSerif-Regular.ttf' }],
  },
  {
    id: 'zilla-slab',
    rodzina: 'Zilla Slab',
    kategoria: 'szeryfowa',
    autor: 'Typotheque',
    licencja: 'SIL OFL 1.1',
    katalog: 'zillaslab',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'ZillaSlab-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'ZillaSlab-Bold.ttf' },
      { wariant: 'kursywa', plik: 'ZillaSlab-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'ZillaSlab-BoldItalic.ttf' },
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
  {
    id: 'poppins',
    rodzina: 'Poppins',
    kategoria: 'bezszeryfowa',
    autor: 'Indian Type Foundry, Jonny Pinhorn, Ninad Kale',
    licencja: 'SIL OFL 1.1',
    katalog: 'poppins',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Poppins-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Poppins-Bold.ttf' },
      { wariant: 'kursywa', plik: 'Poppins-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'Poppins-BoldItalic.ttf' },
    ],
  },
  {
    id: 'play',
    rodzina: 'Play',
    kategoria: 'bezszeryfowa',
    autor: 'Jonas Hecksher',
    licencja: 'SIL OFL 1.1',
    katalog: 'play',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Play-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Play-Bold.ttf' },
    ],
  },
  {
    id: 'kanit',
    rodzina: 'Kanit',
    kategoria: 'bezszeryfowa',
    autor: 'Cadson Demak',
    licencja: 'SIL OFL 1.1',
    katalog: 'kanit',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Kanit-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Kanit-Bold.ttf' },
      { wariant: 'kursywa', plik: 'Kanit-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'Kanit-BoldItalic.ttf' },
    ],
  },
  {
    id: 'saira-condensed',
    rodzina: 'Saira Condensed',
    kategoria: 'bezszeryfowa',
    autor: 'Omnibus-Type',
    licencja: 'SIL OFL 1.1',
    katalog: 'sairacondensed',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'SairaCondensed-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'SairaCondensed-Bold.ttf' },
    ],
  },
  {
    id: 'titillium-web',
    rodzina: 'Titillium Web',
    kategoria: 'bezszeryfowa',
    autor: 'Accademia di Belle Arti di Urbino',
    licencja: 'SIL OFL 1.1',
    katalog: 'titilliumweb',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'TitilliumWeb-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'TitilliumWeb-Bold.ttf' },
      { wariant: 'kursywa', plik: 'TitilliumWeb-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'TitilliumWeb-BoldItalic.ttf' },
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
  {
    id: 'pacifico',
    rodzina: 'Pacifico',
    kategoria: 'pisana',
    autor: 'Vernon Adams, Jacques Le Bailly, Botjo Nikoltchev, Ani Petrova',
    licencja: 'SIL OFL 1.1',
    katalog: 'pacifico',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Pacifico-Regular.ttf' }],
  },
  {
    id: 'lobster',
    rodzina: 'Lobster',
    kategoria: 'pisana',
    autor: 'Impallari Type',
    licencja: 'SIL OFL 1.1',
    katalog: 'lobster',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Lobster-Regular.ttf' }],
  },
  {
    id: 'kaushan-script',
    rodzina: 'Kaushan Script',
    kategoria: 'pisana',
    autor: 'Impallari Type',
    licencja: 'SIL OFL 1.1',
    katalog: 'kaushanscript',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'KaushanScript-Regular.ttf' }],
  },
  {
    id: 'allura',
    rodzina: 'Allura',
    kategoria: 'pisana',
    autor: 'Robert Leuschke',
    licencja: 'SIL OFL 1.1',
    katalog: 'allura',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Allura-Regular.ttf' }],
  },
  {
    id: 'parisienne',
    rodzina: 'Parisienne',
    kategoria: 'pisana',
    autor: 'Astigmatic',
    licencja: 'SIL OFL 1.1',
    katalog: 'parisienne',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Parisienne-Regular.ttf' }],
  },
  {
    id: 'sacramento',
    rodzina: 'Sacramento',
    kategoria: 'pisana',
    autor: 'Astigmatic',
    licencja: 'SIL OFL 1.1',
    katalog: 'sacramento',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Sacramento-Regular.ttf' }],
  },
  {
    id: 'alex-brush',
    rodzina: 'Alex Brush',
    kategoria: 'pisana',
    autor: 'Robert Leuschke',
    licencja: 'SIL OFL 1.1',
    katalog: 'alexbrush',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'AlexBrush-Regular.ttf' }],
  },
  {
    id: 'pinyon-script',
    rodzina: 'Pinyon Script',
    kategoria: 'pisana',
    autor: 'Nicole Fally',
    licencja: 'SIL OFL 1.1',
    katalog: 'pinyonscript',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'PinyonScript-Regular.ttf' }],
  },
  {
    id: 'italianno',
    rodzina: 'Italianno',
    kategoria: 'pisana',
    autor: 'Robert Leuschke',
    licencja: 'SIL OFL 1.1',
    katalog: 'italianno',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Italianno-Regular.ttf' }],
  },
  {
    id: 'niconne',
    rodzina: 'Niconne',
    kategoria: 'pisana',
    autor: 'Vernon Adams',
    licencja: 'SIL OFL 1.1',
    katalog: 'niconne',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Niconne-Regular.ttf' }],
  },
  {
    id: 'oleo-script',
    rodzina: 'Oleo Script',
    kategoria: 'pisana',
    autor: 'soytutype fonts',
    licencja: 'SIL OFL 1.1',
    katalog: 'oleoscript',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'OleoScript-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'OleoScript-Bold.ttf' },
    ],
  },
  {
    id: 'indie-flower',
    rodzina: 'Indie Flower',
    kategoria: 'pisana',
    autor: 'Kimberly Geswein',
    licencja: 'SIL OFL 1.1',
    katalog: 'indieflower',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'IndieFlower-Regular.ttf' }],
  },
  {
    id: 'bad-script',
    rodzina: 'Bad Script',
    kategoria: 'pisana',
    autor: 'Gaslight',
    licencja: 'SIL OFL 1.1',
    katalog: 'badscript',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'BadScript-Regular.ttf' }],
  },
  {
    id: 'mali',
    rodzina: 'Mali',
    kategoria: 'pisana',
    autor: 'Cadson Demak',
    licencja: 'SIL OFL 1.1',
    katalog: 'mali',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'Mali-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'Mali-Bold.ttf' },
      { wariant: 'kursywa', plik: 'Mali-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'Mali-BoldItalic.ttf' },
    ],
  },
  {
    id: 'pangolin',
    rodzina: 'Pangolin',
    kategoria: 'pisana',
    autor: 'Kevin Burke',
    licencja: 'SIL OFL 1.1',
    katalog: 'pangolin',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'Pangolin-Regular.ttf' }],
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
  {
    id: 'fira-mono',
    rodzina: 'Fira Mono',
    kategoria: 'maszynowa',
    autor: 'Carrois Apostrophe',
    licencja: 'SIL OFL 1.1',
    katalog: 'firamono',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'FiraMono-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'FiraMono-Bold.ttf' },
    ],
  },
  {
    id: 'inconsolata',
    rodzina: 'Inconsolata',
    kategoria: 'maszynowa',
    autor: 'Raph Levien',
    licencja: 'SIL OFL 1.1',
    katalog: 'inconsolata',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'static/Inconsolata-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'static/Inconsolata-Bold.ttf' },
    ],
  },
  {
    id: 'pt-mono',
    rodzina: 'PT Mono',
    kategoria: 'maszynowa',
    autor: 'ParaType',
    licencja: 'SIL OFL 1.1',
    katalog: 'ptmono',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'PTM55FT.ttf' }],
  },
  {
    id: 'cutive-mono',
    rodzina: 'Cutive Mono',
    kategoria: 'maszynowa',
    autor: 'Vernon Adams',
    licencja: 'SIL OFL 1.1',
    katalog: 'cutivemono',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'CutiveMono-Regular.ttf' }],
  },
  {
    id: 'anonymous-pro',
    rodzina: 'Anonymous Pro',
    kategoria: 'maszynowa',
    autor: 'Mark Simonson',
    licencja: 'SIL OFL 1.1',
    katalog: 'anonymouspro',
    polskieZnaki: true,
    warianty: [
      { wariant: 'normalny', plik: 'AnonymousPro-Regular.ttf' },
      { wariant: 'pogrubiony', plik: 'AnonymousPro-Bold.ttf' },
      { wariant: 'kursywa', plik: 'AnonymousPro-Italic.ttf' },
      { wariant: 'pogrubiona-kursywa', plik: 'AnonymousPro-BoldItalic.ttf' },
    ],
  },
  {
    id: 'syne-mono',
    rodzina: 'Syne Mono',
    kategoria: 'maszynowa',
    autor: 'Bonjour Monde, Lucas Descroix',
    licencja: 'SIL OFL 1.1',
    katalog: 'synemono',
    polskieZnaki: true,
    warianty: [{ wariant: 'normalny', plik: 'SyneMono-Regular.ttf' }],
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
  pozycja: Pick<PozycjaKataloguGoogle, 'katalog' | 'grupa'>,
  wariant: Pick<WariantKataloguGoogle, 'plik'>,
): readonly string[] {
  const grupa = pozycja.grupa ?? 'ofl';
  const sciezkaPliku = wariant.plik.split('/').map(encodeURIComponent).join('/');
  const sciezka = `${grupa}/${pozycja.katalog}/${sciezkaPliku}`;
  return [
    `https://cdn.jsdelivr.net/gh/google/fonts@main/${sciezka}`,
    `https://raw.githubusercontent.com/google/fonts/main/${sciezka}`,
  ];
}

const KATEGORIE_Z_KODU: readonly KategoriaGoogleFonts[] = [
  'ozdobna',
  'szeryfowa',
  'bezszeryfowa',
  'pisana',
  'maszynowa',
];
const GRUPY_Z_KODU: readonly GrupaGoogleFonts[] = ['ofl', 'apache', 'ufl'];
const LICENCJE_Z_KODU: readonly LicencjaGoogleFonts[] = [
  'SIL OFL 1.1',
  'Apache 2.0',
  'Ubuntu Font License',
];

type KompaktoweWarianty = { n: string; b?: string; i?: string; bi?: string };
type KrotkaKatalogu = readonly [string, number, string, number, string, number, KompaktoweWarianty];

let obietnicaPelnegoKatalogu: Promise<readonly PozycjaKataloguGoogle[]> | undefined;

/**
 * Leniwie wczytuje pełny katalog Google Fonts (~1800 rodzin łacińskich, w tym ~1500 z polskimi
 * znakami) z kompaktowego pliku JSON wydzielonego przez Vite w osobnym chunku.
 */
export function wczytajPelnyKatalogGoogleFonts(): Promise<readonly PozycjaKataloguGoogle[]> {
  if (!obietnicaPelnegoKatalogu) {
    obietnicaPelnegoKatalogu = import('./katalogGoogleFonts.json')
      .then((mod) => {
        const surowe = mod.default as unknown as readonly KrotkaKatalogu[];
        const znane = new Set(KATALOG_GOOGLE_FONTS.map((p) => p.rodzina.toLowerCase()));
        const pozostale: PozycjaKataloguGoogle[] = [];
        for (const [rodzina, katKod, autor, grupaKod, katalog, pl, w] of surowe) {
          if (znane.has(rodzina.toLowerCase())) continue;
          const warianty: WariantKataloguGoogle[] = [{ wariant: 'normalny', plik: w.n }];
          if (w.b) warianty.push({ wariant: 'pogrubiony', plik: w.b });
          if (w.i) warianty.push({ wariant: 'kursywa', plik: w.i });
          if (w.bi) warianty.push({ wariant: 'pogrubiona-kursywa', plik: w.bi });
          pozostale.push({
            id: rodzina
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, ''),
            rodzina,
            kategoria: KATEGORIE_Z_KODU[katKod] ?? 'bezszeryfowa',
            autor,
            licencja: LICENCJE_Z_KODU[grupaKod] ?? 'SIL OFL 1.1',
            grupa: GRUPY_Z_KODU[grupaKod] ?? 'ofl',
            katalog,
            polskieZnaki: pl === 1,
            warianty,
          });
        }
        return [...KATALOG_GOOGLE_FONTS, ...pozostale];
      })
      .catch((e) => {
        obietnicaPelnegoKatalogu = undefined;
        throw e;
      });
  }
  return obietnicaPelnegoKatalogu;
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
      const nazwaPlikuTtf = wariant.plik.split('/').pop() ?? wariant.plik;
      const w = wgrajCzcionke(nazwaPlikuTtf, bajty, { zrodlo: 'google', zajete });
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

interface WpisKataloguGithub {
  name: string;
  type: 'file' | 'dir';
}

export type FunkcjaPobieraniaDowolnej = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<Pick<Response, 'ok' | 'status' | 'arrayBuffer' | 'json'>>;

function wybierzPlikiWariantow(
  plikiTtf: readonly string[],
  prefiks: string,
): WariantKataloguGoogle[] {
  const statyczne = plikiTtf.filter((f) => !f.includes('['));
  if (statyczne.length > 0) {
    const znajdz = (re: RegExp) => statyczne.find((f) => re.test(f));
    const reg = znajdz(/-Regular\.ttf$/i) ?? (statyczne.length === 1 ? statyczne[0] : undefined);
    const bold = znajdz(/-Bold\.ttf$/i);
    const ital = znajdz(/-Italic\.ttf$/i);
    const bi = znajdz(/-BoldItalic\.ttf$/i);
    const wynik: WariantKataloguGoogle[] = [];
    if (reg) wynik.push({ wariant: 'normalny', plik: `${prefiks}${reg}` });
    if (bold) wynik.push({ wariant: 'pogrubiony', plik: `${prefiks}${bold}` });
    if (ital) wynik.push({ wariant: 'kursywa', plik: `${prefiks}${ital}` });
    if (bi) wynik.push({ wariant: 'pogrubiona-kursywa', plik: `${prefiks}${bi}` });
    if (wynik.length > 0) return wynik;
    return [{ wariant: 'normalny', plik: `${prefiks}${statyczne[0]!}` }];
  }
  // Wiele nowych rodzin w Google Fonts udostępnia wyłącznie pliki zmienne (`[wght].ttf`).
  const zmienne = plikiTtf.filter((f) => f.includes('['));
  if (zmienne.length === 0) return [];
  const norm = zmienne.find((f) => !/italic/i.test(f)) ?? zmienne[0]!;
  const kurs = zmienne.find((f) => /italic/i.test(f));
  const wynik: WariantKataloguGoogle[] = [{ wariant: 'normalny', plik: `${prefiks}${norm}` }];
  if (kurs && kurs !== norm) wynik.push({ wariant: 'kursywa', plik: `${prefiks}${kurs}` });
  return wynik;
}

/**
 * Pobiera dowolną rodzinę czcionek z repozytorium `google/fonts` po jej nazwie
 * (np. „Cinzel”, „UnifrakturMaguntia”, „Playfair Display”). Jeśli rodzina istnieje
 * w kuratorowanym katalogu, korzysta z niego bez dodatkowego zapytania o listę plików.
 */
export async function pobierzDowolnaRodzineGoogle(
  nazwaRodziny: string,
  {
    zasoby = [],
    pobierz = (url, init) => fetch(url, init),
    signal,
    limitCzasuMs = LIMIT_CZASU_POBIERANIA_MS,
  }: {
    zasoby?: readonly OpisZasobu[];
    pobierz?: FunkcjaPobieraniaDowolnej;
    signal?: AbortSignal;
    limitCzasuMs?: number;
  } = {},
): Promise<{ rodzina: string; wgrane: WgranaCzcionka[]; brakPolskichZnakow: boolean }> {
  const nazwa = nazwaRodziny.trim().replace(/\s+/g, ' ');
  if (!nazwa) {
    throw new BladDanych(t('googleFonts.brakNazwy'));
  }
  const zKatalogu = KATALOG_GOOGLE_FONTS.find(
    (p) => p.rodzina.toLowerCase() === nazwa.toLowerCase(),
  );
  if (zKatalogu) {
    const wgrane = await pobierzRodzineGoogle(zKatalogu, { zasoby, pobierz, signal, limitCzasuMs });
    return { rodzina: zKatalogu.rodzina, wgrane, brakPolskichZnakow: false };
  }

  const slug = nazwa.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!slug) {
    throw new BladDanych(t('googleFonts.nieZnaleziono', { rodzina: nazwa }));
  }

  let znalezionaGrupa: 'ofl' | 'apache' | 'ufl' | undefined;
  let warianty: WariantKataloguGoogle[] = [];

  for (const grupa of ['ofl', 'apache', 'ufl'] as const) {
    if (signal?.aborted) throw bladAnulowania();
    const { signal: sig, zwolnij } = przygotujSygnal(signal, limitCzasuMs);
    try {
      const res = await pobierz(
        `https://api.github.com/repos/google/fonts/contents/${grupa}/${slug}`,
        { signal: sig },
      );
      if (!res.ok) continue;
      const wpisy = (await res.json()) as WpisKataloguGithub[];
      if (!Array.isArray(wpisy)) continue;
      znalezionaGrupa = grupa;
      const glowneTtf = wpisy
        .filter((w) => w.type === 'file' && w.name.toLowerCase().endsWith('.ttf'))
        .map((w) => w.name);
      const statyczneGlowne = glowneTtf.filter((f) => !f.includes('['));
      if (statyczneGlowne.length > 0) {
        warianty = wybierzPlikiWariantow(statyczneGlowne, '');
      } else if (wpisy.some((w) => w.type === 'dir' && w.name === 'static')) {
        const { signal: sigSt, zwolnij: zwolnijSt } = przygotujSygnal(signal, limitCzasuMs);
        try {
          const resSt = await pobierz(
            `https://api.github.com/repos/google/fonts/contents/${grupa}/${slug}/static`,
            { signal: sigSt },
          );
          if (resSt.ok) {
            const stWpisy = (await resSt.json()) as WpisKataloguGithub[];
            const stTtf = Array.isArray(stWpisy)
              ? stWpisy
                  .filter((w) => w.type === 'file' && w.name.toLowerCase().endsWith('.ttf'))
                  .map((w) => w.name)
              : [];
            warianty = wybierzPlikiWariantow(stTtf, 'static/');
          }
        } finally {
          zwolnijSt();
        }
      }
      if (warianty.length === 0 && glowneTtf.length > 0) {
        warianty = wybierzPlikiWariantow(glowneTtf, '');
      }
      break;
    } catch (e) {
      if (signal?.aborted) throw bladAnulowania();
      if (e instanceof BladDanych) throw e;
    } finally {
      zwolnij();
    }
  }

  if (!znalezionaGrupa || warianty.length === 0) {
    throw new BladDanych(t('googleFonts.nieZnaleziono', { rodzina: nazwa }));
  }

  const zajete = new Set(zasoby.map((z) => z.id));
  const wgrane: WgranaCzcionka[] = [];
  let nazwaZPliku = nazwa;
  for (const wariant of warianty) {
    if (signal?.aborted) throw bladAnulowania();
    const sciezkaPliku = wariant.plik.split('/').map(encodeURIComponent).join('/');
    const sciezka = `${znalezionaGrupa}/${slug}/${sciezkaPliku}`;
    const adresy = [
      `https://cdn.jsdelivr.net/gh/google/fonts@main/${sciezka}`,
      `https://raw.githubusercontent.com/google/fonts/main/${sciezka}`,
    ];
    let ostatniBlad = '';
    let pobrany: WgranaCzcionka | undefined;
    for (const url of adresy) {
      if (signal?.aborted) throw bladAnulowania();
      const { signal: sig, czyPrzekroczonoCzas, zwolnij } = przygotujSygnal(signal, limitCzasuMs);
      try {
        const res = await pobierz(url, { signal: sig });
        if (signal?.aborted) throw bladAnulowania();
        if (!res.ok) {
          ostatniBlad = `HTTP ${res.status}`;
          continue;
        }
        const bajty = new Uint8Array(await res.arrayBuffer());
        if (signal?.aborted) throw bladAnulowania();
        const nazwaPlikuTtf = wariant.plik.split('/').pop() ?? wariant.plik;
        const w = wgrajCzcionke(nazwaPlikuTtf, bajty, { zrodlo: 'google', zajete });
        if (wgrane.length === 0 && w.opis.rodzina) nazwaZPliku = w.opis.rodzina;
        pobrany = {
          ...w,
          opis: {
            ...w.opis,
            rodzina: nazwaZPliku,
            wariant: wariant.wariant,
            zrodlo: 'google',
          },
        };
        break;
      } catch (e) {
        if (signal?.aborted) throw bladAnulowania();
        ostatniBlad = czyPrzekroczonoCzas()
          ? t('googleFonts.przekroczonoCzas')
          : e instanceof Error
            ? e.message
            : String(e);
      } finally {
        zwolnij();
      }
    }
    if (!pobrany) {
      throw new BladDanych(
        t('googleFonts.bladPobrania', {
          rodzina: nazwa,
          szczegoly: ostatniBlad || t('googleFonts.brakPolaczenia'),
        }),
      );
    }
    zajete.add(pobrany.opis.id);
    wgrane.push(pobrany);
  }

  const brakPolskichZnakow = wgrane.some((w) => !maPolskieZnaki(w.czcionka));
  return { rodzina: nazwaZPliku, wgrane, brakPolskichZnakow };
}
