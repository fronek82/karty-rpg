// Granice grafemów (liter widzianych przez czytelnika) w tekście.
// Intl.Segmenter jest dopiero od Firefoksa 125 i Safari 17.4 – w starszych przeglądarkach
// (np. Firefox 115 ESR na macOS 10.14) używamy przybliżenia: punkt kodowy razem ze znakami
// łączącymi, selektorami wariantu, modyfikatorami emoji i sekwencjami ZWJ.

const ZWJ = 0x200d;
const ZNAK_LACZACY = /^\p{M}$/u;
const FLAGA = /^\p{Regional_Indicator}$/u;
const PIKTOGRAM = /^\p{Extended_Pictographic}$/u;

/** Znaki doklejane do poprzedniego grafemu. */
function doklejany(znak: string, kod: number): boolean {
  return (
    ZNAK_LACZACY.test(znak) ||
    kod === ZWJ ||
    (kod >= 0xfe00 && kod <= 0xfe0f) || // selektory wariantu
    (kod >= 0x1f3fb && kod <= 0x1f3ff) || // modyfikatory koloru skóry
    (kod >= 0xe0020 && kod <= 0xe007f) // znaczniki (flagi regionów)
  );
}

/** Przybliżone granice grafemów bez Intl.Segmenter (indeksy w jednostkach UTF-16). */
export function graniceGrafemowZastepcze(tekst: string): number[] {
  const granice: number[] = [];
  let indeks = 0;
  let poprzedni = 0;
  let flagiWGrafemie = 0;
  for (const znak of tekst) {
    const kod = znak.codePointAt(0)!;
    const flaga = FLAGA.test(znak);
    const doklej =
      granice.length > 0 &&
      (doklejany(znak, kod) ||
        (poprzedni === ZWJ && PIKTOGRAM.test(znak)) ||
        (poprzedni === 0x0d && kod === 0x0a) ||
        (flaga && flagiWGrafemie === 1));
    if (!doklej) {
      granice.push(indeks);
      flagiWGrafemie = 0;
    }
    if (flaga) flagiWGrafemie++;
    poprzedni = kod;
    indeks += znak.length;
  }
  return granice;
}

type Segmentator = { segment(tekst: string): Iterable<{ index: number }> };
const SegmenterIntl = (Intl as { Segmenter?: new (l?: string, o?: object) => Segmentator })
  .Segmenter;
const SEGMENTATOR = SegmenterIntl
  ? new SegmenterIntl(undefined, { granularity: 'grapheme' })
  : undefined;

/** Indeksy początków kolejnych grafemów tekstu. */
export function graniceGrafemow(tekst: string): number[] {
  return SEGMENTATOR
    ? Array.from(SEGMENTATOR.segment(tekst), (g) => g.index)
    : graniceGrafemowZastepcze(tekst);
}
