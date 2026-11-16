import * as fontkit from 'fontkit';
import type { WariantCzcionki } from '../model/szablon';
import type { Kontur } from './scena';

export interface UlozonyGlif {
  /** Numer glifu w czcionce. */
  id: number;
  /** Wartości w jednostkach czcionki. */
  przesuniecie: number;
  dx: number;
  dy: number;
}

/**
 * Czcionka wczytana przez fontkit (TTF, OTF/CFF, WOFF, WOFF2). Kształtuje tekst
 * (ligatury, kerning, glify złożone) i zwraca kontury glifów.
 */
export class Czcionka {
  readonly unitsPerEm: number;
  /** Wysokość nad linią bazową (jednostki czcionki, dodatnia). */
  readonly ascent: number;
  /** Głębokość pod linią bazową (jednostki czcionki, dodatnia). */
  readonly descent: number;
  private readonly pamiecUkladu = new Map<string, UlozonyGlif[]>();
  private readonly pamiecKonturow = new Map<number, Kontur>();

  constructor(
    readonly id: string,
    private readonly font: fontkit.Font,
  ) {
    this.unitsPerEm = font.unitsPerEm;
    this.ascent = font.ascent;
    this.descent = Math.abs(font.descent);
  }

  /** Kształtuje tekst w jedną linię (bez łamania). */
  uloz(tekst: string): UlozonyGlif[] {
    const zapamietany = this.pamiecUkladu.get(tekst);
    if (zapamietany) return zapamietany;
    const run = this.font.layout(tekst);
    const glify = run.glyphs.map((g, i) => {
      const p = run.positions[i];
      return { id: g.id, przesuniecie: p?.xAdvance ?? 0, dx: p?.xOffset ?? 0, dy: p?.yOffset ?? 0 };
    });
    this.pamiecUkladu.set(tekst, glify);
    return glify;
  }

  /**
   * Metadane z pliku: rodzina typograficzna (rekord nazwy 16, awaryjnie 1), styl (17, awaryjnie 2),
   * grubość (OS/2 usWeightClass) i kursywa (OS/2 fsSelection lub head.macStyle).
   */
  metadane(): { rodzina: string; styl: string; grubosc: number; kursywa: boolean } {
    const f = this.font;
    const nazwa = (klucz: string) => {
      try {
        return f.getName(klucz, 'en') ?? undefined;
      } catch {
        return undefined;
      }
    };
    const os2 = f['OS/2'] as
      { usWeightClass?: number; fsSelection?: { italic?: boolean } } | undefined;
    const head = (f as unknown as { head?: unknown }).head as
      { macStyle?: { italic?: boolean; bold?: boolean } } | undefined;
    const styl = nazwa('preferredSubfamily') ?? f.subfamilyName ?? '';
    return {
      rodzina: nazwa('preferredFamily') ?? f.familyName ?? '',
      styl,
      grubosc: os2?.usWeightClass ?? (head?.macStyle?.bold ? 700 : 400),
      kursywa: !!(
        os2?.fsSelection?.italic ||
        head?.macStyle?.italic ||
        /italic|oblique/i.test(styl)
      ),
    };
  }

  /** Szerokość tekstu w jednostkach czcionki. */
  szerokosc(tekst: string): number {
    return this.uloz(tekst).reduce((suma, g) => suma + g.przesuniecie, 0);
  }

  /** Czy czcionka ma wszystkie znaki tekstu (glif 0 = brak znaku). */
  brakujaceZnaki(tekst: string): string[] {
    const braki = new Set<string>();
    for (const znak of tekst) {
      if (/\s/.test(znak)) continue;
      const kod = znak.codePointAt(0);
      if (kod !== undefined && !this.font.hasGlyphForCodePoint(kod)) braki.add(znak);
    }
    return [...braki];
  }

  /** Kontur glifu (jednostki czcionki, Y w górę), krzywe kwadratowe zamienione na sześcienne. */
  kontur(idGlifu: number): Kontur {
    const zapamietany = this.pamiecKonturow.get(idGlifu);
    if (zapamietany) return zapamietany;
    const kontur = konturZFontkit(this.font.getGlyph(idGlifu).path.commands);
    this.pamiecKonturow.set(idGlifu, kontur);
    return kontur;
  }
}

const zaokr = (v: number) => Math.round(v * 100) / 100;

export function konturZFontkit(komendy: fontkit.PathCommand[]): Kontur {
  const wynik: Kontur = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const { command, args: a } of komendy) {
    switch (command) {
      case 'moveTo':
        x = startX = a[0] ?? 0;
        y = startY = a[1] ?? 0;
        wynik.push(['M', zaokr(x), zaokr(y)]);
        break;
      case 'lineTo':
        x = a[0] ?? 0;
        y = a[1] ?? 0;
        wynik.push(['L', zaokr(x), zaokr(y)]);
        break;
      case 'quadraticCurveTo': {
        const [qx = 0, qy = 0, ex = 0, ey = 0] = a;
        // Krzywa kwadratowa jako sześcienna: punkty kontrolne w 2/3 drogi do punktu kontrolnego.
        wynik.push([
          'C',
          zaokr(x + (2 / 3) * (qx - x)),
          zaokr(y + (2 / 3) * (qy - y)),
          zaokr(ex + (2 / 3) * (qx - ex)),
          zaokr(ey + (2 / 3) * (qy - ey)),
          zaokr(ex),
          zaokr(ey),
        ]);
        x = ex;
        y = ey;
        break;
      }
      case 'bezierCurveTo': {
        const [x1 = 0, y1 = 0, x2 = 0, y2 = 0, ex = 0, ey = 0] = a;
        wynik.push(['C', zaokr(x1), zaokr(y1), zaokr(x2), zaokr(y2), zaokr(ex), zaokr(ey)]);
        x = ex;
        y = ey;
        break;
      }
      case 'closePath':
        wynik.push(['Z']);
        x = startX;
        y = startY;
        break;
    }
  }
  return wynik;
}

/** Plik jest kolekcją czcionek (TTC/DFONT) – trzeba wybrać pojedynczą czcionkę. */
export class BladKolekcjiCzcionek extends Error {}

export function wczytajCzcionke(id: string, dane: Uint8Array): Czcionka {
  // fontkit przyjmuje Buffer, ale w praktyce działa na każdym Uint8Array (także w przeglądarce).
  const font = fontkit.create(dane as Buffer);
  if (!('layout' in font)) {
    throw new BladKolekcjiCzcionek(
      `Plik czcionki „${id}” jest kolekcją czcionek – wybierz pojedynczą czcionkę.`,
    );
  }
  return new Czcionka(id, font);
}

const ZAPASOWE: Record<WariantCzcionki, WariantCzcionki[]> = {
  normalny: ['normalny'],
  pogrubiony: ['pogrubiony', 'normalny'],
  kursywa: ['kursywa', 'normalny'],
  'pogrubiona-kursywa': ['pogrubiona-kursywa', 'pogrubiony', 'kursywa', 'normalny'],
};

/**
 * Rodziny czcionek (z wariantami) i role (np. `tytul` → `Grenze Gotisch`).
 * Brakujący wariant zastępowany jest najbliższym dostępnym.
 */
export class RejestrCzcionek {
  private readonly rodziny = new Map<string, Partial<Record<WariantCzcionki, Czcionka>>>();
  private readonly role = new Map<string, string>();

  dodaj(rodzina: string, wariant: WariantCzcionki, czcionka: Czcionka): this {
    const warianty = this.rodziny.get(rodzina) ?? {};
    warianty[wariant] = czcionka;
    this.rodziny.set(rodzina, warianty);
    return this;
  }

  przypiszRole(rola: string, rodzina: string): this {
    this.role.set(rola, rodzina);
    return this;
  }

  pobierz(nazwa: string, wariant: WariantCzcionki = 'normalny'): Czcionka {
    const rodzina = this.role.get(nazwa) ?? nazwa;
    const warianty = this.rodziny.get(rodzina);
    if (warianty) {
      for (const w of ZAPASOWE[wariant]) {
        const c = warianty[w];
        if (c) return c;
      }
    }
    throw new Error(`Brak czcionki „${nazwa}” (${wariant}).`);
  }
}
