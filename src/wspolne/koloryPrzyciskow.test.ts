// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  czyZmienioneKolory,
  DOMYSLNE_KOLORY_PRZYCISKOW,
  KLUCZ_KOLOROW_PRZYCISKOW,
  KOLOR_TEKSTU_PRZYCISKU,
  odczytajKoloryMotywu,
  przywrocDomyslneKolory,
  ustawKolorPrzycisku,
  ustawTekstPrzycisku,
  zastosujKoloryPrzyciskow,
} from './koloryPrzyciskow';

describe('koloryPrzyciskow', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = 'light';
    zastosujKoloryPrzyciskow('light');
  });

  afterEach(() => {
    localStorage.clear();
    zastosujKoloryPrzyciskow('light');
  });

  it('zwraca domyślne kolory dla obu motywów i nie ustawia nadpisań CSS', () => {
    expect(odczytajKoloryMotywu('light')).toEqual(DOMYSLNE_KOLORY_PRZYCISKOW.light);
    expect(odczytajKoloryMotywu('dark')).toEqual(DOMYSLNE_KOLORY_PRZYCISKOW.dark);
    expect(czyZmienioneKolory('light')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--krok-gra-1')).toBe('');
  });

  it('zapisuje i nakłada wybrany kolor przycisków osobno dla motywu jasnego i ciemnego', () => {
    ustawKolorPrzycisku('light', 'gra', '#1eabb8');
    ustawTekstPrzycisku('light', 'dark');

    expect(czyZmienioneKolory('light')).toBe(true);
    expect(czyZmienioneKolory('dark')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--krok-gra-1')).toBe('#1eabb8');
    expect(document.documentElement.style.getPropertyValue('--krok-gra-2')).toBe('#1eabb8');
    expect(document.documentElement.style.getPropertyValue('--krok-tekst')).toBe(
      KOLOR_TEKSTU_PRZYCISKU.dark,
    );

    // Przełączenie na motyw ciemny bez nadpisań zdejmuje zmienne inline (wraca do tokeny.css).
    zastosujKoloryPrzyciskow('dark');
    expect(document.documentElement.style.getPropertyValue('--krok-gra-1')).toBe('');
  });

  it('przywraca domyślne kolory i ignoruje uszkodzony JSON w localStorage', () => {
    ustawKolorPrzycisku('light', 'awers', '#ba6f84');
    przywrocDomyslneKolory('light');
    expect(czyZmienioneKolory('light')).toBe(false);
    expect(localStorage.getItem(KLUCZ_KOLOROW_PRZYCISKOW)).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--strona-awers')).toBe('');

    localStorage.setItem(KLUCZ_KOLOROW_PRZYCISKOW, '{zepsuty');
    expect(odczytajKoloryMotywu('light')).toEqual(DOMYSLNE_KOLORY_PRZYCISKOW.light);
  });
});
