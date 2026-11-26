// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREFIKS_PASKA_BOCZNEGO } from '../../wspolne/ustawienia';
import { NaglowekProjektu } from './NaglowekProjektu';
import { PanelSekcji, SekcjaPanelu } from './PanelSekcji';
import { PasekBoczny } from './PasekBoczny';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('NaglowekProjektu', () => {
  const kroki = [
    { id: 'szablony' as const, numer: 1, etykieta: 'Szablony', href: '#/projekt/p1' },
    { id: 'karty' as const, numer: 2, etykieta: 'Karty', href: '#/projekt/p1/karty' },
    { id: 'druk' as const, numer: 3, etykieta: 'Druk', href: '#/projekt/p1/druk' },
  ];

  it('pokazuje kroki, aktywny krok, nazwę projektu i brak przycisku Biblioteka (D8)', () => {
    render(
      <NaglowekProjektu
        nazwaProjektu="Karty zaklęć"
        aktywnyKrok="szablony"
        kroki={kroki}
        mozeCofnac
        mozePonowic={false}
        stanZapisu="zapisano"
        akcjaGlowna={{ etykieta: 'Przejdź do kart →', href: '#/projekt/p1/karty' }}
      />,
    );

    expect(screen.getByText('Karty zaklęć')).toBeTruthy();
    expect(screen.getByText('Szablony').closest('[aria-current="page"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Karty/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Druk/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Bibliotek/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Bibliotek/i })).toBeNull();
    expect(screen.getByText('✓ zapisano')).toBeTruthy();
  });

  it('wywołuje Cofnij / Ponów oraz pokazuje etykietę MAUSRITTER gdy flaga ustawiona', () => {
    const onCofnij = vi.fn();
    const onPonow = vi.fn();
    render(
      <NaglowekProjektu
        nazwaProjektu="Mausritter"
        aktywnyKrok="mausritter"
        kroki={[
          { id: 'mausritter', numer: 1, etykieta: 'Karty na arkuszach', href: '#/p' },
          { id: 'druk', numer: 2, etykieta: 'Druk', href: '#/p/druk' },
        ]}
        mausritter
        mozeCofnac
        mozePonowic
        onCofnij={onCofnij}
        onPonow={onPonow}
      />,
    );

    expect(screen.getByText('MAUSRITTER')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cofnij' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ponów' }));
    expect(onCofnij).toHaveBeenCalledTimes(1);
    expect(onPonow).toHaveBeenCalledTimes(1);
  });
});

describe('PasekBoczny', () => {
  const grupy = [
    {
      id: 'g1',
      nazwa: 'Układ',
      pozycje: [
        {
          id: 'swobodny',
          nazwa: 'Swobodny',
          podpowiedz: 'dowolne położenie',
          ikona: 'M4 4h7v7H4z',
          odznaka: 'DOMYŚLNY',
        },
      ],
    },
  ];

  it('domyślnie jest zwinięty z dymkiem DOM i zapamiętuje rozwinięcie w localStorage', () => {
    render(<PasekBoczny ekranId="test-edytor" tytul="Dodaj element" grupy={grupy} />);

    const nav = screen.getByRole('navigation', { name: 'Dodaj element' });
    expect(nav.getAttribute('data-stan')).toBe('zwiniety');
    // Dymek jest zwykłym elementem w DOM z tekstem nazwy i podpowiedzi.
    const dymek = screen.getByText('Swobodny – dowolne położenie');
    expect(dymek.getAttribute('role')).toBe('tooltip');

    fireEvent.click(screen.getByRole('button', { name: 'Rozwiń pasek' }));
    expect(nav.getAttribute('data-stan')).toBe('rozwiniety');
    expect(window.localStorage.getItem(`${PREFIKS_PASKA_BOCZNEGO}test-edytor`)).toBe('1');
    expect(screen.getByText('DOMYŚLNY')).toBeTruthy();
    expect(screen.queryByText('Swobodny – dowolne położenie')).toBeNull();
  });

  it('odczytuje zapisany stan z localStorage osobno dla ekranu', () => {
    window.localStorage.setItem(`${PREFIKS_PASKA_BOCZNEGO}inny-ekran`, '1');
    render(<PasekBoczny ekranId="inny-ekran" tytul="Karty" grupy={grupy} />);
    expect(screen.getByRole('navigation', { name: 'Karty' }).getAttribute('data-stan')).toBe(
      'rozwiniety',
    );
  });
});

describe('PanelSekcji', () => {
  it('renderuje nagłówek i sekcje domyślnie otwarte oraz zwinięte', () => {
    render(
      <PanelSekcji tytul="Ustawienia" podtytul="A4">
        <SekcjaPanelu tytul="Papier" domyslnieOtwarta>
          <span>Format A4</span>
        </SekcjaPanelu>
        <SekcjaPanelu tytul="Kalibracja" domyslnieOtwarta={false}>
          <span>Przesunięcie X</span>
        </SekcjaPanelu>
      </PanelSekcji>,
    );

    const detale = document.querySelectorAll('details.ui2-sekcja');
    expect(detale).toHaveLength(2);
    expect(detale[0]!.hasAttribute('open')).toBe(true);
    expect(detale[1]!.hasAttribute('open')).toBe(false);
  });
});
