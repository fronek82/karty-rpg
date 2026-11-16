import type { GrupaKart, Karta, Talia } from '../../model/szablon';
import {
  szablonBron,
  szablonPrzedmiot,
  szablonPusta,
  szablonSakiewka,
  szablonStan,
  szablonZaklecie,
  szablonZbroja,
} from './szablony';

/**
 * Talie odpowiadające trzem arkuszom referencyjnym. Nazwy przedmiotów, kości obrażeń, klasy broni,
 * stany i warunki ich usunięcia to mechanika gry; opisy grup stanów są napisane od nowa.
 * Ilustracje: obrazek zastępczy – właściwe grafiki użytkownik wgrywa w aplikacji.
 */

export const OBRAZ_ZASTEPCZY = 'mausritter/zastepczy';

/** Karta z jawnym, stałym identyfikatorem (zapisane projekty i grupy się do niego odwołują). */
function karta(
  id: string,
  szablonId: string,
  dane: Record<string, string>,
  ilosc: number,
  rozmiar?: { kolumny: number; rzedy: number },
): Karta {
  const k: Karta = { id, szablonId, dane, ilosc };
  if (rozmiar) k.rozmiar = rozmiar;
  return k;
}

const Z = OBRAZ_ZASTEPCZY;
const PIONOWA = { kolumny: 1, rzedy: 2 };
const POZIOMA = { kolumny: 2, rzedy: 1 };

function bron(
  id: string,
  nazwa: string,
  wartosc: string,
  klasa: string,
  ilosc: number,
  ciezka = false,
): Karta {
  const dane: Record<string, string> = { nazwa, wartosc, klasa };
  if (nazwa !== '' || klasa === 'Improwizowana') dane.obraz = Z;
  return karta(id, szablonBron.id, dane, ilosc, ciezka ? PIONOWA : undefined);
}

export const taliaBroni: Talia = {
  id: 'mausritter-bron-i-pancerze',
  nazwa: 'Karty broni i pancerzy',
  karty: [
    bron('bron-improwizowana', '', 'k6', 'Improwizowana', 4),
    bron('bron-igla', 'Igła', 'k6', 'Lekka', 3),
    bron('bron-sztylet', 'Sztylet', 'k6', 'Lekka', 3),
    bron('bron-pusta-lekka', '', 'k6', 'Lekka', 2),
    bron('bron-topor', 'Topór', 'k6/k8', 'Średnia', 2),
    bron('bron-miecz', 'Miecz', 'k6/k8', 'Średnia', 2),
    bron('bron-kiscien', 'Kiścień', 'k6/k8', 'Średnia', 2),
    bron('bron-pusta-srednia', '', 'k6/k8', 'Średnia', 2),
    bron('bron-mlot-bojowy', 'Młot bojowy', 'k10', 'Ciężka', 2, true),
    bron('bron-wlocznia', 'Włócznia', 'k10', 'Ciężka', 2, true),
    bron('bron-hak', 'Hak', 'k10', 'Ciężka', 2, true),
    bron('bron-pusta-ciezka', '', 'k10', 'Ciężka', 2, true),
    bron('bron-proca', 'Proca', 'k6', 'Lekka dystansowa', 3),
    bron('bron-pusta-lekka-dystansowa', '', 'k6', 'Lekka dystansowa', 3),
    bron('bron-luk', 'Łuk', 'k8', 'Ciężka dystansowa', 3, true),
    bron('bron-pusta-ciezka-dystansowa', '', 'k8', 'Ciężka dystansowa', 1, true),
    karta(
      'amunicja-kamienie',
      szablonBron.id,
      { nazwa: 'Kamienie', klasa: 'Amunicja', obraz: Z },
      3,
    ),
    karta('amunicja-strzaly', szablonBron.id, { nazwa: 'Strzały', klasa: 'Amunicja', obraz: Z }, 3),
    karta(
      'zbroja-ciezka',
      szablonZbroja.id,
      { nazwa: 'Ciężka zbroja', wartosc: '-1 obr', obraz: Z },
      3,
      PIONOWA,
    ),
    karta(
      'zbroja-lekka',
      szablonZbroja.id,
      { nazwa: 'Lekka zbroja', wartosc: '-1 obr', obraz: Z },
      4,
      POZIOMA,
    ),
  ],
};

export const taliaWyposazenia: Talia = {
  id: 'mausritter-wyposazenie',
  nazwa: 'Karty niezbędnego wyposażenia',
  karty: [
    karta('przedmiot-pochodnie', szablonPrzedmiot.id, { nazwa: 'Pochodnie', obraz: Z }, 10),
    karta('przedmiot-latarnia', szablonPrzedmiot.id, { nazwa: 'Latarnia', obraz: Z }, 4),
    karta(
      'przedmiot-latarnia-elektryczna',
      szablonPrzedmiot.id,
      { nazwa: 'Latarnia elektr.', obraz: Z, uzycia: '6' },
      4,
    ),
    karta('sakiewka', szablonSakiewka.id, { nazwa: 'Sakiewka', obraz: Z }, 8),
    karta('przedmiot-prowiant', szablonPrzedmiot.id, { nazwa: 'Prowiant', obraz: Z }, 8),
    karta('zaklecie', szablonZaklecie.id, { obraz: Z }, 9),
    karta('pusta-1x1', szablonPusta.id, {}, 19),
    karta('pusta-2x1', szablonPusta.id, {}, 4, POZIOMA),
  ],
};

const wyczerpana = karta(
  'stan-wyczerpana',
  szablonStan.id,
  { nazwa: 'Wyczerpana', usuniecie: 'Długi odpoczynek' },
  18,
);
const przerazona = karta(
  'stan-przerazona',
  szablonStan.id,
  {
    nazwa: 'Przerażona',
    skutek: 'Zdaj test SW, aby\nstawić czoła lękowi',
    usuniecie: 'Krótki odpoczynek',
  },
  6,
);
const glodna = karta(
  'stan-glodna',
  szablonStan.id,
  { nazwa: 'Głodna', usuniecie: 'Spożycie posiłku' },
  6,
);
const ranna = karta(
  'stan-ranna',
  szablonStan.id,
  { nazwa: 'Ranna', skutek: 'Utrudnienie\nw testach SF i ZR', usuniecie: 'Pełny odpoczynek' },
  12,
);
const niepoczytalna = karta(
  'stan-niepoczytalna',
  szablonStan.id,
  { nazwa: 'Niepoczytalna', skutek: 'Utrudnienie\nw testach SW', usuniecie: 'Pełny odpoczynek' },
  6,
);
const wlasny = karta('stan-wlasny', szablonStan.id, {}, 12);

/** Opisy grup – własnymi słowami (polskie wydanie nie jest na wolnej licencji). */
const grupyStanow: GrupaKart[] = [
  {
    id: 'wyczerpana',
    naglowek: 'Wyczerpana',
    opis: 'Najczęściej przyznawany stan. Pojawia się, gdy mysz pominie długi odpoczynek albo przegra próbę sił lub zręczności.',
    karty: [wyczerpana.id],
  },
  {
    id: 'przerazona',
    naglowek: 'Przerażona',
    opis: 'Skutek spotkania z grozą: potworem lub czarem.',
    karty: [przerazona.id],
  },
  { id: 'glodna', naglowek: 'Głodna', opis: 'Cały dzień bez racji prowiantu.', karty: [glodna.id] },
  {
    id: 'ranna',
    naglowek: 'Ranna',
    opis: 'Ciężki stan. Pojawia się po krytycznym trafieniu, gdy rzut obronny na SF się nie powiedzie.',
    karty: [ranna.id],
  },
  {
    id: 'niepoczytalna',
    naglowek: 'Niepoczytalna',
    opis: 'Ciężki stan. Cena nieudanego rzucenia zaklęcia.',
    karty: [niepoczytalna.id],
  },
  {
    id: 'wlasne',
    naglowek: 'Własne stany',
    opis: 'Puste karty na stany wymyślone przy stole: krótka nazwa, skutek i sposób pozbycia się kłopotu.',
    karty: [wlasny.id],
  },
];

export const taliaStanow: Talia = {
  id: 'mausritter-stany',
  nazwa: 'Karty stanów',
  karty: [wyczerpana, przerazona, glodna, ranna, niepoczytalna, wlasny],
  grupy: grupyStanow,
};

export const talieMausrittera = [taliaBroni, taliaWyposazenia, taliaStanow];
