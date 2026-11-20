/**
 * Czyszczenie tekstu skopiowanego z kolumn PDF przed wklejeniem do pól tekstowych (M5-1).
 *
 * Moduł jest czysty (bez zależności od DOM/React): łączy sztuczne złamania wierszy z PDF
 * oraz wyrazy przeniesione dywizem (`-`, miękki łącznik `\u00AD`, unikodowy dywiz `\u2010`)
 * na końcu wiersza, zachowując puste linie (akapity) oraz listy numerowane i punktowane.
 */

const MA_ZLAMANIE = /[\r\n\u2028\u2029]/;
const POCZATEK_LISTY = /^(?:\d+[.)]|[-–—•◦▪*])\s+/;
const DYWIZ_PRZENIESIENIA = /[\p{L}][-\u00AD\u2010]$/u;
const MALA_LITERA = /^\p{Ll}/u;
const BIALE_POZIOME = /[\t\u00A0\u2000-\u200A\u202F\u205F]+/g;

function normalizujSpacjePoziome(wiersz: string): string {
  return wiersz.replace(BIALE_POZIOME, ' ').replace(/ {2,}/g, ' ');
}

/**
 * Usuwa sztuczne złamania wierszy z tekstu skopiowanego z PDF:
 * - dla pojedynczego wiersza bez złamań usuwa miękkie łączniki (`\u00AD`) i zamienia twarde spacje
 *   na zwykłe, zachowując celowe spacje brzegowe (np. wklejanie w środku zdania),
 * - w tekście wielowierszowym łączy kolejne wiersze tego samego akapitu spacją,
 *   a wyrazy zakończone dywizem (`-`, `\u00AD`, `\u2010`) przed małą literą (`zie-\nmię`) skleja bez spacji,
 * - usuwa pozostałe miękkie łączniki (`\u00AD`) ze środka wierszy,
 * - zachowuje puste linie jako granice akapitów (`\n\n`) oraz wiersze rozpoczynające listy
 *   numerowane (`1. `, `2) `) i punktowane (`- `, `• `, `* `), bez naruszania `*kursywy*` / `**pogrubienia**`.
 */
export function wyczyscTekstZPdf(tekst: string): string {
  if (!tekst) return tekst;
  if (!MA_ZLAMANIE.test(tekst)) {
    return tekst.replace(/\u00AD/g, '').replace(BIALE_POZIOME, ' ');
  }

  const znormalizowany = tekst
    .replace(/\r\n?/g, '\n')
    .replace(/\u2029/g, '\n\n')
    .replace(/\u2028/g, '\n');

  const wiersze = znormalizowany.split('\n').map((w) => normalizujSpacjePoziome(w).trim());

  const akapity: string[][] = [];
  let biezacy: string[] = [];
  for (const w of wiersze) {
    if (w === '') {
      if (biezacy.length > 0) {
        akapity.push(biezacy);
        biezacy = [];
      }
    } else {
      biezacy.push(w);
    }
  }
  if (biezacy.length > 0) akapity.push(biezacy);
  if (akapity.length === 0) return '';

  const wynikoweAkapity = akapity.map((linie) => {
    const wyjscie: string[] = [];
    for (const linia of linie) {
      if (wyjscie.length === 0 || POCZATEK_LISTY.test(linia)) {
        wyjscie.push(linia);
        continue;
      }
      const ostatnia = wyjscie[wyjscie.length - 1]!;
      if (DYWIZ_PRZENIESIENIA.test(ostatnia) && MALA_LITERA.test(linia)) {
        wyjscie[wyjscie.length - 1] = ostatnia.slice(0, -1) + linia;
      } else {
        wyjscie[wyjscie.length - 1] = `${ostatnia} ${linia}`;
      }
    }
    return wyjscie.map((w) => w.replace(/\u00AD/g, '')).join('\n');
  });

  return wynikoweAkapity.join('\n\n');
}

/** Wstawia oczyszczony tekst w miejsce zaznaczenia pola i zwraca nową wartość oraz pozycję kursora. */
export function wstawWklejonyTekst(
  obecny: string,
  poczatek: number,
  koniec: number,
  wklejany: string,
): { wartosc: string; kursor: number } {
  const start = Math.max(0, Math.min(poczatek, obecny.length));
  const stop = Math.max(start, Math.min(koniec, obecny.length));
  const wartosc = obecny.slice(0, start) + wklejany + obecny.slice(stop);
  return { wartosc, kursor: start + wklejany.length };
}
