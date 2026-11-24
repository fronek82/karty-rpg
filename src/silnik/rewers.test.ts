import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { scenyDoPdf } from '../druk/pdf';
import type { ElementOzdobny } from '../ozdobniki/typy';
import type { Rewers, Szablon, TrybTla } from '../model/szablon';
import type { Czcionka, RejestrCzcionek } from './czcionki';
import { renderujRewers, wspolneKluczeRewersu } from './karta';
import type { ElementSceny, GlifNaScenie, Scena } from './scena';
import { scenaDoSvg } from './svg';
import { tekstPoLukuNaScene, ulozTekst } from './tekst';
import { rejestrTestowy } from './__testy__/pomoc';

const czcionki = rejestrTestowy();

const wszystkieElementy = (s: Scena): ElementSceny[] => {
  const wynik: ElementSceny[] = [];
  const zbierz = (lista: readonly ElementSceny[]) => {
    for (const e of lista) {
      wynik.push(e);
      if (e.typ === 'grupa') zbierz(e.elementy);
    }
  };
  zbierz(s.elementy);
  return wynik;
};

describe('renderujRewers (M4-2)', () => {
  const bazowy: Rewers = {
    id: 'r1',
    nazwa: 'Rewers RPG',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo: '#1e293b',
    korzen: {
      id: 'korzen',
      typ: 'swobodny',
      dzieci: [],
    },
  };

  const ctx = (elementy?: readonly ElementOzdobny[]) => ({
    czcionki,
    obraz: (id: string) => (id === 'tekstura' ? { szerokosc: 400, wysokosc: 200 } : undefined),
    ...(elementy ? { elementy } : {}),
  });

  it('własne rogi i postrzępienie tyłu: w edytorze z tyłu, na arkuszu rogi wyznacza przód', () => {
    const r: Rewers = { ...bazowy, promienRogow: 5 };
    const promienTla = (s: Scena) =>
      wszystkieElementy(s).find((e) => e.typ === 'prostokat' && e.wypelnienie) as
        { promien?: number } | undefined;
    expect(promienTla(renderujRewers(r, ctx()).scena)?.promien).toBe(5);
    expect(promienTla(renderujRewers(r, ctx(), { szer: 63, wys: 88 }).scena)?.promien).toBe(
      undefined,
    );
    expect(
      promienTla(renderujRewers(r, ctx(), { szer: 63, wys: 88, promienRogow: 2 }).scena)?.promien,
    ).toBe(2);
    const gladki = scenaDoSvg(renderujRewers(bazowy, ctx()).scena);
    const postrzepiony = scenaDoSvg(
      renderujRewers({ ...bazowy, postrzepienie: { sila: 1, ziarno: 3, ziarnistosc: 4 } }, ctx())
        .scena,
    );
    expect(postrzepiony).not.toBe(gladki);
  });

  it('renderuje cztery tryby dopasowania obrazu tła: wypelnij, dopasuj, rozciagnij, kafelki', () => {
    const wyniki = (['wypelnij', 'dopasuj', 'rozciagnij', 'kafelki'] as TrybTla[]).map((tryb) => {
      const r: Rewers = { ...bazowy, teksturaTla: 'tekstura', teksturaTryb: tryb };
      const w = renderujRewers(r, ctx());
      return { tryb, w, elementy: wszystkieElementy(w.scena) };
    });

    const wypelnij = wyniki.find((x) => x.tryb === 'wypelnij')!;
    const imgWypelnij = wypelnij.elementy.find((e) => e.typ === 'obraz')!;
    expect(imgWypelnij.typ).toBe('obraz');
    if (imgWypelnij.typ === 'obraz') {
      expect(imgWypelnij.wys).toBeCloseTo(88, 2);
      expect(imgWypelnij.szer).toBeCloseTo(176, 2);
    }

    const dopasuj = wyniki.find((x) => x.tryb === 'dopasuj')!;
    const imgDopasuj = dopasuj.elementy.find((e) => e.typ === 'obraz')!;
    expect(imgDopasuj.typ).toBe('obraz');
    if (imgDopasuj.typ === 'obraz') {
      expect(imgDopasuj.szer).toBeCloseTo(63, 2);
      expect(imgDopasuj.wys).toBeCloseTo(31.5, 2);
      expect(imgDopasuj.y).toBeCloseTo((88 - 31.5) / 2, 2);
    }

    const rozciagnij = wyniki.find((x) => x.tryb === 'rozciagnij')!;
    const imgRozciagnij = rozciagnij.elementy.find((e) => e.typ === 'obraz')!;
    expect(imgRozciagnij.typ).toBe('obraz');
    if (imgRozciagnij.typ === 'obraz') {
      expect(imgRozciagnij.x).toBeCloseTo(0, 4);
      expect(imgRozciagnij.y).toBeCloseTo(0, 4);
      expect(imgRozciagnij.szer).toBeCloseTo(63, 4);
      expect(imgRozciagnij.wys).toBeCloseTo(88, 4);
    }

    const kafelki = wyniki.find((x) => x.tryb === 'kafelki')!;
    const grupy = kafelki.w.scena.elementy.filter((e) => e.typ === 'grupa');
    expect(grupy.length).toBeGreaterThanOrEqual(1);
    const kafelkiObrazy = kafelki.elementy.filter((e) => e.typ === 'obraz');
    expect(kafelkiObrazy.length).toBeGreaterThanOrEqual(6);
  });

  it('skaluje rewers do docelowego rozmiaru karty z zachowaniem kotwic i proporcji', () => {
    const r: Rewers = {
      ...bazowy,
      korzen: {
        id: 'korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'naroznik',
            typ: 'ikona',
            ikona: 'gwiazdka',
            rozmiar: 6,
            pozycja: { x: -4, y: -4, kotwica: 'prawy-dolny' },
          },
        ],
      },
    };
    const maly = renderujRewers(r, ctx());
    const duzy = renderujRewers(r, ctx(), { szer: 80, wys: 120, promienRogow: 4 });
    expect(maly.scena.szer).toBe(63);
    expect(duzy.scena.szer).toBe(80);
    expect(duzy.scena.wys).toBe(120);
    const poleMaly = maly.wezly.find((w) => w.id === 'naroznik')!;
    const poleDuzy = duzy.wezly.find((w) => w.id === 'naroznik')!;
    expect(poleMaly.x).toBeCloseTo(63 - 4 - poleMaly.szer, 2);
    expect(poleDuzy.x).toBeCloseTo(80 - 4 - poleDuzy.szer, 2);
    expect(poleDuzy.y).toBeCloseTo(120 - 4 - poleDuzy.wys, 2);
  });

  it('renderuje warstwy czcionek, ramek i grafik SVG z katalogu oraz biblioteki własnej (kolorowalnej i stałej)', () => {
    const wlasne: ElementOzdobny[] = [
      {
        id: 'wl:herb',
        nazwa: 'Herb',
        rodzaj: 'srodek',
        szer: 10,
        wys: 10,
        kolorowanie: 'jednolity',
        kontury: [
          { kontur: [['M', 0, 0], ['L', 10, 0], ['L', 5, 10], ['Z']], wypelnienie: 'kolor' },
        ],
      },
      {
        id: 'wl:flaga',
        nazwa: 'Flaga',
        rodzaj: 'srodek',
        szer: 10,
        wys: 10,
        kolorowanie: 'oryginal',
        kontury: [
          {
            kontur: [['M', 1, 1], ['L', 9, 1], ['L', 9, 9], ['L', 1, 9], ['Z']],
            wypelnienie: '#dc2626',
          },
        ],
      },
    ];

    const r: Rewers = {
      ...bazowy,
      ramka: {
        styl: 'podwojna',
        grubosc: 0.6,
        kolor: '#facc15',
        odsuniecie: 3,
        promien: 2,
      },
      korzen: {
        id: 'korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'tytul',
            typ: 'tekst',
            tekst: 'KARTA PRZYGODY',
            pozycja: { x: 6, y: 10 },
            szerokosc: { mm: 51 },
            styl: { czcionka: 'tytul', rozmiar: 5, kolor: '#f8fafc', wariant: 'pogrubiony' },
          },
          {
            id: 'wbud',
            typ: 'ikona',
            ikona: 'gwiazdka',
            element: 'wb:kat',
            rozmiar: 8,
            kolor: '#38bdf8',
            pozycja: { x: 8, y: 30 },
          },
          {
            id: 'herb',
            typ: 'ikona',
            ikona: 'gwiazdka',
            element: 'wl:herb',
            rozmiar: 12,
            kolor: '#22c55e',
            pozycja: { x: 25, y: 40 },
          },
          {
            id: 'flaga',
            typ: 'ikona',
            ikona: 'gwiazdka',
            element: 'wl:flaga',
            rozmiar: 10,
            pozycja: { x: 40, y: 60 },
          },
        ],
      },
    };

    const wynik = renderujRewers(r, ctx(wlasne));
    expect(wynik.ostrzezenia).toEqual([]);
    expect(Object.keys(wynik.scena.glify)).not.toHaveLength(0);
    expect(wynik.scena.symbole?.['wl:herb']).toBeDefined();
    expect(wynik.scena.symbole?.['wl:flaga']?.kontury[0]?.wypelnienie).toBe('#dc2626');

    const symbole = wszystkieElementy(wynik.scena).filter((e) => e.typ === 'symbol');
    expect(symbole.find((s) => s.typ === 'symbol' && s.klucz === 'wl:herb')).toMatchObject({
      kolor: '#22c55e',
    });
    expect(symbole.find((s) => s.typ === 'symbol' && s.klucz === 'wb:kat')).toMatchObject({
      kolor: '#38bdf8',
    });

    const svg = scenaDoSvg(wynik.scena, { przedrostekId: 't-' });
    expect(svg).toContain('<g id="t-s');
    expect(svg).toContain('<use href="#t-s');
    expect(svg).toContain('#facc15');
    expect(svg).toContain('#dc2626');
  });

  it('zgłasza ostrzeżenie o brakującym elemencie ozdobnym w warstwie ikony', () => {
    const r: Rewers = {
      ...bazowy,
      korzen: {
        id: 'korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'brak',
            typ: 'ikona',
            ikona: 'gwiazdka',
            element: 'wl:nieistnieje',
            rozmiar: 6,
            pozycja: { x: 10, y: 10 },
          },
        ],
      },
    };
    const wynik = renderujRewers(r, ctx());
    expect(wynik.ostrzezenia).toEqual([
      expect.objectContaining({
        pole: 'brak',
        komunikat: 'nieznany-element-ozdobny',
        szczegoly: 'wl:nieistnieje',
      }),
    ]);
  });

  it('zachowuje kolejność rysowania warstw (kolejne dziecko rysowane jest wyżej)', () => {
    const r: Rewers = {
      ...bazowy,
      korzen: {
        id: 'korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'spod',
            typ: 'ikona',
            ikona: 'gwiazdka',
            rozmiar: 10,
            kolor: '#111111',
            pozycja: { x: 10, y: 10 },
          },
          {
            id: 'wierzch',
            typ: 'ikona',
            ikona: 'nozyczki',
            rozmiar: 10,
            kolor: '#ef4444',
            pozycja: { x: 10, y: 10 },
          },
        ],
      },
    };
    const wynik = renderujRewers(r, ctx());
    const kolory = wszystkieElementy(wynik.scena)
      .filter((e) => e.typ === 'sciezka' && e.wypelnienie)
      .map((e) => (e.typ === 'sciezka' ? e.wypelnienie : undefined));
    const idxSpod = kolory.indexOf('#111111');
    const idxWierzch = kolory.indexOf('#ef4444');
    expect(idxSpod).toBeGreaterThan(-1);
    expect(idxWierzch).toBeGreaterThan(idxSpod);
  });
});

describe('M4-3: tekst po łuku, krycie warstw i efekty tekstury tła', () => {
  const bazowy: Rewers = {
    id: 'r-efekty',
    nazwa: 'Rewers efekty',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo: '#0f172a',
    korzen: {
      id: 'korzen',
      typ: 'swobodny',
      dzieci: [],
    },
  };

  const ctx = () => ({
    czcionki,
    obraz: (id: string) => (id === 'tekstura' ? { szerokosc: 400, wysokosc: 300 } : undefined),
  });

  it('układa glify po łuku wypukłym (góra) i wklęsłym (dół) z symetrycznymi kątami i większym wygięciem dla mniejszego promienia', () => {
    const zLukiem = (promien: number, kierunek: 'gora' | 'dol'): Rewers => ({
      ...bazowy,
      korzen: {
        id: 'korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'tytul',
            typ: 'tekst',
            tekst: 'ARKANA',
            pozycja: { x: 6, y: 12 },
            szerokosc: { mm: 51 },
            styl: {
              czcionka: 'tytul',
              rozmiar: 5,
              kolor: '#f8fafc',
              wyrownanie: 'srodek',
            },
            luk: { promien, kierunek },
          },
        ],
      },
    });

    const gora35 = renderujRewers(zLukiem(35, 'gora'), ctx());
    const gora70 = renderujRewers(zLukiem(70, 'gora'), ctx());
    const dol35 = renderujRewers(zLukiem(35, 'dol'), ctx());

    const zbierzGlify = (s: Scena): GlifNaScenie[] =>
      wszystkieElementy(s)
        .filter((e): e is Extract<ElementSceny, { typ: 'tekst' }> => e.typ === 'tekst')
        .flatMap((e) => e.glify);

    const gGora35 = zbierzGlify(gora35.scena);
    const gGora70 = zbierzGlify(gora70.scena);
    const gDol35 = zbierzGlify(dol35.scena);

    expect(gGora35).toHaveLength(6);
    expect(gDol35).toHaveLength(6);

    // Dla łuku wypukłego ('gora') lewy glif obraca się ujemnie (w lewo w górę), prawy dodatnio.
    expect(gGora35[0]!.obrot!).toBeLessThan(-5);
    expect(gGora35.at(-1)!.obrot!).toBeGreaterThan(5);
    expect(Math.abs(gGora35[0]!.obrot! + gGora35.at(-1)!.obrot!)).toBeLessThan(2);

    // Dla łuku wklęsłego ('dol') kierunek obrotu jest przeciwny.
    expect(gDol35[0]!.obrot!).toBeGreaterThan(5);
    expect(gDol35.at(-1)!.obrot!).toBeLessThan(-5);
    expect(Math.abs(gDol35[0]!.obrot! + gDol35.at(-1)!.obrot!)).toBeLessThan(2);

    // Mniejszy promień daje większe kąty obrotu.
    expect(Math.abs(gGora35[0]!.obrot!)).toBeGreaterThan(Math.abs(gGora70[0]!.obrot!) * 1.5);

    // Wypukły łuk: środek wyżej (mniejsze y) niż końce; wklęsły: środek niżej (większe y).
    const srodekGora = gGora35[Math.floor(gGora35.length / 2)]!;
    expect(srodekGora.y).toBeLessThan(gGora35[0]!.y);
    expect(srodekGora.y).toBeLessThan(gGora35.at(-1)!.y);

    const srodekDol = gDol35[Math.floor(gDol35.length / 2)]!;
    expect(srodekDol.y).toBeGreaterThan(gDol35[0]!.y);
    expect(srodekDol.y).toBeGreaterThan(gDol35.at(-1)!.y);

    // Automatyczny pomiar pudełka tekstu po łuku rośnie względem prostego tekstu.
    const prosty = renderujRewers(
      {
        ...bazowy,
        korzen: {
          id: 'korzen',
          typ: 'swobodny',
          dzieci: [
            {
              id: 'tytul',
              typ: 'tekst',
              tekst: 'ARKANA',
              pozycja: { x: 6, y: 12 },
              szerokosc: { mm: 51 },
              styl: { czcionka: 'tytul', rozmiar: 5, kolor: '#f8fafc', wyrownanie: 'srodek' },
            },
          ],
        },
      },
      ctx(),
    );
    const poleProste = prosty.wezly.find((w) => w.id === 'tytul')!;
    const poleLuk = gora35.wezly.find((w) => w.id === 'tytul')!;
    expect(poleLuk.wys).toBeGreaterThan(poleProste.wys);
  });

  it('obsługuje polskie znaki, ligatury, znaki łączące (zero-advance) i auto-fit po łuku', () => {
    const r: Rewers = {
      ...bazowy,
      korzen: {
        id: 'korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'diakrytyki',
            typ: 'tekst',
            tekst: 'Żółć fi ąęśźż',
            pozycja: { x: 6, y: 10 },
            szerokosc: { mm: 51 },
            wysokosc: { mm: 12 },
            styl: {
              czcionka: 'tresc',
              rozmiar: 8,
              minRozmiar: 2,
              kolor: '#f8fafc',
              wyrownanie: 'srodek',
              obwodka: { grubosc: 0.4, kolor: '#000000' },
            },
            luk: { promien: 32, kierunek: 'gora' },
          },
          {
            id: 'za-maly',
            typ: 'tekst',
            tekst: 'BARDZO DŁUGI NAPIS NIE MIESZCZĄCY SIĘ W MAŁYM POLU PO ŁUKU',
            pozycja: { x: 6, y: 60 },
            szerokosc: { mm: 20 },
            wysokosc: { mm: 5 },
            styl: { czcionka: 'tytul', rozmiar: 6, kolor: '#f8fafc' },
            luk: { promien: 25, kierunek: 'dol' },
          },
        ],
      },
    };
    const wynik = renderujRewers(r, ctx());
    expect(wynik.ostrzezenia.some((o) => o.pole === 'diakrytyki')).toBe(false);
    expect(
      wynik.ostrzezenia.some((o) => o.pole === 'za-maly' && o.komunikat === 'tekst-nie-miesci-sie'),
    ).toBe(true);
    const svg = scenaDoSvg(wynik.scena, { przedrostekId: 'l-' });
    expect(svg).toContain('transform="matrix(');
    expect(svg).toContain('stroke="#000000"');

    // Znak łączący (combining mark, przesuniecie = 0) musi dostać ten sam kąt obrotu co glif bazowy
    // i zachować dokładny wektor przesunięcia (dx, dy) po obrocie nawet przy odstepLiter > 0.
    const sztucznaCzcionka = {
      id: 'synth',
      unitsPerEm: 1000,
      ascent: 800,
      descent: 200,
      maCeche: () => false,
      uloz: (tekst: string) =>
        tekst === 'A\u0301B'
          ? [
              { id: 1, przesuniecie: 600, dx: 0, dy: 0 },
              { id: 2, przesuniecie: 0, dx: -300, dy: 250 },
              { id: 3, przesuniecie: 600, dx: 0, dy: 0 },
            ]
          : [{ id: 1, przesuniecie: 600, dx: 0, dy: 0 }],
      kontur: () => [['M', 0, 0], ['L', 100, 0], ['L', 100, 100], ['Z']],
    } as unknown as Czcionka;
    const rejestrSynth: RejestrCzcionek = {
      pobierz: () => sztucznaCzcionka,
    } as unknown as RejestrCzcionek;
    const glifyMap: Scena['glify'] = {};
    const ukladSynth = ulozTekst(
      [
        {
          tekst: 'A\u0301B',
          styl: { czcionka: 'synth', rozmiar: 10, kolor: '#ffffff', odstepLiter: 2 },
        },
      ],
      undefined,
      rejestrSynth,
    );
    const elem = tekstPoLukuNaScene(
      ukladSynth,
      { promien: 30, kierunek: 'gora' },
      { x: 0, y: 0, szer: 40, wys: 20 },
      'srodek',
      'srodek',
      glifyMap,
    );
    const grupyGlifow = elem.filter(
      (e): e is Extract<ElementSceny, { typ: 'tekst' }> => e.typ === 'tekst',
    );
    expect(grupyGlifow).toHaveLength(1);
    const [baza, znak, nastepny] = grupyGlifow[0]!.glify;
    expect(baza!.obrot).toBeDefined();
    expect(znak!.obrot).toBeCloseTo(baza!.obrot!, 6);
    expect(nastepny!.obrot!).toBeGreaterThan(baza!.obrot!);
    // Sprawdź zachowany wektor względny między bazą (x=0) a znakiem łączącym (x=6-3=3mm, dy=+2.5mm => -2.5mm w Y).
    const rad = ((baza!.obrot ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const oczDx = 3 * cos - -2.5 * sin;
    const oczDy = 3 * sin + -2.5 * cos;
    expect(znak!.x - baza!.x).toBeCloseTo(oczDx, 3);
    expect(znak!.y - baza!.y).toBeCloseTo(oczDy, 3);
  });

  it('obsługuje krycie warstw (0, półprzezroczyste, 1, obrócone) oraz krycie i zabarwienie tekstury tła w SVG i PDF', async () => {
    const r: Rewers = {
      ...bazowy,
      teksturaTla: 'tekstura',
      teksturaTryb: 'wypelnij',
      teksturaKrycie: 0.5,
      teksturaZabarwienie: { kolor: '#7c2d12', krycie: 0.35 },
      korzen: {
        id: 'korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'ukryta',
            typ: 'tekst',
            tekst: 'NIEWIDOCZNA',
            krycie: 0,
            pozycja: { x: 5, y: 5 },
            szerokosc: { mm: 40 },
            styl: { czcionka: 'tytul', rozmiar: 5, kolor: '#ef4444' },
          },
          {
            id: 'polprzezroczysta',
            typ: 'tekst',
            tekst: 'KARTA',
            krycie: 0.4,
            tlo: '#1d4ed8',
            obramowanie: { grubosc: 0.4, kolor: '#facc15' },
            pozycja: { x: 10, y: 35, obrot: 15 },
            szerokosc: { mm: 40 },
            wysokosc: { mm: 14 },
            styl: {
              czcionka: 'tytul',
              rozmiar: 5,
              kolor: '#ffffff',
              wyrownanie: 'srodek',
              obwodka: { grubosc: 0.3, kolor: '#000000' },
            },
            luk: { promien: 40, kierunek: 'gora' },
          },
          {
            id: 'pelna',
            typ: 'ikona',
            ikona: 'gwiazdka',
            rozmiar: 6,
            krycie: 1,
            kolor: '#22c55e',
            pozycja: { x: 28, y: 70 },
          },
        ],
      },
    };

    const wynik = renderujRewers(r, ctx());
    expect(wynik.ostrzezenia).toEqual([]);

    // Warstwa z krycie = 0 nie emituje glifów ani koloru #ef4444.
    const svg = scenaDoSvg(wynik.scena, { przedrostekId: 'k-' });
    expect(svg).not.toContain('#ef4444');
    // Krycie tekstury (0.5), zabarwienie (0.35 + #7c2d12) oraz krycie warstwy (0.4).
    expect(svg).toContain('opacity="0.5"');
    expect(svg).toContain('opacity="0.35"');
    expect(svg).toContain('#7c2d12');
    expect(svg).toContain('opacity="0.4"');
    // Warstwa z krycie = 1 nie generuje zbędnego atrybutu opacity="1".
    expect(svg).not.toContain('opacity="1"');

    // Eksport PDF z grupami przezroczystości (Transparency Group Form XObject) i obróconymi glifami.
    const { bajty } = await scenyDoPdf([wynik.scena]);
    const pdf = await PDFDocument.load(bajty);
    expect(pdf.getPageCount()).toBe(1);
    const pdfTekst = new TextDecoder('latin1').decode(bajty);
    expect(pdfTekst).toContain('/Transparency');
    expect(pdfTekst).toContain('/DeviceRGB');
    expect(pdfTekst).toContain('/ExtGState');
  });

  it('obsługuje wieloliniowy tekst po łuku, szeroki łuk powyżej 180° oraz ikony :star: na łuku', () => {
    const r: Rewers = {
      id: 'luk-brzegowe',
      nazwa: 'Łuk brzegowe',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      korzen: {
        id: 'korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'wieloliniowy',
            typ: 'tekst',
            tekst: 'PIERWSZA :star: LINIA\nDRUGA LINIA',
            ikonyWTekscie: true,
            pozycja: { x: 4, y: 6 },
            szerokosc: { mm: 55 },
            wysokosc: { mm: 24 },
            styl: { czcionka: 'tytul', rozmiar: 4, kolor: '#111827', wyrownanie: 'srodek' },
            luk: { promien: 26, kierunek: 'gora' },
          },
          {
            id: 'szeroki-luk',
            typ: 'tekst',
            tekst: 'BARDZO DŁUGI NAPIS NA MAŁYM PROMIENIU ŁUKU',
            pozycja: { x: 4, y: 36 },
            szerokosc: { mm: 55 },
            wysokosc: { mm: 45 },
            styl: { czcionka: 'tytul', rozmiar: 4, kolor: '#111827', wyrownanie: 'srodek' },
            luk: { promien: 10, kierunek: 'dol' },
          },
        ],
      },
    };
    const wynik = renderujRewers(r, ctx());
    const wszystkie = wszystkieElementy(wynik.scena);
    const teksty = wszystkie.filter((e) => e.typ === 'tekst');
    const grupy = wszystkie.filter((e) => e.typ === 'grupa');
    expect(teksty.length).toBeGreaterThanOrEqual(2);
    // Ikona :star: na łuku emituje obróconą lub przesuniętą grupę ze ścieżką gwiazdki.
    const ikonyNaLuku = grupy.filter((g) => g.elementy.some((e) => e.typ === 'sciezka'));
    expect(ikonyNaLuku.length).toBeGreaterThanOrEqual(1);
    // Szeroki łuk zawiera glify o kątach przekraczających 45°.
    const maxKat = Math.max(...teksty.flatMap((t) => t.glify.map((g) => Math.abs(g.obrot ?? 0))));
    expect(maxKat).toBeGreaterThan(45);
  });
});

describe('wspólne pola awersu i rewersu', () => {
  const awersSzablon: Szablon = {
    id: 'sz-awers',
    nazwa: 'Awers',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo: '#ffffff',
    korzen: {
      id: 'ak',
      typ: 'kolumna',
      dzieci: [
        {
          id: 'a-nazwa',
          nazwa: 'Nazwa',
          typ: 'tekst',
          klucz: 'nazwa',
          styl: { czcionka: 'tytul', rozmiar: 4, kolor: '#111111' },
        },
        {
          id: 'a-koszt',
          nazwa: 'Koszt',
          typ: 'wartosc',
          klucz: 'koszt',
          ksztalt: 'prostokat',
          styl: { czcionka: 'tytul', rozmiar: 4, kolor: '#111111' },
        },
        {
          id: 'a-obraz',
          nazwa: 'Ilustracja',
          typ: 'obraz',
          klucz: 'ilustracja',
          dopasowanie: 'dopasuj',
        },
        {
          id: 'a-konflikt-1',
          nazwa: 'Notatka',
          typ: 'tekst',
          klucz: 'notatka1',
          styl: { czcionka: 'tytul', rozmiar: 3, kolor: '#111111' },
        },
        {
          id: 'a-konflikt-2',
          nazwa: 'Notatka',
          typ: 'tekst',
          klucz: 'notatka2',
          styl: { czcionka: 'tytul', rozmiar: 3, kolor: '#111111' },
        },
        {
          id: 'a-tab',
          nazwa: 'Statystyki',
          typ: 'tabela',
          kolumny: [
            { naglowek: 'Siła', klucz: 'sila' },
            { naglowek: 'Zręczność', klucz: 'zrecznosc' },
          ],
          stylNaglowka: { czcionka: 'tytul', rozmiar: 3, kolor: '#111111' },
          styl: { czcionka: 'tytul', rozmiar: 3, kolor: '#111111' },
        },
      ],
    },
  };

  const rewersWspolny: Rewers = {
    id: 'rev-wsp',
    nazwa: 'Rewers',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo: '#ffffff',
    korzen: {
      id: 'rk',
      typ: 'swobodny',
      dzieci: [
        {
          id: 'r-nazwa',
          nazwa: '  nazwa  ',
          typ: 'tekst',
          tekst: 'STAŁA',
          pozycja: { x: 4, y: 4 },
          szerokosc: { mm: 55 },
          wysokosc: { mm: 10 },
          styl: { czcionka: 'tytul', rozmiar: 4, kolor: '#111111' },
        },
        {
          // Ten sam napis „Koszt”, ale inny typ (tekst zamiast wartosc) – nie powinien się wiązać.
          id: 'r-koszt-zly-typ',
          nazwa: 'Koszt',
          typ: 'tekst',
          tekst: 'BEZ ZMIAN',
          pozycja: { x: 4, y: 18 },
          szerokosc: { mm: 55 },
          wysokosc: { mm: 10 },
          styl: { czcionka: 'tytul', rozmiar: 4, kolor: '#111111' },
        },
        {
          id: 'r-obraz',
          nazwa: 'Ilustracja',
          typ: 'obraz',
          zasob: 'obr-domyslny',
          dopasowanie: 'dopasuj',
          pozycja: { x: 4, y: 32 },
          szerokosc: { mm: 30 },
          wysokosc: { mm: 30 },
        },
        {
          // Niejednoznaczna nazwa na awersie (notatka1 vs notatka2) – nie wiąże się.
          id: 'r-notatka',
          nazwa: 'Notatka',
          typ: 'tekst',
          tekst: 'DOMYŚLNA NOTATKA',
          pozycja: { x: 4, y: 66 },
          szerokosc: { mm: 55 },
          wysokosc: { mm: 10 },
          styl: { czcionka: 'tytul', rozmiar: 3, kolor: '#111111' },
        },
        {
          // Tabela na rewersie ma własne klucze kolumn, ale te same nagłówki co awers.
          id: 'r-tab',
          nazwa: 'Statystyki',
          typ: 'tabela',
          pozycja: { x: 4, y: 76 },
          szerokosc: { mm: 55 },
          wysokosc: { mm: 10 },
          kolumny: [
            { naglowek: 'Siła', klucz: 'rew_kol_1' },
            { naglowek: 'Nieznana', klucz: 'rew_kol_2' },
          ],
          stylNaglowka: { czcionka: 'tytul', rozmiar: 3, kolor: '#111111' },
          styl: { czcionka: 'tytul', rozmiar: 3, kolor: '#111111' },
        },
      ],
    },
  };

  it('wspolneKluczeRewersu wykrywa wyłącznie jednoznaczne pola (w tym kolumny tabeli) o tym samym typie i nazwie', () => {
    const klucze = wspolneKluczeRewersu(awersSzablon, rewersWspolny);
    expect([...klucze].sort()).toEqual(['ilustracja', 'nazwa', 'sila']);
  });

  it('renderujRewers podstawia wartości z awersu (tekst, obraz i tabela), a pomija inny typ i puste pola', () => {
    const obrazy = new Map([
      ['obr-domyslny', { szerokosc: 100, wysokosc: 100 }],
      ['obr-karty', { szerokosc: 100, wysokosc: 100 }],
    ]);
    const kontekst = { czcionki, obraz: (id: string) => obrazy.get(id) };

    const zDanymi = renderujRewers(rewersWspolny, kontekst, {
      awers: {
        szablon: awersSzablon,
        dane: {
          nazwa: 'Miecz ognia',
          koszt: '99',
          ilustracja: 'obr-karty',
          notatka1: 'A',
          notatka2: 'B',
          sila: '14',
        },
      },
    });
    const bezDanych = renderujRewers(rewersWspolny, kontekst, {
      awers: { szablon: awersSzablon, dane: { nazwa: '   ' } },
    });

    // Obraz na rewersie przejął zasób z danych karty; bez danych wraca do domyślnego.
    const obrazyZDanymi = wszystkieElementy(zDanymi.scena)
      .filter((e) => e.typ === 'obraz')
      .map((e) => e.zasob);
    const obrazyBezDanych = wszystkieElementy(bezDanych.scena)
      .filter((e) => e.typ === 'obraz')
      .map((e) => e.zasob);
    expect(obrazyZDanymi).toEqual(['obr-karty']);
    expect(obrazyBezDanych).toEqual(['obr-domyslny']);

    // Tekst pola „Nazwa” i tabela zmieniły się; pole „Koszt” (inny typ) i „Notatka” (konflikt) zostały stałe.
    const tekstyZ = wszystkieElementy(zDanymi.scena).filter((e) => e.typ === 'tekst');
    const tekstyBez = wszystkieElementy(bezDanych.scena).filter((e) => e.typ === 'tekst');
    expect(tekstyZ.length).toBeGreaterThan(tekstyBez.length);
    expect(JSON.stringify(tekstyZ[0])).not.toBe(JSON.stringify(tekstyBez[0]));
    expect(JSON.stringify(tekstyZ[1])).toBe(JSON.stringify(tekstyBez[1]));
    expect(JSON.stringify(tekstyZ[2])).toBe(JSON.stringify(tekstyBez[2]));
  });
});
