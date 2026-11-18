import { afterEach, describe, expect, it } from 'vitest';
import { ustawJezyk } from '../i18n';
import {
  KODY,
  komunikatyBrakujacychWariantow,
  tekstOstrzezenia,
  tekstOstrzezeniaArkusza,
} from './ostrzezenia';

afterEach(() => ustawJezyk('pl'));

describe('ostrzeżenia silnika i arkusza w obu językach', () => {
  for (const jezyk of ['pl', 'en'] as const) {
    it(`${jezyk}: każdy kod silnika ma pełne zdanie bez niepodstawionych parametrów`, () => {
      ustawJezyk(jezyk);
      for (const kod of Object.keys(KODY)) {
        const tekst = tekstOstrzezeniaArkusza({ komunikat: `${kod}:a:b` });
        expect(tekst, kod).not.toBe('');
        expect(tekst, kod).not.toMatch(/\{\w+\}/);
        expect(tekst, kod).not.toContain(kod);
      }
    });
  }

  it('to samo ostrzeżenie – inne zdanie w zależności od języka', () => {
    const o = { pole: 'tytul', komunikat: 'tekst-nie-miesci-sie' as const };
    expect(tekstOstrzezenia(o)).toBe(
      'pole „tytul”: tekst nie mieści się nawet w najmniejszym rozmiarze',
    );
    ustawJezyk('en');
    expect(tekstOstrzezenia(o)).toBe(
      'field “tytul”: the text does not fit even at the smallest size',
    );
  });

  it('nieznany kod pokazany surowo w obu językach', () => {
    ustawJezyk('en');
    expect(tekstOstrzezeniaArkusza({ komunikat: 'nowy-kod:x' })).toBe('nowy-kod:x');
  });

  it('brakujące warianty czcionek: komunikat zmienia język po przełączeniu', () => {
    const lista = [{ nazwa: 'tytul', wariant: 'pogrubiony' as const }];
    expect(komunikatyBrakujacychWariantow(lista)[0]).toContain('Tytuł');
    expect(komunikatyBrakujacychWariantow(lista)[0]).toContain('„pogrubiony”');
    ustawJezyk('en');
    expect(komunikatyBrakujacychWariantow(lista)[0]).toBe(
      'The font Title has no “bold” variant (e.g. bold from **…**) – the closest one was used.',
    );
  });
});
