import { describe, expect, it } from 'vitest';
import type { Szablon } from '../model/szablon';
import { scenyDoPdf } from '../druk/pdf';
import { renderujKarte } from '../silnik/karta';
import { scenaDoSvg } from '../silnik/svg';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import { konturPostrzepiony, szkicujElementy } from './dekoracje';
import { macierzeLuku, ramkaZMotywu } from './motyw';

const r = { x: 0, y: 0, szer: 60, wys: 80 };
const ustawienia = { sila: 1.5, ziarnistosc: 3, ziarno: 17 };

describe('dekoracje sceny', () => {
  it('rysuje deterministyczne wcięcia wewnątrz wycinka i reaguje na ziarno', () => {
    const a = konturPostrzepiony(r, ustawienia);
    expect(a).toEqual(konturPostrzepiony(r, { ...ustawienia }));
    expect(a).not.toEqual(konturPostrzepiony(r, { ...ustawienia, ziarno: 18 }));
    expect(a.length).toBeGreaterThan(30);
    for (const k of a) {
      if (k[0] === 'Z') continue;
      expect(k[1]).toBeGreaterThanOrEqual(0);
      expect(k[1]).toBeLessThanOrEqual(r.szer);
      expect(k[2]).toBeGreaterThanOrEqual(0);
      expect(k[2]).toBeLessThanOrEqual(r.wys);
    }
  });

  it('przy skrajnej sile i ziarnistości nie przecina własnych krawędzi', () => {
    const kontur = konturPostrzepiony(r, { sila: 3, ziarnistosc: 0.5, ziarno: 1 });
    const punkty = kontur.flatMap((k) =>
      k[0] === 'M' || k[0] === 'L' ? [[k[1], k[2]] as const] : [],
    );
    type P = (typeof punkty)[number];
    const strona = (a: P, b: P, p: P) =>
      (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    let przeciecia = 0;
    for (let i = 1; i < punkty.length; i++)
      for (let j = i + 2; j < punkty.length; j++) {
        const [a, b, c, d] = [punkty[i - 1]!, punkty[i]!, punkty[j - 1]!, punkty[j]!];
        if (strona(a, b, c) * strona(a, b, d) < 0 && strona(c, d, a) * strona(c, d, b) < 0)
          przeciecia++;
      }
    expect(przeciecia).toBe(0);
  });

  it('szkic zachowuje obrys i przekształca proste odcinki oraz kształty', () => {
    const obrys = { kolor: '#322456', grubosc: 0.2, kreska: [1, 1] };
    const obiekty: Parameters<typeof szkicujElementy>[0] = [
      { typ: 'linia', x1: 0, x2: 20, y1: 10, y2: 10, obrys },
      { typ: 'okrag', cx: 15, cy: 20, r: 12, obrys },
    ];
    const w = szkicujElementy(obiekty, { sila: 0.8, ziarno: 1 });
    expect(w).toEqual(szkicujElementy(obiekty, { sila: 0.8, ziarno: 1 }));
    expect(w).not.toEqual(szkicujElementy(obiekty, { sila: 0.8, ziarno: 2 }));
    expect(w.every((e) => e.typ === 'sciezka' && e.kontur.length > 4 && e.obrys === obrys)).toBe(
      true,
    );
  });

  it('prowadzi kafelki po łuku i używa zaokrąglonych szyn', () => {
    const macierze = macierzeLuku({ szer: 4, wys: 2 }, r, 3, 12);
    expect(macierze.some((m) => Math.abs(m[0]) > 0.01 && Math.abs(m[1]) > 0.01)).toBe(true);
    const wynik = ramkaZMotywu(
      {
        rodzaj: 'motyw',
        kolor: '#322456',
        szerokosc: 3,
        element: 'wb:pnacze',
        szyny: 0.3,
        poLuku: true,
      },
      r,
      { promien: 12 },
    );
    expect(Object.keys(wynik.symbole)).toEqual(['wb:pnacze']);
    const grupa = wynik.elementy[0];
    expect(grupa?.typ).toBe('grupa');
    if (grupa?.typ !== 'grupa') throw new Error('Brak grupy łuku');
    expect(grupa.przyciecieKonturem).toBeDefined();
    expect(grupa.elementy.filter((x) => x.typ === 'prostokat').map((x) => x.promien)).toEqual([
      11.85, 9.15,
    ]);
    expect(macierzeLuku({ szer: 100, wys: 1 }, r, 2, 12).length).toBeGreaterThan(20);
  });

  it('wycina tekstury tła jednakowym konturem w SVG i PDF', async () => {
    const szablon: Szablon = {
      id: 's',
      nazwa: 'Tekstura',
      rozmiar: { tryb: 'mm', szerokosc: r.szer, wysokosc: r.wys },
      teksturaTla: 'tekstura',
      postrzepienie: ustawienia,
      korzen: {
        id: 'panel',
        typ: 'kolumna',
        margines: 4,
        teksturaTla: 'tekstura',
        postrzepienie: ustawienia,
        tlo: '#ddeeff',
        dzieci: [],
      },
    };
    const { scena, ostrzezenia } = renderujKarte(
      szablon,
      { dane: {} },
      {
        czcionki: rejestrTestowy(),
        obraz: () => ({ szerokosc: 8, wysokosc: 8 }),
      },
    );
    expect(ostrzezenia).toEqual([]);
    const png = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        'base64',
      ),
    );
    const svg = scenaDoSvg(scena, { adresObrazu: () => 'data:image/png;base64,AA==' });
    expect(svg.match(/<clipPath[^>]*><path/g)).toHaveLength(2);
    expect(svg.match(/<image/g)).toHaveLength(2);
    const { bajty } = await scenyDoPdf([scena], { obraz: () => ({ format: 'png', dane: png }) });
    expect(Buffer.from(bajty).subarray(0, 4).toString()).toBe('%PDF');
  });
});
