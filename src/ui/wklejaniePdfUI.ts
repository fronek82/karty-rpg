import type { ClipboardEvent } from 'react';
import { wstawWklejonyTekst, wyczyscTekstZPdf } from '../wspolne/wklejaniePdf';

let wklejanieWToku = false;

/** Prawda wyłącznie synchronicznie w trakcie wstawiania tekstu z PDF (oddzielny krok historii). */
export const czyWklejanieWToku = () => wklejanieWToku;

/**
 * Automatyczne czyszczenie tekstu wklejanego z PDF w wielowierszowych polach tekstowych (M5-1).
 * Jeśli wklejany tekst nie wymaga zmian, pozwala przeglądarce obsłużyć wklejenie natywnie.
 * Używa `execCommand('insertText')`, aby zachować natywny stos cofania `Ctrl+Z` wewnątrz `<textarea>`,
 * z bezpiecznym fallbackiem na `ustaw(wartosc)` i ręczne odtworzenie pozycji kursora.
 */
export function obsluzWklejenieZPdf(
  e: ClipboardEvent<HTMLTextAreaElement>,
  ustaw: (wartosc: string) => void,
): void {
  const surowy = e.clipboardData?.getData('text/plain');
  if (!surowy) return;
  const oczyszczony = wyczyscTekstZPdf(surowy);
  if (oczyszczony === surowy) return;

  e.preventDefault();
  const el = e.currentTarget;
  const poczatek = el.selectionStart ?? el.value.length;
  const koniec = el.selectionEnd ?? el.value.length;
  const { wartosc, kursor } = wstawWklejonyTekst(el.value, poczatek, koniec, oczyszczony);

  let wstawionoNatywnie = false;
  if (typeof document.execCommand === 'function') {
    wklejanieWToku = true;
    try {
      wstawionoNatywnie =
        document.execCommand('insertText', false, oczyszczony) && el.value === wartosc;
    } finally {
      wklejanieWToku = false;
    }
  }

  if (!wstawionoNatywnie) {
    ustaw(wartosc);
    requestAnimationFrame(() => {
      if (document.activeElement === el) {
        el.setSelectionRange(kursor, kursor);
      }
    });
  }
}
