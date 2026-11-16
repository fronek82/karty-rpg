import type { Szablon } from '../model/szablon';
import type { Pakiet } from '../pakiety/typy';
import { RejestrCzcionek, wczytajCzcionke } from '../silnik/czcionki';
import type { InformacjaOObrazie } from '../silnik/karta';

/**
 * Zasoby pakietu w przeglądarce: czcionki z `public/czcionki/` i obrazy pakietu
 * (pliki z importu Vite). Wczytywane raz i trzymane w pamięci.
 */

export interface ObrazWPamieci {
  info: InformacjaOObrazie;
  dane: Uint8Array;
  format: 'png' | 'jpg';
  /** Adres do podglądu SVG (data:, żeby SVG wstawione jako tekst było samowystarczalne). */
  adres: string;
}

export interface ZasobyPakietu {
  czcionki: RejestrCzcionek;
  szablony: Map<string, Szablon>;
  obrazy: Map<string, ObrazWPamieci>;
}

async function pobierz(adres: string): Promise<Uint8Array> {
  const odp = await fetch(adres);
  if (!odp.ok) throw new Error(`${adres}: HTTP ${odp.status}`);
  return new Uint8Array(await odp.arrayBuffer());
}

function base64(dane: Uint8Array): string {
  let tekst = '';
  for (let i = 0; i < dane.length; i += 0x8000)
    tekst += String.fromCharCode(...dane.subarray(i, i + 0x8000));
  return btoa(tekst);
}

export async function wczytajZasobyPakietu(
  pakiet: Pakiet,
  baza: string = import.meta.env.BASE_URL,
): Promise<ZasobyPakietu> {
  const czcionki = new RejestrCzcionek();
  const zadania: Promise<void>[] = [];
  for (const c of pakiet.czcionki) {
    czcionki.przypiszRole(c.rola, c.rodzina);
    for (const [wariant, plik] of Object.entries(c.warianty)) {
      if (!plik) continue;
      zadania.push(
        pobierz(`${baza}czcionki/${plik}`).then((dane) => {
          czcionki.dodaj(
            c.rodzina,
            wariant as Parameters<RejestrCzcionek['dodaj']>[1],
            wczytajCzcionke(plik, dane),
          );
        }),
      );
    }
  }
  const obrazy = new Map<string, ObrazWPamieci>();
  for (const z of pakiet.zasoby) {
    zadania.push(
      pobierz(z.plik).then((dane) => {
        const typ = z.format === 'png' ? 'image/png' : 'image/jpeg';
        obrazy.set(z.id, {
          info: { szerokosc: z.szerokosc, wysokosc: z.wysokosc },
          dane,
          format: z.format,
          adres: `data:${typ};base64,${base64(dane)}`,
        });
      }),
    );
  }
  await Promise.all(zadania);
  return { czcionki, szablony: new Map(pakiet.szablony.map((s) => [s.id, s])), obrazy };
}
