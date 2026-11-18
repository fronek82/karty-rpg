import { describe, expect, it } from 'vitest';
import { KLUCZ_JEZYKA, KLUCZ_MOTYWU } from '../wspolne/ustawienia';
import { KLUCZ_JEZYKA as JEZYK_APLIKACJI } from '../i18n';
import { KLUCZ_MOTYWU as MOTYW_APLIKACJI } from '../ui/motyw';
import { wybierzJezyk, wybierzMotyw } from './wybor';

describe('wybór języka instrukcji (D8)', () => {
  it('?lang= wygrywa z zapamiętanym wyborem i z przeglądarką', () => {
    expect(wybierzJezyk('?lang=en', 'pl', 'pl-PL')).toBe('en');
    expect(wybierzJezyk('?lang=pl', 'en', 'en-US')).toBe('pl');
    expect(wybierzJezyk('?a=1&lang=en', null, 'pl')).toBe('en');
  });

  it('błędne ?lang= jest pomijane, wtedy zapamiętany wybór', () => {
    expect(wybierzJezyk('?lang=de', 'en', 'pl')).toBe('en');
    expect(wybierzJezyk('?lang=', 'pl', 'en')).toBe('pl');
  });

  it('bez adresu i zapisu: pl → PL, reszta EN', () => {
    expect(wybierzJezyk('', null, 'pl-PL')).toBe('pl');
    expect(wybierzJezyk('', null, 'pl')).toBe('pl');
    expect(wybierzJezyk('', null, 'en-GB')).toBe('en');
    expect(wybierzJezyk('', null, 'de-DE')).toBe('en');
    expect(wybierzJezyk('', null, undefined)).toBe('en');
    expect(wybierzJezyk('', 'xx', 'pl')).toBe('pl');
  });
});

describe('wybór motywu instrukcji', () => {
  it('jawny wybór wygrywa, „system” i brak wpisu idą za systemem', () => {
    expect(wybierzMotyw('dark', false)).toBe('dark');
    expect(wybierzMotyw('light', true)).toBe('light');
    expect(wybierzMotyw('system', true)).toBe('dark');
    expect(wybierzMotyw(null, false)).toBe('light');
    expect(wybierzMotyw('cokolwiek', true)).toBe('dark');
  });
});

describe('klucze localStorage wspólne z aplikacją', () => {
  it('instrukcja i aplikacja używają tych samych kluczy', () => {
    expect(JEZYK_APLIKACJI).toBe(KLUCZ_JEZYKA);
    expect(MOTYW_APLIKACJI).toBe(KLUCZ_MOTYWU);
    expect(KLUCZ_JEZYKA).toBe('karty.jezyk');
    expect(KLUCZ_MOTYWU).toBe('karty.motyw');
  });
});
