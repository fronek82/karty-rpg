// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PozycjeMenuDodaj, RODZAJE } from './PozycjeMenuDodaj';
import { IKONY_WEZLOW } from './DrzewoSzablonu';

afterEach(cleanup);

/** Menu „+ Dodaj” pokazuje same napisy (UI-7, B152) – analogicznie do MenuTypu.test.tsx. */
it('pozycje menu „+ Dodaj” mają same napisy – bez ikon', () => {
  const dodaj = vi.fn();
  const { container } = render(<PozycjeMenuDodaj dodaj={dodaj} />);
  expect(container.querySelector('.ikona')).toBeNull();
  const pozycje = screen.getAllByRole('menuitem');
  expect(pozycje).toHaveLength(RODZAJE.length);
  const ikony = Object.values(IKONY_WEZLOW).filter((i) => !/^\p{L}$/u.test(i));
  for (const p of pozycje) {
    expect(p.textContent).toMatch(/^\p{L}/u);
    for (const i of ikony) expect(p.textContent).not.toContain(i);
  }
});
