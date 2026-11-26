import { describe, expect, it, vi } from 'vitest';
import { graniceGrafemow, graniceGrafemowZastepcze } from './grafemy';

const przypadki = [
  'zażółć gęślą jaźń',
  'éäb', // litery ze znakami łączącymi
  'a👍🏽b', // modyfikator koloru skóry
  'x👨‍👩‍👧y', // sekwencja ZWJ
  '🇵🇱🇩🇪z', // flagi
  '❤️!', // selektor wariantu
  'a\u200db', // ZWJ przed literą
  'x\r\ny',
  '🇵🇱🇩🇪🇫', // trzy wskaźniki regionów
  '',
];

describe('granice grafemów', () => {
  it.each(przypadki)('zastępstwo zgadza się z Intl.Segmenter: %s', (tekst) => {
    expect(graniceGrafemowZastepcze(tekst)).toEqual(graniceGrafemow(tekst));
  });
});

it('bez Intl.Segmenter moduł się wczytuje i używa zastępstwa', async () => {
  vi.resetModules();
  vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined });
  try {
    const m = await import('./grafemy');
    expect(m.graniceGrafemow('e\u0301x')).toEqual([0, 2]);
  } finally {
    vi.unstubAllGlobals();
  }
});
