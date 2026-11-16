import type { ZadaniePdf } from '../druk/budowaPdf';
import { t } from '../i18n';

async function wWatkuGlownym(zadanie: ZadaniePdf): Promise<Uint8Array> {
  const { zbudujPdf } = await import('../druk/budowaPdf');
  return zbudujPdf(zadanie);
}

/**
 * PDF w workerze, żeby interfejs nie zamarzał. Gdy workera nie ma albo nie da się go uruchomić
 * (starsza przeglądarka, polityka bezpieczeństwa) – budowa w wątku głównym. Błąd budowy
 * zgłoszony przez działający worker jest błędem PDF (bez ponawiania).
 */
export async function pdfWWatku(zadanie: ZadaniePdf): Promise<Uint8Array> {
  if (typeof Worker === 'undefined') return wWatkuGlownym(zadanie);
  let worker: Worker;
  try {
    worker = new Worker(new URL('../druk/pdf.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return wWatkuGlownym(zadanie);
  }
  try {
    const wynik = await new Promise<{ bajty: Uint8Array } | { blad: string } | 'bez-workera'>(
      (ok) => {
        worker.onmessage = (e: MessageEvent<{ bajty?: Uint8Array; blad?: string }>) =>
          ok(
            e.data.bajty
              ? { bajty: e.data.bajty }
              : { blad: e.data.blad ?? t('arkusze.bladWorkera') },
          );
        // Błąd ładowania skryptu workera (przed jakąkolwiek odpowiedzią) – ścieżka zapasowa.
        worker.onerror = (e) => {
          e.preventDefault();
          ok('bez-workera');
        };
        worker.postMessage(zadanie);
      },
    );
    if (wynik === 'bez-workera') return wWatkuGlownym(zadanie);
    if ('blad' in wynik) throw new Error(wynik.blad);
    return wynik.bajty;
  } finally {
    worker.terminate();
  }
}
