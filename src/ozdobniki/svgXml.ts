/**
 * Lekki parser XML do importu własnych SVG (bez DOM – ten sam kod w przeglądarce, workerze i testach
 * Node). Nic nie wykonuje i niczego nie wstawia do strony: z pliku powstaje tylko drzewo elementów
 * z atrybutami. Teksty między znacznikami są pomijane, DOCTYPE (z encjami własnymi) jest pomijany –
 * encje definiowane w pliku nie są rozwijane, więc „bomby encji” nie mają jak zadziałać.
 */

import { t } from '../i18n';

export interface WezelXml {
  /** Nazwa lokalna (bez przedrostka przestrzeni nazw). */
  nazwa: string;
  /** Przedrostek przestrzeni nazw (`sodipodi` w `sodipodi:namedview`) albo pusty. */
  przestrzen: string;
  /** Atrybuty z pełnymi nazwami (np. `xlink:href`) i rozwiniętymi encjami standardowymi. */
  atr: Record<string, string>;
  dzieci: WezelXml[];
  /** Zawartość tekstowa – tylko dla `style` i `script` (żeby ocenić, co z nich usunięto). */
  tekst?: string;
}

export class BladXml extends Error {
  constructor(
    readonly kod: 'xml' | 'za-duzo-elementow' | 'za-gleboko',
    komunikat: string,
  ) {
    super(komunikat);
    this.name = 'BladXml';
  }
}

export const LIMITY_XML = { elementy: 20000, glebokosc: 64 };

const ENCJE: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Rozwija tylko encje standardowe i liczbowe; nieznane zostają bez zmian. */
export function rozwinEncje(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z]+);/g, (calosc, n: string) => {
    if (n[0] === '#') {
      const kod = n[1] === 'x' ? parseInt(n.slice(2), 16) : parseInt(n.slice(1), 10);
      return kod > 0 && kod <= 0x10ffff ? String.fromCodePoint(kod) : calosc;
    }
    return Object.hasOwn(ENCJE, n) ? ENCJE[n]! : calosc;
  });
}

const SPACJA = /\s/;

function rozdzielNazwe(pelna: string): { nazwa: string; przestrzen: string } {
  const i = pelna.indexOf(':');
  return i < 0
    ? { nazwa: pelna, przestrzen: '' }
    : { nazwa: pelna.slice(i + 1), przestrzen: pelna.slice(0, i) };
}

/** Parsuje dokument XML do drzewa; element główny jest jeden. */
export function parsujXml(zrodlo: string, limity = LIMITY_XML): WezelXml {
  const s = zrodlo.charCodeAt(0) === 0xfeff ? zrodlo.slice(1) : zrodlo;
  const n = s.length;
  let i = 0;
  let liczba = 0;
  const stos: WezelXml[] = [];
  let korzen: WezelXml | undefined;
  const blad = (opis: string): never => {
    throw new BladXml('xml', opis);
  };
  const pomin = (koniec: string, opis: string) => {
    const j = s.indexOf(koniec, i);
    if (j < 0) blad(opis);
    i = j + koniec.length;
  };

  while (i < n) {
    const lt = s.indexOf('<', i);
    if (lt < 0) {
      // Tekst po ostatnim znaczniku – dozwolone są tylko białe znaki.
      if (s.slice(i).trim() !== '' && stos.length === 0) blad(t('svg.xml.tekstPozaGlownym'));
      break;
    }
    if (lt > i && stos.length === 0 && s.slice(i, lt).trim() !== '')
      blad(t('svg.xml.tekstPozaGlownym'));
    // Tekst między znacznikami: zapamiętany tylko dla `style` / `script`.
    if (lt > i && stos.length > 0) {
      const g = stos[stos.length - 1]!;
      if (g.nazwa === 'style' || g.nazwa === 'script') g.tekst = (g.tekst ?? '') + s.slice(i, lt);
    }
    i = lt;
    if (s.startsWith('<!--', i)) {
      i += 4;
      pomin('-->', t('svg.xml.niezamknietyKomentarz'));
    } else if (s.startsWith('<![CDATA[', i)) {
      const od = i + 9;
      i = od;
      const j = s.indexOf(']]>', i);
      if (j < 0) blad(t('svg.xml.niezamknietaCdata'));
      const g = stos[stos.length - 1];
      if (g && (g.nazwa === 'style' || g.nazwa === 'script'))
        g.tekst = (g.tekst ?? '') + s.slice(od, j);
      i = j + 3;
    } else if (s.startsWith('<?', i)) {
      i += 2;
      pomin('?>', t('svg.xml.niezamknietaInstrukcja'));
    } else if (s.startsWith('<!', i)) {
      // DOCTYPE (także z podzbiorem wewnętrznym w nawiasach kwadratowych) – pomijany w całości.
      i += 2;
      let nawiasy = 0;
      while (i < n && !(s[i] === '>' && nawiasy === 0)) {
        if (s[i] === '[') nawiasy++;
        else if (s[i] === ']') nawiasy--;
        else if (s[i] === '"' || s[i] === "'") {
          const q = s[i]!;
          const j = s.indexOf(q, i + 1);
          if (j < 0) blad(t('svg.xml.niezamknietyDoctype'));
          i = j;
        }
        i++;
      }
      if (i >= n) blad(t('svg.xml.niezamknietyDoctype'));
      i++;
    } else if (s.startsWith('</', i)) {
      const j = s.indexOf('>', i);
      if (j < 0) blad(t('svg.xml.niezamknietyZnacznikZamykajacy'));
      const pelna = s.slice(i + 2, j).trim();
      const otwarty = stos.pop();
      if (!otwarty) return blad(t('svg.xml.nadmiarowyZnacznikZamykajacy'));
      const { nazwa, przestrzen } = rozdzielNazwe(pelna);
      if (otwarty.nazwa !== nazwa || otwarty.przestrzen !== przestrzen)
        blad(t('svg.xml.znacznikNiePasuje', { a: pelna, b: otwarty.nazwa }));
      i = j + 1;
    } else {
      // Znacznik otwierający: nazwa, atrybuty, `>` albo `/>`.
      i++;
      const odNazwy = i;
      while (i < n && !SPACJA.test(s[i]!) && s[i] !== '>' && s[i] !== '/') i++;
      const pelna = s.slice(odNazwy, i);
      if (pelna === '') blad(t('svg.xml.pustaNazwa'));
      // Bez prototypu: nazwy jak `__proto__` czy `constructor` to zwykłe klucze.
      const atr: Record<string, string> = Object.create(null) as Record<string, string>;
      let samozamykajacy = false;
      for (;;) {
        while (i < n && SPACJA.test(s[i]!)) i++;
        if (i >= n) blad(t('svg.xml.niezamknietyZnacznik'));
        if (s[i] === '>') {
          i++;
          break;
        }
        if (s[i] === '/') {
          if (s[i + 1] !== '>') blad(t('svg.xml.niepoprawnyZnacznik'));
          samozamykajacy = true;
          i += 2;
          break;
        }
        const odAtr = i;
        while (i < n && !SPACJA.test(s[i]!) && s[i] !== '=' && s[i] !== '>' && s[i] !== '/') i++;
        const nazwaAtr = s.slice(odAtr, i);
        while (i < n && SPACJA.test(s[i]!)) i++;
        if (s[i] !== '=') blad(t('svg.xml.atrybutBezWartosci', { nazwa: nazwaAtr }));
        i++;
        while (i < n && SPACJA.test(s[i]!)) i++;
        const q = s[i];
        if (q !== '"' && q !== "'")
          return blad(t('svg.xml.atrybutBezCudzyslowu', { nazwa: nazwaAtr }));
        const koniec = s.indexOf(q, i + 1);
        if (koniec < 0) blad(t('svg.xml.niezamknietaWartosc'));
        // Pierwszy zapis atrybutu wygrywa (powtórzenie to błąd XML – tu łagodnie).
        if (!Object.hasOwn(atr, nazwaAtr)) atr[nazwaAtr] = rozwinEncje(s.slice(i + 1, koniec));
        i = koniec + 1;
      }
      if (++liczba > limity.elementy)
        throw new BladXml('za-duzo-elementow', `więcej niż ${limity.elementy} elementów`);
      const { nazwa, przestrzen } = rozdzielNazwe(pelna);
      const wezel: WezelXml = { nazwa, przestrzen, atr, dzieci: [] };
      const rodzic = stos[stos.length - 1];
      if (rodzic) rodzic.dzieci.push(wezel);
      else if (korzen) blad(t('svg.xml.wiecejNizJedenGlowny'));
      else korzen = wezel;
      if (!samozamykajacy) {
        stos.push(wezel);
        if (stos.length > limity.glebokosc)
          throw new BladXml('za-gleboko', `zagnieżdżenie głębsze niż ${limity.glebokosc}`);
      }
    }
  }
  if (stos.length > 0)
    blad(t('svg.xml.niezamknietyElement', { nazwa: stos[stos.length - 1]!.nazwa }));
  if (!korzen) blad(t('svg.xml.brakGlownego'));
  return korzen!;
}
