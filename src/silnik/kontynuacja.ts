import {
  czyKontener,
  korzenKarty,
  stylPola,
  type Karta,
  type PoleTekst,
  type Szablon,
  type Wezel,
} from '../model/szablon';
import {
  daneZParametrami,
  renderujKarte,
  trescPolaTekstowego,
  wartoscPola,
  type KontekstRenderowania,
  type WyrenderowanaKarta,
} from './karta';
import type { Fragment } from './tekst';

const MAKS_KART = 64;
const IKONA = '\uFFFC';

export function poleKontynuacji(s: Szablon, karta: Pick<Karta, 'rozmiar'>): PoleTekst | undefined {
  const znajdz = (w: Wezel): PoleTekst | undefined => {
    if (w.typ === 'tekst' && w.kontynuuj) return w;
    if (!czyKontener(w)) return undefined;
    for (const dziecko of w.dzieci) {
      const pole = znajdz(dziecko);
      if (pole) return pole;
    }
    return undefined;
  };
  return znajdz(korzenKarty(s, karta));
}

interface ZakresFragmentu {
  f: Fragment;
  od: number;
  do: number;
}

function skladowe(fragmenty: Fragment[], listy: boolean) {
  let poz = 0;
  const czesci: ZakresFragmentu[] = [];
  for (const f of fragmenty) {
    const dlugosc = f.ikona ? 1 : f.tekst.length;
    czesci.push({ f, od: poz, do: poz + dlugosc });
    poz += dlugosc;
  }
  const tekst = fragmenty.map((f) => (f.ikona ? IKONA : f.tekst)).join('');
  const brzegi: { koniec: number; wznow: number; nowyAkapit: boolean }[] = [];
  let poczatekAkapitu = 0;
  for (const m of tekst.matchAll(/\s+/g)) {
    const wznow = m.index + m[0].length;
    const koniecWiersza = m[0].lastIndexOf('\n');
    const nowyAkapit = koniecWiersza >= 0;
    const dlugoscPrzed = m.index - poczatekAkapitu;
    const wZnaczniku =
      listy &&
      !nowyAkapit &&
      dlugoscPrzed <= 10 &&
      /^\d{1,9}\.$/.test(tekst.slice(poczatekAkapitu, m.index));
    if (nowyAkapit) poczatekAkapitu = m.index + koniecWiersza + 1;
    if (m.index > 0 && wznow < tekst.length && !wZnaczniku)
      brzegi.push({ koniec: m.index, wznow, nowyAkapit });
  }
  return { czesci, brzegi, dlugosc: poz };
}

function wycinek(czesci: ZakresFragmentu[], od: number, doKad: number, nowyAkapit: boolean) {
  const fragmenty: Fragment[] = [];
  for (const c of czesci) {
    if (c.do <= od) continue;
    if (c.od >= doKad) break;
    if (c.f.ikona) {
      fragmenty.push(c.f);
      continue;
    }
    const tekst = c.f.tekst.slice(Math.max(0, od - c.od), Math.min(c.do, doKad) - c.od);
    if (!nowyAkapit && c.f.lista) {
      const koniec = tekst.indexOf('\n');
      if (koniec >= 0) {
        if (koniec) fragmenty.push({ ...c.f, tekst: tekst.slice(0, koniec), lista: false });
        fragmenty.push({ ...c.f, tekst: tekst.slice(koniec) });
        nowyAkapit = true;
        continue;
      }
      fragmenty.push({ ...c.f, tekst, lista: false });
    } else fragmenty.push({ ...c.f, tekst });
    if (tekst.includes('\n')) nowyAkapit = true;
  }
  return fragmenty;
}

/** Składa deterministyczną kolejność kart, zachowując style, ikony i tekst źródłowy. */
export function kartyZKontynuacja(
  szablon: Szablon,
  karta: Pick<Karta, 'dane' | 'rozmiar' | 'obrazy'>,
  ctx: KontekstRenderowania,
  dopisek: string,
  pole = poleKontynuacji(szablon, karta),
  opcje?: { spad?: number; minDpi?: number },
): WyrenderowanaKarta[] {
  const cala = renderujKarte(szablon, karta, ctx, opcje);
  if (!pole) return [cala];
  const dane = daneZParametrami(szablon, karta.dane);
  const tresc = wartoscPola(pole, dane);
  if (!tresc.trim()) return [cala];
  const przepelnienie = (w: WyrenderowanaKarta) =>
    w.ostrzezenia.some((o) => o.pole === pole.id && o.komunikat === 'tekst-nie-miesci-sie');
  const miesci = (w: WyrenderowanaKarta) =>
    !przepelnienie(w) &&
    w.wezly.some(
      (x) =>
        x.id === pole.id &&
        x.x >= -1e-6 &&
        x.y >= -1e-6 &&
        x.x + x.szer <= w.scena.szer + 1e-6 &&
        x.y + x.wys <= w.scena.wys + 1e-6,
    );
  if (miesci(cala)) return [cala];
  const awaryjna = przepelnienie(cala)
    ? cala
    : {
        ...cala,
        ostrzezenia: [
          ...cala.ostrzezenia,
          { pole: pole.id, komunikat: 'tekst-nie-miesci-sie' as const },
        ],
      };
  const poleEfektywne = { ...pole, styl: stylPola(szablon, pole) };
  const { czesci, brzegi, dlugosc } = skladowe(
    trescPolaTekstowego(poleEfektywne, tresc),
    !!pole.listyNumerowane,
  );
  if (!brzegi.length) return [awaryjna];

  let od = 0;
  let nowyAkapit = true;
  let pierwszyBrzeg = 0;
  const wynik: WyrenderowanaKarta[] = [];
  const wyrenderuj = (koniec: number) =>
    renderujKarte(
      szablon,
      karta,
      {
        ...ctx,
        kontynuacja: {
          poleId: pole.id,
          fragmenty: wycinek(czesci, od, koniec, nowyAkapit),
          ...(wynik.length > 0 ? { dopisek: `${dopisek} ${wynik.length + 1}` } : {}),
        },
      },
      opcje,
    );

  while (wynik.length < MAKS_KART) {
    const reszta = wynik.length ? wyrenderuj(dlugosc) : cala;
    if (miesci(reszta)) return [...wynik, reszta];
    // Granice słów: żadna pusta karta, żaden znak wewnątrz słowa lub ikony się nie rozdziela.
    let lewo = pierwszyBrzeg;
    let prawo = brzegi.length - 1;
    let najlepszy: { indeks: number; karta: WyrenderowanaKarta } | undefined;
    while (lewo <= prawo) {
      const i = Math.floor((lewo + prawo) / 2);
      const kandydat = wyrenderuj(brzegi[i]!.koniec);
      if (miesci(kandydat)) {
        najlepszy = { indeks: i, karta: kandydat };
        lewo = i + 1;
      } else prawo = i - 1;
    }
    if (!najlepszy) return [awaryjna];
    const brzeg = brzegi[najlepszy.indeks]!;
    wynik.push(najlepszy.karta);
    od = brzeg.wznow;
    nowyAkapit = brzeg.nowyAkapit;
    pierwszyBrzeg = najlepszy.indeks + 1;
  }
  return [awaryjna];
}
