/// <reference lib="webworker" />
import { zbudujPdf, type ZadaniePdf } from './budowaPdf';

/** Worker PDF: budowa arkuszy i PDF poza wątkiem głównym – interfejs nie zamarza. */
self.onmessage = (e: MessageEvent<ZadaniePdf>) => {
  zbudujPdf(e.data).then(
    (bajty) => (self as unknown as Worker).postMessage({ bajty }, [bajty.buffer]),
    (blad: unknown) =>
      (self as unknown as Worker).postMessage({
        blad: blad instanceof Error ? blad.message : String(blad),
      }),
  );
};
