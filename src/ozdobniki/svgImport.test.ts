import { describe, expect, it } from 'vitest';
import {
  kolorSvg,
  importujSvg,
  liczbaScisla,
  parsujTransformacje,
  splaszczSciezke,
  LIMITY_SVG,
} from './svgImport';
import { BladImportuSvg } from './svgImport';
import { parsujXml } from './svgXml';
import type { Kontur } from '../silnik/scena';

const svg = (tresc: string, atr = 'viewBox="0 0 20 20"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${atr}>${tresc}</svg>`;

const kody = (s: string) => importujSvg(s).raport.map((r) => r.kod);

/** Punkty na krzywych kontur: próbkowanie segmentów M/L/C. */
function probki(k: Kontur, n = 20): [number, number][] {
  const p: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (const c of k) {
    if (c[0] === 'M' || c[0] === 'L') {
      x = c[1];
      y = c[2];
      p.push([x, y]);
    } else if (c[0] === 'C') {
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        p.push([
          u ** 3 * x + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t ** 3 * c[5],
          u ** 3 * y + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t ** 3 * c[6],
        ]);
      }
      x = c[5];
      y = c[6];
    }
  }
  return p;
}

describe('parser XML', () => {
  it('buduje drzewo, rozwija encje standardowe i pomija DOCTYPE z encjami własnymi', () => {
    const w = parsujXml(
      `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "&b;&b;"><!ENTITY b "xxxxxxxx">]>
       <svg a="1 &amp; 2 &#65;"><!-- k --><g id="x"/><![CDATA[ignorowane]]></svg>`,
    );
    expect(w.nazwa).toBe('svg');
    expect(w.atr.a).toBe('1 & 2 A');
    expect(w.dzieci).toHaveLength(1);
    // Encja własna nie jest rozwijana.
    expect(parsujXml('<svg a="&a;"/>').atr.a).toBe('&a;');
  });
  it('odrzuca niepoprawny XML', () => {
    for (const zle of ['<svg>', '<svg></g>', '<svg a=1/>', 'tekst', '<svg/><svg/>', '<svg a="x']) {
      expect(() => parsujXml(zle), zle).toThrow();
    }
  });
});

describe('spłaszczanie ścieżek – referencje liczbowe', () => {
  it('łuk A → krzywe Béziera leżą na okręgu (tolerancja 1e-3 promienia)', () => {
    const k = splaszczSciezke('M0 0 A5 5 0 0 1 10 0');
    expect(k.every((c) => c[0] === 'M' || c[0] === 'C')).toBe(true);
    for (const [x, y] of probki(k, 30).slice(1)) {
      expect(Math.hypot(x - 5, y)).toBeCloseTo(5, 2);
      expect(y).toBeLessThanOrEqual(1e-9);
    }
    // Półokrąg przechodzi przez górny punkt (5, −5).
    expect(probki(k, 30).some(([x, y]) => Math.abs(x - 5) < 1e-6 && Math.abs(y + 5) < 1e-3)).toBe(
      true,
    );
  });
  it('łuk eliptyczny z obrotem – punkty spełniają równanie elipsy', () => {
    // Elipsa rx=10, ry=5 obrócona o 30°, łuk od (0,0) do (10,10).
    const k = splaszczSciezke('M0 0 A10 5 30 0 1 10 10');
    const pkt = probki(k, 40);
    expect(pkt.at(-1)![0]).toBeCloseTo(10, 6);
    expect(pkt.at(-1)![1]).toBeCloseTo(10, 6);
    // Środek elipsy: dowolne 3 punkty łuku wyznaczają tę samą elipsę – sprawdzamy stałość
    // wartości formy kwadratowej względem środka wyliczonego z początku i końca (rozwiązanie
    // analityczne SVG F.6.5 dla fA=0, fS=1).
    const ph = (30 * Math.PI) / 180;
    const [dx, dy] = [(0 - 10) / 2, (0 - 10) / 2];
    const x1 = Math.cos(ph) * dx + Math.sin(ph) * dy;
    const y1 = -Math.sin(ph) * dx + Math.cos(ph) * dy;
    const lam = (x1 * x1) / 100 + (y1 * y1) / 25;
    const rx = lam > 1 ? 10 * Math.sqrt(lam) : 10;
    const ry = lam > 1 ? 5 * Math.sqrt(lam) : 5;
    const licz =
      (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) /
      (rx * rx * y1 * y1 + ry * ry * x1 * x1);
    const znak = -1; // fA ≠ fS → +, tu fA = 0, fS = 1 → +; poniżej sprawdzamy oba znaki
    void znak;
    const wsp = Math.sqrt(Math.max(0, licz));
    const kandydaci = [wsp, -wsp].map((s) => {
      const cxp = (s * rx * y1) / ry;
      const cyp = (-s * ry * x1) / rx;
      return [
        Math.cos(ph) * cxp - Math.sin(ph) * cyp + 5,
        Math.sin(ph) * cxp + Math.cos(ph) * cyp + 5,
      ] as [number, number];
    });
    const blad = (c: [number, number]) =>
      Math.max(
        ...pkt.map(([x, y]) => {
          const ux = Math.cos(ph) * (x - c[0]) + Math.sin(ph) * (y - c[1]);
          const uy = -Math.sin(ph) * (x - c[0]) + Math.cos(ph) * (y - c[1]);
          return Math.abs((ux * ux) / (rx * rx) + (uy * uy) / (ry * ry) - 1);
        }),
      );
    expect(Math.min(...kandydaci.map(blad))).toBeLessThan(2e-3);
  });
  it('skróty i polecenia względne: H, V, S, T, Q, h, v, c', () => {
    const k = splaszczSciezke('M10 10 H20 V30 h-5 v-5 Q25 40 30 30 T40 30 C0 0 1 1 2 2 S5 5 6 6 z');
    expect(k.every((c) => ['M', 'L', 'C', 'Z'].includes(c[0]))).toBe(true);
    expect(k.slice(0, 5)).toEqual([
      ['M', 10, 10],
      ['L', 20, 10],
      ['L', 20, 30],
      ['L', 15, 30],
      ['L', 15, 25],
    ]);
    // Q (15,25) → (25,40) → (30,30) jako C: punkty kontrolne w 2/3.
    const q = k[5] as ['C', ...number[]];
    expect(q[1]).toBeCloseTo(15 + (2 / 3) * 10, 9);
    expect(q[2]).toBeCloseTo(25 + (2 / 3) * 15, 9);
    expect(q[3]).toBeCloseTo(30 + (2 / 3) * -5, 9);
    expect(q[4]).toBeCloseTo(30 + (2 / 3) * 10, 9);
    expect(k.at(-1)).toEqual(['Z']);
  });
  it('po Z rysowanie bez M zaczyna się w początku podścieżki', () => {
    const k = splaszczSciezke('M1 1 L5 1 L5 5 Z L9 9');
    expect(k).toEqual([['M', 1, 1], ['L', 5, 1], ['L', 5, 5], ['Z'], ['M', 1, 1], ['L', 9, 9]]);
  });
  it('transformacje: obrót o 90° prostokąta', () => {
    const m = parsujTransformacje('rotate(90)');
    const k = splaszczSciezke('M0 0H10V20H0Z', m);
    const p = k.filter((c) => c[0] === 'L').map((c) => [c[1], c[2]] as [number, number]);
    expect(p[0]![0]).toBeCloseTo(0, 9);
    expect(p[0]![1]).toBeCloseTo(10, 9);
    expect(p[1]![0]).toBeCloseTo(-20, 9);
    expect(p[1]![1]).toBeCloseTo(10, 9);
    expect(p[2]![0]).toBeCloseTo(-20, 9);
    expect(p[2]![1]).toBeCloseTo(0, 9);
  });
  it('transformacje: składanie translate · scale · rotate wokół punktu · skew', () => {
    expect(parsujTransformacje('translate(10 5) scale(2)')).toEqual([2, 0, 0, 2, 10, 5]);
    const r = parsujTransformacje('rotate(90 10 10)');
    // (20,10) → obrót o 90° wokół (10,10) → (10,20).
    expect(r[0] * 20 + r[2] * 10 + r[4]).toBeCloseTo(10, 9);
    expect(r[1] * 20 + r[3] * 10 + r[5]).toBeCloseTo(20, 9);
    const sk = parsujTransformacje('skewX(45)');
    expect(sk[2]).toBeCloseTo(1, 9);
    expect(parsujTransformacje('matrix(1 2 3 4 5 6)')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(parsujTransformacje('nieznana(1)')).toEqual([1, 0, 0, 1, 0, 0]);
  });
  it('łuk po niejednorodnej skali dalej dotyka punktów końcowych', () => {
    const k = splaszczSciezke('M0 0 A5 5 0 0 1 10 0', [3, 0, 0, 1, 0, 0]);
    const p = probki(k, 30);
    expect(p.at(-1)![0]).toBeCloseTo(30, 6);
    // Elipsa o półosiach 15 × 5 wokół (15, 0).
    for (const [x, y] of p.slice(1)) expect(((x - 15) / 15) ** 2 + (y / 5) ** 2).toBeCloseTo(1, 2);
  });
});

describe('kolory SVG', () => {
  it('parsuje zapisy i zwraca null dla nieznanych', () => {
    expect(kolorSvg('#F00')).toBe('#ff0000');
    expect(kolorSvg('rgb(255, 128, 0)')).toBe('#ff8000');
    expect(kolorSvg('rgb(100%, 0%, 0%)')).toBe('#ff0000');
    expect(kolorSvg('Red')).toBe('#ff0000');
    expect(kolorSvg('none')).toBeUndefined();
    expect(kolorSvg('currentColor')).toBe('kolor');
    expect(kolorSvg('niemakolor')).toBeNull();
  });
});

describe('import SVG – kształty i normalizacja', () => {
  it('normalizuje do wysokości 10 według viewBox i spłaszcza kształty', () => {
    const w = importujSvg(
      svg(
        `<rect x="2" y="2" width="16" height="8" rx="2"/><circle cx="10" cy="15" r="3"/>
         <ellipse cx="5" cy="15" rx="2" ry="1"/><line x1="0" y1="0" x2="20" y2="0" stroke="red"/>
         <polyline points="0,0 5,5 10,0" fill="none" stroke="#00f" stroke-width="2"/>
         <polygon points="0,0 4,0 4,4"/>`,
        'viewBox="0 0 40 20"',
      ),
    );
    expect(w.element.szer).toBe(20);
    expect(w.element.wys).toBe(10);
    expect(w.liczbaSciezek).toBe(6);
    const wszystkie = w.element.kontury.flatMap((k) => k.kontur);
    expect(wszystkie.every((c) => ['M', 'L', 'C', 'Z'].includes(c[0]))).toBe(true);
    // Skala 0,5: obrys polyline 2 → 1.
    expect(w.element.kontury.find((k) => k.obrys?.kolor === '#0000ff')?.obrys?.grubosc).toBe(1);
    // Linia nie ma wypełnienia.
    expect(
      w.element.kontury.find((k) => k.obrys?.kolor === '#ff0000')?.wypelnienie,
    ).toBeUndefined();
  });
  it('transformacje grup składają się od zewnątrz do wewnątrz', () => {
    const w = importujSvg(
      svg('<g transform="translate(10 0)"><rect transform="scale(2)" width="2" height="2"/></g>'),
    );
    const xs = w.element.kontury[0]!.kontur.filter((c) => c[0] !== 'Z').map((c) => c[1] as number);
    // Prostokąt 2×2 → skala 2 → 4×4 od x=10; viewBox 20 → skala 0,5.
    expect(Math.min(...xs)).toBe(5);
    expect(Math.max(...xs)).toBe(7);
  });
  it('use do elementu w defs, z przesunięciem x/y', () => {
    const w = importujSvg(
      svg('<defs><path id="a" d="M0 0H4V4H0Z"/></defs><use href="#a" x="10" y="10"/>'),
    );
    const xs = w.element.kontury[0]!.kontur.filter((c) => c[0] !== 'Z').map((c) => c[1] as number);
    expect(Math.min(...xs)).toBe(5);
    expect(w.liczbaSciezek).toBe(1);
  });
  it('bez viewBox: width/height, a bez nich obwiednia', () => {
    expect(
      importujSvg('<svg width="30" height="10"><rect width="10" height="10"/></svg>').element.szer,
    ).toBe(30);
    const w = importujSvg('<svg><rect x="10" y="10" width="40" height="20"/></svg>');
    expect(w.element.szer).toBe(20);
    expect(w.element.kontury[0]!.kontur[0]).toEqual(['M', 0, 0]);
  });
  it('evenodd zachowany tylko przy wielu podścieżkach', () => {
    const dwa = importujSvg(svg('<path fill-rule="evenodd" d="M0 0H20V20H0ZM5 5H15V15H5Z"/>'))
      .element.kontury[0]!;
    expect(dwa.evenodd).toBe(true);
    const jeden = importujSvg(svg('<path fill-rule="evenodd" d="M0 0H20V20H0Z"/>')).element
      .kontury[0]!;
    expect(jeden.evenodd).toBeUndefined();
  });
});

describe('kolorowanie', () => {
  it('jeden kolor lub currentColor → jednolity; wiele → oryginał', () => {
    expect(
      importujSvg(svg('<rect width="5" height="5" fill="#123456"/>')).element.kolorowanie,
    ).toBe('jednolity');
    expect(importujSvg(svg('<path d="M0 0H5V5Z" fill="currentColor"/>')).element.kolorowanie).toBe(
      'jednolity',
    );
    expect(importujSvg(svg('<rect width="5" height="5"/>')).element.kolorowanie).toBe('jednolity');
    const dwa = importujSvg(
      svg('<rect width="5" height="5" fill="red"/><rect width="5" height="5" fill="blue"/>'),
    );
    expect(dwa.element.kolorowanie).toBe('oryginal');
    expect(dwa.liczbaKolorow).toBe(2);
  });
  it('currentColor zapisany jako „kolor”, fill dziedziczony po grupie, styl z atrybutu style', () => {
    const w = importujSvg(
      svg(
        '<g fill="currentColor"><rect width="5" height="5"/><rect width="5" height="5" style="fill:#0f0;stroke:#000;stroke-width:2"/></g>',
      ),
    );
    expect(w.element.kontury[0]!.wypelnienie).toBe('kolor');
    expect(w.element.kontury[1]!.wypelnienie).toBe('#00ff00');
    expect(w.element.kontury[1]!.obrys?.kolor).toBe('#000000');
    expect(w.element.kolorowanie).toBe('oryginal');
  });
  it('opcja nadpisuje wykrycie; gradient → pierwszy kolor z raportem', () => {
    const w = importujSvg(
      svg(
        '<defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs><rect width="5" height="5" fill="url(#g)"/>',
      ),
      { kolorowanie: 'oryginal', rodzaj: 'ksztalt' },
    );
    expect(w.element.kontury[0]!.wypelnienie).toBe('#ff0000');
    expect(w.element.kolorowanie).toBe('oryginal');
    expect(w.element.rodzaj).toBe('ksztalt');
    expect(w.raport.map((r) => r.kod)).toContain('gradient');
  });
});

describe('złośliwe i nieobsługiwane pliki', () => {
  it('skrypt, onload, zewnętrzny href, foreignObject – usunięte i zgłoszone', () => {
    const w = importujSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20" onload="alert(1)">
        <script>alert(document.cookie)</script>
        <foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml" onclick="x()">x</div></foreignObject>
        <image href="https://example.com/a.png" width="5" height="5"/>
        <use xlink:href="https://example.com/a.svg#x"/>
        <a href="javascript:alert(1)"><rect width="5" height="5" onmouseover="x()"/></a>
        <rect width="10" height="10"/>
      </svg>`,
    );
    const k = w.raport.map((r) => r.kod);
    for (const oczekiwany of [
      'skrypt',
      'zdarzenie',
      'foreignObject',
      'obraz',
      'odwolanie-zewnetrzne',
    ])
      expect(k, oczekiwany).toContain(oczekiwany);
    expect(w.raport.find((r) => r.kod === 'zdarzenie')!.ile).toBe(3);
    // Wynik to wyłącznie kontury – żadnego tekstu z pliku.
    expect(JSON.stringify(w.element)).not.toMatch(/alert|script|onload|example\.com|cookie/);
    expect(w.liczbaSciezek).toBe(2);
  });
  it('tekst, filtr, maska, przycięcie, wzór, animacja, nieprzezroczystość, kreskowanie', () => {
    const w = importujSvg(
      svg(
        `<defs><filter id="f"><feGaussianBlur stdDeviation="2"/></filter><mask id="m"/><clipPath id="c"/>
         <pattern id="p" width="2" height="2"/></defs>
         <text x="1" y="1">Napis</text>
         <rect width="5" height="5" filter="url(#f)" mask="url(#m)" clip-path="url(#c)" opacity="0.5" stroke="#000" stroke-dasharray="1 2"/>
         <rect width="5" height="5"><animate attributeName="x" to="3"/></rect>
         <style>.a{fill:red}</style>`,
      ),
    );
    const k = w.raport.map((r) => r.kod);
    for (const o of [
      'tekst',
      'filtr',
      'maska',
      'przyciecie',
      'wzor',
      'animacja',
      'przezroczystosc',
      'kreskowanie',
      'styl-css',
    ])
      expect(k, o).toContain(o);
    // Filtr nie jest liczony podwójnie (definicja + użycie).
    expect(w.raport.find((r) => r.kod === 'filtr')!.ile).toBe(1);
  });
  it('nieznany element i nieznany kolor w raporcie ze szczegółami', () => {
    const w = importujSvg(svg('<blink/><rect width="5" height="5" fill="kolorX"/>'));
    expect(w.raport.find((r) => r.kod === 'nieznany-element')!.szczegoly).toBe('blink');
    expect(w.raport.find((r) => r.kod === 'nieznany-kolor')!.szczegoly).toBe('kolorX');
  });
  it('elementy innych przestrzeni nazw (metadane edytorów) są pomijane po cichu', () => {
    expect(
      kody(
        svg(
          '<sodipodi:namedview id="x"/><metadata><rdf:RDF/></metadata><rect width="5" height="5"/>',
        ),
      ),
    ).toEqual([]);
  });
  it('display:none i visibility:hidden nie rysują', () => {
    const w = importujSvg(
      svg(
        '<rect width="5" height="5" display="none"/><g style="visibility:hidden"><rect width="5" height="5"/></g><rect width="6" height="6"/>',
      ),
    );
    expect(w.liczbaSciezek).toBe(1);
  });
  it('plik bez kształtów, nie-SVG i uszkodzony XML są odrzucane', () => {
    const kod = (s: string) => {
      try {
        importujSvg(s);
      } catch (e) {
        return (e as BladImportuSvg).kod;
      }
      return 'ok';
    };
    expect(kod(svg('<text>a</text>'))).toBe('pusty');
    expect(kod('<html></html>')).toBe('nie-svg');
    expect(kod('<svg><g></svg>')).toBe('xml');
    expect(kod(svg('<rect width="0" height="5"/>'))).toBe('pusty');
  });
});

describe('bomby i limity', () => {
  it('plik większy niż limit bajtów', () => {
    const duzy = svg(`<!--${'x'.repeat(LIMITY_SVG.bajty)}--><rect width="5" height="5"/>`);
    expect(() => importujSvg(duzy)).toThrow(/KB/);
    expect(() => importujSvg(new Uint8Array(LIMITY_SVG.bajty + 1))).toThrow(BladImportuSvg);
  });
  it('zbyt wiele elementów i zbyt głębokie zagnieżdżenie', () => {
    const wiele = svg('<g/>'.repeat(20001));
    expect(() => importujSvg(wiele)).toThrow(/elementów/);
    const gleboko = svg('<g>'.repeat(100) + '<rect width="1" height="1"/>' + '</g>'.repeat(100));
    expect(() => importujSvg(gleboko)).toThrow(/zagnieżdżenie/);
  });
  it('wykładnicza bomba <use> kończy się błędem, nie zawieszeniem', () => {
    let defs = '<path id="u0" d="M0 0H1V1Z"/>';
    for (let i = 1; i <= 12; i++)
      defs += `<g id="u${i}"><use href="#u${i - 1}"/><use href="#u${i - 1}"/><use href="#u${i - 1}"/></g>`;
    const t0 = Date.now();
    expect(() => importujSvg(svg(`<defs>${defs}</defs><use href="#u12"/>`))).toThrow(
      BladImportuSvg,
    );
    expect(Date.now() - t0).toBeLessThan(3000);
  });
  it('pętla use (cykl) nie zapętla importu', () => {
    const w = importujSvg(
      svg('<g id="a"><rect width="5" height="5"/><use href="#a"/></g><use href="#a"/>'),
    );
    expect(w.liczbaSciezek).toBeGreaterThan(0);
  });
  it('więcej niż 20 000 komend po spłaszczeniu', () => {
    // Pojedyncza ścieżka z 25 000 odcinków (~200 KB).
    const d = 'M0 0' + 'l1 1'.repeat(25000);
    expect(() => importujSvg(svg(`<path d="${d}"/>`, 'viewBox="0 0 30000 30000"'))).toThrow(
      /komend/,
    );
  });
  it('ścieżka z liczbami poza zakresem nie psuje wyniku', () => {
    const w = importujSvg(svg('<path d="M0 0L1e999 5Z"/><rect width="5" height="5"/>'));
    const wszystkie = w.element.kontury.flatMap((k) =>
      k.kontur.flatMap((c) => c.slice(1) as number[]),
    );
    expect(wszystkie.every((v) => Number.isFinite(v as number))).toBe(true);
  });
  it('gigantyczne łuki i skale: błąd wymiarów albo skończone liczby w zakresie', () => {
    try {
      const w = importujSvg(
        svg(
          '<path d="M0 0A1e9 1e9 0 1 1 10 10"/><rect width="5" height="5"/>',
          'viewBox="0 0 20 20"',
        ),
      );
      for (const k of w.element.kontury)
        for (const c of k.kontur)
          for (const v of c.slice(1)) {
            expect(Number.isFinite(v as number)).toBe(true);
            expect(Math.abs(v as number)).toBeLessThanOrEqual(LIMITY_SVG.zakres);
          }
    } catch (e) {
      expect((e as BladImportuSvg).kod).toBe('wymiary');
    }
  });
});

describe('poprawki po przeglądzie', () => {
  it('symbol rysuje się tylko przez use', () => {
    const sym = '<symbol id="s"><rect width="5" height="5"/></symbol>';
    expect(() => importujSvg(svg(sym))).toThrow(/nie ma kształtów/);
    expect(importujSvg(svg(`${sym}<use href="#s"/>`)).liczbaSciezek).toBe(1);
  });

  it('zdenormalizowany viewBox i gigantyczne współrzędne – błąd wymiarów, nie NaN', () => {
    const kodBledu = (s: string) => {
      try {
        importujSvg(s);
      } catch (e) {
        return (e as BladImportuSvg).kod;
      }
      return 'ok';
    };
    expect(kodBledu(svg('<rect width="1" height="1"/>', 'viewBox="0 0 1e-320 1e-320"'))).toBe(
      'wymiary',
    );
    expect(kodBledu(svg('<rect width="1" height="1"/>', 'viewBox="0 0 1e-9 1e-9"'))).toBe(
      'wymiary',
    );
    expect(kodBledu(svg('<path d="M0 0L1e12 5Z"/>', 'viewBox="0 0 20 10"'))).toBe('wymiary');
    expect(kodBledu(svg('<rect width="10" height="10" stroke="red" stroke-width="1e12"/>'))).toBe(
      'wymiary',
    );
    expect(kodBledu(svg('<rect width="10" height="10"/>'))).toBe('ok');
  });

  it('wspólny licznik węzłów: szeroka bomba use kończy się błędem', () => {
    // 3 poziomy po 60 użyć: 216 000 węzłów mimo limitu 2 000 użyć na poziom nie jest możliwe –
    // limit użyć i licznik węzłów zatrzymują import.
    let defs = '<rect id="u0" width="1" height="1"/>';
    for (let i = 1; i <= 3; i++)
      defs += `<g id="u${i}">${`<use href="#u${i - 1}"/>`.repeat(60)}</g>`;
    expect(() => importujSvg(svg(`<defs>${defs}</defs><use href="#u3"/>`))).toThrow(BladImportuSvg);
  });

  it('głęboki łańcuch use jest obcinany, nie zawiesza importu', () => {
    let defs = '<rect id="u0" width="5" height="5"/>';
    for (let i = 1; i <= 50; i++) defs += `<g id="u${i}"><use href="#u${i - 1}"/></g>`;
    const w = importujSvg(
      svg(`<defs>${defs}</defs><rect width="2" height="2"/><use href="#u50"/>`),
    );
    expect(w.liczbaSciezek).toBe(1);
  });

  it('lista punktów z błędną wartością odrzuca cały kształt; błędna transformacja trafia do raportu', () => {
    const w = importujSvg(
      svg(
        '<polygon points="0,0 5,0 abc,5"/><polyline points="0x10,0 5,5"/><rect width="5" height="5" transform="rotate(zly)"/>',
      ),
    );
    expect(w.liczbaSciezek).toBe(1);
    expect(w.raport.find((r) => r.kod === 'bledna-sciezka')!.ile).toBe(2);
    expect(w.raport.map((r) => r.kod)).toContain('bledna-transformacja');
  });

  it('liczby: bez zapisu szesnastkowego i Infinity', () => {
    expect(liczbaScisla('0x10')).toBeUndefined();
    expect(liczbaScisla('Infinity')).toBeUndefined();
    expect(liczbaScisla('1e999')).toBeUndefined();
    expect(liczbaScisla('-.5e1')).toBe(-5);
    expect(liczbaScisla('3.')).toBe(3);
    const w = importujSvg(svg('<rect width="0x10" height="5"/><rect width="5mm" height="5"/>'));
    expect(w.liczbaSciezek).toBe(1);
  });

  it('samotne M nie liczy się do podścieżek (evenodd zostaje wyłączony)', () => {
    const w = importujSvg(svg('<path fill-rule="evenodd" d="M0 0H10V10H0ZM5 5"/>'));
    expect(w.element.kontury[0]!.evenodd).toBeUndefined();
  });

  it('nazwa koloru z prototypu Object nie jest kolorem', () => {
    expect(kolorSvg('constructor')).toBeNull();
    expect(kolorSvg('__proto__')).toBeNull();
    const w = importujSvg(
      svg('<rect width="5" height="5" fill="&constructor;" style="__proto__:x"/>'),
    );
    expect(w.raport.find((r) => r.kod === 'nieznany-kolor')).toBeDefined();
  });

  it('nierozwinięty łuk w danych: ścieżka błędna, nie wyjątek', () => {
    expect(() =>
      importujSvg(svg('<path d="M0 0A5 5 0 1"/><rect width="3" height="3"/>')),
    ).not.toThrow();
  });
});
