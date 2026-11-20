import { describe, expect, it } from 'vitest';
import type { Rewers } from '../model/szablon';
import { rejestrTestowy } from './__testy__/pomoc';
import { renderujRewers } from './rewers';
import type { ElementSceny } from './scena';

const r: Rewers = {
  id: 'mapa',
  nazwa: 'Mapa',
  rozmiar: { tryb: 'mm', szerokosc: 60, wysokosc: 80 },
  korzen: { id: 'k', typ: 'swobodny', dzieci: [] },
  teksturaTla: 'rastr',
};
const kontekst = {
  czcionki: rejestrTestowy(),
  obraz: () => ({ szerokosc: 120, wysokosc: 80 }),
};
function* elementy(e: ElementSceny[]): Generator<ElementSceny> {
  for (const x of e) {
    yield x;
    if (x.typ === 'grupa') yield* elementy(x.elementy);
  }
}

describe('scena rewersu', () => {
  it.each(['dopasuj', 'wypelnij', 'rozciagnij', 'kafelki'] as const)(
    'rozmieszcza teksturę w trybie %s',
    (dopasowanieTla) => {
      const w = renderujRewers({ ...r, dopasowanieTla }, kontekst);
      expect(w.ostrzezenia).toEqual([]);
      const obrazy = [...elementy(w.scena.elementy)].filter((x) => x.typ === 'obraz');
      if (dopasowanieTla === 'kafelki') {
        expect(obrazy.length).toBeGreaterThan(1);
        expect(obrazy[0]!.szer / obrazy[0]!.wys).toBeCloseTo(1.5);
      } else {
        expect(obrazy).toHaveLength(1);
        if (dopasowanieTla === 'dopasuj')
          expect(obrazy[0]).toMatchObject({ szer: 60, wys: 40, y: 20 });
        if (dopasowanieTla === 'wypelnij')
          expect(obrazy[0]).toMatchObject({ szer: 120, wys: 80, x: -30 });
        if (dopasowanieTla === 'rozciagnij') expect(obrazy[0]).toMatchObject({ szer: 60, wys: 80 });
      }
    },
  );

  it('rysuje tło korzenia raz i pod warstwami również przy osobnej ramce', () => {
    const w = renderujRewers(
      {
        ...r,
        korzen: {
          ...r.korzen,
          tlo: '#123456',
          dzieci: [
            { id: 'napis', typ: 'tekst', tekst: 'Napis', styl: { rozmiar: 4, czcionka: 'tresc' } },
          ],
        },
        ramka: { grubosc: 0.4, kolor: '#111111' },
      },
      kontekst,
    );
    const elementyRewersu = [...elementy(w.scena.elementy)];
    const tla = elementyRewersu.filter((e) => e.typ === 'prostokat' && e.wypelnienie === '#123456');
    expect(tla).toHaveLength(1);
    expect(elementyRewersu.indexOf(tla[0]!)).toBeLessThan(
      elementyRewersu.findIndex((e) => e.typ === 'tekst'),
    );
  });

  it('zachowuje kolejność warstw i odwzorowuje rewers w rozmiarze egzemplarza', () => {
    const w = renderujRewers(
      {
        ...r,
        korzen: {
          ...r.korzen,
          dzieci: [
            {
              id: 'pierwszy',
              typ: 'tekst',
              tekst: 'A',
              styl: { rozmiar: 4, czcionka: 'tresc', kolor: '#123456' },
            },
            {
              id: 'drugi',
              typ: 'tekst',
              tekst: 'B',
              styl: { rozmiar: 4, czcionka: 'tresc', kolor: '#654321' },
            },
          ],
        },
      },
      kontekst,
      { szer: 120, wys: 40 },
    );
    expect(w.scena.elementy[0]).toMatchObject({ macierz: [2, 0, 0, 0.5, 0, 0] });
    expect(
      [...elementy(w.scena.elementy)].flatMap((o) => (o.typ === 'tekst' ? [o.kolor] : [])),
    ).toEqual(['#123456', '#654321']);
  });
});
