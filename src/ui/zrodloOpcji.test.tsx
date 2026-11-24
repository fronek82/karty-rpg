// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { atrybutyZrodla, OpcjeRewersowGlobalnych, wybranaOpcja } from './zrodloOpcji';

afterEach(cleanup);

it('wybrana pozycja: zwykłe id i źródło z data-zrodlo (bez atrybutu – projekt)', () => {
  const wybor = vi.fn();
  render(
    <select aria-label="lista" defaultValue="" onChange={(e) => wybor(wybranaOpcja(e))}>
      <option value="">—</option>
      <option value="r1">Rewers projektu</option>
      <OpcjeRewersowGlobalnych
        lista={[{ klucz: 'rewers:p:r1', nazwa: 'Rewers z przeglądarki', zrodlo: 'projekt' }]}
      />
      <option value="p:s" {...atrybutyZrodla('inny-projekt')}>
        Awers z innego projektu
      </option>
    </select>,
  );
  const lista = screen.getByRole('combobox', { name: 'lista' });
  fireEvent.change(lista, { target: { value: 'r1' } });
  fireEvent.change(lista, { target: { value: 'rewers:p:r1' } });
  fireEvent.change(lista, { target: { value: 'p:s' } });
  expect(wybor.mock.calls.map((c) => c[0])).toEqual([
    { id: 'r1', zrodlo: 'projekt' },
    { id: 'rewers:p:r1', zrodlo: 'globalny' },
    { id: 'p:s', zrodlo: 'inny-projekt' },
  ]);
  expect(screen.getByRole('group', { name: 'Zapisane tyły' })).toBeTruthy();
});

it('pusta lista rewersów globalnych – bez grupy', () => {
  const { container } = render(
    <select>
      <OpcjeRewersowGlobalnych lista={[]} />
    </select>,
  );
  expect(container.querySelector('optgroup')).toBeNull();
});
