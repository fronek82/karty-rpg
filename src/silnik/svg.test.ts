import { describe, expect, it } from 'vitest';
import { kolorSceny, type Scena } from './scena';
import { scenaDoSvg } from './svg';

const scena = (elementy: Scena['elementy'], glify: Scena['glify'] = {}): Scena => ({
  szer: 10,
  wys: 10,
  elementy,
  glify,
});

describe('scenaDoSvg', () => {
  it('przedrostek identyfikatorów zapobiega kolizjom kilku SVG na stronie', () => {
    const s = scena(
      [{ typ: 'tekst', kolor: '#000000', glify: [{ klucz: 'f#1', x: 1, y: 5, skala: 0.01 }] }],
      { 'f#1': { kontur: [['M', 0, 0], ['L', 100, 0], ['L', 0, 100], ['Z']] } },
    );
    const svg = scenaDoSvg(s, { przedrostekId: 'karta7-' });
    expect(svg).toContain('id="karta7-g0"');
    expect(svg).toContain('href="#karta7-g0"');
  });

  it('kolor spoza formatu #rgb/#rrggbb zamienia na czarny (jak PDF) – nic obcego nie trafia do SVG', () => {
    const svg = scenaDoSvg(
      scena([
        {
          typ: 'prostokat',
          x: 0,
          y: 0,
          szer: 5,
          wys: 5,
          wypelnienie: '"><script>alert(1)</script>',
        },
      ]),
    );
    expect(svg).not.toContain('script');
    expect(svg).toContain('fill="#000000"');
    expect(kolorSceny('#ABC')).toBe('#aabbcc');
  });

  it('obrys o zerowej grubości nie jest rysowany', () => {
    const svg = scenaDoSvg(
      scena([
        { typ: 'linia', x1: 0, y1: 0, x2: 5, y2: 5, obrys: { kolor: '#000000', grubosc: 0 } },
      ]),
    );
    expect(svg).not.toContain('stroke=');
  });

  it('promień zaokrąglenia ograniczony do połowy krótszego boku', () => {
    const svg = scenaDoSvg(
      scena([{ typ: 'prostokat', x: 0, y: 0, szer: 10, wys: 2, promien: 3, wypelnienie: '#fff' }]),
    );
    expect(svg).toContain('rx="1" ry="1"');
    expect(svg).toContain('fill="#ffffff"');
  });
});
