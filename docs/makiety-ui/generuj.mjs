// Generuje makiety interfejsu (PNG) do docs/obrazy/.
//   node docs/makiety-ui/generuj.mjs            – używa zapisanych podglądów z docs/makiety-ui/podglady/
//   node docs/makiety-ui/generuj.mjs --podglady – najpierw renderuje podglądy silnikiem aplikacji (Vitest)
// Wymaga zainstalowanego Playwrighta z Chromium (npm ci && npx playwright install chromium).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const KATALOG = dirname(fileURLToPath(import.meta.url));
const KORZEN = join(KATALOG, '..', '..');
const PODGLADY = join(KATALOG, 'podglady');
const HTML = join(KATALOG, 'html');
const WYJSCIE = join(KORZEN, 'docs', 'obrazy');

if (process.argv.includes('--podglady')) {
  execFileSync('npx', ['vitest', 'run', '--config', 'docs/makiety-ui/vitest.config.ts'], {
    cwd: KORZEN,
    stdio: 'inherit',
  });
}
mkdirSync(HTML, { recursive: true });
mkdirSync(WYJSCIE, { recursive: true });

// ---------- dane z silnika ----------
const info = JSON.parse(readFileSync(join(PODGLADY, 'info.json'), 'utf8'));
/** SVG z silnika wstawiony w stronę; wymiary w mm zastępuje rozmiar z CSS. */
const svg = (nazwa) =>
  readFileSync(join(PODGLADY, nazwa), 'utf8').replace(
    /^<svg([^>]*?) width="[^"]*" height="[^"]*"/,
    '<svg$1',
  );
const zastepczyPng = `data:image/png;base64,${readFileSync(join(KORZEN, 'src/pakiety/mausritter/obrazy/zastepczy.png')).toString('base64')}`;

// ---------- elementy wspólne ----------
const SLONCE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const KSIEZYC =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>';

/** Trzy kontrolki na samym końcu paska: Instrukcja, język, motyw. */
function kontrolkiKonca(motyw, { instrukcja = false } = {}) {
  return `
    <button class="btn-kontur${instrukcja ? ' aktywny' : ''}" type="button"${instrukcja ? ' aria-current="page"' : ''}>Instrukcja</button>
    <div class="seg" role="group" aria-label="Język">
      <button type="button" aria-pressed="true">PL</button><button type="button" aria-pressed="false">EN</button>
    </div>
    <div class="seg" role="group" aria-label="Motyw">
      <button type="button" aria-label="Motyw jasny" aria-pressed="${motyw === 'light'}">${SLONCE}</button><button type="button" aria-label="Motyw ciemny" aria-pressed="${motyw === 'dark'}">${KSIEZYC}</button>
    </div>`;
}

function pasek(motyw, opcje = {}) {
  return `<header class="gora">
    <span class="nazwa-app">Karty RPG</span>
    ${opcje.srodek ?? ''}
    <span class="rozpychacz"></span>
    ${opcje.przedKoncem ?? ''}
    ${kontrolkiKonca(motyw, opcje)}
  </header>`;
}

const okruszki = (...czesci) =>
  `<nav class="okruszki" aria-label="Okruszki">${czesci
    .map((c, i) =>
      i < czesci.length - 1
        ? `<a href="#">${c}</a><span class="sep">›</span>`
        : `<span class="biezacy" aria-current="page">${c}</span>`,
    )
    .join('')}</nav>`;

const pasekMenu = (klasa, tytul, opis, aktywny = false) =>
  `<button type="button" class="pasek-menu ${klasa}${aktywny ? ' aktywny' : ''}"><b>${tytul}</b><span>${opis}</span></button>`;

const stopka = `<footer class="stopka"><span>Karty RPG, wersja 0.1.0</span><span>Projekty zostają w tej przeglądarce</span><span class="rozpychacz"></span><a href="#">Licencje</a><a href="#">Kod źródłowy</a></footer>`;

function strona(motyw, tytul, tresc, dodatkowyCss = '') {
  return `<!doctype html><html lang="pl" data-theme="${motyw}"><head><meta charset="utf-8"><title>${tytul}</title>
<link rel="stylesheet" href="../makiety.css"><style>${dodatkowyCss}</style></head><body>${tresc}</body></html>`;
}

// ---------- siatka slotów nad pustą kartką (jak nakładka edytora) ----------
function siatkaSlotow(
  opis,
  { zajete = new Set(), cel = null, zaznaczona = null, klasa = 'siatka' } = {},
) {
  const { poczatek: p, slot: s, siatka: g } = opis;
  let r = '';
  for (let k = 0; k < g.kolumny; k++)
    for (let w = 0; w < g.rzedy; w++) {
      if (zajete.has(`${k},${w}`)) continue;
      const x = p.x + k * s.szerokosc;
      const y = p.y + w * s.wysokosc;
      const jestCel = cel && cel[0] === k && cel[1] === w;
      r += jestCel
        ? `<rect x="${x}" y="${y}" width="${s.szerokosc}" height="${s.wysokosc}" fill="#2f7fd8" fill-opacity=".16" stroke="#2f7fd8" stroke-width=".5"/>`
        : `<rect x="${x}" y="${y}" width="${s.szerokosc}" height="${s.wysokosc}" fill="none" stroke="#1b7fa8" stroke-opacity=".55" stroke-width=".28" stroke-dasharray="1.6 1.2"/>`;
    }
  if (zaznaczona) {
    const [k, w, sz, wy] = zaznaczona;
    const x = p.x + k * s.szerokosc;
    const y = p.y + w * s.wysokosc;
    const W = sz * s.szerokosc;
    const H = wy * s.wysokosc;
    r += `<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="none" stroke="#2f7fd8" stroke-width=".7"/>`;
    for (const [hx, hy] of [
      [x, y],
      [x + W, y],
      [x, y + H],
      [x + W, y + H],
    ])
      r += `<rect x="${hx - 0.9}" y="${hy - 0.9}" width="1.8" height="1.8" fill="#fff" stroke="#2f7fd8" stroke-width=".4"/>`;
  }
  return `<svg class="${klasa}" viewBox="0 0 297 210" aria-hidden="true">${r}</svg>`;
}

// =====================================================================================
// 1. Start
// =====================================================================================
function kafelekProjektu({ nazwa, meta, data, miniatura }) {
  return `<article class="kafelek">
    <div class="miniatura kadr">${miniatura}</div>
    <div class="opis"><b>${nazwa}</b>
      <div class="meta">${meta}</div><div class="meta">${data}</div>
      <div class="akcje"><button class="btn glowny" type="button">Otwórz</button><button class="btn" type="button">Eksportuj</button><button class="btn" type="button">Usuń</button></div>
    </div></article>`;
}
const papierZSvg = (nazwa) =>
  `<div class="papier" style="width:100%;aspect-ratio:297/210">${svg(nazwa)}</div>`;
const papierZKartami = () =>
  `<div class="papier" style="width:100%;aspect-ratio:297/210;display:flex;gap:3.5%;padding:5% 6%;align-items:flex-start">${[
    'czar',
    'czar',
    'czar',
    'czar',
  ]
    .map(
      (k, i) =>
        `<div style="width:21%;filter:drop-shadow(0 1px 1px rgb(0 0 0/35%))">${svg(`karta-${k}.svg`).replace('id="czar-', 'id="czar-').replaceAll('czar-', `c${i}-`)}</div>`,
    )
    .join('')}</div>`;

function ekranStart(motyw, { naglowekHero = null } = {}) {
  const projekty = [
    {
      nazwa: 'Moje karty Mausritter',
      meta: '1 strona, 12 kart',
      data: 'zmieniony dziś, 20:41',
      miniatura: papierZSvg('arkusz-edycja.svg'),
    },
    {
      nazwa: 'Stany – sesja 3',
      meta: '1 strona, 60 kart',
      data: 'zmieniony wczoraj',
      miniatura: papierZSvg('arkusz-mausritter-arkusz-stany.svg'),
    },
    {
      nazwa: 'Zaklęcia maga',
      meta: '2 strony, 16 kart',
      data: 'zmieniony 12 lis 2026',
      miniatura: papierZKartami(),
    },
    {
      nazwa: 'Wyposażenie drużyny',
      meta: '1 strona, 70 kart',
      data: 'zmieniony 3 lis 2026',
      miniatura: papierZSvg('arkusz-mausritter-arkusz-wyposazenie.svg'),
    },
  ];
  const tresc = `${pasek(motyw)}
  <section class="hero"><h1>${naglowekHero ?? 'Karty do gier – zaprojektuj i wydrukuj'}</h1><p>Wszystko działa w przeglądarce, a projekty zostają na tym komputerze.</p></section>
  <main class="kolumny k3">
    <nav aria-label="Nowy projekt"><div class="etykieta-sekcji">Nowy projekt</div>
      <div class="menu">
        ${pasekMenu('k-bordo', 'Stwórz własne karty', 'Własny szablon, własny format')}
        ${pasekMenu('k-granat', 'Stwórz karty do Mausrittera', 'Kartka A4 ze slotami i gotowe układy')}
      </div></nav>
    <section aria-labelledby="moje"><h2 id="moje">Moje projekty</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">${projekty.map(kafelekProjektu).join('')}</div></section>
    <section aria-labelledby="import"><div class="etykieta-sekcji" id="import">Import</div>
      <button class="btn glowny duzy" type="button">Importuj pliki…</button>
      <p class="opis-importu">Projekty <code>.kartyrpg</code> i szablony <code>.kartyrpg-szablon</code> z innego komputera albo z kopii zapasowej.</p>
      <div class="strefa"><b>Przeciągnij pliki tutaj</b>i upuść, aby je wczytać</div></section>
  </main>${stopka}`;
  return strona(
    motyw,
    'Start',
    tresc,
    '.kadr{height:150px;align-items:flex-start;overflow:hidden;padding:12px 12px 0}.kadr .papier{flex:none}',
  );
}

// =====================================================================================
// 2. Mausritter
// =====================================================================================
function ekranMausritter(motyw) {
  const kafelek = (
    nazwa,
    miniatura,
    hover = false,
  ) => `<button type="button" class="kafelek${hover ? ' hover' : ''}" style="width:100%;font:inherit;color:inherit">
      <div class="miniatura" style="height:196px;width:100%">${miniatura}</div>
      <div class="opis" style="width:100%"><b>${nazwa}</b><span class="podpowiedz">Kliknij, aby zacząć</span></div></button>`;
  const pap = (n, szer = '100%') =>
    `<div class="papier" style="width:${szer};aspect-ratio:297/210">${svg(n)}</div>`;
  const pusty = `<div class="papier" style="width:100%;aspect-ratio:297/210">${svg('arkusz-pusty.svg')}${siatkaSlotow(info.pusty)}</div>`;
  const stos = `<div class="stos" style="aspect-ratio:297/210">
      ${[
        'arkusz-mausritter-arkusz-stany.svg',
        'arkusz-mausritter-arkusz-wyposazenie.svg',
        'arkusz-mausritter-arkusz-bron.svg',
      ]
        .map(
          (n, i) =>
            `<div class="papier" style="width:80%;left:${i * 10}%;top:${(2 - i) * 7}%;z-index:${i}">${svg(n)}</div>`,
        )
        .join('')}</div>`;
  const tresc = `${pasek(motyw)}${okruszki('Start', 'Karty do Mausrittera')}
  <main class="kolumny k2" style="padding-top:18px">
    <nav aria-label="Grupy na tej stronie"><div class="etykieta-sekcji">Od czego zacząć</div>
      <div class="menu">
        ${pasekMenu('k-bursztyn', 'Pusta kartka', 'Siatka 10×7 slotów, bez kart', true)}
        ${pasekMenu('k-turkus', 'Zacznij od gotowego układu', 'Broń, wyposażenie, stany')}
      </div></nav>
    <div>
      <section class="grupa" aria-labelledby="g1"><h2 id="g1">Pusta kartka</h2>
        <article class="kafelek szeroki"><div class="miniatura" style="padding:16px">${pusty}</div>
          <div class="opis"><b style="font-size:18px">Pusta kartka A4</b>
            <p>Strona A4 poziomo z siatką 10×7 slotów (25,75 mm). Karty dodajesz, klikając pusty slot.</p>
            <span class="podpowiedz" style="margin-top:6px">Kliknij, aby zacząć</span></div></article></section>
      <section class="grupa" aria-labelledby="g2"><h2 id="g2">Gotowe układy <small>karty z rozmieszczeniem do druku</small></h2>
        <div class="siatka4">
          ${kafelek('Broń i pancerze', pap('arkusz-mausritter-arkusz-bron.svg'), true)}
          ${kafelek('Wyposażenie', pap('arkusz-mausritter-arkusz-wyposazenie.svg'))}
          ${kafelek('Stany', pap('arkusz-mausritter-arkusz-stany.svg'))}
          ${kafelek('Wszystkie trzy', stos)}
        </div></section>
    </div>
  </main>${stopka}`;
  return strona(motyw, 'Mausritter', tresc);
}

// =====================================================================================
// 3. Własne karty
// =====================================================================================
function ekranWlasne(motyw) {
  const SK = 2.5; // px na mm w miniaturach kart
  const mini = (id, szer, wys) =>
    `<div class="karta-mini" style="width:${szer * SK}px;height:${wys * SK}px;background:none;box-shadow:none;filter:drop-shadow(0 1px 3px rgb(0 0 0/40%))">${svg(`karta-${id}.svg`)}</div>`;
  const kafelek = (
    nazwa,
    miniatura,
    hover = false,
  ) => `<button type="button" class="kafelek${hover ? ' hover' : ''}" style="width:100%;font:inherit;color:inherit">
      <div class="miniatura" style="height:246px;width:100%">${miniatura}</div>
      <div class="opis" style="width:100%"><b>${nazwa}</b><span class="podpowiedz">Kliknij, aby zacząć od tego szablonu</span></div></button>`;
  const pustaKarta = `<div class="pusta-karta" style="width:${63 * SK}px;height:${88 * SK}px"><span>63 × 88 mm</span></div>`;
  const tresc = `${pasek(motyw)}${okruszki('Start', 'Stwórz własne karty')}
  <main class="kolumny k2" style="padding-top:18px">
    <nav aria-label="Własne karty"><div class="etykieta-sekcji">Własny szablon</div>
      <div class="menu">
        ${pasekMenu('k-losos', 'Nowy szablon od zera', 'Nazwa, format, rogi, kolor')}
        ${pasekMenu('k-turkus', 'Importuj szablon', 'Plik .kartyrpg-szablon')}
      </div></nav>
    <section aria-labelledby="sz"><h2 id="sz">Przykładowe szablony <small style="font-size:14px;font-weight:400;color:var(--tekst-przygaszony)">do wypróbowania i przerobienia</small></h2>
      <div class="siatka3">
        ${kafelek('Karta z opisem', mini('czar', 63, 88), true)}
        ${kafelek('Blok statystyk', mini('statystyki', 88, 63))}
        ${kafelek('Karta potwora', mini('potwor', 63, 88))}
        ${kafelek('Karta ozdobna', mini('ozdobna', 63, 88))}
        ${kafelek('Karta swobodna', mini('swobodna', 63, 88))}
        ${kafelek('Pusta karta', pustaKarta)}
      </div></section>
  </main>${stopka}`;
  return strona(motyw, 'Własne karty', tresc, '.siatka3{gap:18px}.stopka{margin-top:auto}');
}

// =====================================================================================
// 4. Edytor kartki
// =====================================================================================
function ekranEdycja(motyw) {
  const u = info.edycja;
  const zajete = new Set();
  const rozmiary = { 'zbroja-ciezka': [1, 2], 'bron-luk': [1, 2] };
  for (const [id, k, w] of u.uklad) {
    const [sz, wy] = rozmiary[id] ?? [1, 1];
    for (let i = 0; i < sz; i++) for (let j = 0; j < wy; j++) zajete.add(`${k + i},${w + j}`);
  }
  const PX = 1000 / 297;
  const slotX = (k) => (u.poczatek.x + k * u.slot.szerokosc) * PX;
  const slotY = (w) => (u.poczatek.y + w * u.slot.wysokosc) * PX;
  const cel = [2, 2];
  const menu = ['Broń', 'Zbroja', 'Ekwipunek', 'Zaklęcie', 'Stan', 'Pusta karta']
    .map(
      (n) =>
        `<button type="button"${n === 'Zaklęcie' ? ' class="hover"' : ''} role="menuitem">${n}</button>`,
    )
    .join('');
  const przedKoncem = `<button class="btn-kontur" type="button">Ustawienia</button><button class="btn-kontur" type="button">Eksportuj</button><button class="btn-kontur pelny" type="button">Pobierz PDF</button><span class="rozdziel"></span>`;
  const srodek = `<span class="projekt"><span class="pole-nazwy" role="textbox" aria-label="Nazwa projektu">Moje karty Mausritter</span><span class="status">Zapisano w tej przeglądarce o 20:41</span></span>`;
  const tresc = `${pasek(motyw, { srodek, przedKoncem })}
  <div class="edytor">
    <section class="plotno" aria-label="Kartka">
      <div class="narzedzia"><b>Strona 1 z 1</b><button class="btn-m" type="button">Dodaj stronę</button><span class="rozpychacz"></span>
        <button class="btn-m" type="button">Cofnij</button><button class="btn-m wylaczony" type="button">Ponów</button></div>
      <div class="kartka">
        <div style="position:absolute;inset:0">${svg('arkusz-edycja.svg').replace(
          '<svg',
          '<svg style="display:block;width:100%;height:100%"',
        )}</div>
        ${siatkaSlotow(u, { zajete, cel, zaznaczona: [1, 0, 1, 1], klasa: 'nakladka' })}
        <div class="menu-typow" role="menu" aria-label="Typ karty" style="left:${slotX(cel[0] + 1) + 8}px;top:${slotY(cel[1])}px">
          <div class="naglowek">Dodaj kartę</div>${menu}</div>
      </div>
    </section>
    <aside class="panel-boczny" aria-label="Zaznaczona karta">
      <h2>Zaznaczona karta</h2><div class="podtytul">Miecz, 1 × 1 slot</div>
      <div class="pole-f"><span class="etykieta">Typ karty</span><div class="wej"><span>Broń</span><span aria-hidden="true">▾</span></div></div>
      <div class="pole-f"><label for="p-nazwa">Nazwa</label><div class="wej" id="p-nazwa">Miecz</div></div>
      <div class="rzad2">
        <div class="pole-f"><label for="p-war">Obrażenia</label><div class="wej" id="p-war">k6/k8</div></div>
        <div class="pole-f"><label for="p-kl">Klasa</label><div class="wej" id="p-kl">Średnia</div></div>
      </div>
      <div class="pole-f"><span class="etykieta">Rozmiar w slotach</span>
        <div class="seg-pole" role="group" aria-label="Rozmiar"><span class="wybrany">1 × 1</span><span>2 × 1</span><span>1 × 2</span></div></div>
      <hr class="sep-panel">
      <div class="pole-f"><span class="etykieta">Ilustracja</span>
        <div class="ilustracja"><div class="mini"><img src="${zastepczyPng}" alt=""></div>
          <div class="przyciski"><button class="btn-m" type="button">Wybierz z biblioteki</button><button class="btn-m" type="button">Wgraj zdjęcie</button></div></div></div>
      <hr class="sep-panel">
      <div class="pole-f"><label for="p-il">Liczba egzemplarzy</label><div class="wej" id="p-il" style="width:110px">1</div></div>
      <div style="display:flex;gap:8px;margin-top:16px"><button class="btn-m" type="button">Duplikuj</button><button class="btn-m niebezp" type="button">Usuń kartę</button></div>
    </aside>
  </div>`;
  return strona(
    motyw,
    'Edytor kartki',
    tresc,
    'body{height:900px;overflow:hidden}.kartka{aspect-ratio:297/210}',
  );
}

// =====================================================================================
// 5. Instrukcja
// =====================================================================================
function ekranInstrukcja(motyw) {
  const spis = [
    'Mausritter',
    'Własne szablony',
    'Edycja kart',
    'Druk w skali 100%',
    'Kalibracja drukarki',
    'Eksport i import projektu',
  ]
    .map(
      (t, i) =>
        `<li><a href="#s${i + 1}"${i === 0 ? ' class="aktywny" aria-current="location"' : ''}>${t}</a></li>`,
    )
    .join('');
  const tresc = `${pasek(motyw, { instrukcja: true })}
  <div class="instrukcja">
    <nav class="spis" aria-label="Spis treści"><div class="etykieta-sekcji">Spis treści</div><ol>${spis}</ol></nav>
    <main class="tekst"><div class="kolumna">
      <h1>Instrukcja</h1>
      <h2 id="s1">Karty do Mausrittera</h2>
      <p>Poniższe kroki prowadzą od pustej kartki do wydruku.</p>
      <ol>
        <li>Na ekranie startowym wybierz „Stwórz karty do Mausrittera”, a potem „Pusta kartka” albo gotowy układ: Broń i pancerze, Wyposażenie, Stany lub Wszystkie trzy.</li>
        <li>Kliknij pusty slot na kartce A4 i wybierz typ karty: broń, zbroja, ekwipunek, zaklęcie, stan albo pusta karta. Nowa karta ma od razu domyślny rozmiar swojego typu.</li>
        <li>Kliknij kartę. W panelu po prawej zmienisz jej pola, rozmiar i ilustrację, także zdjęciem z telefonu. Kilka kart zaznaczysz z klawiszem <kbd>Shift</kbd> albo prostokątem. Wspólne pola zmienisz wtedy naraz.</li>
        <li>Karty przeciągasz myszą, także na następną stronę. Przydadzą się skróty: <kbd>Delete</kbd> usuwa, <kbd>Ctrl</kbd> + <kbd>D</kbd> duplikuje, <kbd>Ctrl</kbd> + <kbd>Z</kbd> cofa, a strzałki przesuwają zaznaczone karty. Na kartce ze stanami możesz dodać nagłówek grupy nad kolumnami.</li>
        <li>W Ustawieniach wpiszesz tytuł kartki, włączysz tryb czarno-biały i wybierzesz papier oraz czcionki, także własne.</li>
        <li>Kliknij „Pobierz PDF” i drukuj w skali 100%, bez opcji „Dopasuj do strony”. Przycisk „Eksportuj” zapisuje projekt do pliku <code>.kartyrpg</code>. To kopia zapasowa i sposób na przeniesienie projektu na inny komputer.</li>
      </ol>
      <h2 id="s2">Własne szablony</h2>
      <p>Szablon opisuje wygląd jednej karty: z jakich pól się składa i gdzie one leżą. Karty robisz potem z szablonu, wpisując tylko dane.</p>
      <ol>
        <li>Na ekranie startowym wybierz „Stwórz własne karty”, a potem „Nowy szablon od zera”. Podaj nazwę, format karty (Poker, Bridge, Mini Euro, Mini American, Tarot, kwadrat albo własny w milimetrach), orientację, zaokrąglenie rogów i kolor tła.</li>
      </ol>
    </div></main>
  </div>`;
  return strona(motyw, 'Instrukcja', tresc, 'body{height:900px;overflow:hidden}');
}

// =====================================================================================
// Próbki czcionek tytułu
// =====================================================================================
function ekranCzcionka(rodzina, waga, nazwa, autor) {
  const tresc = `${pasek('light')}
  <section class="hero" style="padding-bottom:30px"><h1 style="font-family:'${rodzina}',serif;font-weight:${waga}">Karty do gier – zaprojektuj i wydrukuj</h1><p>Wszystko działa w przeglądarce, a projekty zostają na tym komputerze.</p></section>
  <section class="probka" style="font-family:'${rodzina}',serif;font-weight:${waga}">
    <div class="blok"><div class="et" style="font-family:system-ui;font-weight:700">Próbka, rozmiar mniejszy</div>
      <div style="font-size:26px;line-height:1.3;color:var(--tytul)">Karty do gier – zaprojektuj i wydrukuj</div>
      <div style="font-size:18px;margin-top:8px">Stwórz własne karty, Moje projekty</div></div>
    <div class="blok"><div class="et" style="font-family:system-ui;font-weight:700">Angielski tytuł</div>
      <div style="font-size:26px;line-height:1.3;color:var(--tytul)">Game Cards – Design and Print</div>
      <div style="font-size:18px;margin-top:8px">Create your own cards, My projects</div></div>
    <div class="blok cala"><div class="et" style="font-family:system-ui;font-weight:700">Polskie znaki</div>
      <div style="font-size:34px;line-height:1.35;letter-spacing:0.04em">ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ</div>
      <div style="font-size:20px;margin-top:6px">Zażółć gęślą jaźń. Stwórz łódź, dźwięk i żądło.</div></div>
    <div class="blok cala"><div class="podpis" style="font-family:system-ui;font-weight:400"><b>${nazwa}</b>, ${autor}. Licencja: SIL Open Font License 1.1 (OFL), swobodne użycie także w druku i w plikach PDF.</div></div>
  </section>`;
  return strona('light', nazwa, tresc);
}

// =====================================================================================
// Zapis HTML i zrzuty
// =====================================================================================
const zrzuty = [];
const dodaj = (plik, html, wysokosc = 900) => {
  writeFileSync(join(HTML, `${plik}.html`), html);
  zrzuty.push({ plik, wysokosc });
};
for (const m of ['light', 'dark']) {
  const n = m === 'light' ? 'jasny' : 'ciemny';
  dodaj(`makieta-ui-1-start-${n}`, ekranStart(m));
  dodaj(`makieta-ui-2-mausritter-${n}`, ekranMausritter(m));
  dodaj(`makieta-ui-3-wlasne-${n}`, ekranWlasne(m));
  dodaj(`makieta-ui-4-edycja-${n}`, ekranEdycja(m));
  dodaj(`makieta-ui-5-instrukcja-${n}`, ekranInstrukcja(m));
}
dodaj(
  'makieta-ui-czcionka-1-cinzel-decorative',
  ekranCzcionka('Cinzel Decorative', 700, 'Cinzel Decorative Bold', 'Natanael Gama'),
  620,
);
dodaj(
  'makieta-ui-czcionka-2-uncial-antiqua',
  ekranCzcionka('Uncial Antiqua', 400, 'Uncial Antiqua', 'Astigmatic'),
  620,
);
dodaj(
  'makieta-ui-czcionka-3-metamorphous',
  ekranCzcionka('Metamorphous', 400, 'Metamorphous', 'Sorkin Type'),
  620,
);

const przegladarka = await chromium.launch();
for (const { plik, wysokosc } of zrzuty) {
  const strona = await przegladarka.newPage({
    viewport: { width: 1440, height: wysokosc },
    deviceScaleFactor: 1,
  });
  await strona.goto(`file://${join(HTML, `${plik}.html`)}`);
  await strona.evaluate(() => document.fonts.ready);
  await strona.screenshot({ path: join(WYJSCIE, `${plik}.png`) });
  await strona.close();
  console.log('zapisano', `docs/obrazy/${plik}.png`);
}
await przegladarka.close();
