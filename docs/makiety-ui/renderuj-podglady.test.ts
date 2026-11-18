/// <reference types="node" />
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { renderujKarte } from '../../src/silnik/karta';
import { scenaDoSvg } from '../../src/silnik/svg';
import { rejestrTestowy } from '../../src/silnik/__testy__/pomoc';
import {
  daneCzaru,
  daneStatystyk,
  daneWroga,
  szablonCzaru,
  szablonOzdobny,
  szablonStatystyk,
  szablonWroga,
} from '../../src/silnik/__testy__/przyklady';
import { zbudujArkusz } from '../../src/druk/arkusz';
import { pakietMausritter } from '../../src/pakiety/mausritter';
import { OBRAZ_ZASTEPCZY, taliaStanow } from '../../src/pakiety/mausritter/talie';
import type { Szablon } from '../../src/model/szablon';

/**
 * Renderuje podglądy do makiet PRAWDZIWYM silnikiem aplikacji (zbudujArkusz / renderujKarte +
 * scenaDoSvg) i zapisuje je jako SVG w docs/makiety-ui/podglady/.
 */
const WYJSCIE = 'docs/makiety-ui/podglady';
const zastepczy = `data:image/png;base64,${readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png').toString('base64')}`;
const czcionki = rejestrTestowy();
const szablony = new Map<string, Szablon>(pakietMausritter.szablony.map((s) => [s.id, s]));
const ctx = {
  czcionki,
  szablony,
  obraz: (z: string) => (z === OBRAZ_ZASTEPCZY ? { szerokosc: 512, wysokosc: 512 } : undefined),
};
const svgOpcje = (p: string) => ({
  przedrostekId: p,
  adresObrazu: (z: string) => (z === OBRAZ_ZASTEPCZY ? zastepczy : undefined),
});
const zapisz = (nazwa: string, tresc: string) => writeFileSync(`${WYJSCIE}/${nazwa}`, tresc);

/** Szablon swobodny (przykład F) – wzorzec z testy/swobodnyUI.ts z dopisanymi kluczami pól. */
const swobodna = {
  id: 'swobodna',
  nazwa: 'Karta swobodna',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  promienRogow: 3,
  tlo: '#f4ecd8',
  korzen: {
    id: 'karta',
    typ: 'swobodny',
    dzieci: [
      {
        id: 'i',
        nazwa: 'Ilustracja',
        typ: 'obraz',
        klucz: 'ilustracja',
        pozycja: { x: 0, y: 0 },
        szerokosc: { mm: 63 },
        wysokosc: { mm: 46 },
      },
      {
        id: 't',
        nazwa: 'Tytuł',
        typ: 'tekst',
        klucz: 'tytul',
        pozycja: { x: 6, y: 34 },
        szerokosc: { mm: 51 },
        wysokosc: { mm: 12 },
        styl: { czcionka: 'tytul', rozmiar: 5.5, wariant: 'pogrubiony', wyrownanie: 'srodek' },
      },
      {
        id: 'k',
        nazwa: 'Koszt',
        typ: 'wartosc',
        klucz: 'koszt',
        ksztalt: 'kolo',
        pozycja: { x: 3, y: 3 },
        szerokosc: { mm: 12 },
        wysokosc: { mm: 12 },
        tlo: '#fff8e6',
        obramowanie: { grubosc: 0.4, kolor: '#7d2240' },
        styl: { czcionka: 'tresc', rozmiar: 5, wariant: 'pogrubiony' },
      },
      {
        id: 'n',
        nazwa: 'Typ',
        typ: 'tekst',
        klucz: 'typ',
        pozycja: { x: 57, y: 8, obrot: 90 },
        szerokosc: { mm: 40 },
        wysokosc: { mm: 4.5 },
        styl: { czcionka: 'tresc', rozmiar: 2.8, wariant: 'kursywa', kolor: '#7d2240' },
      },
      {
        id: 'o',
        nazwa: 'Opis',
        typ: 'kolumna',
        pozycja: { x: 4, y: 50 },
        szerokosc: { mm: 55 },
        wysokosc: { mm: 30 },
        dzieci: [
          {
            id: 'oo',
            typ: 'tekst',
            klucz: 'opis',
            wysokosc: { wypelnij: 1 },
            styl: { czcionka: 'tresc', rozmiar: 3.4 },
          },
        ],
      },
    ],
  },
} as unknown as Szablon;

/** Szablon D bez własnego elementu biblioteki (wl:Gwiazdka) – wartość w kształcie rombu. */
const ozdobna = JSON.parse(
  JSON.stringify(szablonOzdobny).replace(
    '"ksztalt":"wlasny","ksztaltElement":"wl:Gwiazdka"',
    '"ksztalt":"romb"',
  ),
) as Szablon;

it('podglądy do makiet', () => {
  mkdirSync(WYJSCIE, { recursive: true });
  const info: Record<string, unknown> = {};

  // Arkusze Mausrittera: pusta kartka i trzy gotowe układy (każdy arkusz to osobna strona).
  const arkusze = new Map(pakietMausritter.arkusze.map((a) => [a.id, a]));
  const talie = new Map(pakietMausritter.talie.map((t) => [t.id, t]));
  for (const a of arkusze.values()) {
    const w = zbudujArkusz(a, talie.get(a.taliaId)!, ctx);
    zapisz(`arkusz-${a.id}.svg`, scenaDoSvg(w.strony[0]!, svgOpcje(`${a.id}-`)));
    info[a.id] = {
      strony: w.strony.length,
      poczatek: w.poczatekSiatki,
      slot: w.slot,
      siatka: w.siatka,
      ostrzezenia: w.ostrzezenia,
      polozone: w.rozmieszczenie,
    };
  }
  const pusty = pakietMausritter.nowaKartka;
  const wp = zbudujArkusz(
    { id: 'k', nazwa: pusty.nazwa, taliaId: 't', liczbaStron: 1, ustawienia: pusty.ustawienia },
    { id: 't', nazwa: pusty.nazwa, karty: [] },
    ctx,
  );
  zapisz('arkusz-pusty.svg', scenaDoSvg(wp.strony[0]!, svgOpcje('pusty-')));
  info.pusty = { poczatek: wp.poczatekSiatki, slot: wp.slot, siatka: wp.siatka };

  // Strona do makiety edytora: kilka kart i puste sloty (jedna karta 1x2 i puste miejsca).
  const wszystkie = [...pakietMausritter.talie.flatMap((t) => t.karty), ...taliaStanow.karty];
  const uklad: [string, number, number][] = [
    ['bron-sztylet', 0, 0],
    ['bron-miecz', 1, 0],
    ['zbroja-ciezka', 2, 0],
    ['przedmiot-pochodnie', 3, 0],
    ['przedmiot-latarnia', 4, 0],
    ['zaklecie', 5, 0],
    ['stan-ranna', 6, 0],
    ['sakiewka', 0, 1],
    ['bron-luk', 1, 1],
    ['przedmiot-prowiant', 3, 1],
    ['stan-glodna', 4, 1],
    ['bron-topor', 5, 1],
  ];
  const kartyEdycji = uklad.map(([id]) => ({ ...wszystkie.find((k) => k.id === id)!, ilosc: 1 }));
  const we = zbudujArkusz(
    {
      id: 'edycja',
      nazwa: 'Moje karty',
      taliaId: 'te',
      liczbaStron: 1,
      ustawienia: pakietMausritter.nowaKartka.ustawienia,
      przypiete: uklad.map(([kartaId, kolumna, rzad]) => ({ kartaId, kolumna, rzad })),
    },
    { id: 'te', nazwa: 'Moje karty', karty: kartyEdycji },
    ctx,
  );
  zapisz('arkusz-edycja.svg', scenaDoSvg(we.strony[0]!, svgOpcje('edycja-')));
  info.edycja = {
    poczatek: we.poczatekSiatki,
    slot: we.slot,
    siatka: we.siatka,
    ostrzezenia: we.ostrzezenia,
    uklad,
  };

  writeFileSync(`${WYJSCIE}/info.json`, JSON.stringify(info, null, 1));

  // Karty z przykładowych szablonów.
  const karty: [string, Szablon, Record<string, string>][] = [
    ['czar', szablonCzaru, daneCzaru],
    ['statystyki', szablonStatystyk, daneStatystyk],
    ['potwor', szablonWroga, daneWroga as Record<string, string>],
    [
      'ozdobna',
      ozdobna,
      {
        tytul: 'Smocza łuska',
        opis: 'Pancerz z łusek dawno pokonanego smoka. Chroni przed ogniem i zimnem.',
        sila: '7',
      },
    ],
    [
      'swobodna',
      swobodna,
      {
        ilustracja: OBRAZ_ZASTEPCZY,
        tytul: 'Ognisty smok',
        koszt: '3',
        typ: 'Stwór',
        opis: 'Zionie ogniem na wszystko przed sobą.',
      },
    ],
  ];
  for (const [id, s, dane] of karty) {
    const r = renderujKarte(s, { id: 'x', szablonId: s.id, ilosc: 1, dane } as never, ctx);
    zapisz(`karta-${id}.svg`, scenaDoSvg(r.scena, svgOpcje(`${id}-`)));
    console.log(id, r.scena.szer, r.scena.wys, JSON.stringify(r.ostrzezenia));
  }
});
