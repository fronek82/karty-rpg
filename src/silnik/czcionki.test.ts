import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LIMIT_PAMIECI_UKLADU, RejestrCzcionek, konturZFontkit, wczytajCzcionke } from './czcionki';
import { czcionkaTestowa, rejestrTestowy } from './__testy__/pomoc';

describe('Czcionka', () => {
  const garamond = czcionkaTestowa('EBGaramond-Regular.ttf');

  it('pamięć układu tekstu ma limit (LRU)', () => {
    const c = czcionkaTestowa('EBGaramond-Regular.ttf');
    const a0 = c.uloz('a0');
    const a1 = c.uloz('a1');
    for (let i = 2; i <= LIMIT_PAMIECI_UKLADU; i++) {
      c.uloz(`a${i}`);
      if (i === 10) c.uloz('a0'); // odświeżony – wypadnie później niż a1
    }
    expect(c.rozmiarPamieciUkladu).toBe(LIMIT_PAMIECI_UKLADU);
    expect(c.uloz('a0')).toBe(a0);
    expect(c.uloz('a1')).not.toBe(a1);
    expect(c.uloz('a1')).toEqual(a1);
  });

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

describe('brakujące warianty', () => {
  it('zastąpiony wariant trafia do brakujaceWarianty, istniejący – nie', () => {
    const r = rejestrTestowy();
    r.pobierz('tytul', 'kursywa'); // Grenze Gotisch nie ma kursywy
    r.pobierz('tresc', 'pogrubiony');
    expect([...r.brakujaceWarianty.values()]).toEqual([{ nazwa: 'tytul', wariant: 'kursywa' }]);
    r.ustawRole({ tytul: 'Grenze Gotisch' });
    expect(r.brakujaceWarianty.size).toBe(0);
  });
});

describe('pogrubienie czcionki zmiennej (oś wght)', () => {
  // Podzbiór Oswald[wght] (200–700, domyślnie 400) – jak pliki zmienne z Google Fonts.
  const oswald = () =>
    wczytajCzcionke(
      'Oswald[wght].ttf',
      new Uint8Array(
        readFileSync(new URL('./__testy__/czcionki/Oswald-zmienna-podzbior.ttf', import.meta.url)),
      ),
    );

  it('pogrubiony wariant to instancja wght 700 z własnym id i szerszymi glifami', () => {
    const normalna = oswald();
    const r = new RejestrCzcionek().dodaj('Oswald', 'normalny', normalna);
    const pogrubiona = r.pobierz('Oswald', 'pogrubiony');
    expect(pogrubiona).not.toBe(normalna);
    expect(pogrubiona.id).toBe('Oswald[wght].ttf#wght700');
    expect(pogrubiona.szerokosc('Hello')).toBeGreaterThan(normalna.szerokosc('Hello'));
    expect(r.pobierz('Oswald', 'pogrubiony')).toBe(pogrubiona); // zapamiętana
    // Pogrubiona kursywa bez kursywy – pogrubienie zamiast zwykłego kroju.
    expect(r.pobierz('Oswald', 'pogrubiona-kursywa')).toBe(pogrubiona);
    expect([...r.brakujaceWarianty.values()]).toEqual([
      { nazwa: 'Oswald', wariant: 'pogrubiona-kursywa' },
    ]);
  });

  it('czcionka statyczna nie ma pogrubienia z osi wght', () => {
    expect(czcionkaTestowa('EBGaramond-Regular.ttf').pogrubiona()).toBeUndefined();
  });
});
