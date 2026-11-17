import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { pt } from '../model/jednostki';
import type { Kontener, Pole, PoleSeparator, Szablon } from '../model/szablon';
import { renderujKarte } from '../silnik/karta';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import type { ElementSceny } from '../silnik/scena';
import { scenaDoSvg } from '../silnik/svg';
import { scenyDoPdf } from '../druk/pdf';
import { tekstOstrzezenia } from '../ui/ostrzezenia';
import {
  ELEMENTY_WBUDOWANE,
  SRODKI_WBUDOWANE,
  ZAKONCZENIA_WBUDOWANE,
  dlugoscSeparatora,
  rozlozKafelki,
  znajdzElement,
} from '.';

const ctx = { czcionki: rejestrTestowy() };

const sep = (reszta: Partial<PoleSeparator> = {}): PoleSeparator => ({
  id: 'sep',
  typ: 'separator',
  kierunek: 'poziomy',
  grubosc: 0.3,
  ...reszta,
});

/** Karta 60 × 40 mm bez paddingu: separator w kolumnie albo w wierszu. */
const karta = (
  dzieci: Pole[],
  typ: Kontener['typ'] = 'kolumna',
  rozmiar = { szerokosc: 60, wysokosc: 40 },
): Szablon => ({
  id: 't',
  nazwa: 'T',
  rozmiar: { tryb: 'mm', ...rozmiar },
  tlo: '#fdf6e3',
  korzen: { id: 'k', typ, padding: 0, dzieci },
});

const symbole = (e: ElementSceny[]) =>
  e.filter((x): x is Extract<ElementSceny, { typ: 'symbol' }> => x.typ === 'symbol');
const linie = (e: ElementSceny[]) =>
  e.filter((x): x is Extract<ElementSceny, { typ: 'linia' }> => x.typ === 'linia');

const rysuj = (s: Szablon) => renderujKarte(s, { dane: {} }, ctx);

const OZDOBNY = {
  zakonczenia: { element: 'wb:zak-grot', rozmiar: 3 },
  srodek: { element: 'wb:sr-romb', rozmiar: 3 },
  odstepOdOzdoby: 0.5,
} satisfies Partial<PoleSeparator>;

describe('katalog zakończeń i środków', () => {
  it('5 zakończeń i 4 środki o unikalnych identyfikatorach wb:…, kolorowalne, w polu rysunku', () => {
    expect(ZAKONCZENIA_WBUDOWANE).toHaveLength(5);
    expect(SRODKI_WBUDOWANE).toHaveLength(4);
    const id = ELEMENTY_WBUDOWANE.map((e) => e.id);
    expect(new Set(id).size).toBe(id.length);
    for (const e of [...ZAKONCZENIA_WBUDOWANE, ...SRODKI_WBUDOWANE]) {
      expect(e.id).toMatch(/^wb:/);
      expect(znajdzElement(e.id)).toBe(e);
      expect(e.kontury.length).toBeGreaterThan(0);
      for (const c of e.kontury) {
        expect(c.wypelnienie === 'kolor' || c.obrys?.kolor === 'kolor').toBe(true);
        for (const k of c.kontur)
          for (const v of k.slice(1) as number[]) {
            expect(Number.isFinite(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(-0.01);
            expect(v).toBeLessThanOrEqual(Math.max(e.szer, e.wys) + 0.01);
          }
      }
    }
    expect(ZAKONCZENIA_WBUDOWANE.every((e) => e.rodzaj === 'zakonczenie')).toBe(true);
    expect(SRODKI_WBUDOWANE.every((e) => e.rodzaj === 'srodek')).toBe(true);
  });
});

describe('separator ozdobny – geometria', () => {
  it('bez ozdób: jedna linia na całą długość (jak dotąd), bez symboli', () => {
    const { scena, ostrzezenia } = rysuj(karta([sep()]));
    expect(ostrzezenia).toEqual([]);
    expect(symbole(scena.elementy)).toHaveLength(0);
    expect(linie(scena.elementy)).toEqual([
      expect.objectContaining({ x1: 0, x2: 60, y1: expect.any(Number) }),
    ]);
    expect(scena.symbole).toBeUndefined();
  });

  it('zakończenia i środek: dwie linie z przerwą, trzy symbole, odstęp od ozdoby', () => {
    const { scena, ostrzezenia } = rysuj(karta([sep(OZDOBNY)]));
    expect(ostrzezenia).toEqual([]);
    const l = linie(scena.elementy);
    expect(l).toHaveLength(2);
    // Grot 12 × 6 przy wysokości 3 → szerokość 6; środek romb 9 × 6 → 4,5 mm.
    expect(l[0]!.x1).toBeCloseTo(6 + 0.5);
    expect(l[0]!.x2).toBeCloseTo(30 - 2.25 - 0.5);
    expect(l[1]!.x1).toBeCloseTo(30 + 2.25 + 0.5);
    expect(l[1]!.x2).toBeCloseTo(60 - 6 - 0.5);
    const s = symbole(scena.elementy);
    expect(s.map((x) => x.klucz).sort()).toEqual(['wb:sr-romb', 'wb:zak-grot', 'wb:zak-grot']);
    // Prawy koniec to odbicie lustrzane lewego (ujemna skala w osi linii).
    const [lewy, prawy] = s.filter((x) => x.klucz === 'wb:zak-grot');
    expect(lewy!.macierz[0]).toBeCloseTo(0.5);
    expect(prawy!.macierz[0]).toBeCloseTo(-0.5);
    expect(prawy!.macierz[4]).toBeCloseTo(60);
    expect(Object.keys(scena.symbole ?? {}).sort()).toEqual(['wb:sr-romb', 'wb:zak-grot']);
  });

  it('wysokość separatora w kolumnie to największa ozdoba (nie grubość linii)', () => {
    const wys = (d: Partial<PoleSeparator>) => {
      const { scena } = rysuj(karta([sep(d), { ...sep(), id: 's2' }]));
      return linie(scena.elementy)[0]!.y1; // linia pierwszego separatora na jego środku
    };
    expect(wys({})).toBeCloseTo(0.15);
    expect(wys(OZDOBNY)).toBeCloseTo(1.5);
  });

  it('długość w mm i w %: wyśrodkowana, przycięta do dostępnego miejsca', () => {
    const w = (dlugosc: PoleSeparator['dlugosc']) => {
      const { scena } = rysuj(karta([sep({ dlugosc })]));
      const l = linie(scena.elementy)[0]!;
      return [l.x1, l.x2];
    };
    expect(w({ mm: 20 })).toEqual([20, 40]);
    expect(w({ procent: 50 })).toEqual([15, 45]);
    expect(w({ mm: 200 })).toEqual([0, 60]);
    expect(w({ procent: 100 })).toEqual([0, 60]);
    expect(w(undefined)).toEqual([0, 60]);
    expect(dlugoscSeparatora(sep({ procent: 80 } as never), 50)).toBe(50);
    expect(dlugoscSeparatora(sep({ dlugosc: { procent: 80 } }), 50)).toBe(40);
    expect(dlugoscSeparatora(sep({ dlugosc: { mm: -3 } }), 50)).toBe(0);
  });

  it('długość obejmuje ozdoby: zakończenia na końcach skróconego separatora', () => {
    const { scena } = rysuj(karta([sep({ ...OZDOBNY, dlugosc: { procent: 50 } })]));
    const s = symbole(scena.elementy).filter((x) => x.klucz === 'wb:zak-grot');
    expect(s[0]!.macierz[4]).toBeCloseTo(15);
    expect(s[1]!.macierz[4]).toBeCloseTo(45);
  });

  it('zbyt krótki separator: środek, a potem zakończenia znikają, nic nie wychodzi poza długość', () => {
    // 12 mm: zakończenia (2 × 6) zajmują całość – środek się nie mieści.
    let r = rysuj(karta([sep({ ...OZDOBNY, dlugosc: { mm: 12.5 } })]));
    expect(symbole(r.scena.elementy).map((x) => x.klucz)).toEqual(['wb:zak-grot', 'wb:zak-grot']);
    // 10 mm: nie mieszczą się nawet zakończenia.
    r = rysuj(karta([sep({ ...OZDOBNY, dlugosc: { mm: 10 } })]));
    expect(symbole(r.scena.elementy).map((x) => x.klucz)).toEqual(['wb:sr-romb']);
    r = rysuj(karta([sep({ ...OZDOBNY, dlugosc: { mm: 0 } })]));
    expect(r.scena.elementy.filter((e) => e.typ !== 'prostokat')).toEqual([]);
  });

  it('linia podwójna daje dwie linie na odcinek; przerywana zachowuje kreskę', () => {
    const p = rysuj(karta([sep({ ...OZDOBNY, stylLinii: 'podwojna' })]));
    expect(linie(p.scena.elementy)).toHaveLength(4);
    const k = rysuj(karta([sep({ stylLinii: 'przerywana', zakonczenia: OZDOBNY.zakonczenia })]));
    expect(linie(k.scena.elementy)[0]!.obrys.kreska).toBeDefined();
  });

  it('pionowy w wierszu: oś x stała, ozdoby obrócone, odbicie na dolnym końcu', () => {
    const { scena, ostrzezenia } = rysuj(
      karta([sep({ kierunek: 'pionowy', ...OZDOBNY, dlugosc: { procent: 50 } })], 'wiersz'),
    );
    expect(ostrzezenia).toEqual([]);
    const l = linie(scena.elementy);
    expect(l).toHaveLength(2);
    for (const x of l) expect(x.x1).toBe(x.x2);
    // Dostępna wysokość 40, długość 50 % → od y = 10 do 30; grot ma 6 mm.
    expect(l[0]!.y1).toBeCloseTo(10 + 6 + 0.5);
    expect(l[1]!.y2).toBeCloseTo(30 - 6 - 0.5);
    const [gora, dol] = symbole(scena.elementy).filter((x) => x.klucz === 'wb:zak-grot');
    // Obrót o 90°: skala osi linii leży w `b` (y), a nie w `a`.
    expect(gora!.macierz[0]).toBe(0);
    expect(gora!.macierz[1]).toBeCloseTo(0.5);
    // Prawdziwy obrót o 90°: c = −b·(sy/sx) < 0 (nie transpozycja), wyznacznik dodatni.
    expect(gora!.macierz[2]).toBeCloseTo(-0.5);
    expect(gora!.macierz[3]).toBe(0);
    const [a, b, c, d] = gora!.macierz;
    expect(a * d - b * c).toBeGreaterThan(0);
    // Pas ozdób 3 mm leży na x = 0…3; rysunek (y rysunku → −x) zaczyna się przy x = 3.
    expect(gora!.macierz[4]).toBeCloseTo(3);
    expect(dol!.macierz[4]).toBeCloseTo(3);
    expect(gora!.macierz[5]).toBeCloseTo(10);
    expect(dol!.macierz[1]).toBeCloseTo(-0.5);
    expect(dol!.macierz[5]).toBeCloseTo(30);
  });

  it('separator pionowy w wierszu mierzy szerokość wg ozdób i dzieli wiersz ze sąsiadem', () => {
    const tekst: Pole = {
      id: 'a',
      typ: 'tekst',
      klucz: 'a',
      szerokosc: { wypelnij: 1 },
      styl: { czcionka: 'tresc', rozmiar: pt(9) },
    };
    const { scena } = rysuj(
      karta(
        [tekst, sep({ kierunek: 'pionowy', ...OZDOBNY }), { ...tekst, id: 'b', klucz: 'b' }],
        'wiersz',
      ),
    );
    const l = linie(scena.elementy)[0]!;
    // Pas separatora 3 mm (ozdoby), tekstów po (60 − 3) / 2 → linia w x = 28,5 + 1,5.
    expect(l.x1).toBeCloseTo(30);
  });

  it('motyw zamiast linii: kafelki rozłożone równo na każdym odcinku, bez linii', () => {
    const { scena, ostrzezenia } = rysuj(
      karta([
        sep({ rysunek: { motyw: 'wb:lancuch', szerokosc: 3 }, ...OZDOBNY, dlugosc: { mm: 50 } }),
      ]),
    );
    expect(ostrzezenia).toEqual([]);
    expect(linie(scena.elementy)).toHaveLength(0);
    const kafle = symbole(scena.elementy).filter((x) => x.klucz === 'wb:lancuch');
    const lancuch = znajdzElement('wb:lancuch')!;
    // Odcinki: [5 + 6 + 0,5; 30 − 2,25 − 0,5] i symetryczny.
    const dl = 25 - 6 - 0.5 - 2.25 - 0.5;
    const n = rozlozKafelki(dl, 3, lancuch).n;
    expect(kafle).toHaveLength(2 * n);
    const krok = dl / n;
    expect(kafle[1]!.macierz[0]).toBeCloseTo(krok / lancuch.szer);
    expect(kafle[1]!.macierz[4] - kafle[0]!.macierz[4]).toBeCloseTo(krok);
    // Pas wyśrodkowany w poprzek: y = środek − 1,5.
    expect(kafle[0]!.macierz[5]).toBeCloseTo(1.5 - 1.5);
    expect(kafle[0]!.macierz[3]).toBeCloseTo(3 / lancuch.wys);
  });

  it('motyw pionowy: kafelki obrócone, kolor z pola', () => {
    const { scena } = rysuj(
      karta(
        [
          sep({
            kierunek: 'pionowy',
            rysunek: { motyw: 'wb:gwiazdki', szerokosc: 4 },
            kolor: '#aa0000',
          }),
        ],
        'wiersz',
      ),
    );
    const kafle = symbole(scena.elementy);
    expect(kafle.length).toBeGreaterThan(3);
    for (const k of kafle) {
      expect(k.macierz[0]).toBe(0);
      expect(k.kolor).toBe('#aa0000');
    }
  });
});

describe('separator ozdobny – przypadki brzegowe', () => {
  it('punkt wejścia linii (x = szer) każdego zakończenia leży na osi wys / 2', () => {
    for (const e of ZAKONCZENIA_WBUDOWANE) {
      const ys: number[] = [];
      for (const c of e.kontury)
        for (const k of c.kontur) {
          const v = k.slice(1) as number[];
          for (let i = 0; i + 1 < v.length; i += 2)
            if (Math.abs(v[i]! - e.szer) < 1e-9) ys.push(v[i + 1]!);
        }
      expect(ys.length, e.id).toBeGreaterThan(0);
      expect((Math.min(...ys) + Math.max(...ys)) / 2, e.id).toBeCloseTo(e.wys / 2);
    }
  });

  it('graniczna długość: środek wraz z odstępami nie daje ujemnych odcinków', () => {
    // Grot 6 mm, romb 4,5 mm, odstęp 0,5: potrzeba 4,5 + 12 + 4 · 0,5 = 18,5 mm.
    for (const mm of [17, 18, 18.4, 18.5, 18.6, 19, 25]) {
      const { scena } = rysuj(karta([sep({ ...OZDOBNY, dlugosc: { mm } })]));
      const klucze = symbole(scena.elementy).map((x) => x.klucz);
      expect(klucze.includes('wb:sr-romb'), `${mm} mm`).toBe(mm >= 18.5 - 1e-9);
      expect(klucze.filter((k) => k === 'wb:zak-grot')).toHaveLength(2);
      for (const l of linie(scena.elementy)) expect(l.x2, `${mm} mm`).toBeGreaterThan(l.x1);
    }
    // 17 mm: linia między zakończeniami ma 17 − 12 − 1 = 4 mm, bez środka.
    const l = linie(rysuj(karta([sep({ ...OZDOBNY, dlugosc: { mm: 17 } })])).scena.elementy);
    expect(l).toHaveLength(1);
    expect(l[0]!.x2 - l[0]!.x1).toBeCloseTo(4);
  });

  it('grubość 0 z ozdobami: bez linii, ozdoby rysowane', () => {
    const { scena, ostrzezenia } = rysuj(karta([sep({ ...OZDOBNY, grubosc: 0 })]));
    expect(ostrzezenia).toEqual([]);
    expect(linie(scena.elementy)).toHaveLength(0);
    expect(symbole(scena.elementy)).toHaveLength(3);
  });

  it('rozmiar ozdoby 0: ozdoba pominięta, linia na całą długość', () => {
    const { scena } = rysuj(
      karta([
        sep({
          zakonczenia: { element: 'wb:zak-grot', rozmiar: 0 },
          srodek: { element: 'wb:sr-romb', rozmiar: 0 },
        }),
      ]),
    );
    expect(symbole(scena.elementy)).toHaveLength(0);
    const l = linie(scena.elementy);
    expect(l).toHaveLength(1);
    expect([l[0]!.x1, l[0]!.x2]).toEqual([0, 60]);
  });

  it('ujemny odstęp jest traktowany jak 0', () => {
    const a = rysuj(karta([sep({ ...OZDOBNY, odstepOdOzdoby: -2 })])).scena;
    const b = rysuj(karta([sep({ ...OZDOBNY, odstepOdOzdoby: 0 })])).scena;
    expect(scenaDoSvg(a)).toBe(scenaDoSvg(b));
  });

  it('pionowy separator w kolumnie (regresja): skończone współrzędne, bez wyjścia poza kartę', () => {
    const { scena, ostrzezenia } = rysuj(
      karta([sep({ kierunek: 'pionowy', ...OZDOBNY, dlugosc: { procent: 50 } })]),
    );
    expect(ostrzezenia).toEqual([]);
    for (const e of linie(scena.elementy))
      for (const v of [e.x1, e.y1, e.x2, e.y2]) expect(Number.isFinite(v)).toBe(true);
    for (const s of symbole(scena.elementy))
      for (const v of s.macierz) expect(Number.isFinite(v)).toBe(true);
  });

  it('długość w % poza zakresem: schemat odrzuca > 100, silnik przycina do miejsca', () => {
    expect(dlugoscSeparatora(sep({ dlugosc: { procent: 250 } }), 40)).toBe(40);
  });
});

describe('separator ozdobny – nieznane elementy', () => {
  it('nieznane zakończenie, środek i motyw: ostrzeżenie, reszta rysowana, linia zamiast motywu', () => {
    const { scena, ostrzezenia } = rysuj(
      karta([
        sep({
          rysunek: { motyw: 'wb:nie-ma', szerokosc: 3 },
          zakonczenia: { element: 'wb:pnacze', rozmiar: 3 }, // motyw w roli zakończenia
          srodek: { element: 'wb:sr-gwiazda', rozmiar: 3 },
        }),
      ]),
    );
    expect(ostrzezenia.map((o) => o.komunikat)).toEqual([
      'nieznany-element-ozdobny',
      'nieznany-element-ozdobny',
    ]);
    expect(ostrzezenia.map((o) => o.szczegoly)).toEqual(['wb:pnacze', 'wb:nie-ma']);
    expect(tekstOstrzezenia(ostrzezenia[0]!)).toContain('wb:pnacze');
    expect(linie(scena.elementy)).toHaveLength(2);
    expect(symbole(scena.elementy).map((x) => x.klucz)).toEqual(['wb:sr-gwiazda']);
  });
});

describe('wzorce SVG separatorów', () => {
  const przyklady: [string, Szablon][] = [
    [
      'poziomy-zakonczenia-srodek',
      karta([sep({ ...OZDOBNY, kolor: '#6b3a1e' })], 'kolumna', { szerokosc: 60, wysokosc: 6 }),
    ],
    [
      'poziomy-podwojna-80proc',
      karta(
        [sep({ ...OZDOBNY, stylLinii: 'podwojna', dlugosc: { procent: 80 }, kolor: '#2f5d8a' })],
        'kolumna',
        { szerokosc: 60, wysokosc: 6 },
      ),
    ],
    [
      'poziomy-motyw',
      karta(
        [
          sep({
            rysunek: { motyw: 'wb:lancuch', szerokosc: 3 },
            zakonczenia: { element: 'wb:zak-zawijas', rozmiar: 3 },
            kolor: '#6b3a1e',
          }),
        ],
        'kolumna',
        { szerokosc: 60, wysokosc: 6 },
      ),
    ],
    [
      'pionowy-wiersz',
      karta(
        [
          sep({
            kierunek: 'pionowy',
            ...OZDOBNY,
            zakonczenia: { element: 'wb:zak-lisc', rozmiar: 3 },
            srodek: { element: 'wb:sr-lisc', rozmiar: 3 },
            kolor: '#6b3a1e',
          }),
        ],
        'wiersz',
        { szerokosc: 6, wysokosc: 40 },
      ),
    ],
    [
      'pionowy-motyw-mm',
      karta(
        [
          sep({
            kierunek: 'pionowy',
            rysunek: { motyw: 'wb:runy', szerokosc: 4 },
            zakonczenia: { element: 'wb:zak-kropka', rozmiar: 2 },
            dlugosc: { mm: 30 },
          }),
        ],
        'wiersz',
        { szerokosc: 6, wysokosc: 40 },
      ),
    ],
  ];
  for (const [nazwa, s] of przyklady)
    it(nazwa, async () => {
      const { scena, ostrzezenia } = rysuj(s);
      expect(ostrzezenia).toEqual([]);
      await expect(scenaDoSvg(scena)).toMatchFileSnapshot(`./__snapshots__/separator-${nazwa}.svg`);
    });

  it('te same dane dają ten sam SVG', () => {
    const s = przyklady[2]![1];
    expect(scenaDoSvg(rysuj(s).scena)).toBe(scenaDoSvg(rysuj(s).scena));
  });
});

describe('PDF z separatorami ozdobnymi', () => {
  it('każdy rysunek to jeden XObject – niezależnie od liczby wstawień i stron', async () => {
    const { scena } = rysuj(
      karta([
        sep({ rysunek: { motyw: 'wb:przeplot', szerokosc: 3 }, ...OZDOBNY }),
        { ...sep({ ...OZDOBNY }), id: 's2' },
      ]),
    );
    expect(symbole(scena.elementy).length).toBeGreaterThan(10);
    // Trzy różne rysunki: przeplot, grot, romb.
    const wynik = await scenyDoPdf([scena, scena]);
    expect(wynik.liczbaSymboli).toBe(3);
    const pdf = await PDFDocument.load(wynik.bajty);
    expect(pdf.getPageCount()).toBe(2);
  });
});
