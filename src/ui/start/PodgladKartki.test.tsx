// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PodgladKartki } from './PodgladKartki';
import type { Podglad, StronaPodgladu } from './podglady';

afterEach(cleanup);

const strona = (svg: string, siatka = false): StronaPodgladu => ({
  svg,
  szerokosc: 297,
  wysokosc: 210,
  ...(siatka
    ? {
        siatka: {
          poczatek: { x: 10, y: 10 },
          slot: { szerokosc: 25, wysokosc: 25 },
          kolumny: 3,
          rzedy: 2,
        },
      }
    : {}),
});
const podglad = (...s: StronaPodgladu[]): Podglad => ({ id: 'x', strony: s, ostrzezenia: [] });

describe('PodgladKartki', () => {
  it('bez wyniku pokazuje szkielet z opisem dla czytnika', () => {
    render(<PodgladKartki wynik={undefined} />);
    expect(screen.getByRole('img', { name: 'Przygotowuję podgląd…' })).toBeTruthy();
  });

  it('błąd pokazuje komunikat, nie kartkę', () => {
    render(<PodgladKartki wynik={{ blad: 'zepsute' }} />);
    expect(
      screen.getByRole('img', { name: /Nie udało się przygotować podglądu \(zepsute\)/ }),
    ).toBeTruthy();
  });

  it('wstawia SVG sceny z silnika i rysuje siatkę z geometrii', () => {
    const { container } = render(
      <PodgladKartki wynik={{ podglad: podglad(strona('<svg id="a"></svg>', true)) }} />,
    );
    expect(container.querySelector('.papier-svg svg#a')).toBeTruthy();
    expect(container.querySelectorAll('.siatka-slotow rect')).toHaveLength(6);
    expect(container.querySelector('.siatka-slotow')!.getAttribute('viewBox')).toBe('0 0 297 210');
  });

  it('stos: tyle kartek, ile stron; pierwsza na wierzchu', () => {
    const { container } = render(
      <PodgladKartki
        stos
        wynik={{
          podglad: podglad(
            strona('<svg id="1"/>'),
            strona('<svg id="2"/>'),
            strona('<svg id="3"/>'),
          ),
        }}
      />,
    );
    const papiery = [...container.querySelectorAll<HTMLElement>('.stos .papier')];
    expect(papiery).toHaveLength(3);
    expect(papiery[0]!.style.zIndex).toBe('2');
    expect(papiery[2]!.style.zIndex).toBe('0');
  });
});
