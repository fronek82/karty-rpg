import { pt } from '../model/jednostki';
import type { StylTekstu } from '../model/szablon';

/** Styl tekstu w roli „treść” – rozmiar w punktach (wartość trafia do modelu w mm). */
export const tresc = (rozmiar: number, reszta: Partial<StylTekstu> = {}): StylTekstu => ({
  czcionka: 'tresc',
  rozmiar: pt(rozmiar),
  ...reszta,
});
