import { t } from '../i18n';
import { MAKS_ZNACZNIKOW } from '../silnik/karta';
import { MAKS_EGZEMPLARZY } from './kartka';
import { kolumnySzablonu, type KolumnaDanych } from './edycja';
import type { OpisZasobu } from '../model/projekt';
import type { Szablon } from '../model/szablon';
import { normalizujNazwe } from '../model/nazwy';

export const LIMIT_TABELI = { bajty: 8 * 1024 * 1024, wiersze: 500, kolumny: 128, sztuki: 2000 };
export interface WierszImportu {
  numer: number;
  komorki: string[];
  bledy?: Set<number>;
  liczby?: Map<number, number>;
}
export interface TabelaImportu {
  naglowki: string[];
  wiersze: WierszImportu[];
}
export interface PlikTabeli {
  arkusze: string[];
  odczytaj: (arkusz: number) => TabelaImportu;
}
export interface WartosciImportu {
  dane: Record<string, string>;
  ilosc: number;
}
export interface MapowanieImportu {
  pola: ReadonlyMap<string, number>;
  ilosc?: number;
}

const pelny = (r: string[]) => r.some((v) => v.trim() !== '');
const zaDuzaTabela = () => new Error(t('tabelaImport.limit', LIMIT_TABELI));

function ucieczkaCsv(wartosc: string, sep: ';' | ','): string {
  if (wartosc.includes(sep) || wartosc.includes('"') || /[\r\n]/.test(wartosc)) {
    return `"${wartosc.replace(/"/g, '""')}"`;
  }
  return wartosc;
}

/**
 * Generuje pusty szablon CSV z nagłówkami odpowiadającymi polom szablonu karty oraz kolumną ilości,
 * gotowy do uzupełnienia w arkuszu kalkulacyjnym (Excel, Calc, Google Sheets) i ponownego importu.
 */
export function szablonCsv(
  szablon: Szablon,
  {
    separator = ';',
    etykietaIlosci = t('tabelaImport.ilosc'),
    zBom = true,
  }: { separator?: ';' | ','; etykietaIlosci?: string; zBom?: boolean } = {},
): string {
  const kolumny = kolumnySzablonu(szablon);
  const zliczone = new Map<string, number>();
  for (const k of kolumny) {
    const n = normalizujNazwe(k.nazwa);
    zliczone.set(n, (zliczone.get(n) ?? 0) + 1);
  }
  const naglowki = kolumny.map((k) =>
    (zliczone.get(normalizujNazwe(k.nazwa)) ?? 0) > 1 ? k.klucz : k.nazwa,
  );
  if (
    etykietaIlosci &&
    !naglowki.some((h) => normalizujNazwe(h) === normalizujNazwe(etykietaIlosci))
  ) {
    naglowki.push(etykietaIlosci);
  }
  const wiersz = naglowki.map((h) => ucieczkaCsv(h, separator)).join(separator);
  return `${zBom ? '\uFEFF' : ''}${wiersz}\r\n`;
}

export function tabelaZKomorek(wiersze: WierszImportu[]): TabelaImportu {
  const pierwszy = wiersze.findIndex((r) => r.bledy?.size || pelny(r.komorki));
  if (pierwszy < 0) throw new Error(t('tabelaImport.pusta'));
  const liczbaKolumn = wiersze.reduce((n, r) => Math.max(n, r.komorki.length), 0);
  const reszta = wiersze.slice(pierwszy + 1).filter((r) => r.bledy?.size || pelny(r.komorki));
  if (liczbaKolumn > LIMIT_TABELI.kolumny || reszta.length > LIMIT_TABELI.wiersze)
    throw zaDuzaTabela();
  return {
    naglowki: Array.from(
      { length: liczbaKolumn },
      (_, i) => wiersze[pierwszy]!.komorki[i]?.trim() ?? '',
    ),
    wiersze: reszta,
  };
}

/** Liczy separatory w pierwszym niepustym rekordzie, z pominięciem cudzysłowów. */
function separatorCsv(tekst: string) {
  let cytat = false;
  let sredniki = 0;
  let przecinki = 0;
  let zawartosc = false;
  for (const znak of tekst) {
    if (znak === '"') cytat = !cytat;
    else if (!cytat) {
      if (znak === ';') sredniki++;
      else if (znak === ',') przecinki++;
      else if ((znak === '\r' || znak === '\n') && (zawartosc || sredniki || przecinki)) break;
    }
    if (znak.trim()) zawartosc = true;
  }
  return sredniki > przecinki ? ';' : ',';
}

export function odczytajCsv(surowy: string): TabelaImportu {
  const tekst = surowy.startsWith('\uFEFF') ? surowy.slice(1) : surowy;
  const sep = separatorCsv(tekst);
  const wynik: WierszImportu[] = [];
  let wiersz: string[] = [];
  let linia = 1;
  let numer = linia;
  let wartosc = '';
  let cytat = false;
  let zamkniety = false;
  const blad = () => new Error(t('tabelaImport.csv', { wiersz: numer }));
  const dodajKomorke = () => {
    wiersz.push(wartosc);
    if (wiersz.length > LIMIT_TABELI.kolumny) throw zaDuzaTabela();
    wartosc = '';
    zamkniety = false;
  };
  const dodajWiersz = () => {
    dodajKomorke();
    if (pelny(wiersz)) wynik.push({ komorki: wiersz, numer });
    if (wynik.length > LIMIT_TABELI.wiersze + 1) throw zaDuzaTabela();
    wiersz = [];
  };
  for (let i = 0; i < tekst.length; i++) {
    const znak = tekst[i]!;
    if (znak === '\r' || znak === '\n') {
      if (znak === '\r' && tekst[i + 1] === '\n') i++;
      linia++;
      if (cytat) wartosc += '\n';
      else {
        dodajWiersz();
        numer = linia;
      }
    } else if (cytat) {
      if (znak !== '"') wartosc += znak;
      else if (tekst[i + 1] === '"') {
        wartosc += znak;
        i++;
      } else {
        cytat = false;
        zamkniety = true;
      }
    } else if (znak === sep) dodajKomorke();
    else if (zamkniety) throw blad();
    else if (znak === '"') {
      if (wartosc) throw blad();
      cytat = true;
    } else wartosc += znak;
  }
  if (cytat) throw blad();
  dodajWiersz();
  return tabelaZKomorek(wynik);
}

export async function otworzTabele(plik: File): Promise<PlikTabeli> {
  if (plik.size > LIMIT_TABELI.bajty) throw new Error(t('tabelaImport.rozmiar', { mb: 8 }));
  const nazwa = plik.name.toLowerCase();
  if (nazwa.endsWith('.csv')) {
    const bajty = await plik.arrayBuffer();
    let tekst: string;
    try {
      tekst = new TextDecoder('utf-8', { fatal: true }).decode(bajty);
    } catch {
      throw new Error(t('tabelaImport.kodowanie'));
    }
    const tabela = odczytajCsv(tekst);
    return { arkusze: [], odczytaj: () => tabela };
  }
  if (nazwa.endsWith('.xlsx')) {
    const { otworzXlsx } = await import('./importXlsx');
    return otworzXlsx(new Uint8Array(await plik.arrayBuffer()));
  }
  throw new Error(t('tabelaImport.format'));
}

export function sprawdzImport(
  tabela: TabelaImportu,
  mapowanie: MapowanieImportu,
  pola: KolumnaDanych[],
  zasoby: readonly OpisZasobu[],
) {
  const obrazy = new Map<string, string[]>();
  for (const z of zasoby) {
    if (z.rodzaj !== 'obraz') continue;
    const nazwa = z.nazwa.trim();
    const lista = obrazy.get(nazwa) ?? [];
    lista.push(z.id);
    obrazy.set(nazwa, lista);
  }
  const bledy: string[] = [];
  const wiersze = tabela.wiersze.map((r) => {
    const ilosc = mapowanie.ilosc === undefined ? '' : (r.komorki[mapowanie.ilosc]?.trim() ?? '');
    const surowa = mapowanie.ilosc === undefined ? undefined : r.liczby?.get(mapowanie.ilosc);
    const n = surowa ?? (ilosc === '' ? 1 : Number(ilosc));
    if (
      (mapowanie.ilosc !== undefined && r.bledy?.has(mapowanie.ilosc)) ||
      !Number.isInteger(n) ||
      n < 1 ||
      n > MAKS_EGZEMPLARZY ||
      (surowa === undefined && ilosc !== '' && !/^\d+$/.test(ilosc))
    )
      bledy.push(t('tabelaImport.bladIlosci', { wiersz: r.numer, maks: MAKS_EGZEMPLARZY }));
    const dane: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const pole of pola) {
      const indeks = mapowanie.pola.get(pole.klucz);
      if (indeks !== undefined && r.bledy?.has(indeks)) {
        bledy.push(t('tabelaImport.bladKomorki', { wiersz: r.numer, pole: pole.nazwa }));
        continue;
      }
      const wartosc = indeks === undefined ? '' : (r.komorki[indeks] ?? '');
      if (!wartosc.trim()) continue;
      if (pole.typPola === 'znaczniki') {
        const liczba = indeks === undefined ? undefined : r.liczby?.get(indeks);
        const n = liczba ?? Number(wartosc.trim());
        if (
          !Number.isInteger(n) ||
          n < 0 ||
          n > MAKS_ZNACZNIKOW ||
          (liczba === undefined && !/^\d+$/.test(wartosc.trim()))
        )
          bledy.push(
            t('tabelaImport.bladZnacznikow', {
              wiersz: r.numer,
              pole: pole.nazwa,
              maks: MAKS_ZNACZNIKOW,
            }),
          );
        else dane[pole.klucz] = String(n);
      } else if (pole.typPola === 'obraz') {
        const wyniki = obrazy.get(wartosc.trim());
        if (wyniki?.length === 1) dane[pole.klucz] = wyniki[0]!;
        else
          bledy.push(
            t(wyniki?.length ? 'tabelaImport.wieleObrazow' : 'tabelaImport.brakObrazu', {
              wiersz: r.numer,
              nazwa: wartosc,
              pole: pole.nazwa,
            }),
          );
      } else dane[pole.klucz] = wartosc;
    }
    return { dane, ilosc: n };
  });
  const sztuki = wiersze.reduce((n, r) => n + r.ilosc, 0);
  if (sztuki > LIMIT_TABELI.sztuki) bledy.push(t('tabelaImport.limitSztuk', LIMIT_TABELI));
  return { wiersze, bledy, sztuki };
}
