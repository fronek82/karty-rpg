import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t()', () => {
  it('zwraca tekst po polsku', () => {
    expect(t('aplikacja.nazwa')).toBe('Karty RPG');
  });

  it('podstawia parametry', () => {
    expect(t('start.wersja', { wersja: '0.1.0' })).toBe('Wersja 0.1.0');
  });

  it('zostawia nieznany parametr bez zmian', () => {
    expect(t('start.wersja', {})).toBe('Wersja {wersja}');
  });
});
