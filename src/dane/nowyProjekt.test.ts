/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { ustawJezyk } from '../i18n';
import { czyKartkaZnormalizowana } from '../druk/normalizacja';
import { pakietMausritter } from '../pakiety/mausritter';
import { nowyProjektGry, zastosujGotowyUklad } from './nowyProjekt';
import { rejestrZProjektu } from './pakiet';
import { przygotujProjekt } from './schemat';

const czytaj = async (plik: string) => new Uint8Array(readFileSync(plik));
const pobierz = [
  (f: string) => czytaj(`public/czcionki/${f}`),
  () => czytaj('src/pakiety/mausritter/obrazy/zastepczy.png'),
] as const;

describe('nowy projekt gry', () => {
  afterEach(() => ustawJezyk('pl'));

  it('pusta kartka: jedna kartka bez kart, pakiet zapisany', async () => {
    const { projekt } = await nowyProjektGry(pakietMausritter, ...pobierz, { id: 'n' });
    expect(projekt.arkusze).toHaveLength(1);
    expect(projekt.talie[0]!.karty).toEqual([]);
    expect(projekt.pakiet).toBe('mausritter');
    expect(czyKartkaZnormalizowana(projekt)).toBe(true);
    expect(() => przygotujProjekt(projekt)).not.toThrow();
  });

  it('gotowy układ: tylko wybrane arkusze, karty przypięte', async () => {
    const { projekt } = await nowyProjektGry(pakietMausritter, ...pobierz, { uklad: 'stany' });
    expect(projekt.arkusze.map((a) => a.id)).toEqual(['mausritter-arkusz-stany']);
    expect(projekt.talie).toHaveLength(1);
    expect(czyKartkaZnormalizowana(projekt)).toBe(true);
    expect(projekt.arkusze[0]!.naglowki!.length).toBeGreaterThan(3);
    const wszystkie = await nowyProjektGry(pakietMausritter, ...pobierz, { uklad: 'wszystkie' });
    expect(wszystkie.projekt.arkusze).toHaveLength(3);
    await expect(
      nowyProjektGry(pakietMausritter, ...pobierz, { uklad: 'nie-ma' }),
    ).rejects.toThrow();
  });

  it('nazwy powstają w języku z chwili utworzenia (pl jak dane pakietu, en przetłumaczone)', async () => {
    const pol = await nowyProjektGry(pakietMausritter, ...pobierz, { uklad: 'bron' });
    expect(pol.projekt.nazwa).toBe('Broń i pancerze');
    expect(pol.projekt.arkusze[0]!.nazwa).toBe('Karty broni i pancerzy');
    expect(pol.projekt.arkusze[0]!.ustawienia.tytul!.tekst).toBe('Karty broni i pancerzy');
    expect(pol.projekt.szablony.map((x) => x.nazwa)).toContain('Zbroja');

    ustawJezyk('en');
    const ang = await nowyProjektGry(pakietMausritter, ...pobierz, { uklad: 'bron' });
    expect(ang.projekt.nazwa).toBe('Weapons and armor');
    expect(ang.projekt.arkusze[0]!.nazwa).toBe('Weapon and armor cards');
    expect(ang.projekt.arkusze[0]!.ustawienia.tytul!.tekst).toBe('Weapon and armor cards');
    expect(ang.projekt.talie[0]!.nazwa).toBe('Weapon and armor cards');
    expect(ang.projekt.szablony.map((x) => x.nazwa)).toContain('Armor');
    const pusta = await nowyProjektGry(pakietMausritter, ...pobierz, { id: 'n' });
    expect(pusta.projekt.nazwa).toBe('My cards');
    expect(pusta.projekt.arkusze[0]!.ustawienia.tytul!.tekst).toBe('My cards');
    expect(() => przygotujProjekt(pusta.projekt)).not.toThrow();
  });

  it('nagłówki grup i etykieta „Usunięcie:” drukowane na kartce – w języku z chwili utworzenia', async () => {
    const pol = await nowyProjektGry(pakietMausritter, ...pobierz, { uklad: 'stany' });
    const naglPl = pol.projekt.arkusze[0]!.naglowki!.map((n) => n.naglowek);
    expect(naglPl).toContain('Przerażona');
    expect(naglPl).toContain('Własne stany');
    const stan = (p: typeof pol.projekt) => p.szablony.find((x) => x.id === 'mausritter-stan')!;
    expect(stan(pol.projekt).parametry![0]!.domyslnie).toBe('Usunięcie:');

    ustawJezyk('en');
    const ang = await nowyProjektGry(pakietMausritter, ...pobierz, { uklad: 'stany' });
    const nagl = ang.projekt.arkusze[0]!.naglowki!;
    expect(nagl.map((n) => n.naglowek)).toContain('Frightened');
    expect(nagl.map((n) => n.naglowek)).toContain('Custom conditions');
    expect(nagl.every((n) => !n.opis || !/[ąćęłńóśźż]/i.test(n.opis))).toBe(true);
    expect(stan(ang.projekt).parametry![0]!.domyslnie).toBe('Removal:');
    expect(() => przygotujProjekt(ang.projekt)).not.toThrow();
  });

  it('komunikat schematu o wymiarach własnego papieru powstaje w języku z chwili błędu', async () => {
    const { projekt } = await nowyProjektGry(pakietMausritter, ...pobierz, { id: 'n' });
    const zly = structuredClone(projekt);
    zly.arkusze[0]!.ustawienia.papier = 'wlasny';
    delete zly.arkusze[0]!.ustawienia.wymiaryPapieru;
    expect(() => przygotujProjekt(zly)).toThrow('własny papier wymaga wymiarów');
    ustawJezyk('en');
    expect(() => przygotujProjekt(zly)).toThrow('custom paper needs dimensions');
    ustawJezyk('pl');
    expect(() => przygotujProjekt(zly)).toThrow('własny papier wymaga wymiarów');
  });

  it('zastosujGotowyUklad zachowuje id projektu i podmienia arkusze na wybrany układ', async () => {
    const { projekt, zasoby } = await nowyProjektGry(pakietMausritter, ...pobierz, { id: 'p1' });
    const { rejestr } = rejestrZProjektu(projekt, zasoby);
    const obrazy = new Map(pakietMausritter.zasoby.map((z) => [z.id, z]));
    const zUkladem = zastosujGotowyUklad(projekt, pakietMausritter, 'wszystkie', {
      czcionki: rejestr,
      obraz: (id) => obrazy.get(id),
    });
    expect(zUkladem.id).toBe('p1');
    expect(zUkladem.utworzono).toBe(projekt.utworzono);
    expect(zUkladem.nazwa).toBe('Wszystkie trzy');
    expect(zUkladem.arkusze).toHaveLength(3);
    expect(czyKartkaZnormalizowana(zUkladem)).toBe(true);
    expect(() => przygotujProjekt(zUkladem)).not.toThrow();
  });
});
