// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';
import { KLUCZ_JEZYKA, KLUCZ_MOTYWU } from '../wspolne/ustawienia';

/**
 * Testy treści instrukcji (instrukcja/index.html): spójność nazw z interfejsem, styl, parytet PL ↔ EN,
 * zrzuty, elementy paska. Lista kontrolna stylu jest w komentarzu na początku <main> w index.html.
 */

const zrodlo = readFileSync(resolve('instrukcja/index.html'), 'utf8');
const dok = new DOMParser().parseFromString(zrodlo, 'text/html');

type Jezyk = 'pl' | 'en';
const JEZYKI: Jezyk[] = ['pl', 'en'];
const SLOWNIKI: Record<Jezyk, Record<string, string>> = { pl, en };

const artykul = (j: Jezyk) => dok.querySelector(`article[data-jezyk="${j}"]`)!;
const tekst = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

// ---------- nazwy w cudzysłowach istnieją w interfejsie ----------

/** Dosłowne cytaty, których nie ma w słownikach interfejsu (cudze okna dialogowe). */
const OBCE_OKNA: Record<Jezyk, string[]> = {
  pl: ['Dopasuj do strony', 'Rzeczywisty rozmiar'], // okno drukowania przeglądarki i przeglądarki PDF
  en: ['Fit to page', 'Actual size'],
};

/**
 * Nazwy skrócone: interfejs dopisuje do nich wymiary w nawiasie (np. „Dodaj kartę w to miejsce (wolne
 * 40×60 mm)”). Test wymaga, żeby taki skrót był początkiem jakiegoś tekstu interfejsu.
 */
const SKROTY: Record<Jezyk, string[]> = {
  pl: ['Dodaj kartę w to miejsce'],
  en: ['Add a card here'],
};

/**
 * Ograniczenie testu: sprawdza, że nazwa jest GDZIEKOLWIEK w słowniku interfejsu, a nie że stoi w tym
 * miejscu, które opisuje zdanie (np. „Eksportuj” przy szablonie i przy projekcie to ten sam tekst, ale
 * dwa różne przyciski). Dla kluczowych nazw poniżej sprawdzamy dodatkowo dokładny klucz słownika.
 */
const KLUCZOWE: Record<string, (j: Jezyk) => string> = {
  'kartka.ustawienia': (j) => SLOWNIKI[j]['kartka.ustawienia']!,
  'projekty.eksportuj': (j) => SLOWNIKI[j]['projekty.eksportuj']!,
  'pobierz.menu': (j) => SLOWNIKI[j]['pobierz.menu']!,
  'pobierz.pdf': (j) => SLOWNIKI[j]['pobierz.pdf']!,
  'start.importujPliki': (j) => SLOWNIKI[j]['start.importujPliki']!,
  'start.stworzDo': (j) =>
    SLOWNIKI[j]['start.stworzDo']!.replace('{gra}', SLOWNIKI[j]['gra.mausritter.nazwaDo']!),
};

const CUDZYSLOW: Record<Jezyk, RegExp> = { pl: /„([^„”]+)”/g, en: /“([^“”]+)”/g };

/** Bez ozdobników z początku (＋ ⤒ ✎ ← →…) i końca (… ► ▾) – tak, jak nazwy podaje instrukcja. */
const goly = (s: string) =>
  s
    .replace(/^[^\p{L}\p{N}%(]+/u, '')
    .replace(/[^\p{L}\p{N})}%.]+$/u, '')
    .replace(/\.+$/, '')
    .trim();

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function nazwyInterfejsu(j: Jezyk) {
  const dokladne = new Set<string>();
  const wzorce: RegExp[] = [];
  const poczatki: string[] = [];
  for (const wartosc of Object.values(SLOWNIKI[j])) {
    const w = goly(wartosc);
    if (!w) continue;
    if (/\{\w+\}/.test(w)) {
      // Tekst z parametrem: pasuje dowolna wartość w miejscu {param} (np. „Duplikuj ×3”).
      wzorce.push(new RegExp(`^${escRe(w).replace(/\\\{\w+\\\}/g, '.+')}$`));
      poczatki.push(w);
    } else {
      dokladne.add(w);
      poczatki.push(w);
    }
  }
  return { dokladne, wzorce, poczatki };
}

describe.each(JEZYKI)('nazwy w cudzysłowach (%s) istnieją w interfejsie', (j) => {
  const { dokladne, wzorce, poczatki } = nazwyInterfejsu(j);
  const wszystkie = [...tekst(artykul(j)).matchAll(CUDZYSLOW[j])].map((m) => goly(m[1]!));

  it('cytowanych nazw jest dużo (test wykrywa je poprawnie)', () => {
    expect(wszystkie.length).toBeGreaterThan(150);
  });

  it('każda nazwa jest tekstem interfejsu albo jawnym wyjątkiem', () => {
    const brakujace = [...new Set(wszystkie)].filter(
      (n) =>
        !dokladne.has(n) &&
        !wzorce.some((w) => w.test(n)) &&
        !OBCE_OKNA[j].includes(n) &&
        !SKROTY[j].includes(n),
    );
    expect(brakujace).toEqual([]);
  });

  it('kluczowe nazwy występują i zgadzają się z dokładnym kluczem słownika', () => {
    const cytaty = new Set(wszystkie);
    for (const [klucz, wartosc] of Object.entries(KLUCZOWE))
      expect(cytaty.has(goly(wartosc(j))), `${klucz}: „${wartosc(j)}”`).toBe(true);
  });

  it('skróty z listy wyjątków są początkiem tekstów interfejsu', () => {
    for (const s of SKROTY[j])
      expect(
        poczatki.some((p) => p.startsWith(s)),
        s,
      ).toBe(true);
  });

  it('wyjątki obcych okien nie są tekstami interfejsu (inaczej wyjątek jest zbędny)', () => {
    for (const s of OBCE_OKNA[j]) expect(dokladne.has(s), s).toBe(false);
  });
});

describe('nazwa przycisku pasek: „Instrukcja” / „Guide” i spółka', () => {
  it('etykiety paska równe słownikom aplikacji', () => {
    const etykieta = (sel: string, j: Jezyk) =>
      dok.querySelector(sel)!.getAttribute(`data-etykieta-${j}`);
    for (const j of JEZYKI) {
      const S = SLOWNIKI[j];
      expect(etykieta('.narzedzia-paska', j)).toBe(S['pasek.narzedzia']);
      expect(etykieta('[aria-label="Język"]', j)).toBe(S['jezyk.grupa']);
      expect(etykieta('[aria-label="Motyw"]', j)).toBe(S['motyw.grupa']);
      expect(etykieta('[data-motyw="light"]', j)).toBe(S['motyw.jasny']);
      expect(etykieta('[data-motyw="dark"]', j)).toBe(S['motyw.ciemny']);
      expect(etykieta('nav.spis', j)).toBe(S['instrukcja.spisTresci']);
    }
  });

  it('napisy paska i skip-linku równe słownikom', () => {
    const w = (sel: string, j: Jezyk) => tekst(dok.querySelector(`${sel} [data-jezyk="${j}"]`)!);
    for (const j of JEZYKI) {
      const S = SLOWNIKI[j];
      expect(w('.logo', j)).toBe(S['aplikacja.nazwa']);
      expect(w('.powrot', j)).toBe(S['pasek.powrotDoAplikacji']);
      expect(w('.przycisk-kontur', j)).toBe(S['pasek.instrukcja']);
      expect(w('.pomin', j)).toBe(S['instrukcja.doTresci']);
      expect(w('.etykieta-sekcji', j)).toBe(S['instrukcja.spisTresci']);
      expect(dok.documentElement.getAttribute(`data-tytul-${j}`)).toBe(S['instrukcja.tytulStrony']);
    }
  });

  it('przyciski języka mają lang, opis i nazwy jak w aplikacji', () => {
    for (const j of JEZYKI) {
      const b = dok.querySelector(`[data-jezyk-przycisk="${j}"]`)!;
      expect(b.getAttribute('lang')).toBe(j);
      expect(tekst(b)).toBe(pl[`jezyk.${j}`]);
      expect(b.getAttribute('title')).toBe(pl[`jezyk.${j}Opis`]);
    }
  });

  it('skrypt przed pierwszym malowaniem czyta te same klucze localStorage co aplikacja', () => {
    const skrypt = dok.querySelector('head script:not([src])')!.textContent!;
    expect(skrypt).toContain(`'${KLUCZ_MOTYWU}'`);
    expect(skrypt).toContain(`'${KLUCZ_JEZYKA}'`);
    expect(skrypt).toContain("'lang'");
  });
});

// ---------- styl ----------

const ZAKAZANE: Record<Jezyk, string[]> = {
  pl: [
    'oto przewodnik',
    'oto ',
    'zanurz się',
    'wspaniał',
    'w tym artykule',
    'warto zauważyć',
    'warto wiedzieć',
    'warto pamiętać',
    'kompleksow',
    'bezproblemow',
    'niezwykł',
    'fantastyczn',
    'odkryj',
    'krok po kroku',
    'w mgnieniu oka',
    'bez wysiłku',
    'potęg',
    'podróż',
    'rewolucyjn',
    'idealn',
    'doskonał',
    'mamy nadzieję',
    'nie przegap',
    'umożliwia',
    'ułatwi',
    'intuicyjn',
    'łatwo i szybko',
    'pamiętaj, że',
    'co więcej',
    'ponadto',
    'podsumowując',
    'zachęcamy',
    'nie martw się',
  ],
  en: [
    'dive into',
    'delve',
    'seamless',
    'comprehensive',
    'in this article',
    "it's worth",
    'worth noting',
    "here's a guide",
    'here is a guide',
    'unlock',
    'empower',
    'leverage',
    'game-changer',
    'step-by-step',
    'journey',
    'elevate',
    'robust',
    'effortless',
    "whether you're",
    "in today's",
    'wonderful',
    'fantastic',
    'amazing',
    'simply',
    'we hope',
    'easily',
    'intuitive',
    'powerful',
    'streamline',
    'ensure',
    'please note',
    'note that',
    'feel free',
    'moreover',
    'furthermore',
    'additionally',
    'utilize',
    'in order to',
    'crucial',
  ],
};

/** Emoji, strzałki, symbole techniczne i geometryczne, dingbaty (ikony i ozdobniki w tekście). */
const IKONY =
  /[\u{1F000}-\u{1FFFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FF0B}]|\u{FE0F}|\u{200D}/u;

describe.each(JEZYKI)('styl treści (%s)', (j) => {
  const art = artykul(j);
  const tresc = tekst(art);
  const atrybuty = [...art.querySelectorAll('[alt],[title]')].map(
    (e) => `${e.getAttribute('alt') ?? ''} ${e.getAttribute('title') ?? ''}`,
  );

  it('bez emoji, ikon i dekoracyjnych symboli', () => {
    expect(IKONY.exec(tresc)?.[0]).toBeUndefined();
    for (const a of atrybuty) expect(IKONY.exec(a)?.[0]).toBeUndefined();
  });

  it('bez wykrzykników', () => {
    expect(/.{0,30}!.{0,10}/.exec(tresc)?.[0]).toBeUndefined();
    for (const a of atrybuty) expect(a).not.toContain('!');
  });

  it('bez zakazanych zwrotów', () => {
    const maly = ` ${tresc.toLowerCase()}`;
    const znalezione = ZAKAZANE[j].filter((z) => maly.includes(z.startsWith('oto ') ? ` ${z}` : z));
    expect(znalezione).toEqual([]);
  });

  it('bez pustych akapitów, nagłówków i pozycji list', () => {
    for (const el of art.querySelectorAll('p, li, h1, h2, h3, figcaption'))
      expect(tekst(el), el.outerHTML.slice(0, 60)).not.toBe('');
  });

  it('bez <br> i spacerów między wierszami', () => {
    expect(art.querySelectorAll('br')).toHaveLength(0);
    expect(art.innerHTML).not.toMatch(/&nbsp;|<p>\s*<\/p>|<hr/);
  });

  it('nagłówek ma po sobie treść (akapit, listę, rysunek albo podrzędny nagłówek)', () => {
    for (const h of art.querySelectorAll('h2, h3')) {
      const nastepny = h.nextElementSibling;
      expect(nastepny, h.id).not.toBeNull();
      const poziom = Number(h.tagName[1]);
      if (/^H[1-3]$/.test(nastepny!.tagName))
        expect(Number(nastepny!.tagName[1]), `${h.id}: nagłówek po nagłówku`).toBeGreaterThan(
          poziom,
        );
    }
  });

  it('kroki są listami numerowanymi, a nie akapitami „Krok 1”', () => {
    expect(tresc).not.toMatch(/\b(Krok|Step) \d/);
    expect(art.querySelectorAll('ol').length).toBeGreaterThan(10);
  });
});

// ---------- styl całej strony (pasek, spis, komunikat noscript, treść) ----------

describe('styl całej strony', () => {
  const kopia = dok.body.cloneNode(true) as HTMLElement;
  kopia.querySelectorAll('script, style').forEach((e) => e.remove());
  // Krzywy apostrof ’ traktujemy jak prosty, żeby lista zakazanych zwrotów działała dla obu.
  const calosc = tekst(kopia).replace(/’/g, "'");
  const atrybuty = [...dok.body.querySelectorAll('[alt],[title],[aria-label]')]
    .map(
      (e) => `${e.getAttribute('alt')} ${e.getAttribute('title')} ${e.getAttribute('aria-label')}`,
    )
    .join(' ');

  it('bez emoji, ikon, wykrzykników i zakazanych zwrotów (obie wersje językowe)', () => {
    expect(IKONY.exec(calosc)?.[0]).toBeUndefined();
    expect(IKONY.exec(atrybuty)?.[0]).toBeUndefined();
    expect(/.{0,30}!.{0,10}/.exec(`${calosc} ${atrybuty}`)?.[0]).toBeUndefined();
    const maly = ` ${calosc.toLowerCase()}`;
    const zakazane = [...ZAKAZANE.pl, ...ZAKAZANE.en];
    expect(zakazane.filter((z) => maly.includes(z.startsWith('oto ') ? ` ${z}` : z))).toEqual([]);
  });

  it('bez pauzy i półpauzy w zdaniach (dozwolone tylko wewnątrz nazw z interfejsu w cudzysłowach)', () => {
    // Nazwy interfejsu mają półpauzy (np. „Obrazy stron – JPG, 300 dpi”), więc cytaty pomijamy.
    const bezCytatow = calosc.replace(/„[^„”]*”|“[^“”]*”/g, '');
    expect(/.{0,25}[–—].{0,25}/.exec(bezCytatow)?.[0]).toBeUndefined();
  });
});

// ---------- struktura ----------

describe('parytet sekcji PL ↔ EN', () => {
  const ids = (j: Jezyk, sel: string) =>
    [...artykul(j).querySelectorAll(sel)].map((h) => h.id.replace(/^(pl|en)-/, ''));

  it('te same h2 i h3 w tej samej kolejności', () => {
    expect(ids('en', 'h2, h3')).toEqual(ids('pl', 'h2, h3'));
    expect(ids('pl', 'h2').length).toBeGreaterThanOrEqual(8);
  });

  it('identyfikatory mają przedrostek języka i są unikalne w dokumencie', () => {
    for (const j of JEZYKI)
      for (const h of artykul(j).querySelectorAll('h2, h3'))
        expect(h.id).toMatch(new RegExp(`^${j}-`));
    const wszystkie = [...dok.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(wszystkie).size).toBe(wszystkie.length);
  });

  /** Liczba akapitów, pozycji list i rysunków pod każdym nagłówkiem h2/h3 (do następnego nagłówka). */
  const zawartosc = (j: Jezyk) => {
    const wynik = new Map<string, { p: number; li: number; figure: number }>();
    let klucz = '';
    for (const el of artykul(j).children) {
      if (/^H[23]$/.test(el.tagName)) {
        klucz = el.id.replace(/^(pl|en)-/, '');
        wynik.set(klucz, { p: 0, li: 0, figure: 0 });
      } else if (klucz) {
        const w = wynik.get(klucz)!;
        if (el.tagName === 'P') w.p++;
        if (el.tagName === 'FIGURE') w.figure++;
        w.li += el.querySelectorAll(':scope > li').length;
      }
    }
    return Object.fromEntries(wynik);
  };

  it('w każdej sekcji tyle samo akapitów, pozycji list i rysunków', () => {
    expect(zawartosc('en')).toEqual(zawartosc('pl'));
  });

  it('każdy nagłówek ma w treści tyle samo rysunków i list w obu językach', () => {
    for (const sel of ['figure', 'ol', 'ul', 'kbd'])
      expect(artykul('en').querySelectorAll(sel).length, sel).toBe(
        artykul('pl').querySelectorAll(sel).length,
      );
  });

  it('spis treści wskazuje h2 danego języka, w tej samej kolejności', () => {
    for (const j of JEZYKI) {
      const linki = [...dok.querySelectorAll(`nav ol[data-jezyk="${j}"] a`)].map((a) =>
        a.getAttribute('href'),
      );
      expect(linki).toEqual([...artykul(j).querySelectorAll('h2')].map((h) => `#${h.id}`));
    }
  });

  it('wszystkie odnośniki wewnętrzne wskazują istniejące identyfikatory', () => {
    for (const a of dok.querySelectorAll('a[href^="#"]')) {
      const cel = a.getAttribute('href')!.slice(1);
      expect(dok.getElementById(cel), cel).not.toBeNull();
    }
  });

  it('bloki językowe mają lang zgodny z językiem', () => {
    for (const el of dok.querySelectorAll('[data-jezyk]'))
      expect(el.getAttribute('lang')).toBe(el.getAttribute('data-jezyk'));
  });
});

describe('zrzuty ekranu w treści', () => {
  const NAZWY = [
    'start',
    'mausritter',
    'edytor-kartki',
    'ekran-kart',
    'edytor-szablonu',
    'ustawienia',
    'biblioteki',
  ];

  it.each(JEZYKI)('(%s) siedem rysunków z alt, podpisem, wymiarami i loading=lazy', (j) => {
    const rysunki = [...artykul(j).querySelectorAll('figure')];
    expect(rysunki.map((f) => f.querySelector('img')!.getAttribute('src'))).toEqual(
      NAZWY.map((n) => `/instrukcja-zrzuty/${j}/${n}.png`).sort(
        (a, b) => zrodlo.indexOf(a) - zrodlo.indexOf(b),
      ),
    );
    for (const f of rysunki) {
      const img = f.querySelector('img')!;
      expect(img.getAttribute('alt')!.length).toBeGreaterThan(15);
      expect(img.getAttribute('width')).toBe('1440');
      expect(img.getAttribute('height')).toBe('900');
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(tekst(f.querySelector('figcaption')!).length).toBeGreaterThan(15);
      // Alt opisuje obraz, a podpis go uzupełnia – nie powtarzają się.
      expect(img.getAttribute('alt')).not.toBe(tekst(f.querySelector('figcaption')!));
    }
  });
});

describe('strona', () => {
  it('<html lang> i <title> startowe są polskie, <main> jest celem skip-linku', () => {
    expect(dok.documentElement.getAttribute('lang')).toBe('pl');
    expect(dok.title).toBe(pl['instrukcja.tytulStrony']);
    expect(dok.querySelector('main')!.id).toBe('tresc');
    expect(dok.querySelector('a.pomin')!.getAttribute('href')).toBe('#tresc');
    expect(dok.querySelectorAll('h1')).toHaveLength(2); // po jednym na język (drugi ukryty)
  });

  it('tokeny kolorów są ładowane z aplikacji, a CSS i skrypt nie mają literałów #rrggbb', () => {
    expect(zrodlo).toContain('href="/src/ui/tokeny.css"');
    expect(zrodlo).toContain('href="/src/ui/pasek.css"');
    for (const plik of ['instrukcja.css', 'strona.ts', 'wybor.ts']) {
      const kod = readFileSync(resolve('src/instrukcja', plik), 'utf8');
      expect(kod, plik).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('bez Reacta: strona ładuje tylko własny skrypt', () => {
    const skrypty = [...dok.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'));
    expect(skrypty).toEqual(['/src/instrukcja/strona.ts']);
    const kod = readFileSync(resolve('src/instrukcja/strona.ts'), 'utf8');
    expect(kod).not.toMatch(/from 'react|from '\.\.\/(i18n|ui|silnik|druk)/);
  });
});
