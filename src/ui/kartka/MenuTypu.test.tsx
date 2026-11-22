// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { typyKartMausrittera } from '../../pakiety/mausritter/kartka';
import { MenuTypu } from './MenuTypu';

afterEach(cleanup);

/**
 * Pole `TypKarty.ikona` zostaje w danych pakietu, ale interfejs go celowo nie używa:
 * menu typów kart pokazuje same napisy (UI-4, B152).
 */
it('pozycje mają same napisy – bez ikon', () => {
  const { container } = render(
    <MenuTypu
      typy={typyKartMausrittera}
      styl={{}}
      blokada={() => undefined}
      wybierz={() => {}}
      zamknij={() => {}}
    />,
  );
  expect(container.querySelector('.ikona')).toBeNull();
  const pozycje = screen.getAllByRole('menuitem');
  expect(pozycje).toHaveLength(typyKartMausrittera.length);
  for (const typ of typyKartMausrittera) {
    expect(pozycje.some((p) => p.textContent!.startsWith(typ.nazwa))).toBe(true);
    // Żaden znak ikony typu nie trafia do menu.
    for (const p of pozycje) expect(p.textContent).not.toContain(typ.ikona);
  }
  for (const p of pozycje) expect(p.textContent).toMatch(/^\p{L}/u);
});

it('wyświetla i obsługuje dodatkowe szablony z innych projektów', () => {
  let wybrano = '';
  render(
    <MenuTypu
      typy={typyKartMausrittera}
      dodatkoweNaglowek="Z innych projektów"
      dodatkowe={[{ klucz: 'p2:s1', etykieta: 'Warlock — Zaklęcie' }]}
      styl={{}}
      blokada={() => undefined}
      wybierz={() => {}}
      wybierzDodatkowe={(k) => {
        wybrano = k;
      }}
      zamknij={() => {}}
    />,
  );
  expect(screen.getByText('Z innych projektów')).toBeTruthy();
  const przycisk = screen.getByRole('menuitem', { name: 'Warlock — Zaklęcie' });
  przycisk.click();
  expect(wybrano).toBe('p2:s1');
});
