import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const korzen = fileURLToPath(new URL('.', import.meta.url));

/**
 * Jawna lista literałów #rrggbb dozwolonych poza tokeny.css (ścieżka względem src/ui).
 * Funkcje `rgb(...)`/`rgba(...)`/`hsl(...)` są dozwolone tylko jako neutralna czerń z przezroczystością
 * `rgb(0 0 0 / x%)` (cienie, siatka podglądu na karcie) – działa w obu motywach; nakładki
 * zaznaczenia na papierze karty mają tokeny `--zaznaczenie-papier`, `--zaznaczenie-karty` i `--papier`.
 * Wszystkie to DANE szablonu lub kolory wyjścia (nie motywu aplikacji): domyślne kolory
 * pól i ramek nowego szablonu, kolor tła obrazu eksportu, podgląd ozdobnika na „pergaminie”.
 */
const DOZWOLONE: Record<string, string[]> = {
  'rewers/EdytorRewersu.tsx': ['#000000'], // domyślny kolor grafiki i obrysu rewersu
  'biblioteka/podgladElementu.ts': ['#7a2e24', '#f7f0dc', '#fff8e6'],
  'eksportObrazow.ts': ['#ffffff'], // tło eksportowanego obrazu
  'szablon/EdytorSzablonu.tsx': ['#ffffff'], // domyślne tło karty
  'szablon/Kontrolki.tsx': ['#000000'], // domyślny kolor pola wyboru koloru
  'szablon/Kreator.tsx': ['#ffffff'], // tło nowego szablonu
  'szablon/PanelSeparatora.tsx': ['#000000'],
  'szablon/PanelStylu.tsx': ['#000000', '#ffffff'],
  'szablon/PanelTypu.tsx': ['#000000', '#eeeeee'],
  'szablon/PanelWygladu.tsx': ['#000000', '#ffffff'],
};

function pliki(dir: string): string[] {
  return readdirSync(dir).flatMap((nazwa) => {
    const sciezka = join(dir, nazwa);
    if (statSync(sciezka).isDirectory()) return pliki(sciezka);
    return /\.(css|tsx?)$/.test(nazwa) && !/\.test\.tsx?$/.test(nazwa) ? [sciezka] : [];
  });
}

describe('kolory na sztywno w src/ui', () => {
  it('poza tokeny.css są tylko literały z jawnej listy (dane szablonu)', () => {
    const naruszenia: string[] = [];
    for (const plik of pliki(korzen)) {
      const wzgledna = relative(korzen, plik).replaceAll('\\', '/');
      if (wzgledna === 'tokeny.css') continue;
      const dozwolone = new Set(DOZWOLONE[wzgledna] ?? []);
      const tekst = readFileSync(plik, 'utf8');
      for (const m of tekst.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
        if (!dozwolone.has(m[0].toLowerCase())) naruszenia.push(`${wzgledna}: ${m[0]}`);
      }
    }
    expect(naruszenia).toEqual([]);
  });

  it('lista dozwolonych nie zawiera nieużywanych wpisów', () => {
    for (const [plik, lista] of Object.entries(DOZWOLONE)) {
      const tekst = readFileSync(join(korzen, plik), 'utf8').toLowerCase();
      for (const l of lista) expect(tekst, `${plik}: ${l}`).toContain(l);
    }
  });

  it('funkcje kolorów poza tokeny.css: tylko czerń z przezroczystością w cieniach i siatce', () => {
    const naruszenia: string[] = [];
    for (const plik of pliki(korzen)) {
      const wzgledna = relative(korzen, plik).replaceAll('\\', '/');
      if (wzgledna === 'tokeny.css') continue;
      const tekst = readFileSync(plik, 'utf8');
      // Inne przestrzenie kolorów nie mają tu zastosowania (kolory idą z tokenów).
      for (const m of tekst.matchAll(/(?<![\w-])(?:oklch|oklab|lab|lch|hwb|color)\(/g))
        naruszenia.push(`${wzgledna}: ${m[0]}`);
      for (const m of tekst.matchAll(/\b(?:rgba?|hsla?)\(([^)]*)\)/g)) {
        const czern = /^\s*0[ ,]+0[ ,]+0\s*[/,]/.test(m[1]!);
        // Dozwolone tylko w cieniach (box-shadow, --cien*) i siatce podglądu (linear-gradient).
        const przed = tekst.slice(Math.max(0, m.index! - 160), m.index!);
        const wCieniu = /(box-shadow|linear-gradient)[^;{}]*$/.test(przed);
        if (!(czern && wCieniu) || !wzgledna.endsWith('.css'))
          naruszenia.push(`${wzgledna}: ${m[0]}`);
      }
    }
    expect(naruszenia).toEqual([]);
  });

  it('nazwy kolorów CSS (white, black, red…) poza color-mix z czernią są zabronione', () => {
    const nazwy =
      /\b(white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|silver|navy|teal|maroon|lime|aqua|fuchsia|olive|cyan|magenta|brown|gold|beige|ivory|tan)\b/i;
    const naruszenia: string[] = [];
    for (const plik of pliki(korzen)) {
      if (!plik.endsWith('.css')) continue;
      const wzgledna = relative(korzen, plik).replaceAll('\\', '/');
      if (wzgledna === 'tokeny.css') continue;
      // Bez komentarzy i bez color-mix(…) – tam czerń jawnie wolno (przyciemnianie tła).
      const tekst = readFileSync(plik, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/color-mix\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, 'color-mix()');
      for (const m of tekst.matchAll(/([\w-]+)\s*:\s*([^;{}]+)[;}]/g)) {
        if (m[1]!.startsWith('--') && m[1] !== '--znacznik') continue;
        const wartosc = m[2]!.replace(/url\([^)]*\)/g, '').replace(/'[^']*'/g, '');
        if (nazwy.test(wartosc) && !/^(font|content|grid|list|white-space)/.test(m[1]!))
          naruszenia.push(`${wzgledna}: ${m[1]}: ${m[2]!.trim()}`);
      }
    }
    expect(naruszenia).toEqual([]);
  });
});
