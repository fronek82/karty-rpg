import type { ZadaniePdf } from '../druk/budowaPdf';

/**
 * PDF w workerze (gdy przeglądarka go obsługuje), inaczej w wątku głównym.
 * Worker i kod PDF ładowane dopiero przy pierwszym pobraniu.
 */
export async function pdfWWatku(zadanie: ZadaniePdf): Promise<Uint8Array> {
  if (typeof Worker === 'undefined') {
    const { zbudujPdf } = await import('../druk/budowaPdf');
    return zbudujPdf(zadanie);
  }
  const worker = new Worker(new URL('../druk/pdf.worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<Uint8Array>((ok, blad) => {
      worker.onmessage = (e: MessageEvent<{ bajty?: Uint8Array; blad?: string }>) =>
        e.data.bajty ? ok(e.data.bajty) : blad(new Error(e.data.blad ?? 'PDF'));
      worker.onerror = (e) => blad(new Error(e.message || 'worker PDF'));
      worker.postMessage(zadanie);
    });
  } finally {
    worker.terminate();
  }
}
