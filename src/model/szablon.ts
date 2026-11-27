import type { Mm } from './jednostki';

/** Kolor w zapisie `#rrggbb`. */
export type Kolor = string;

/** Domyślne kolory dokumentu, wspólne dla obu motywów interfejsu. */
export const DOMYSLNE_TLO_KARTY: Kolor = '#ffffff';
export const DOMYSLNY_KOLOR_TEKSTU: Kolor = '#000000';

export interface KolorZDanych {
  klucz: string;
  domyslny: Kolor;
  mapa: { wartosc: string; kolor: Kolor }[];
}

/**
 * Rozmiar elementu wzdłuż jednej osi:
 * - `{ mm }` – stały,
 * - `{ procent }` – procent miejsca dostępnego dla dziecka: wnętrza rodzica (bez paddingu);
 *   w osi poprzecznej i w warstwach – pomniejszonego o marginesy dziecka,
 * - `{ wypelnij }` – udział w wolnym miejscu z wagą,
 * - `'auto'` – dopasuj do treści.
 */
export type Rozmiar = { mm: Mm } | { procent: number } | { wypelnij: number } | 'auto';

export interface Odstepy {
  gora: Mm;
  prawo: Mm;
  dol: Mm;
  lewo: Mm;
}

export type WyrownanieOsi = 'poczatek' | 'srodek' | 'koniec';
export type StylLinii = 'ciagla' | 'przerywana' | 'kropkowana' | 'podwojna';

/**
 * Narożniki z biblioteki ozdobników – ten sam rysunek odbity lustrzanie na cztery rogi ramki.
 * `element` to identyfikator elementu (wbudowane: `wb:…`); nieznany daje ostrzeżenie i brak narożnika.
 */
export interface Narozniki {
  element: string;
  /** Bok kwadratu, w który wpisany jest narożnik (mm). */
  rozmiar: Mm;
  /** Kolor; domyślnie kolor linii ramki. */
  kolor?: Kolor;
}

/**
 * Ozdoba zamiast linii ramki: motyw z biblioteki powtarzany wzdłuż czterech boków (pas szerokości
 * `szerokosc` mm), w rogach kostka narożna motywu (albo narożniki z `narozniki`). Motyw biegnie po
 * prostych bokach – promień zaokrąglenia dotyczy tylko linii (R3). Nieznany element: ostrzeżenie
 * i cienka linia ciągła w kolorze ozdoby. Dla ramki karty odsunięcie to `RamkaKarty.odsuniecie`.
 */
export interface OzdobaMotyw {
  rodzaj: 'motyw';
  /** Identyfikator motywu (wbudowane: `wb:pnacze`, `wb:przeplot`, …). */
  element: string;
  /** Szerokość pasa motywu (mm). */
  szerokosc: Mm;
  poLuku?: boolean;
  kolor: Kolor;
  /** Grubość „szyn” – cienkich linii po obu stronach pasa (mm); brak = bez szyn. */
  szyny?: Mm;
  /** Odsunięcie pasa od krawędzi węzła (mm, domyślnie 0); ramka karty używa `odsuniecie` ramki. */
  odsuniecie?: Mm;
}
/**
 * Ramka 9-slice z biblioteki ozdobników (element rodzaju `ramka9`, źródło PNG albo SVG): rogi
 * skalowane tak, by najgrubszy bok miał `grubosc` mm, boki rozciągnięte albo powtórzone równo,
 * środek według ustawień elementu. Nieznany element: ostrzeżenie i cienka linia ciągła.
 */
export interface OzdobaRamka9 {
  rodzaj: 'ramka9';
  /** Identyfikator elementu `ramka9` (własny z biblioteki projektu). */
  element: string;
  /** Grubość ramki (mm) – szerokość najgrubszego boku po przeskalowaniu. */
  grubosc: Mm;
  /** Kolor rysunku kolorowalnego (źródło SVG „jednolity”); domyślnie czarny. */
  kolor?: Kolor;
  /** Odsunięcie od krawędzi węzła (mm, domyślnie 0); ramka karty używa `odsuniecie` ramki. */
  odsuniecie?: Mm;
}

/** Ozdoba ramki: motyw powtarzalny albo ramka 9-slice. */
export type Ozdoba = OzdobaMotyw | OzdobaRamka9;

export interface Szkic {
  sila: Mm;
  ziarno: number;
}

export interface Postrzepienie extends Szkic {
  ziarnistosc: Mm;
}

export interface Obramowanie {
  grubosc: Mm;
  szkic?: Szkic;
  kolor: Kolor;
  styl?: StylLinii;
  /** Przerwa między liniami stylu `podwojna` (mm, domyślnie 2× grubość); `grubosc` to grubość każdej linii. */
  przerwa?: Mm;
  /** Które krawędzie rysować; domyślnie wszystkie (wtedy z zaokrągleniem `promien`). */
  krawedzie?: Partial<Record<keyof Odstepy, boolean>>;
}

/**
 * Punkt zaczepienia w trybie swobodnym: 9 punktów prostokąta (kolumna: lewy / środek / prawy,
 * wiersz: górny / środek / dolny). `x`, `y` liczone są od tego punktu kontenera do tego samego
 * punktu elementu – element „przyklejony” do prawego dolnego rogu zostaje tam po zmianie rozmiaru karty.
 */
export type Kotwica =
  | 'lewy-gorny'
  | 'gorny'
  | 'prawy-gorny'
  | 'lewy'
  | 'srodek'
  | 'prawy'
  | 'lewy-dolny'
  | 'dolny'
  | 'prawy-dolny';

export const KOTWICE: readonly Kotwica[] = [
  'lewy-gorny',
  'gorny',
  'prawy-gorny',
  'lewy',
  'srodek',
  'prawy',
  'lewy-dolny',
  'dolny',
  'prawy-dolny',
];

/** Kąt zgodny z ruchem wskazówek zegara, w stopniach od 0 do mniej niż 360. */
export type ObrotSwobodny = number;

/**
 * Położenie elementu w kontenerze swobodnym (czytane tylko wtedy, gdy rodzic jest swobodny).
 * `x`, `y` (mm, ze znakiem: w prawo / w dół) – przesunięcie punktu `kotwica` elementu względem tego
 * samego punktu wnętrza kontenera (domyślnie `lewy-gorny`). Wymiary elementu to jego `szerokosc`
 * i `wysokosc` (przy obrocie 90° / 270° – wymiary przed obrotem; na karcie zajmuje prostokąt
 * z zamienionymi bokami, obrócony wokół swojego środka).
 */
export interface Pozycja {
  x: Mm;
  y: Mm;
  kotwica?: Kotwica;
  obrot?: ObrotSwobodny;
}

/** Ułamki szerokości i wysokości, które wyznaczają punkt kotwicy (0, 0.5 albo 1). */
export function ulamkiKotwicy(k: Kotwica | undefined): { fx: number; fy: number } {
  switch (k) {
    case 'gorny':
      return { fx: 0.5, fy: 0 };
    case 'prawy-gorny':
      return { fx: 1, fy: 0 };
    case 'lewy':
      return { fx: 0, fy: 0.5 };
    case 'srodek':
      return { fx: 0.5, fy: 0.5 };
    case 'prawy':
      return { fx: 1, fy: 0.5 };
    case 'lewy-dolny':
      return { fx: 0, fy: 1 };
    case 'dolny':
      return { fx: 0.5, fy: 1 };
    case 'prawy-dolny':
      return { fx: 1, fy: 1 };
    default:
      return { fx: 0, fy: 0 };
  }
}

interface WezelBazowy {
  /** Identyfikator unikalny w obrębie szablonu. */
  id: string;
  /** Nazwa dla użytkownika (drzewo edytora, nazwa pola danych w panelu karty). */
  nazwa?: string;
  szerokosc?: Rozmiar;
  wysokosc?: Rozmiar;
  /** Margines zewnętrzny (mm) – jedna liczba dla wszystkich stron albo osobno. */
  margines?: Mm | Partial<Odstepy>;
  /** Padding wewnętrzny (mm). */
  padding?: Mm | Partial<Odstepy>;
  /**
   * Położenie w rodzicu. W osi poprzecznej wiersza/kolumny oraz w obu osiach warstw:
   * brak wyrównania = rozciągnij na całe miejsce, wyrównanie = rozmiar wg treści.
   */
  wyrownanie?: { poziomo?: WyrownanieOsi; pionowo?: WyrownanieOsi };
  tlo?: Kolor;
  obramowanie?: Obramowanie;
  /** Motyw zamiast linii obramowania (gdy jest, linii nie rysujemy). */
  ozdoba?: Ozdoba;
  /**
   * Narożniki z biblioteki ozdobników. Silnik rysuje je niezależnie od linii, ale edytor oferuje
   * wybór narożników tylko przy rodzaju ramki „linia” (przełączenie na „brak” je czyści).
   */
  narozniki?: Narozniki;
  /** Zaokrąglenie rogów tła i obramowania (mm); przy kształcie „sciety” – wielkość ścięcia. */
  promien?: Mm;
  /**
   * Najmniejszy rozmiar (mm) – np. kwadratowa ramka wartości. Obowiązuje przy rozmiarze wg treści,
   * rozciąganiu i wypełnianiu (także kosztem wyjścia poza rodzica); rozmiar stały (mm, %) ma pierwszeństwo.
   */
  minSzerokosc?: Mm;
  minWysokosc?: Mm;
  /** Położenie w rodzicu swobodnym (R10); w innych kontenerach ignorowane, ale zostaje w modelu. */
  pozycja?: Pozycja;
  /** Krycie warstwy/węzła 0–1 (domyślnie 1 – w pełni nieprzezroczysty). */
  krycie?: number;
  /**
   * Wartość odmiany, gdy węzeł jest dzieckiem przełącznika (`Kontener.przelacznik`); pusta –
   * numer pozycji w rodzicu (1, 2, 3…).
   */
  odmiana?: string;
}

/**
 * Przełącznik odmian: kontener pokazuje jedno dziecko – to, którego wartość odmiany jest
 * w danych karty pod `klucz` (bez klucza – na tyle – wartość z przełącznika przodu o tej samej
 * nazwie). Bez wartości – odmiana `domyslna`, a bez niej pierwsze dziecko.
 */
export interface Przelacznik {
  klucz?: string;
  domyslna?: string;
}

/**
 * Wiersz (dzieci obok siebie), kolumna (jedno pod drugim), warstwy (jedno na drugim) lub
 * swobodny (dzieci z `pozycja`: położenie w mm od kotwicy, obrót co 90°; kolejność w drzewie =
 * kolejność rysowania, ostatnie na wierzchu).
 */
export interface Kontener extends WezelBazowy {
  typ: 'wiersz' | 'kolumna' | 'warstwy' | 'swobodny';
  dzieci: Wezel[];
  /** Przełącznik odmian – z dzieci widać jedno, wybrane z danych karty. */
  przelacznik?: Przelacznik;
  tloZDanych?: KolorZDanych;
  teksturaTla?: string;
  postrzepienie?: Postrzepienie;
  /** Odstęp między dziećmi (mm). */
  odstep?: Mm;
  /** Rozłożenie dzieci w osi głównej, gdy zostaje wolne miejsce. */
  rozklad?: WyrownanieOsi | 'miedzy';
}

export type WyrownanieTekstu = 'lewo' | 'srodek' | 'prawo' | 'justuj';

export type WariantCzcionki = 'normalny' | 'pogrubiony' | 'kursywa' | 'pogrubiona-kursywa';

export interface StylTekstu {
  /** Rola czcionki w projekcie (np. `tytul`, `tresc`) albo nazwa rodziny. */
  czcionka: string;
  wariant?: WariantCzcionki;
  /** Rozmiar czcionki (mm, wysokość kwadratu em). Do zapisu w punktach służy `pt()`. */
  rozmiar: Mm;
  /** Auto-dopasowanie: zmniejszaj do tego rozmiaru, aż tekst się zmieści. */
  minRozmiar?: Mm;
  kolor?: Kolor;
  /** `justuj` – wiersze rozciągnięte do pełnej szerokości (bez ostatniego wiersza akapitu). */
  wyrownanie?: WyrownanieTekstu;
  wyrownaniePionowe?: WyrownanieOsi;
  /** Wysokość wiersza jako wielokrotność rozmiaru (domyślnie 1,2). */
  interlinia?: number;
  wielkieLitery?: boolean;
  /**
   * Kapitaliki: małe litery jako małe wersaliki (cecha `smcp` czcionki albo synteza).
   * Przy `wielkieLitery` nie działają (wszystko jest wersalikami).
   */
  kapitaliki?: boolean;
  /** Wcięcie pierwszego wiersza akapitu (mm). */
  wciecie?: Mm;
  /** Dodatkowy odstęp po akapicie (mm). */
  odstepAkapitow?: Mm;
  /** Dodatkowy odstęp między literami (mm). */
  odstepLiter?: Mm;
  /** Obwódka wokół liter (np. biała, żeby napis był czytelny na tle ilustracji). */
  obwodka?: { grubosc: Mm; kolor: Kolor };
}

/**
 * Napis w szablonie: stały albo parametr szablonu (`{ parametr: 'klucz' }`) – wtedy wartością jest
 * `dane[klucz]` karty, a gdy pusto – wartość domyślna parametru z `Szablon.parametry`.
 */
export type NapisSzablonu = string | { parametr: string };

export type GdyPuste = 'pokaz-ramke' | 'ukryj';

interface PoleBazowe extends WezelBazowy {
  /** Klucz w danych karty; bez klucza pole pokazuje wartość stałą z szablonu. */
  klucz?: string;
  /**
   * Gdy brak wartości: `pokaz-ramke` – zachowaj miejsce, tło i obramowanie (domyślnie),
   * `ukryj` – pole znika i nie zajmuje miejsca.
   */
  gdyPuste?: GdyPuste;
}

export interface PoleTekst extends PoleBazowe {
  typ: 'tekst';
  /** Tekst stały (gdy brak klucza) albo domyślny (gdy w danych pusto). */
  tekst?: NapisSzablonu;
  styl: StylTekstu;
  grupaStyluId?: string;
  /** Łamanie na wiele wierszy (domyślnie tak). */
  wieleWierszy?: boolean;
  etykieta?: {
    tekst: NapisSzablonu;
    /**
     * `nad` / `pod` – osobny wiersz nad / pod wartością; `przed` – w tej samej linii przed tekstem.
     */
    pozycja: 'nad' | 'przed' | 'pod';
    styl?: Partial<StylTekstu>;
    kolorZDanych?: KolorZDanych;
  };
  /**
   * Formatowanie w treści (domyślnie włączone): `**pogrubienie**`, `*kursywa*`,
   * `***pogrubiona kursywa***`; `\*` to zwykła gwiazdka.
   */
  formatowanie?: boolean;
  listyNumerowane?: boolean;
  ikonyWTekscie?: boolean;
  kontynuuj?: boolean;
  /** Skład napisu po łuku (np. łuk u góry lub u dołu rewersu). */
  luk?: LukTekstu;
}

export interface LukTekstu {
  /** Promień okręgu łuku w mm (dodatni). */
  promien: Mm;
  /** `gora` – łuk wypukły ku górze; `dol` – wklęsły ku dołowi. Domyślnie `gora`. */
  kierunek?: 'gora' | 'dol';
}

/** Krótka wartość (np. `k6`, `-1 obr`) w ramce o zadanym kształcie. */
export interface PoleWartosc extends PoleBazowe {
  typ: 'wartosc';
  tekst?: NapisSzablonu;
  styl: StylTekstu;
  grupaStyluId?: string;
  /** `sciety` – prostokąt ze ściętymi rogami (wielkość ścięcia w `promien`). */
  ksztalt: KsztaltWartosci;
  /**
   * Przy kształcie `wlasny`: identyfikator elementu biblioteki (rodzaj „kształt”, własny SVG).
   * Nieznany element: ostrzeżenie `nieznany-element-ozdobny` i zwykły prostokąt.
   */
  ksztaltElement?: string;
  /** Liczba ramion gwiazdy (`ksztalt: 'gwiazda'`), od 3 do 12; domyślnie 5. */
  ramiona?: number;
  /**
   * Kształt zachowuje swoje proporcje (romb, gwiazda, własny SVG…): skaluje się proporcjonalnie
   * i jest wyśrodkowany w dostępnym miejscu. Domyślnie włączone; `false` – rozciągnięty do pola
   * (zachowanie sprzed schematu 28). Kwadrat i koło są zawsze równoboczne.
   */
  zachowajProporcje?: boolean;
  /**
   * Etykieta w osobnym miejscu nad, pod albo obok kształtu (np. „WYTRZYMAŁOŚĆ” nad rombem);
   * tło i ramka – tylko kształt. Etykieta nie zmienia proporcji kształtu.
   */
  etykieta?: {
    tekst: NapisSzablonu;
    pozycja: PozycjaEtykietyWartosci;
    styl?: Partial<StylTekstu>;
    kolorZDanych?: KolorZDanych;
    /** Odstęp między etykietą a kształtem (mm, domyślnie 0,5). */
    odstep?: Mm;
  };
}

/**
 * Kształt ramki wartości. Prostokąt z zaokrągleniem (`promien`) to „zaokrąglony prostokąt”;
 * kwadrat – równe boki wg dłuższego wymiaru treści.
 */
export const KSZTALTY_WARTOSCI = [
  'prostokat',
  'kwadrat',
  'kolo',
  'sciety',
  'romb',
  'trojkat',
  'pieciokat',
  'szesciokat',
  'osmiokat',
  'gwiazda',
  'tarcza',
  'serce',
  'kropla',
  'wlasny',
] as const;
export type KsztaltWartosci = (typeof KSZTALTY_WARTOSCI)[number];

export const POZYCJE_ETYKIETY_WARTOSCI = ['nad', 'pod', 'lewo', 'prawo'] as const;
export type PozycjaEtykietyWartosci = (typeof POZYCJE_ETYKIETY_WARTOSCI)[number];

/** Granice i domyślna liczba ramion gwiazdy. */
export const RAMIONA_GWIAZDY = { min: 3, max: 12, domyslnie: 5 } as const;

export interface PoleObraz extends PoleBazowe {
  typ: 'obraz';
  /** Stały zasób, gdy brak klucza (identyfikator z biblioteki projektu). */
  zasob?: string;
  dopasowanie: 'dopasuj' | 'wypelnij' | 'rozciagnij';
  /** Punkt zaczepienia kadru, 0–1 w każdej osi (domyślnie środek). */
  kadr?: { x: number; y: number };
  /**
   * Identyfikatory pól, które obraz omija (np. ramka wartości nałożona na ilustrację).
   * Obraz jest dopasowywany do największego wolnego prostokąta ramki pola.
   */
  omijaj?: string[];
  /** Odstęp od omijanych pól (mm, domyślnie 0,5). */
  odstepOdOmijanych?: Mm;
}

export type DopasowanieObrazu = PoleObraz['dopasowanie'];

/**
 * Ustawienia obrazu zapisane w danych jednej karty (np. kadrowanie ilustracji).
 * Przekształcenie liczone od położenia z dopasowania: skala i obrót wokół środka obrazu,
 * potem przesunięcie. Przekształcony obraz jest przycinany do ramki pola; bez przekształcenia –
 * do obszaru dopasowania, gdy z niego wychodzi (tryb „wypełnij”).
 */
export interface UstawieniaObrazu {
  /** Mnożnik rozmiaru (1 = jak z dopasowania). */
  skala?: number;
  /** Przesunięcie w mm. */
  przesuniecie?: { x: Mm; y: Mm };
  /** Obrót w stopniach, zgodnie z ruchem wskazówek zegara. */
  obrot?: number;
  /** Nadpisuje tryb dopasowania z szablonu. */
  dopasowanie?: DopasowanieObrazu;
}

/** Kółka/kwadraty do zamalowania. Wartość z danych (liczba) nadpisuje liczbę znaczników. */
export interface PoleZnaczniki extends PoleBazowe {
  typ: 'znaczniki';
  kolumny: number;
  rzedy: number;
  ksztalt: 'kolo' | 'kwadrat';
  srednica: Mm;
  odstep: Mm;
  grubosc: Mm;
  kolor?: Kolor;
}

/** Pusta ramka do pisania ołówkiem z opcjonalnym stałym sufiksem (np. `/ 250p`). */
export interface PoleWpis extends PoleBazowe {
  typ: 'wpis';
  sufiks?: NapisSzablonu;
  styl: StylTekstu;
  grupaStyluId?: string;
}

export type NazwaIkony = 'gwiazdka' | 'nozyczki';

export interface PoleIkona extends PoleBazowe {
  typ: 'ikona';
  ikona: NazwaIkony;
  /** Opcjonalny element wektorowy z katalogu ozdobników lub biblioteki projektu. */
  element?: string;
  rozmiar: Mm;
  kolor?: Kolor;
}

/** Linia oddzielająca (pozioma w kolumnie, pionowa w wierszu) – na całą dostępną długość. */
export interface PoleSeparator extends PoleBazowe {
  typ: 'separator';
  kierunek: 'poziomy' | 'pionowy';
  grubosc: Mm;
  szkic?: Szkic;
  kolor?: Kolor;
  stylLinii?: StylLinii;
  /** Przerwa między liniami stylu `podwojna` (mm, domyślnie 2× grubość). */
  przerwa?: Mm;
  /**
   * Rysunek separatora: `'linia'` (domyślnie, styl z `stylLinii`) albo motyw z biblioteki
   * (pas `szerokosc` mm, kafelki rozłożone równo; kolor = `kolor`).
   */
  rysunek?: 'linia' | { motyw: string; szerokosc: Mm };
  /** Zakończenia: element biblioteki na lewym (górnym) końcu i jego odbicie na prawym (dolnym). */
  zakonczenia?: { element: string; rozmiar: Mm };
  /** Środek: element biblioteki w połowie długości, linia w tym miejscu przerwana. */
  srodek?: { element: string; rozmiar: Mm };
  /** Długość rysunku (domyślnie całe dostępne miejsce): w mm albo w % dostępnego miejsca. */
  dlugosc?: { mm: Mm } | { procent: number };
  /** Odstęp linii (motywu) od zakończeń i środka, mm (domyślnie 0,4). Nieznany element: ostrzeżenie. */
  odstepOdOzdoby?: Mm;
}

/** Kolumna tabeli: nagłówek stały z szablonu, wartość z danych karty. */
export interface KolumnaTabeli {
  naglowek: string;
  /** Klucz w danych karty (jedna komórka wartości). */
  klucz: string;
  /** `auto` (domyślnie) – wg najszerszej komórki; `wypelnij` – udział w wolnym miejscu. */
  szerokosc?: 'auto' | { mm: Mm } | { wypelnij: number };
  /** Wyrównanie tekstu w kolumnie (domyślnie – ze stylu tabeli). */
  wyrownanie?: 'lewo' | 'srodek' | 'prawo';
}

/** Tabela: opcjonalny wiersz nagłówków i 1–N wierszy wartości; każda komórka to pole danych. */
export interface PoleTabela extends PoleBazowe {
  typ: 'tabela';
  kolumny: KolumnaTabeli[];
  /** Liczba wierszy wartości (domyślnie 1). */
  wiersze?: number;
  /** Wiersz nagłówków widoczny (domyślnie tak). */
  naglowki?: boolean;
  /** Styl wartości; nagłówki – ten sam z nadpisaniami `stylNaglowka` (domyślnie pogrubiony). */
  styl: StylTekstu;
  grupaStyluId?: string;
  stylNaglowka?: Partial<StylTekstu>;
  tloNaglowka?: Kolor;
  /** Linie siatki; `zewnetrzne: false` – bez obwódki tabeli. */
  linie?: { grubosc: Mm; kolor: Kolor; styl?: StylLinii; przerwa?: Mm; zewnetrzne?: boolean };
  /** Wewnętrzny odstęp komórki (mm, domyślnie 0,8). */
  paddingKomorki?: Mm;
}

export type Pole =
  | PoleTekst
  | PoleWartosc
  | PoleObraz
  | PoleZnaczniki
  | PoleWpis
  | PoleIkona
  | PoleSeparator
  | PoleTabela;
export type Wezel = Kontener | Pole;

export type RozmiarKarty =
  | {
      tryb: 'sloty';
      slot: { szerokosc: Mm; wysokosc: Mm };
      /** Domyślny rozmiar karty w slotach (karta może go zmienić). */
      kolumny: number;
      rzedy: number;
    }
  | { tryb: 'mm'; szerokosc: Mm; wysokosc: Mm };

export interface RamkaKarty {
  grubosc: Mm;
  szkic?: Szkic;
  kolor: Kolor;
  styl?: StylLinii;
  /** Przerwa między liniami stylu `podwojna` (mm, domyślnie 2× grubość). */
  przerwa?: Mm;
  /** Narożniki z biblioteki ozdobników, w rogach ramki. */
  narozniki?: Narozniki;
  /**
   * Motyw zamiast linii. Pola linii (`grubosc`, `kolor`…) zostają w modelu, żeby powrót do rodzaju
   * „linia” zachował ustawienia; przy ozdobie nie są rysowane.
   */
  ozdoba?: Ozdoba;
  /** Odległość zewnętrznej krawędzi linii od krawędzi karty (mm, domyślnie 0). */
  odsuniecie?: Mm;
  /** Zaokrąglenie rogów ramki; domyślnie zgodne z rogami karty. */
  promien?: Mm;
}

/** Parametr szablonu – napis z wartością domyślną, który karta może nadpisać w danych. */
export interface ParametrSzablonu {
  /** Klucz w danych karty. */
  klucz: string;
  /** Nazwa dla użytkownika (kolumna w tabeli danych). */
  nazwa: string;
  domyslnie: string;
}

/** Podkład szablonu: obraz z biblioteki projektu, przezroczystość 0–100 % (50 = pół na pół) i widoczność. */
export interface PodkladSzablonu {
  zasob: string;
  /** Przezroczystość w procentach: 0 – obraz w pełni widoczny, 100 – niewidoczny. */
  przezroczystosc: number;
  widoczny: boolean;
}

export interface GrupaStylu {
  id: string;
  nazwa: string;
  styl: StylTekstu;
}

export type TrybTla = 'wypelnij' | 'dopasuj' | 'rozciagnij' | 'kafelki';

export interface ZabarwienieTla {
  kolor: Kolor;
  /** Siła zabarwienia 0–1 (krycie nakładki barwiącej na teksturze tła). */
  krycie: number;
}

/**
 * Rodzaj wzoru tła: linie (pionowe, poziome, ukośne), kratka, romby (dwa zestawy ukośnych), kropki
 * albo `svg` – grafika z biblioteki użytkownika (element ozdobny) powtarzana kafelkami.
 */
export type RodzajWzoruTla =
  'pionowe' | 'poziome' | 'kratka' | 'romby' | 'ukosne' | 'kropki' | 'svg';

/**
 * Układ kafelków wzoru: siatka, cegiełka (co drugi rząd przesunięty o pół kafelka) albo pion
 * (co druga kolumna przesunięta o pół kafelka).
 */
export type UkladWzoruTla = 'siatka' | 'cegielka' | 'pion';

/**
 * Wzór tła karty rysowany wektorowo (sięga spadu). Kolor pod wzorem to `tlo` karty. Początek
 * wzoru to lewy górny róg karty netto przesunięty o `przesuniecie`; obrót wokół tego punktu.
 */
export interface WzorTla {
  rodzaj: RodzajWzoruTla;
  /** Grubość linii albo średnica kropki (mm). */
  grubosc: Mm;
  /** Odstęp między liniami / kropkami (mm). */
  odstep: Mm;
  kolor: Kolor;
  /** Krycie wzoru 0–1 (domyślnie 1). */
  krycie?: number;
  /** Obrót wzoru w stopniach (zgodnie z ruchem wskazówek zegara). */
  obrot?: number;
  przesuniecie?: { x: Mm; y: Mm };
  /** Kolejność względem tekstury tła: domyślnie wzór nad teksturą. */
  podTekstura?: boolean;
  /** Kropki i `svg`: układ kafelków (domyślnie siatka). */
  uklad?: UkladWzoruTla;
  /** Tylko `svg`: id elementu ozdobnego z biblioteki użytkownika (odwołanie, nie kopia rysunku). */
  element?: string;
  /** Tylko `svg`: dłuższy bok kafelka (mm), rysunek zachowuje proporcje. */
  rozmiar?: Mm;
  /** Tylko `svg`: odstęp między kafelkami w poziomie i w pionie (mm, domyślnie 0). */
  odstepX?: Mm;
  odstepY?: Mm;
}

/** Linia pomocnicza w edytorze szablonu/rewersu (tylko do projektowania – nigdy nie trafia do sceny ani PDF). */
export interface LiniaPomocnicza {
  id: string;
  /** Oś linii: `h` – pozioma (pozycja Y w mm), `v` – pionowa (pozycja X w mm). */
  os: 'h' | 'v';
  /** Położenie od górnej (`h`) lub lewej (`v`) krawędzi karty w mm (krok 0,5 mm). */
  mm: Mm;
}

/** Źródło kopii szablonu lub tyłu w bibliotece szablonów (id rekordu + skrót treści z chwili skopiowania). */
export interface ZrodloSzablonu {
  id: string;
  hash: string;
}

/** Samodzielny układ graficzny rewersu. Wymiary są formatem odniesienia warstw. */
export interface Rewers {
  id: string;
  nazwa: string;
  rozmiar: Extract<RozmiarKarty, { tryb: 'mm' }>;
  korzen: Kontener & { typ: 'swobodny' };
  tlo?: Kolor;
  teksturaTla?: string;
  teksturaTryb?: TrybTla;
  /** Krycie obrazu tekstury tła 0–1 (domyślnie 1). */
  teksturaKrycie?: number;
  /** Zabarwienie tekstury tła na wybrany kolor. */
  teksturaZabarwienie?: ZabarwienieTla;
  wzorTla?: WzorTla;
  ramka?: RamkaKarty;
  /**
   * Zaokrąglenie rogów tyłu (podgląd w edytorze, kontrola zgodności z przodem). Brak – tył
   * dopasowuje rogi do przodu (projekty sprzed schematu 31). Na arkuszu rogi wyznacza przód.
   */
  promienRogow?: Mm;
  postrzepienie?: Postrzepienie;
  /**
   * Teksty przykładowe pól tyłu do podglądu w edytorze (id pola → tekst). Nie trafiają na karty:
   * tam jest stały tekst albo wartość pola przodu o tej samej nazwie.
   */
  przyklad?: Record<string, string>;
  /** Linie pomocnicze w edytorze – zapisywane w rewersie, nigdy nie drukowane. */
  liniePomocnicze?: LiniaPomocnicza[];
  /** Źródło kopii w bibliotece szablonów (schemat 36). */
  zrodlo?: ZrodloSzablonu;
}

/** Brak pola dziedziczy, null jawnie wyłącza rewers. */
export type PrzypisanieRewersu = string | null;

export interface Szablon {
  id: string;
  rewersId?: PrzypisanieRewersu;
  /** Napisy stałe z wartościami domyślnymi (np. „Usunięcie:”, „/ 250p”). */
  parametry?: ParametrSzablonu[];
  nazwa: string;
  rozmiar: RozmiarKarty;
  promienRogow?: Mm;
  tlo?: Kolor;
  tloZDanych?: KolorZDanych;
  teksturaTla?: string;
  /** Wzór tła karty (linie, kratka, kropki…) – patrz `WzorTla`. */
  wzorTla?: WzorTla;
  postrzepienie?: Postrzepienie;
  grupyStylow?: GrupaStylu[];
  /** Dane przykładowe do podglądu w edytorze szablonu (klucz pola → wartość). */
  przyklad?: Record<string, string>;
  /** Ramka całej karty – linia w odległości `odsuniecie` od krawędzi (0 = po krawędzi). */
  ramka?: RamkaKarty;
  korzen: Kontener;
  /**
   * Podkład ze wzoru (zdjęcie lub skan karty) pod podglądem w edytorze – pomoc przy układaniu pól.
   * Nigdy nie jest drukowany, rysowany w scenie karty ani eksportowany do obrazów; nie trafia też
   * do pliku szablonu (tylko do eksportu całego projektu – zasób jest w `Projekt.zasoby`).
   */
  podklad?: PodkladSzablonu;
  /** Linie pomocnicze w edytorze – zapisywane w szablonie, nigdy nie drukowane. */
  liniePomocnicze?: LiniaPomocnicza[];
  /** Źródło kopii w bibliotece szablonów (schemat 36). */
  zrodlo?: ZrodloSzablonu;
  /**
   * Inny układ dla wybranego rozmiaru karty w slotach (np. ciężka broń 1×2 z ilustracją na całą
   * szerokość). Bez pasującego wariantu karta używa `korzen`.
   */
  warianty?: { kolumny: number; rzedy: number; korzen: Kontener }[];
}

/** Korzeń układu dla danej karty – wariant pasujący do jej rozmiaru albo domyślny. */
export function korzenKarty(szablon: Szablon, karta?: Pick<Karta, 'rozmiar'>): Kontener {
  const r = szablon.rozmiar;
  if (r.tryb !== 'sloty' || !szablon.warianty) return szablon.korzen;
  const kolumny = karta?.rozmiar?.kolumny ?? r.kolumny;
  const rzedy = karta?.rozmiar?.rzedy ?? r.rzedy;
  return (
    szablon.warianty.find((w) => w.kolumny === kolumny && w.rzedy === rzedy)?.korzen ??
    szablon.korzen
  );
}

export interface Karta {
  id: string;
  rewersId?: PrzypisanieRewersu;
  szablonId: string;
  /** Wartości pól według kluczy szablonu. */
  dane: Record<string, string>;
  /** Liczba sztuk do druku. */
  ilosc: number;
  /** Oryginał egzemplarza utworzonego w edytorze kartki. */
  kopiaKarty?: { oryginal: string; numer: number };
  /** Rozmiar w slotach (tylko szablony w trybie slotów). */
  rozmiar?: { kolumny: number; rzedy: number };
  /** Ustawienia obrazów tej karty według identyfikatora pola obrazu. */
  obrazy?: Record<string, UstawieniaObrazu>;
}

/** Grupa kart w talii – na arkuszu dostaje nagłówek z opisem nad kolumnami (np. stany). */
export interface GrupaKart {
  id: string;
  naglowek: string;
  opis?: string;
  /** Identyfikatory kart należących do grupy (w kolejności). */
  karty: string[];
}

/** Talia – zbiór kart ze wspólnym domyślnym rewersem. */
export interface Talia {
  id: string;
  rewersId?: PrzypisanieRewersu;
  nazwa: string;
  karty: Karta[];
  grupy?: GrupaKart[];
}

export function czyKontener(wezel: Wezel): wezel is Kontener {
  return (
    wezel.typ === 'wiersz' ||
    wezel.typ === 'kolumna' ||
    wezel.typ === 'warstwy' ||
    wezel.typ === 'swobodny'
  );
}

/** Węzeł i wszyscy jego potomkowie (w głąb, zaczynając od węzła). */
export function* wezlyDrzewa(w: Wezel): Generator<Wezel> {
  yield w;
  if (czyKontener(w)) for (const d of w.dzieci) yield* wezlyDrzewa(d);
}

/** Pola (liście) drzewa węzła – bez kontenerów. */
export function* polaDrzewa(w: Wezel): Generator<Pole> {
  for (const x of wezlyDrzewa(w)) if (!czyKontener(x)) yield x;
}

/** Korzenie szablonu lub rewersu: główny i korzenie wariantów układu. */
export const korzenieSzablonu = (s: Pick<Szablon, 'korzen' | 'warianty'>): Kontener[] => [
  s.korzen,
  ...(s.warianty ?? []).map((w) => w.korzen),
];

/** Wszystkie węzły szablonu lub rewersu (korzeń i warianty układu). */
export const wszystkieWezly = (s: Pick<Szablon, 'korzen' | 'warianty'>): Wezel[] =>
  korzenieSzablonu(s).flatMap((k) => [...wezlyDrzewa(k)]);

/** Wymiary karty w mm. */
export function wymiaryKarty(
  szablon: Szablon,
  karta?: Pick<Karta, 'rozmiar'>,
): {
  szer: Mm;
  wys: Mm;
} {
  const r = szablon.rozmiar;
  if (r.tryb === 'mm') return { szer: r.szerokosc, wys: r.wysokosc };
  const kolumny = karta?.rozmiar?.kolumny ?? r.kolumny;
  const rzedy = karta?.rozmiar?.rzedy ?? r.rzedy;
  return { szer: kolumny * r.slot.szerokosc, wys: rzedy * r.slot.wysokosc };
}

export function rozwinOdstepy(o: Mm | Partial<Odstepy> | undefined): Odstepy {
  if (o === undefined) return { gora: 0, prawo: 0, dol: 0, lewo: 0 };
  if (typeof o === 'number') return { gora: o, prawo: o, dol: o, lewo: o };
  return { gora: o.gora ?? 0, prawo: o.prawo ?? 0, dol: o.dol ?? 0, lewo: o.lewo ?? 0 };
}

export type PoleZeStylem = PoleTekst | PoleWartosc | PoleWpis | PoleTabela;

export function maStylTekstu(w: Wezel): w is PoleZeStylem {
  return w.typ === 'tekst' || w.typ === 'wartosc' || w.typ === 'wpis' || w.typ === 'tabela';
}

export function znajdzGrupeStylu(s: Szablon, id: string | undefined): GrupaStylu | undefined {
  return s.grupyStylow?.find((g) => g.id === id);
}

/** Własny styl pola jest też rezerwą po wczytaniu szablonu z brakującą grupą. */
export function stylPola(s: Szablon, w: PoleZeStylem): StylTekstu {
  return znajdzGrupeStylu(s, w.grupaStyluId)?.styl ?? w.styl;
}

/** Wszystkie style tekstu pola (główny, etykiety, nagłówki tabeli) – np. do zebrania czcionek. */
export function stylePola(w: Wezel): Partial<StylTekstu>[] {
  if (czyKontener(w)) return [];
  switch (w.typ) {
    case 'tekst':
    case 'wartosc':
      return [w.styl, ...(w.etykieta?.styl ? [w.etykieta.styl] : [])];
    case 'tabela':
      return [w.styl, ...(w.stylNaglowka ? [w.stylNaglowka] : [])];
    case 'wpis':
      return [w.styl];
    default:
      return [];
  }
}

/**
 * Klucz danych komórki tabeli: wiersz 1 – klucz kolumny, dalsze – `klucz.2`, `klucz.3`… (kropki
 * nie ma w kluczach tworzonych z nazw, więc komórki nie zderzą się z innymi polami).
 */
export const kluczKomorki = (k: KolumnaTabeli, wiersz: number) =>
  wiersz === 0 ? k.klucz : `${k.klucz}.${wiersz + 1}`;

/** Klucze wszystkich komórek tabeli (wiersz po wierszu). */
export function kluczeTabeli(t: PoleTabela): string[] {
  const n = Math.max(1, Math.floor(t.wiersze ?? 1));
  return Array.from({ length: n }, (_, r) => t.kolumny.map((k) => kluczKomorki(k, r))).flat();
}

/**
 * Klucz treści szablonu awersu lub rewersu – wszystko poza identyfikatorem, przypisaniem rewersu
 * i podkładem, z nazwą bez wielkości liter i skrajnych spacji. Równe klucze = identyczne kopie
 * (np. ten sam szablon dołączony do kilku projektów); inne elementy o tej samej nazwie się różnią.
 */
export function kluczTresciSzablonu(s: Szablon | Rewers): string {
  const kopia: Record<string, unknown> = { ...s, nazwa: s.nazwa.trim().toLowerCase() };
  delete kopia.id;
  delete kopia.rewersId;
  delete kopia.podklad;
  delete kopia.zrodlo;
  return stabilnyJson(kopia);
}

/** JSON z kluczami obiektów w stałej kolejności (walidacja i kopiowanie mogą ją zmieniać). */
function stabilnyJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stabilnyJson).join(',')}]`;
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    const pary = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stabilnyJson(o[k])}`);
    return `{${pary.join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

// --- Przełącznik odmian (N12).

/** Postać wartości odmiany do porównań: bez spacji na brzegach i wielkości liter. */
export const normalizujOdmiane = (v: string) => v.trim().toLocaleLowerCase('pl');

/** Wartość odmiany dziecka przełącznika: wpisana albo numer pozycji (od 1). */
export const wartoscOdmiany = (k: Kontener, i: number): string =>
  k.dzieci[i]?.odmiana?.trim() || String(i + 1);

/** Indeks dziecka o danej wartości odmiany (bez wielkości liter); brak – `-1`. */
export function indeksOdmiany(k: Kontener, wartosc: string | undefined): number {
  const v = wartosc === undefined ? '' : normalizujOdmiane(wartosc);
  if (!v) return -1;
  return k.dzieci.findIndex((_, i) => normalizujOdmiane(wartoscOdmiany(k, i)) === v);
}

/**
 * Dziecko przełącznika widoczne dla danej wartości z danych: pasujące, potem odmiana domyślna,
 * potem pierwsze. `nieznana` – wartość niepusta, której żadne dziecko nie ma.
 */
export function wybranaOdmiana(
  k: Kontener,
  wartosc: string | undefined,
): { wezel: Wezel | undefined; nieznana: boolean } {
  const i = indeksOdmiany(k, wartosc);
  if (i >= 0) return { wezel: k.dzieci[i], nieznana: false };
  const d = indeksOdmiany(k, k.przelacznik?.domyslna);
  return {
    wezel: k.dzieci[d >= 0 ? d : 0],
    nieznana: !!wartosc?.trim(),
  };
}

/** Pierwszy wolny numer odmiany (1, 2, 3…) w przełączniku. */
export function wolnaOdmiana(k: Kontener): string {
  const zajete = new Set(k.dzieci.map((_, i) => normalizujOdmiane(wartoscOdmiany(k, i))));
  let n = 1;
  while (zajete.has(String(n))) n++;
  return String(n);
}
