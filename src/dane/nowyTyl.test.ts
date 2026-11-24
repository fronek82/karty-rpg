import { describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU } from '../model/projekt';
import { migruj, schematRewersu } from './schemat';
import { nowyTyl, UKLADY_TYLU } from './rewers';

const ustawienia = { nazwa: 'Tył', szer: 63, wys: 88, promien: 3, tlo: '#1e293b' };

describe('nowyTyl – układy tyłu z kreatora', () => {
  it('każdy układ daje poprawny rewers z rozmiarem, rogami i kolorem', () => {
    for (const uklad of UKLADY_TYLU) {
      const r = nowyTyl('tyl', { ...ustawienia, uklad }, 'Grafika');
      expect(schematRewersu.safeParse(r).success, uklad).toBe(true);
      expect(r.rozmiar).toEqual({ tryb: 'mm', szerokosc: 63, wysokosc: 88 });
      expect(r.promienRogow).toBe(3);
      expect(r.tlo).toBe('#1e293b');
    }
  });

  it('pusta karta bez elementów; logo – grafika na środku; wzór i ramka z ornamentem', () => {
    expect(nowyTyl('t', { ...ustawienia, uklad: 'pusty' }, 'G').korzen.dzieci).toEqual([]);
    const logo = nowyTyl('t', { ...ustawienia, uklad: 'logo' }, 'Logo').korzen.dzieci[0]!;
    expect(logo).toMatchObject({ typ: 'obraz', nazwa: 'Logo', pozycja: { kotwica: 'srodek' } });
    // Ciemne tło – jasny wzór.
    expect(nowyTyl('t', { ...ustawienia, uklad: 'wzor' }, 'G').wzorTla?.kolor).toBe('#ffffff');
    const ornament = nowyTyl('t', { ...ustawienia, uklad: 'ornament' }, 'G');
    expect(ornament.ramka?.ozdoba).toBeDefined();
    expect(ornament.ramka?.narozniki).toBeDefined();
    expect(ornament.ramka?.odsuniecie).toBe(3);
  });
});

describe('projekt sprzed schematu 31', () => {
  it('migracja 30→31 nie zmienia tyłów (bez rogów – rogi jak przód)', () => {
    const tyl = nowyTyl('t', { ...ustawienia, uklad: 'wzor' }, 'G');
    delete tyl.promienRogow;
    const stary = { wersja: 30, rewersy: [tyl] };
    const nowy = migruj(stary) as { wersja: number; rewersy: unknown[] };
    expect(nowy.wersja).toBe(WERSJA_SCHEMATU);
    expect(nowy.rewersy).toEqual([tyl]);
  });
});
