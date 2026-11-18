/**
 * Skrypt strony instrukcji (instrukcja/index.html) – bez Reacta i bez silnika.
 * Obsługuje przełącznik języka PL | EN, przełącznik motywu, spis treści (podświetlenie sekcji,
 * fokus na nagłówku po przejściu z klawiatury). Pierwsze malowanie (motyw, język, tytuł) ustawia
 * wcześniej mały skrypt w <head>; tu są klucze localStorage wspólne z aplikacją.
 */
import { KLUCZ_JEZYKA, KLUCZ_MOTYWU } from '../wspolne/ustawienia';
import { czyJezyk, wybierzJezyk, wybierzMotyw, type Jezyk, type Motyw } from './wybor';

function zapamietane(klucz: string): string | null {
  try {
    return window.localStorage.getItem(klucz);
  } catch {
    return null;
  }
}

const html = document.documentElement;
const zapytanieCiemne = window.matchMedia('(prefers-color-scheme: dark)');

/** Wybór z tej sesji, gdy zapis do localStorage się nie udał (np. tryb prywatny). */
let motywSesji: Motyw | undefined;
let jezykSesji: Jezyk | undefined;

const aktualnyJezyk = (): Jezyk => (html.lang === 'en' ? 'en' : 'pl');

function zastosujMotyw(): void {
  const wybor = motywSesji ?? zapamietane(KLUCZ_MOTYWU);
  const motyw = wybierzMotyw(wybor, zapytanieCiemne.matches);
  html.dataset.theme = motyw;
  document.querySelectorAll<HTMLButtonElement>('[data-motyw]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.motyw === motyw));
  });
}

function ustawMotyw(motyw: Motyw): void {
  motywSesji = undefined;
  try {
    window.localStorage.setItem(KLUCZ_MOTYWU, motyw);
  } catch {
    motywSesji = motyw;
  }
  zastosujMotyw();
}

/** Etykiety zależne od języka: `data-etykieta-pl` / `data-etykieta-en` → aria-label (i title przycisków). */
function zastosujEtykiety(jezyk: Jezyk): void {
  document.querySelectorAll<HTMLElement>(`[data-etykieta-${jezyk}]`).forEach((el) => {
    const tekst = el.getAttribute(`data-etykieta-${jezyk}`) ?? '';
    el.setAttribute('aria-label', tekst);
    if (el instanceof HTMLButtonElement) el.title = tekst;
  });
}

/** Przy zmianie języka hasz `#pl-sekcja` zamienia się na `#en-sekcja` i odwrotnie. */
function przepiszHasz(jezyk: Jezyk): void {
  const m = /^#(?:pl|en)-(.+)$/.exec(window.location.hash);
  if (!m) return;
  const id = `${jezyk}-${m[1]}`;
  history.replaceState(null, '', `${window.location.search}#${id}`);
  document.getElementById(id)?.scrollIntoView();
}

function zastosujJezyk(jezyk: Jezyk, odswiezAdres = true): void {
  html.lang = jezyk;
  document.title = html.dataset[jezyk === 'pl' ? 'tytulPl' : 'tytulEn'] ?? document.title;
  document.querySelectorAll<HTMLButtonElement>('[data-jezyk-przycisk]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.jezykPrzycisk === jezyk));
  });
  zastosujEtykiety(jezyk);
  przepiszHasz(jezyk);
  if (odswiezAdres) {
    // `?lang=` ma pierwszeństwo przy ładowaniu – adres odzwierciedla bieżący wybór.
    const adres = new URL(window.location.href);
    if (adres.searchParams.has('lang')) {
      adres.searchParams.set('lang', jezyk);
      history.replaceState(null, '', adres);
    }
  }
  obserwujSekcje();
}

function ustawJezyk(jezyk: Jezyk): void {
  jezykSesji = undefined;
  try {
    window.localStorage.setItem(KLUCZ_JEZYKA, jezyk);
  } catch {
    jezykSesji = jezyk;
  }
  zastosujJezyk(jezyk);
}

// ---------- spis treści: podświetlenie bieżącej sekcji ----------
let obserwator: IntersectionObserver | undefined;

function obserwujSekcje(): void {
  obserwator?.disconnect();
  const jezyk = aktualnyJezyk();
  const naglowki = [...document.querySelectorAll<HTMLElement>(`article[lang='${jezyk}'] h2[id]`)];
  const linki = new Map(
    [...document.querySelectorAll<HTMLAnchorElement>(`nav ol[lang='${jezyk}'] a`)].map((a) => [
      a.hash.slice(1),
      a,
    ]),
  );
  const zaznacz = (id: string) => {
    linki.forEach((a, k) => {
      if (k === id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  };
  if (typeof IntersectionObserver === 'undefined' || naglowki.length === 0) {
    if (naglowki[0]) zaznacz(naglowki[0].id);
    return;
  }
  // Bieżąca sekcja to ostatni nagłówek, który minął górną część okna.
  const widoczne = new Set<string>();
  const wybierz = () => {
    const pierwszy = naglowki.find((n) => widoczne.has(n.id));
    if (pierwszy) return zaznacz(pierwszy.id);
    const nad = naglowki.filter((n) => n.getBoundingClientRect().top < window.innerHeight * 0.4);
    zaznacz((nad.at(-1) ?? naglowki[0]!).id);
  };
  obserwator = new IntersectionObserver(
    (wpisy) => {
      for (const w of wpisy) {
        if (w.isIntersecting) widoczne.add(w.target.id);
        else widoczne.delete(w.target.id);
      }
      wybierz();
    },
    { rootMargin: '0px 0px -60% 0px' },
  );
  naglowki.forEach((n) => obserwator!.observe(n));
  wybierz();
}

/** Fokus na nagłówku docelowym: czytnik i Tab zaczynają od niego, a nie od początku strony. */
function fokusNaCelu(): void {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  const cel = document.getElementById(id);
  if (!cel) return;
  if (!cel.hasAttribute('tabindex')) cel.setAttribute('tabindex', '-1');
  cel.focus({ preventScroll: true });
}

function start(): void {
  zastosujJezyk(
    wybierzJezyk(
      window.location.search,
      jezykSesji ?? zapamietane(KLUCZ_JEZYKA),
      navigator.language,
    ),
    false,
  );
  zastosujMotyw();

  document.querySelectorAll<HTMLButtonElement>('[data-jezyk-przycisk]').forEach((b) => {
    b.addEventListener('click', () => ustawJezyk(b.dataset.jezykPrzycisk === 'en' ? 'en' : 'pl'));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-motyw]').forEach((b) => {
    b.addEventListener('click', () => ustawMotyw(b.dataset.motyw === 'dark' ? 'dark' : 'light'));
  });
  zapytanieCiemne.addEventListener('change', zastosujMotyw);
  // Zmiana wyboru w innej karcie (aplikacja lub druga instrukcja).
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === KLUCZ_MOTYWU) zastosujMotyw();
    if (e.key === null || e.key === KLUCZ_JEZYKA) {
      const nowy = zapamietane(KLUCZ_JEZYKA);
      if (czyJezyk(nowy) && nowy !== aktualnyJezyk()) zastosujJezyk(nowy);
    }
  });
  window.addEventListener('hashchange', fokusNaCelu);
  if (window.location.hash) fokusNaCelu();
}

start();
