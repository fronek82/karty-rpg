/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  eksportujProjekt,
  importujProjekt,
  eksportujSzablon,
  importujSzablon,
} from '../dane/archiwum';
import { nowyProjektZPrzykladu } from '../dane/wlasneKarty';
import { zbudujArkusz } from '../druk/arkusz';
import { czyJezyk, JEZYKI, t, ustawJezyk, type Jezyk } from '../i18n';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';
import { RejestrCzcionek } from '../silnik/czcionki';
import { renderujKarte } from '../silnik/karta';
import { scenaDoSvg } from '../silnik/svg';
import { czcionkaTestowa } from '../silnik/__testy__/pomoc';
import { zasobyProjektu } from '../ui/zasobyProjektu';
import { krokiPrzykladow, wczytajCzcionkiPrzykladow } from '../ui/start/podgladyPrzykladow';
import { KAFELKI_SZABLONOW, PRZYKLADY, PUSTA_KARTA } from './index';

afterEach(() => ustawJezyk('pl'));

/** Czcionki jak w projekcie własnych kart: EB Garamond pod obiema rolami. */
const rejestr = () =>
  new RejestrCzcionek()
    .dodaj('EB Garamond', 'normalny', czcionkaTestowa('EBGaramond-Regular.ttf'))
    .dodaj('EB Garamond', 'pogrubiony', czcionkaTestowa('EBGaramond-Bold.ttf'))
    .dodaj('EB Garamond', 'kursywa', czcionkaTestowa('EBGaramond-Italic.ttf'))
    .dodaj('EB Garamond', 'pogrubiona-kursywa', czcionkaTestowa('EBGaramond-BoldItalic.ttf'))
    .przypiszRole('tytul', 'EB Garamond')
    .przypiszRole('tresc', 'EB Garamond');

const czcionka = async (plik: string) => new Uint8Array(readFileSync(`public/czcionki/${plik}`));

/** Nazwy gier i systemów, których przykłady nie mogą zawierać (bez względu na wielkość liter). */
const ZAKAZANE = [
  'mausritter',
  'd&d',
  'dungeons',
  'dragons',
  'warhammer',
  'pierścień',
  'pierscien',
  'one ring',
  'pathfinder',
  'cthulhu',
  'wiedźmin',
  'witcher',
  'tolkien',
  'magic: the',
  'pokémon',
  'pokemon',
];

/** Wszystkie napisy z wartości zagnieżdżonego obiektu. */
function napisy(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(napisy);
  if (v && typeof v === 'object') return Object.values(v).flatMap(napisy);
  return [];
}

describe('katalog przykładów', () => {
  it('kafelki: jedna pusta karta i pięć przykładów o różnych id', () => {
    expect(PRZYKLADY).toHaveLength(5);
    expect(KAFELKI_SZABLONOW).toHaveLength(1 + PRZYKLADY.length);
    expect(KAFELKI_SZABLONOW[0]).toBe(PUSTA_KARTA);
    const idy = KAFELKI_SZABLONOW.map((o) => o.id);
    expect(new Set(idy).size).toBe(idy.length);
  });

  for (const j of JEZYKI) {
    describe(`język ${j}`, () => {
      for (const opis of KAFELKI_SZABLONOW) {
        it(`${opis.id}: ładuje się i renderuje bez ostrzeżeń, rozmiar zgodny z opisem`, async () => {
          ustawJezyk(j);
          const { szablon, dane } = await opis.laduj();
          expect(szablon.nazwa).toBe(t(`przyklad.${opis.id}.nazwa`));
          const r = renderujKarte(szablon, { dane }, { czcionki: rejestr() });
          expect(r.ostrzezenia, JSON.stringify(r.ostrzezenia)).toEqual([]);
          expect(r.scena.szer).toBeCloseTo(opis.rozmiar.szerokosc);
          expect(r.scena.wys).toBeCloseTo(opis.rozmiar.wysokosc);
          // Podgląd ma co pokazać: poza pustą kartą scena zawiera tekst.
          if (opis.id !== 'pusta') expect(scenaDoSvg(r.scena)).toContain('<path');
        });
      }
    });
  }

  it('nazwy mają wersje PL i EN, różne od siebie, niepuste', () => {
    for (const opis of KAFELKI_SZABLONOW) {
      const klucz = `przyklad.${opis.id}.nazwa` as const;
      expect(pl[klucz].trim().length).toBeGreaterThan(0);
      expect(en[klucz].trim().length).toBeGreaterThan(0);
      expect(pl[klucz]).not.toBe(en[klucz]);
    }
    expect(pl['przyklad.opis.nazwa']).toBe('Karta z opisem');
    expect(pl['przyklad.statystyki.nazwa']).toBe('Blok statystyk');
    expect(pl['przyklad.potwor.nazwa']).toBe('Karta potwora');
    expect(pl['przyklad.ozdobna.nazwa']).toBe('Karta ozdobna');
    expect(pl['przyklad.swobodna.nazwa']).toBe('Karta swobodna');
    expect(pl['przyklad.pusta.nazwa']).toBe('Pusta karta');
  });

  it('klucze przykładów: te same w PL i EN, jedna nazwa na kafelek', () => {
    const klucze = (s: Record<string, string>) =>
      Object.keys(s).filter((k) => k.startsWith('przyklad.') || k.startsWith('wlasne.'));
    expect(klucze(en).sort()).toEqual(klucze(pl).sort());
  });

  it('żadnych nazw gier ani systemów w tekstach przykładów (szablony, dane, tłumaczenia)', async () => {
    const teksty: string[] = [];
    for (const j of JEZYKI) {
      ustawJezyk(j);
      for (const opis of KAFELKI_SZABLONOW) teksty.push(...napisy(await opis.laduj()));
      const slownik = j === 'pl' ? pl : en;
      teksty.push(
        ...Object.entries(slownik)
          .filter(([k]) => k.startsWith('przyklad.') || k.startsWith('wlasne.'))
          .map(([, v]) => v),
      );
    }
    expect(teksty.length).toBeGreaterThan(50);
    for (const tekst of teksty)
      for (const zakazane of ZAKAZANE)
        expect(tekst.toLowerCase(), `„${tekst}” zawiera „${zakazane}”`).not.toContain(zakazane);
  });

  it('przykład ozdobny używa tylko elementów wbudowanych (bez zasobów i własnych SVG)', async () => {
    const { szablon } = await PRZYKLADY.find((o) => o.id === 'ozdobna')!.laduj();
    const json = JSON.stringify(szablon);
    expect(json).not.toContain('"wl:');
    expect(json).not.toContain('"zasob"');
    for (const [, id] of json.matchAll(/"(?:element|ksztaltElement)":"([^"]+)"/g))
      expect(id, id).toMatch(/^wb:/);
  });
});

describe('nowy projekt z przykładu', () => {
  for (const opis of KAFELKI_SZABLONOW) {
    it(`${opis.id}: szablon, jedna karta z danymi i kartka dopasowana do rozmiaru`, async () => {
      ustawJezyk('pl');
      const przyklad = await opis.laduj();
      const { projekt, zasoby } = await nowyProjektZPrzykladu(przyklad, czcionka, `p-${opis.id}`);
      expect(projekt.nazwa).toBe(t(`przyklad.${opis.id}.nazwa`));
      expect(projekt.szablony).toHaveLength(1);
      expect(projekt.arkusze).toHaveLength(1);
      const a = projekt.arkusze[0]!;
      const talia = projekt.talie.find((x) => x.id === a.taliaId)!;
      expect(talia.karty).toHaveLength(1);
      expect(talia.karty[0]!.dane).toEqual(przyklad.dane);
      expect(a.przypiete).toHaveLength(1);
      expect(a.ustawienia.slot).toEqual({
        szerokosc: opis.rozmiar.szerokosc,
        wysokosc: opis.rozmiar.wysokosc,
      });
      // Kartka układa się bez ostrzeżeń, a plik projektu przechodzi schemat (zapis i odczyt).
      const { zasoby: z } = { zasoby: zasobyProjektu(projekt, zasoby) };
      const w = zbudujArkusz(a, talia, {
        czcionki: z.zasoby.czcionki,
        szablony: z.zasoby.szablony,
      });
      expect(w.ostrzezenia).toEqual([]);
      expect(w.rozmieszczenie.karty).toHaveLength(1);
      expect(importujProjekt(eksportujProjekt(projekt, zasoby)).projekt).toEqual(projekt);
      // Szablon da się też wyeksportować i wczytać (neutralny plik szablonu).
      const plik = eksportujSzablon(projekt, zasoby, projekt.szablony[0]!.id);
      expect(importujSzablon(plik.bajty).szablon.nazwa).toBe(projekt.nazwa);
    });
  }

  it('język projektu: dane i nazwy powstają w języku z chwili utworzenia', async () => {
    const opis = PRZYKLADY[0]!;
    ustawJezyk('en');
    const { projekt } = await nowyProjektZPrzykladu(await opis.laduj(), czcionka, 'p-en');
    expect(projekt.nazwa).toBe('Card with a description');
    expect(projekt.talie[0]!.karty[0]!.dane.nazwa).toBe('First card');
  });
});

describe('podgląd zgodny z silnikiem', () => {
  for (const j of JEZYKI as readonly Jezyk[]) {
    it(`SVG podglądu = SVG karty z nowego projektu (${j})`, async () => {
      expect(czyJezyk(j)).toBe(true);
      ustawJezyk(j);
      const zasobyPodgladu = await wczytajCzcionkiPrzykladow(
        (plik) => plik,
        async (adres) => czcionka(adres),
      );
      const przyklady = await Promise.all(
        KAFELKI_SZABLONOW.map(async (o) => ({ id: o.id, przyklad: await o.laduj() })),
      );
      const kroki = krokiPrzykladow(przyklady, zasobyPodgladu);
      expect(kroki.map((k) => k.id)).toEqual(KAFELKI_SZABLONOW.map((o) => o.id));
      for (const [indeks, opis] of KAFELKI_SZABLONOW.entries()) {
        const podglad = kroki[indeks]!.licz();
        expect(podglad.ostrzezenia).toEqual([]);
        expect(podglad.strony).toHaveLength(1);
        // Ta sama karta z prawdziwego nowego projektu, liczona tym samym silnikiem.
        const { projekt, zasoby } = await nowyProjektZPrzykladu(
          przyklady[indeks]!.przyklad,
          czcionka,
          `zg-${opis.id}`,
        );
        const z = zasobyProjektu(projekt, zasoby).zasoby;
        const karta = projekt.talie[0]!.karty[0]!;
        const r = renderujKarte(projekt.szablony[0]!, karta, {
          czcionki: z.czcionki,
          elementy: undefined,
        });
        const svg = scenaDoSvg(r.scena, {
          przedrostekId: `pr${indeks}-`,
          atrybuty: { 'aria-hidden': 'true', focusable: 'false' },
        });
        expect(podglad.strony[0]!.svg).toBe(svg);
        expect(podglad.strony[0]!.szerokosc).toBe(r.scena.szer);
      }
    });
  }

  it('identyfikatory SVG podglądów nie powtarzają się między kafelkami', async () => {
    ustawJezyk('pl');
    const zasoby = await wczytajCzcionkiPrzykladow(
      (p) => p,
      async (a) => czcionka(a),
    );
    const przyklady = await Promise.all(
      KAFELKI_SZABLONOW.map(async (o) => ({ id: o.id, przyklad: await o.laduj() })),
    );
    const ids = krokiPrzykladow(przyklady, zasoby).flatMap((k) =>
      [...k.licz().strony[0]!.svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
