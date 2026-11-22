// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PrzypisanieRewersu, Rewers } from '../../model/szablon';
import type { ZapisanyRewersGlobalny } from '../rewersyGlobalne';
import { MenuRewersu } from './MenuRewersu';

afterEach(cleanup);

const lokalny: Rewers = {
  id: 'rev-1',
  nazwa: 'Rewers lokalny',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  korzen: { id: 'rk', typ: 'swobodny', dzieci: [] },
};

const globalny: ZapisanyRewersGlobalny = {
  klucz: 'rewers:p2:rev-2',
  nazwa: 'Rewers z innego projektu',
  zrodlo: 'projekt',
  projektId: 'p2',
  rewersId: 'rev-2',
};

describe('MenuRewersu', () => {
  it('wyświetla rewersy lokalne i globalne oraz wywołuje odpowiednie akcje', () => {
    const wybraneLokalne: (PrzypisanieRewersu | undefined)[] = [];
    const wybraneGlobalne: ZapisanyRewersGlobalny[] = [];
    let zamknieto = 0;

    render(
      <MenuRewersu
        rewersyLokalne={[lokalny]}
        rewersyGlobalne={[globalny]}
        maNadpisanie
        styl={{}}
        wybierzLokalny={(id) => wybraneLokalne.push(id)}
        wybierzGlobalny={(w) => wybraneGlobalne.push(w)}
        zamknij={() => {
          zamknieto++;
        }}
      />,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Domyślny (z talii lub szablonu)' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bez rewersu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rewers lokalny' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rewers z innego projektu' }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    expect(wybraneLokalne).toEqual([undefined, null, 'rev-1']);
    expect(wybraneGlobalne).toEqual([globalny]);
    expect(zamknieto).toBe(1);
  });
});
