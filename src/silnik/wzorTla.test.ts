import { describe, expect, it } from 'vitest';
import { scenyDoPdf } from '../druk/pdf';
import type { Rewers, RodzajWzoruTla, Szablon, WzorTla } from '../model/szablon';
import { renderujKarte, renderujRewers } from './karta';
import type { ElementOzdobny } from '../ozdobniki/typy';
import { rozwinWzor, type ElementSceny, type Kontur } from './scena';
import { scenaDoSvg } from './svg';
import { elementyWzoruSvg, elementyWzoruTla, MAX_KAFELKOW, MAX_KROPEK } from './wzorTla';
import { rejestrTestowy } from './__testy__/pomoc';

const ctx = {
  czcionki: rejestrTestowy(),
  obraz: (id: string) => (id === 'tekstura' ? { szerokosc: 300, wysokosc: 300 } : undefined),
};
const wzor = (rodzaj: RodzajWzoruTla, inne: Partial<WzorTla> = {}): WzorTla => ({
  rodzaj,
  grubosc: 0.3,
  odstep: 5,
  kolor: '#336699',
  ...inne,
});
const szablon = (w?: WzorTla, inne: Partial<Szablon> = {}): Szablon => ({
  id: 's',
  nazwa: 'S',
  rozmiar: { tryb: 'mm', szerokosc: 60, wysokosc: 90 },
  promienRogow: 3,
  tlo: '#fffbea',
  ...(w ? { wzorTla: w } : {}),
  korzen: { id: 'k', typ: 'swobodny', dzieci: [] },
  ...inne,
});
const odcinki = (e: ElementSceny[]) =>
  e.flatMap((x) => (x.typ === 'sciezka' ? x.kontur.filter((k) => k[0] === 'M') : []));

describe('wzór tła karty (N5)', () => {
  const obszar = { x: 0, y: 0, szer: 60, wys: 90 };

  it('linie pionowe i poziome co odstęp, kratka = obie rodziny, romby = dwie ukośne', () => {
    const pion = odcinki(elementyWzoruTla(wzor('pionowe'), obszar));
    // x = 0, 5, …, 60 (13 linii) plus zapas po bokach na grubość.
    expect(pion.length).toBeGreaterThanOrEqual(13);
    const xs = pion.map((m) => Math.round((m[1] as number) * 1000) / 1000);
    expect(xs).toContain(0);
    expect(xs).toContain(30);
    const poz = odcinki(elementyWzoruTla(wzor('poziome'), obszar));
    expect(poz.map((m) => Math.round(m[2] as number))).toContain(45);
    const kratka = odcinki(elementyWzoruTla(wzor('kratka'), obszar));
    expect(kratka.length).toBe(pion.length + poz.length);
    const romby = elementyWzoruTla(wzor('romby'), obszar);
    const ukosne = elementyWzoruTla(wzor('ukosne'), obszar);
    expect(odcinki(romby).length).toBeGreaterThan(odcinki(ukosne).length);
    const linia = romby[0]!;
    expect(linia.typ === 'sciezka' && linia.obrys).toEqual({ kolor: '#336699', grubosc: 0.3 });
  });

  it('obrót i przesunięcie przesuwają linie; kropki to wypełnione koła', () => {
    const przes = odcinki(
      elementyWzoruTla(wzor('pionowe', { przesuniecie: { x: 2, y: 0 } }), obszar),
    );
    expect(przes.map((m) => Math.round(m[1] as number))).toContain(32);
    const obrocone = elementyWzoruTla(wzor('pionowe', { obrot: 90 }), obszar);
    const ys = odcinki(obrocone).map((m) => Math.round(m[2] as number));
    expect(ys).toContain(45);
    const kropki = elementyWzoruTla(wzor('kropki', { grubosc: 1 }), obszar)[0]!;
    expect(kropki.typ).toBe('sciezka');
    if (kropki.typ === 'sciezka') {
      expect(kropki.wypelnienie).toBe('#336699');
      expect(kropki.obrys).toBeUndefined();
      // 13 × 19 kropek w siatce 5 mm na karcie 60 × 90.
      expect(kropki.kontur.filter((k) => k[0] === 'M').length).toBe(13 * 19);
    }
  });

  it('gęste kropki są ograniczone liczbowo', () => {
    const e = elementyWzoruTla(wzor('kropki', { odstep: 0.5, grubosc: 0.2 }), {
      x: 0,
      y: 0,
      szer: 300,
      wys: 300,
    })[0]!;
    expect(e.typ === 'sciezka' && e.kontur.filter((k) => k[0] === 'M').length).toBeLessThanOrEqual(
      MAX_KROPEK * 1.05,
    );
  });

  it('karta: wzór nad kolorem tła, przycięty do rogów, z kryciem; kolejność względem tekstury', () => {
    const w = renderujKarte(szablon(wzor('kratka', { krycie: 0.4 })), { dane: {} }, ctx).scena;
    expect(w.elementy[0]!.typ).toBe('prostokat');
    const g = w.elementy[1]!;
    expect(g.typ).toBe('grupa');
    if (g.typ === 'grupa') {
      expect(g.krycie).toBe(0.4);
      expect(g.przyciecieKonturem).toBeDefined();
    }
    const nad = renderujKarte(
      szablon(wzor('kratka'), { teksturaTla: 'tekstura' }),
      { dane: {} },
      ctx,
    ).scena.elementy;
    const pod = renderujKarte(
      szablon(wzor('kratka', { podTekstura: true }), { teksturaTla: 'tekstura' }),
      { dane: {} },
      ctx,
    ).scena.elementy;
    const jestWzor = (e: ElementSceny) =>
      e.typ === 'grupa' && e.elementy.some((x) => x.typ === 'sciezka');
    const jestObraz = (e: ElementSceny) =>
      e.typ === 'obraz' || (e.typ === 'grupa' && e.elementy.some((x) => x.typ === 'obraz'));
    expect(nad.findIndex(jestWzor)).toBeGreaterThan(nad.findIndex(jestObraz));
    expect(pod.findIndex(jestWzor)).toBeLessThan(pod.findIndex(jestObraz));
  });

  it('tryb drukarni: wzór sięga spadu i trzyma położenie względem karty netto', () => {
    const sz = szablon(wzor('pionowe'));
    const bez = renderujKarte(sz, { dane: {} }, ctx).scena.elementy[1]!;
    const zew = renderujKarte(sz, { dane: {} }, ctx, { spad: 3 }).scena.elementy[0]!;
    const ze = (zew.typ === 'grupa' ? zew.elementy[1] : undefined)!;
    expect(ze.typ === 'grupa' && ze.przyciecie).toEqual({ x: -3, y: -3, szer: 66, wys: 96 });
    const xs = (e: ElementSceny) =>
      e.typ === 'grupa' ? odcinki(e.elementy).map((m) => Math.round((m[1] as number) * 100)) : [];
    expect(xs(ze)).toEqual(expect.arrayContaining(xs(bez)));
    expect(Math.min(...xs(ze))).toBeLessThan(-300);
  });

  it('rewers rysuje wzór; SVG i PDF zawierają wektorowe linie', async () => {
    const r: Rewers = {
      id: 'r',
      nazwa: 'R',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      tlo: '#ffffff',
      wzorTla: wzor('romby'),
      korzen: { id: 'k', typ: 'swobodny', dzieci: [] },
    };
    const scena = renderujRewers(r, ctx).scena;
    const svg = scenaDoSvg(scena);
    expect(svg).toContain('stroke="#336699"');
    const { bajty } = await scenyDoPdf([scena]);
    expect(bajty.length).toBeGreaterThan(0);
  });
});

describe('wzór tła z biblioteki SVG (N9)', () => {
  const obszar = { x: 0, y: 0, szer: 60, wys: 90 };
  // Rysunek 10 × 5 (szerszy niż wyższy) – dłuższy bok = rozmiar kafelka.
  const kwadrat = (kolor: string, drugi?: string): ElementOzdobny => ({
    id: 'wlasny-kafel',
    nazwa: 'Kafel',
    rodzaj: 'naroznik',
    szer: 10,
    wys: 5,
    kontury: [
      {
        kontur: [['M', 0, 0], ['L', 10, 0], ['L', 10, 5], ['Z']],
        wypelnienie: kolor,
      },
      ...(drugi
        ? [
            {
              kontur: [['M', 0, 0], ['L', 5, 5], ['Z']] as Kontur,
              obrys: { grubosc: 1, kolor: drugi },
            },
          ]
        : []),
    ],
  });
  const svgWzor = (inne: Partial<WzorTla> = {}) =>
    wzor('svg', { element: 'wlasny-kafel', rozmiar: 8, ...inne });
  const wzorSceny = (e: ElementSceny[]) => {
    const w = e[0];
    if (w?.typ !== 'wzor') throw new Error('brak wzoru');
    return w;
  };

  it('siatka: kafelek o dłuższym boku = rozmiar, okres = kafelek + odstępy', () => {
    const w = elementyWzoruSvg(svgWzor({ odstepX: 2, odstepY: 1 }), obszar, kwadrat('#ff0000'));
    const p = wzorSceny(w.elementy);
    expect([p.szer, p.wys]).toEqual([10, 5]);
    expect(p.elementy).toHaveLength(1);
    expect(p.macierz).toEqual([1, 0, -0, 1, 0, 0]);
    expect(Object.keys(w.symbole)).toEqual(['wzor-tla:wlasny-kafel:kolor']);
  });

  it('cegiełka i pion: kafelek podwójnej wysokości / szerokości z kopią przesuniętą o pół', () => {
    const e = kwadrat('#ff0000');
    const c = wzorSceny(elementyWzoruSvg(svgWzor({ uklad: 'cegielka' }), obszar, e).elementy);
    expect([c.szer, c.wys]).toEqual([8, 8]);
    const m = c.elementy.map((x) => (x.typ === 'symbol' ? x.macierz.slice(4) : []));
    expect(m).toEqual([
      [0, 0],
      [4, 4],
    ]);
    const p = wzorSceny(elementyWzoruSvg(svgWzor({ uklad: 'pion' }), obszar, e).elementy);
    expect([p.szer, p.wys]).toEqual([16, 4]);
    expect(p.elementy.map((x) => (x.typ === 'symbol' ? x.macierz.slice(4) : []))).toEqual([
      [0, 0],
      [8, 2],
    ]);
  });

  it('obrót i przesunięcie początku w macierzy wzoru', () => {
    const p = wzorSceny(
      elementyWzoruSvg(
        svgWzor({ obrot: 90, przesuniecie: { x: 3, y: 4 } }),
        obszar,
        kwadrat('#f00'),
      ).elementy,
    );
    expect(p.macierz).toEqual([0, 1, -1, 0, 3, 4]);
  });

  it('jednokolorowy dostaje kolor wzoru, wielokolorowy zachowuje kolory pliku', () => {
    const jeden = elementyWzoruSvg(svgWzor(), obszar, kwadrat('#ff0000'));
    const s1 = wzorSceny(jeden.elementy).elementy[0]!;
    expect(s1.typ === 'symbol' && s1.kolor).toBe('#336699');
    expect(Object.values(jeden.symbole)[0]!.kontury[0]!.wypelnienie).toBe('kolor');
    const wiele = elementyWzoruSvg(svgWzor(), obszar, kwadrat('#ff0000', '#00ff00'));
    expect(Object.keys(wiele.symbole)).toEqual(['wzor-tla:wlasny-kafel']);
    expect(Object.values(wiele.symbole)[0]!.kontury[0]!.wypelnienie).toBe('#ff0000');
  });

  it('gęsty wzór jest ograniczony liczbą kafelków (kafelki powiększone proporcjonalnie)', () => {
    const p = wzorSceny(
      elementyWzoruSvg(
        svgWzor({ rozmiar: 1 }),
        { x: 0, y: 0, szer: 300, wys: 300 },
        kwadrat('#f00'),
      ).elementy,
    );
    expect((300 * 300) / (p.szer * p.wys)).toBeLessThanOrEqual(MAX_KAFELKOW + 1);
  });

  it('karta: wzór przycięty do rogów; SVG ma <pattern> w mm, PDF – kopie wektorowe (jeden XObject)', async () => {
    const w = renderujKarte(
      szablon(svgWzor({ obrot: 30, uklad: 'cegielka' })),
      { dane: {} },
      { ...ctx, elementy: [kwadrat('#ff0000')] },
    );
    expect(w.ostrzezenia).toEqual([]);
    const grupa = w.scena.elementy.find((e) => e.typ === 'grupa');
    expect(grupa?.typ === 'grupa' && grupa.przyciecieKonturem).toBeTruthy();
    const svg = scenaDoSvg(w.scena);
    expect(svg).toContain('<pattern');
    expect(svg).toContain('patternUnits="userSpaceOnUse"');
    expect(svg).toMatch(/patternTransform="matrix\(0\.866/);
    expect(svg).toContain('fill="url(#w');
    const pdf = await scenyDoPdf([w.scena]);
    expect(pdf.liczbaSymboli).toBe(1);
    expect(pdf.pominieteObrazy).toEqual([]);
  });

  it('brak grafiki w bibliotece: samo tło kolorem i ostrzeżenie (bez błędu)', () => {
    const w = renderujKarte(szablon(svgWzor()), { dane: {} }, ctx);
    expect(w.ostrzezenia).toEqual([
      { pole: 'tlo-karty', komunikat: 'nieznany-element-ozdobny', szczegoly: 'wlasny-kafel' },
    ]);
    expect(w.scena.elementy.some((e) => e.typ === 'grupa')).toBe(false);
    expect(w.scena.elementy[0]).toMatchObject({ typ: 'prostokat', wypelnienie: '#fffbea' });
  });

  it('rozwinWzor pokrywa obszar kopiami (także po obrocie) i przycina do obszaru', () => {
    const p = wzorSceny(elementyWzoruSvg(svgWzor({ obrot: 45 }), obszar, kwadrat('#f00')).elementy);
    const g = rozwinWzor(p);
    expect(g.typ === 'grupa' && g.przyciecie).toEqual(obszar);
    const wew = g.typ === 'grupa' ? g.elementy[0] : undefined;
    const kopie = wew?.typ === 'grupa' ? wew.elementy.length : 0;
    // Obwiednia obróconego obszaru (≈106 × 106 mm) / kafelek 8 × 4 mm.
    expect(kopie).toBeGreaterThan((106 * 106) / 32);
  });

  it('kropki w cegiełce: co drugi rząd przesunięty o pół odstępu', () => {
    const srodki = (uklad?: 'cegielka') => {
      const [e] = elementyWzoruTla(
        wzor('kropki', { grubosc: 1, odstep: 10, ...(uklad ? { uklad } : {}) }),
        {
          x: 0,
          y: 0,
          szer: 20,
          wys: 20,
        },
      );
      const k = e?.typ === 'sciezka' ? e.kontur.filter((x) => x[0] === 'M') : [];
      // Punkt M koła = (cx + r, cy).
      return k.map((x) => `${Math.round((x[1] as number) - 0.5)},${Math.round(x[2] as number)}`);
    };
    expect(srodki()).toContain('0,10');
    expect(srodki()).not.toContain('5,10');
    expect(srodki('cegielka')).toContain('5,10');
    expect(srodki('cegielka')).toContain('0,0');
  });
});
