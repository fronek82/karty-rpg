import { describe, expect, it } from 'vitest';
import { RejestrCzcionek, konturZFontkit } from './czcionki';
import { czcionkaTestowa, rejestrTestowy } from './__testy__/pomoc';

describe('Czcionka', () => {
  const garamond = czcionkaTestowa('EBGaramond-Regular.ttf');

  it('kształtuje tekst z ligaturami', () => {
    // „fi” to w EB Garamond jeden glif (ligatura).
    expect(garamond.uloz('fi')).toHaveLength(1);
    expect(garamond.uloz('f i')).toHaveLength(3);
  });

  it('ma polskie znaki, ale nie ma gwiazdki', () => {
    expect(garamond.brakujaceZnaki('Zażółć gęślą jaźń')).toEqual([]);
    expect(garamond.brakujaceZnaki('a★b')).toEqual(['★']);
  });

  it('zwraca kontur złożony tylko z M, L, C, Z', () => {
    const [glif] = garamond.uloz('ż');
    const kontur = garamond.kontur(glif!.id);
    expect(kontur.length).toBeGreaterThan(5);
    expect(new Set(kontur.map((k) => k[0]))).toEqual(new Set(['M', 'C', 'L', 'Z']));
  });
});

describe('konturZFontkit', () => {
  it('zamienia krzywą kwadratową na sześcienną', () => {
    const k = konturZFontkit([
      { command: 'moveTo', args: [0, 0] },
      { command: 'quadraticCurveTo', args: [30, 30, 60, 0] },
      { command: 'closePath', args: [] },
    ]);
    expect(k).toEqual([['M', 0, 0], ['C', 20, 20, 40, 20, 60, 0], ['Z']]);
  });
});

describe('RejestrCzcionek', () => {
  it('rozwiązuje role i zastępuje brakujący wariant', () => {
    const r = rejestrTestowy();
    expect(r.pobierz('tytul', 'pogrubiony').id).toBe('GrenzeGotisch-Bold.ttf');
    // Grenze Gotisch nie ma kursywy w rejestrze – zostaje wersja normalna.
    expect(r.pobierz('tytul', 'kursywa').id).toBe('GrenzeGotisch-Regular.ttf');
  });

  it('zgłasza czytelny błąd, gdy brak czcionki', () => {
    expect(() => new RejestrCzcionek().pobierz('tytul')).toThrow('Brak czcionki „tytul”');
  });

  it('czcionka zapasowa zamiast błędu, z zapisem brakującej nazwy', () => {
    const r = new RejestrCzcionek();
    const c = czcionkaTestowa('EBGaramond-Regular.ttf');
    r.dodaj('EB Garamond', 'normalny', c)
      .ustawZapasowa('EB Garamond')
      .przypiszRole('tytul', 'Nie Ma');
    expect(r.pobierz('tytul', 'pogrubiony')).toBe(c);
    expect([...r.brakujace]).toEqual(['tytul']);
  });
});
