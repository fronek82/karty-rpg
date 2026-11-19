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

export interface Obramowanie {
  grubosc: Mm;
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

/** Obroty dozwolone w trybie swobodnym (R9) – pomiar, przyciąganie i trafienia zostają prostokątne. */
export type ObrotSwobodny = 0 | 90 | 180 | 270;

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
}

/**
 * Wiersz (dzieci obok siebie), kolumna (jedno pod drugim), warstwy (jedno na drugim) lub
 * swobodny (dzieci z `pozycja`: położenie w mm od kotwicy, obrót co 90°; kolejność w drzewie =
 * kolejność rysowania, ostatnie na wierzchu).
 */
export interface Kontener extends WezelBazowy {
  typ: 'wiersz' | 'kolumna' | 'warstwy' | 'swobodny';
  dzieci: Wezel[];
  tloZDanych?: KolorZDanych;
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
  /** Etykieta nad albo pod kształtem (np. „WYTRZYMAŁOŚĆ” nad rombem); tło i ramka – tylko kształt. */
  etykieta?: {
    tekst: NapisSzablonu;
    pozycja: 'nad' | 'pod';
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
export type KsztaltWartosci =
  'prostokat' | 'kwadrat' | 'kolo' | 'sciety' | 'romb' | 'tarcza' | 'szesciokat' | 'wlasny';

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
  rozmiar: Mm;
  kolor?: Kolor;
}

/** Linia oddzielająca (pozioma w kolumnie, pionowa w wierszu) – na całą dostępną długość. */
export interface PoleSeparator extends PoleBazowe {
  typ: 'separator';
  kierunek: 'poziomy' | 'pionowy';
  grubosc: Mm;
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

export interface Szablon {
  id: string;
  /** Napisy stałe z wartościami domyślnymi (np. „Usunięcie:”, „/ 250p”). */
  parametry?: ParametrSzablonu[];
  nazwa: string;
  rozmiar: RozmiarKarty;
  promienRogow?: Mm;
  tlo?: Kolor;
  tloZDanych?: KolorZDanych;
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

/** Talia – zbiór kart (na razie bez rewersu – M4). */
export interface Talia {
  id: string;
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
