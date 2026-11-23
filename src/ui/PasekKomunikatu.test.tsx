// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CZAS_PASKA, PasekKomunikatu } from './PasekKomunikatu';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const pokaz = (zamknij = vi.fn(), wykonaj = vi.fn()) => {
  render(
    <PasekKomunikatu
      komunikat={{ tekst: 'Usunięto: Karta', akcja: { etykieta: 'Cofnij', wykonaj } }}
      zamknij={zamknij}
    />,
  );
  return { zamknij, wykonaj, pasek: screen.getByTestId('pasek-komunikatu') };
};

describe('PasekKomunikatu', () => {
  it('znika po czasie', () => {
    const { zamknij, pasek } = pokaz();
    expect(pasek.textContent).toContain('Usunięto: Karta');
    act(() => vi.advanceTimersByTime(CZAS_PASKA - 100));
    expect(zamknij).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(zamknij).toHaveBeenCalledTimes(1);
  });

  it('nie znika, gdy kursor jest nad paskiem; po zjechaniu liczy resztę czasu', () => {
    const { zamknij, pasek } = pokaz();
    act(() => vi.advanceTimersByTime(5000));
    fireEvent.pointerEnter(pasek);
    act(() => vi.advanceTimersByTime(60_000));
    expect(zamknij).not.toHaveBeenCalled();
    fireEvent.pointerLeave(pasek);
    act(() => vi.advanceTimersByTime(CZAS_PASKA - 5000 - 100));
    expect(zamknij).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(zamknij).toHaveBeenCalledTimes(1);
  });

  it('dotknięcie nie wstrzymuje paska (na dotyku nie ma „zjechania” kursorem)', () => {
    const { zamknij, pasek } = pokaz();
    fireEvent.pointerEnter(pasek, { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(CZAS_PASKA + 100));
    expect(zamknij).toHaveBeenCalledTimes(1);
  });

  it('„Cofnij” wykonuje akcję i zamyka pasek', () => {
    const { zamknij, wykonaj } = pokaz();
    fireEvent.click(screen.getByRole('button', { name: 'Cofnij' }));
    expect(wykonaj).toHaveBeenCalledTimes(1);
    expect(zamknij).toHaveBeenCalledTimes(1);
  });
});
