import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  ACCEPT_IMPORTU,
  rodzajPoNazwie,
  rodzajPoZawartosci,
  rozpoznajRodzaj,
} from './importPlikow';

const zip = (...nazwy: string[]) =>
  zipSync(Object.fromEntries(nazwy.map((n) => [n, strToU8('{}')])), { level: 0 });

describe('rodzajPoNazwie', () => {
  it('rozpoznaje projekt, szablon i zip po rozszerzeniu', () => {
    expect(rodzajPoNazwie('moje.kartyrpg')).toBe('projekt');
    expect(rodzajPoNazwie('moje.kartyrpg-szablon')).toBe('szablon');
    expect(rodzajPoNazwie('kopia.zip')).toBe('zip');
  });

  it('ignoruje wielkość liter i spacje na końcu', () => {
    expect(rodzajPoNazwie('MOJE.KARTYRPG')).toBe('projekt');
    expect(rodzajPoNazwie('Czar.KartyRPG-Szablon ')).toBe('szablon');
  });

  it('szablon nie jest mylony z projektem (dłuższe rozszerzenie ma pierwszeństwo)', () => {
    expect(rodzajPoNazwie('a.kartyrpg-szablon')).toBe('szablon');
    expect(rodzajPoNazwie('a.kartyrpg.zip')).toBe('zip');
  });

  it('inne pliki są nieobsługiwane', () => {
    expect(rodzajPoNazwie('notatki.txt')).toBeUndefined();
    expect(rodzajPoNazwie('kartyrpg')).toBeUndefined();
    expect(rodzajPoNazwie('')).toBeUndefined();
  });
});

describe('rodzajPoZawartosci', () => {
  it('szablon.json → szablon, projekt.json → projekt', () => {
    expect(rodzajPoZawartosci(zip('szablon.json'))).toBe('szablon');
    expect(rodzajPoZawartosci(zip('projekt.json', 'zasoby/a.png'))).toBe('projekt');
  });

  it('archiwum bez pliku projektu lub szablonu i nie-ZIP → undefined', () => {
    expect(rodzajPoZawartosci(zip('cos.txt'))).toBeUndefined();
    expect(rodzajPoZawartosci(strToU8('to nie jest zip'))).toBeUndefined();
  });
});

describe('rozpoznajRodzaj', () => {
  it('dla .zip decyduje zawartość, dla pozostałych rozszerzenie', () => {
    expect(rozpoznajRodzaj('a.zip', zip('szablon.json'))).toBe('szablon');
    expect(rozpoznajRodzaj('a.zip', zip('projekt.json'))).toBe('projekt');
    expect(rozpoznajRodzaj('a.zip', zip('x.txt'))).toBeUndefined();
    expect(rozpoznajRodzaj('a.kartyrpg', strToU8('cokolwiek'))).toBe('projekt');
    expect(rozpoznajRodzaj('a.txt', zip('projekt.json'))).toBeUndefined();
  });

  it('accept pola plików zawiera oba rozszerzenia i zip', () => {
    expect(ACCEPT_IMPORTU.split(',')).toEqual(['.kartyrpg', '.kartyrpg-szablon', '.zip']);
  });
});
