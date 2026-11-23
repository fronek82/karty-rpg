import { afterEach, describe, expect, it } from 'vitest';
import { tJesliJest, ustawJezyk } from '../i18n';
import { pakietMausritter } from '../pakiety/mausritter';
import {
  nazwaRozmiaru,
  nazwaTypu,
  nazwaUkladu,
  nazwaWariantu,
  nazwaGryDo,
} from './nazwyPakietu';
import { gry } from '../pakiety/gry';

afterEach(() => ustawJezyk('pl'));

describe('nazwy pakietu w obu językach', () => {
  const typy = pakietMausritter.typyKart;

  it('po polsku zgodne z danymi pakietu', () => {
    for (const typ of typy) {
      expect(nazwaTypu(typ)).toBe(typ.nazwa);
      for (const w of typ.warianty) expect(nazwaWariantu(w)).toBe(w.nazwa);
      for (const r of typ.rozmiary) expect(nazwaRozmiaru(r)).toBe(r.nazwa);
    }
    for (const u of pakietMausritter.gotoweUklady) expect(nazwaUkladu(u)).toBe(u.nazwa);
    for (const g of gry) expect(nazwaGryDo(g)).toBe(g.nazwaDo);
  });

  it('każda nazwa ma tłumaczenie angielskie (inne niż polskie albo identyczne z założenia)', () => {
    ustawJezyk('en');
    const brak: string[] = [];
    const sprawdz = (klucz: string) => tJesliJest(klucz) ?? brak.push(klucz);
    for (const typ of typy) {
      sprawdz(`pakiet.typ.${typ.id}`);
      for (const w of typ.warianty) sprawdz(`pakiet.wariant.${w.szablonId}`);
      for (const r of typ.rozmiary) if (r.nazwa) sprawdz(`pakiet.rozmiar.${r.id}`);
    }
    for (const u of pakietMausritter.gotoweUklady) sprawdz(`pakiet.uklad.${u.id}`);
    for (const a of pakietMausritter.arkusze) sprawdz(`pakiet.arkusz.${a.id}`);
    for (const s of pakietMausritter.szablony) sprawdz(`pakiet.wariant.${s.id}`);
    expect(brak).toEqual([]);
    expect(nazwaTypu(typy[0]!)).toBe('Weapon');
    expect(nazwaRozmiaru({ id: 'ciezka', nazwa: 'ciężka' })).toBe('heavy');
    expect(nazwaUkladu({ id: 'wszystkie', nazwa: 'Wszystkie trzy' })).toBe('All three');
  });

  it('brak tłumaczenia – nazwa z danych', () => {
    ustawJezyk('en');
    expect(nazwaTypu({ id: 'xyz', nazwa: 'Własny' })).toBe('Własny');
  });
});
