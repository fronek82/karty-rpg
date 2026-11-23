import { describe, expect, it } from 'vitest';
import { scenyDoPdf } from '../druk/pdf';
import type { Rewers, RodzajWzoruTla, Szablon, WzorTla } from '../model/szablon';
import { renderujKarte, renderujRewers } from './karta';
import type { ElementSceny } from './scena';
import { scenaDoSvg } from './svg';
import { elementyWzoruTla, MAX_KROPEK } from './wzorTla';
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
