/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { zbudujArkusz } from '../druk/arkusz';
import { scenyDoPdf } from '../druk/pdf';
import { wymiaryStrony } from '../model/arkusz';
import { pakietMausritter } from '../pakiety/mausritter';
import {
  daneCzaru,
  szablonCzaru,
  szablonStatystyk,
  szablonWroga,
} from '../silnik/__testy__/przyklady';
import { eksportujSzablon, importujProjekt, eksportujProjekt, importujSzablon } from './archiwum';
import { dodajKarteWSlocie, ustawDaneKart } from './kartka';
import { rejestrZProjektu } from './pakiet';
import {
  dodajSzablonZKartka,
  kartkaDlaSzablonu,
  nowyProjektWlasny,
  pakietWlasny,
  pasujeDoSlotu,
  PAKIET_WLASNY,
  slotyNaStronie,
  typyZSzablonow,
  ustawieniaKartkiDla,
  zmienRozmiarSzablonu,
} from './wlasneKarty';

const czcionka = async (plik: string) => new Uint8Array(readFileSync(`public/czcionki/${plik}`));
const paczka = (s = szablonCzaru) => ({ szablon: s, role: {}, zasoby: [], dane: new Map() });

describe('kartka dla szablonu', () => {
  it('karta pionowa 63×88 na A4: pionowo 3×3, slot = wymiar karty, bez tytułu', () => {
    const u = ustawieniaKartkiDla(szablonCzaru);
    expect(u.orientacja).toBe('pionowa');
    expect(u.slot).toEqual({ szerokosc: 63, wysokosc: 88 });
    expect(slotyNaStronie(u, u.slot!)).toMatchObject({ kolumny: 3, rzedy: 3, razem: 9 });
    expect(u.tytul?.tekst).toBe('');
  });

  it('karta pozioma 88×63: orientacja z większą liczbą kart (poziomo 3×3)', () => {
    const u = ustawieniaKartkiDla(szablonStatystyk);
    expect(u.orientacja).toBe('pozioma');
    expect(slotyNaStronie(u, u.slot!).razem).toBe(9);
  });

  it('format zdjęciowy: marginesy i strefa bezpieczeństwa 3 mm; własny papier', () => {
    const u = ustawieniaKartkiDla(szablonCzaru, 'foto-10x15');
    expect(u.marginesBezpieczenstwa).toBe(3);
    expect(u.marginesy.lewo).toBe(3);
    expect(wymiaryStrony(u)).toEqual({ szer: 152, wys: 102 }); // poziomo mieszczą się 2 karty
    const w = ustawieniaKartkiDla(szablonCzaru, 'wlasny', { szer: 140, wys: 200 });
    expect(wymiaryStrony(w)).toEqual({ szer: 140, wys: 200 });
  });

  it('typy kart z szablonów i dopasowanie rozmiaru do kartki', () => {
    const typy = typyZSzablonow([szablonCzaru, ...pakietMausritter.szablony.slice(0, 1)]);
    expect(typy[0]).toMatchObject({
      id: 'test-czar',
      nazwa: 'Czar (test)',
      rozmiary: [{ kolumny: 1, rzedy: 1 }],
      warianty: [{ szablonId: 'test-czar' }],
    });
    expect(typy[1]!.rozmiary.length).toBeGreaterThanOrEqual(1);
    const u = ustawieniaKartkiDla(szablonCzaru);
    expect(pasujeDoSlotu(szablonWroga, u.slot!)).toBe(true); // też 63×88
    expect(pasujeDoSlotu(szablonStatystyk, u.slot!)).toBe(false);
    expect(typy[0]!.opisRozmiaru).toBe('63×88 mm');
    // Szablon w slotach: rozmiar domyślny i warianty bez powtórzeń, opis – wymiar karty.
    const bron = pakietMausritter.szablony.find((x) => x.id === 'mausritter-bron')!;
    const [t] = typyZSzablonow([
      { ...bron, warianty: [...(bron.warianty ?? []), ...(bron.warianty ?? [])] },
    ]);
    expect(new Set(t!.rozmiary.map((r) => `${r.kolumny}×${r.rzedy}`)).size).toBe(
      t!.rozmiary.length,
    );
    expect(t!.opisRozmiaru).toBe('25,8×25,8 mm');
    // Pakiet „w locie” bez szablonów – kartka 63×88.
    expect(pakietWlasny([]).nowaKartka.ustawienia.slot).toEqual({ szerokosc: 63, wysokosc: 88 });
  });
});

describe('projekt własnych kart', () => {
  it('z szablonu: czcionki domyślne, kartka, karty w mm na kartce, PDF', async () => {
    const { projekt, zasoby } = await nowyProjektWlasny(paczka(), czcionka, 'w1');
    expect(projekt.pakiet).toBe(PAKIET_WLASNY);
    expect(projekt.role).toEqual({ tytul: 'EB Garamond', tresc: 'EB Garamond' });
    expect(projekt.szablony.map((s) => s.id)).toEqual(['test-czar']);
    expect(projekt.arkusze).toHaveLength(1);
    const a = projekt.arkusze[0]!;
    const ctx = {
      szablony: new Map(projekt.szablony.map((s) => [s.id, s])),
      siatka: { kolumny: 3, rzedy: 3 },
    };
    let p = projekt;
    const ids: string[] = [];
    for (const kolumna of [0, 1, 2]) {
      const w = dodajKarteWSlocie(
        p,
        a.id,
        { strona: 0, kolumna, rzad: 0 },
        { szablonId: 'test-czar', rozmiary: [{ kolumny: 1, rzedy: 1 }] },
        ctx,
      );
      if ('blad' in w) throw new Error(w.blad);
      p = w.projekt;
      ids.push(w.kartaId);
    }
    for (const [k, v] of Object.entries(daneCzaru)) p = ustawDaneKart(p, a.id, ids, k, v);
    const { rejestr, ostrzezenia } = rejestrZProjektu(p, zasoby);
    expect(ostrzezenia).toEqual([]);
    const arkusz = p.arkusze[0]!;
    const wynik = zbudujArkusz(
      arkusz,
      p.talie.find((t) => t.id === arkusz.taliaId)!,
      {
        czcionki: rejestr,
        szablony: ctx.szablony,
      },
    );
    expect(wynik.ostrzezenia).toEqual([]);
    expect(wynik.siatka).toMatchObject({ kolumny: 3, rzedy: 3 });
    expect(wynik.rozmieszczenie.karty).toHaveLength(3);
    const { bajty } = await scenyDoPdf(wynik.strony);
    expect(bajty.length).toBeGreaterThan(1000);
    // Zapis i odczyt pliku projektu.
    expect(importujProjekt(eksportujProjekt(p, zasoby)).projekt).toEqual(p);
  });

  it('import szablonu innego rozmiaru dokłada kartkę; tego samego – nie', async () => {
    const { projekt, zasoby } = await nowyProjektWlasny(paczka(), czcionka, 'w2');
    const ten = dodajSzablonZKartka(projekt, zasoby, paczka(szablonWroga));
    expect(ten.projekt.arkusze).toHaveLength(1);
    const inny = dodajSzablonZKartka(ten.projekt, ten.zasoby, paczka(szablonStatystyk));
    expect(inny.projekt.arkusze).toHaveLength(2);
    expect(inny.projekt.arkusze[1]).toMatchObject({ nazwa: 'Blok statystyk (test)' });
    expect(inny.projekt.arkusze[1]!.ustawienia.slot).toEqual({ szerokosc: 88, wysokosc: 63 });
  });

  it('role czcionek szablonu mają pierwszeństwo przed domyślnymi; brakujące – domyślne', async () => {
    const w = await nowyProjektWlasny(
      { ...paczka(), role: { tytul: 'Grenze Gotisch' } },
      czcionka,
      'w6',
    );
    expect(w.projekt.role).toEqual({ tytul: 'Grenze Gotisch', tresc: 'EB Garamond' });
    expect(w.ostrzezenia).toEqual([]);
  });

  it('kartka bez slotu w ustawieniach: rozmiar z jej kart; dwa razy ten sam plik – nowe id', async () => {
    const { projekt, zasoby } = await nowyProjektWlasny(paczka(), czcionka, 'w7');
    const bezSlotu = {
      ...projekt,
      arkusze: projekt.arkusze.map((a) => {
        const { slot: _s, ...u } = a.ustawienia;
        void _s;
        return { ...a, ustawienia: u };
      }),
      talie: projekt.talie.map((t) => ({
        ...t,
        karty: [{ id: 'k1', szablonId: 'test-czar', dane: {}, ilosc: 1 }],
      })),
    };
    expect(dodajSzablonZKartka(bezSlotu, zasoby, paczka(szablonWroga)).nowaKartka).toBe(false);
    expect(dodajSzablonZKartka(bezSlotu, zasoby, paczka(szablonStatystyk)).nowaKartka).toBe(true);
    const dwa = dodajSzablonZKartka(projekt, zasoby, paczka());
    expect(dwa.szablonId).not.toBe('test-czar');
    expect(dwa.projekt.szablony).toHaveLength(2);
    expect(dwa.nowaKartka).toBe(false);
  });

  it('import do projektu bez pakietu oznacza go jako własne karty', async () => {
    const { projekt, zasoby } = await nowyProjektWlasny(paczka(), czcionka, 'w8');
    const bez = { ...projekt };
    delete bez.pakiet;
    expect(dodajSzablonZKartka(bez, zasoby, paczka(szablonWroga)).projekt.pakiet).toBe(
      PAKIET_WLASNY,
    );
  });

  it('eksport szablonu z projektu i import do nowego projektu', async () => {
    const { projekt, zasoby } = await nowyProjektWlasny(paczka(), czcionka, 'w3');
    const { bajty } = eksportujSzablon(projekt, zasoby, 'test-czar');
    const nowy = await nowyProjektWlasny(importujSzablon(bajty), czcionka, 'w4');
    expect(nowy.projekt.szablony[0]).toEqual(projekt.szablony[0]);
  });
});

describe('arkusz: karty w mm i strefa bezpieczeństwa', () => {
  it('karta innego rozmiaru niż slot i karta w strefie przycięcia dają ostrzeżenia', async () => {
    const { projekt, zasoby } = await nowyProjektWlasny(paczka(), czcionka, 'w5');
    const szablony = new Map([szablonCzaru, szablonStatystyk].map((s) => [s.id, s] as const));
    const { rejestr } = rejestrZProjektu(projekt, zasoby);
    const talia = {
      id: 't',
      nazwa: 't',
      karty: [
        { id: 'a', szablonId: 'test-czar', dane: {}, ilosc: 1 },
        { id: 'b', szablonId: 'test-statystyki', dane: {}, ilosc: 1 },
      ],
    };
    const u = {
      ...ustawieniaKartkiDla(szablonCzaru, 'foto-13x18'),
      marginesy: { gora: 1, prawo: 1, dol: 1, lewo: 1 },
    };
    const w = zbudujArkusz({ id: 'x', nazwa: 'x', taliaId: 't', ustawienia: u }, talia, {
      czcionki: rejestr,
      szablony,
    });
    expect(w.ostrzezenia).toContainEqual({ kartaId: 'b', komunikat: 'karta-inny-rozmiar' });
    expect(w.ostrzezenia).toContainEqual({ kartaId: 'a', komunikat: 'karta-w-strefie-przyciecia' });
    // Z marginesami 3 mm (domyślnie dla zdjęć) karta mieści się poza strefą.
    const ok = zbudujArkusz(
      {
        id: 'x',
        nazwa: 'x',
        taliaId: 't',
        ustawienia: ustawieniaKartkiDla(szablonCzaru, 'foto-13x18'),
      },
      { ...talia, karty: [talia.karty[0]!] },
      { czcionki: rejestr, szablony },
    );
    expect(ok.ostrzezenia.filter((o) => o.komunikat === 'karta-w-strefie-przyciecia')).toEqual([]);
  });
});

describe('rozmiar szablonu i kartka dla szablonu', () => {
  it('zmiana rozmiaru: kartka szablonu dostaje nowy slot i lepszą orientację; za duża – odrzucona', async () => {
    const { projekt } = await nowyProjektWlasny(paczka(), czcionka, 'r1');
    const w = zmienRozmiarSzablonu(projekt, 'test-czar', 88, 63);
    expect(w.szablony[0]!.rozmiar).toEqual({ tryb: 'mm', szerokosc: 88, wysokosc: 63 });
    expect(w.arkusze[0]!.ustawienia.slot).toEqual({ szerokosc: 88, wysokosc: 63 });
    expect(w.arkusze[0]!.ustawienia.orientacja).toBe('pozioma');
    expect(zmienRozmiarSzablonu(projekt, 'test-czar', 290, 290)).toBe(projekt);
  });

  it('kartka dla szablonu: istniejąca tego rozmiaru albo nowa bez tytułu', async () => {
    const { projekt, zasoby } = await nowyProjektWlasny(paczka(), czcionka, 'r2');
    expect(kartkaDlaSzablonu(projekt, 'test-czar')).toEqual({
      projekt,
      arkuszId: projekt.arkusze[0]!.id,
    });
    const z = dodajSzablonZKartka(projekt, zasoby, paczka(szablonStatystyk));
    const bez = { ...z.projekt, arkusze: z.projekt.arkusze.slice(0, 1) };
    const n = kartkaDlaSzablonu(bez, 'test-statystyki');
    expect(n.projekt.arkusze).toHaveLength(2);
    expect(n.projekt.arkusze[1]!.ustawienia.tytul?.tekst).toBe('');
  });
});
