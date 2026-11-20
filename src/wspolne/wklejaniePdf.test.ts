import { describe, expect, it } from 'vitest';
import { wstawWklejonyTekst, wyczyscTekstZPdf } from './wklejaniePdf';

describe('czyszczenie tekstu wklejanego z PDF (M5-1)', () => {
  it('łączy sztuczne złamania wierszy z kolumny PDF i wyrazy dzielone dywizem', () => {
    const zPdf = [
      'Ten czar powoduje, że',
      'przeciwnik upada na zie-',
      'mię i traci następną',
      'turę walki.',
    ].join('\n');

    expect(wyczyscTekstZPdf(zPdf)).toBe(
      'Ten czar powoduje, że przeciwnik upada na ziemię i traci następną turę walki.',
    );
  });

  it('obsługuje przenoszenie wyrazów miękkim łącznikiem U+00AD, unikodowym dywizem U+2010 i polskimi znakami', () => {
    expect(wyczyscTekstZPdf('prze\u00AD\nnoszenie oraz zie\u2010\nmię')).toBe(
      'przenoszenie oraz ziemię',
    );
    expect(wyczyscTekstZPdf('Żół-\nć oraz za\u00ADżółć\ngęślą\u00A0jaźń')).toBe(
      'Żółć oraz zażółć gęślą jaźń',
    );
  });

  it('nie dokleja zbędnych spacji brzegowych przy wciętych akapitach z PDF', () => {
    expect(wyczyscTekstZPdf('  Pierwszy wiersz\ndrugi wiersz  ')).toBe(
      'Pierwszy wiersz drugi wiersz',
    );
    expect(wyczyscTekstZPdf(' \nAkapit\ndalej\n ')).toBe('Akapit dalej');
  });

  it('nie skleja myślnika otoczonego spacją ani dywizu przed wielką literą lub cyfrą', () => {
    expect(wyczyscTekstZPdf('Efekt -\npo rzucie\n20-\n30 metrów')).toBe(
      'Efekt - po rzucie 20- 30 metrów',
    );
    expect(wyczyscTekstZPdf('Księga-\nWiedzy')).toBe('Księga- Wiedzy');
  });

  it('zachowuje puste linie jako podział akapitów i redukuje wielokrotne puste linie', () => {
    const zPdf =
      'Pierwszy akapit\nw dwóch linijkach.\r\n\r\n\r\nDrugi akapit\ntakże złamany\nw kolumnie.';
    expect(wyczyscTekstZPdf(zPdf)).toBe(
      'Pierwszy akapit w dwóch linijkach.\n\nDrugi akapit także złamany w kolumnie.',
    );
  });

  it('zachowuje listy numerowane i punktowane, łącząc zawinięte kontynuacje punktów', () => {
    const zPdf = [
      'Instrukcja:',
      '1. Pierwszy krok',
      'zawinięty w drugiej linii.',
      '2. Drugi krok z przeno-',
      'szeniem wyrazu.',
      '• Punkt listy',
      'i jego dalsza część.',
      '- Kreska jako punkt',
      'z kolejnym wierszem.',
    ].join('\n');

    expect(wyczyscTekstZPdf(zPdf)).toBe(
      [
        'Instrukcja:',
        '1. Pierwszy krok zawinięty w drugiej linii.',
        '2. Drugi krok z przenoszeniem wyrazu.',
        '• Punkt listy i jego dalsza część.',
        '- Kreska jako punkt z kolejnym wierszem.',
      ].join('\n'),
    );
  });

  it('nie myli formatowania Markdown (*kursywa*, **pogrubienie**) z listą punktowaną', () => {
    const zPdf = 'Zadaje obrażenia\n**krytyczne** oraz\n*dodatkowe* skutki.';
    expect(wyczyscTekstZPdf(zPdf)).toBe('Zadaje obrażenia **krytyczne** oraz *dodatkowe* skutki.');
  });

  it('nie psuje wklejania pojedynczego wiersza (zachowuje celowe spacje brzegowe)', () => {
    expect(wyczyscTekstZPdf(' słowo ')).toBe(' słowo ');
    expect(wyczyscTekstZPdf('za\u00ADżółć\u00A0jaźń')).toBe('zażółć jaźń');
    expect(wyczyscTekstZPdf('')).toBe('');
  });

  it('wstawia oczyszczony tekst dokładnie w miejsce zaznaczenia i oblicza pozycję kursora', () => {
    const w = wstawWklejonyTekst('Początek [tu] koniec', 9, 13, 'nowy tekst');
    expect(w).toEqual({ wartosc: 'Początek nowy tekst koniec', kursor: 19 });
  });
});
