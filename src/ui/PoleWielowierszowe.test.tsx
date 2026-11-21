// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PoleWielowierszowe,
  odczytajWysokoscPola,
  wyczyscWysokosciPol,
  zapiszWysokoscPola,
} from './PoleWielowierszowe';

describe('PoleWielowierszowe', () => {
  beforeEach(() => {
    wyczyscWysokosciPol();
  });

  afterEach(() => {
    cleanup();
  });

  it('ogranicza i utrwala wysokość w localStorage', () => {
    expect(odczytajWysokoscPola('kartka:opis')).toBeUndefined();
    zapiszWysokoscPola('kartka:opis', 220.4);
    expect(odczytajWysokoscPola('kartka:opis')).toBe(220);

    zapiszWysokoscPola('kartka:mala', 10);
    expect(odczytajWysokoscPola('kartka:mala')).toBe(40);

    zapiszWysokoscPola('kartka:duza', 2000);
    expect(odczytajWysokoscPola('kartka:duza')).toBe(800);
  });

  it('zapamiętuje ręcznie zmienioną wysokość po przełączeniu na inny element', () => {
    const r1 = render(<PoleWielowierszowe kluczRozmiaru="kartka:s1:opis" aria-label="Opis" />);
    const ta1 = r1.getByLabelText('Opis') as HTMLTextAreaElement;
    expect(ta1.style.height).toBe('');

    // Symulacja przeciągnięcia uchwytu zmiany rozmiaru przez użytkownika.
    ta1.style.height = '184px';
    fireEvent.pointerUp(ta1);
    expect(odczytajWysokoscPola('kartka:s1:opis')).toBe(184);

    // Odmontowanie (przełączenie karty) i ponowne zamontowanie z tym samym kluczem rozmiaru.
    r1.unmount();
    const r2 = render(<PoleWielowierszowe kluczRozmiaru="kartka:s1:opis" aria-label="Opis" />);
    const ta2 = r2.getByLabelText('Opis') as HTMLTextAreaElement;
    expect(ta2.style.height).toBe('184px');
  });

  it('czyści wysokość DOM przy zmianie kluczRozmiaru bez odmontowania i nie nadpisuje nowego klucza', () => {
    const r = render(<PoleWielowierszowe kluczRozmiaru="kartka:A:opis" aria-label="Opis" />);
    const ta = r.getByLabelText('Opis') as HTMLTextAreaElement;
    ta.style.height = '210px';
    fireEvent.pointerUp(ta);
    expect(odczytajWysokoscPola('kartka:A:opis')).toBe(210);

    // Przełączenie na pole innego szablonu bez odmontowania komponentu.
    r.rerender(<PoleWielowierszowe kluczRozmiaru="kartka:B:opis" aria-label="Opis" />);
    expect(ta.style.height).toBe('');
    expect(odczytajWysokoscPola('kartka:B:opis')).toBeUndefined();

    // Powrót do szablonu A przywraca zapamiętaną wysokość.
    r.rerender(<PoleWielowierszowe kluczRozmiaru="kartka:A:opis" aria-label="Opis" />);
    expect(ta.style.height).toBe('210px');
  });
});
