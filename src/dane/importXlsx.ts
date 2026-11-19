import { unzipSync, zipSync } from 'fflate';
import { read, utils } from 'xlsx';
import { t } from '../i18n';
import { LIMIT_TABELI, tabelaZKomorek, type PlikTabeli, type WierszImportu } from './importTabeli';

const XML =
  /^(?:\[Content_Types\]\.xml|_rels\/\.rels|xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/(?:styles|sharedStrings|metadata)\.xml|xl\/(?:worksheets|theme)\/[^/]+\.xml)$/;
const limit = 16 * 1024 * 1024;

function sprawdzArchiwum(bajty: Uint8Array) {
  let suma = 0;
  let wpisy = 0;
  const dane = unzipSync(bajty, {
    filter: (f) => {
      if (++wpisy > 2048) throw new Error('ZIP');
      if (!XML.test(f.name)) return false;
      if (f.compression !== 0 && f.compression !== 8) throw new Error('ZIP');
      if (f.compression === 0 && f.size !== f.originalSize) throw new Error('ZIP');
      if ((suma += f.originalSize) > limit) throw new Error('ZIP');
      return true;
    },
  });
  if (!dane['xl/workbook.xml'] || !dane['[Content_Types].xml']) throw new Error('XLSX');
  if (Object.values(dane).reduce((s, f) => s + f.byteLength, 0) > limit) throw new Error('ZIP');
  return zipSync(dane, { level: 0 });
}

export function otworzXlsx(bajty: Uint8Array): PlikTabeli {
  let dane: Uint8Array;
  let arkusze: string[];
  try {
    dane = sprawdzArchiwum(bajty);
    arkusze = read(dane, { type: 'array', bookSheets: true, bookVBA: false }).SheetNames;
    if (!arkusze.length) throw new Error('XLSX');
  } catch {
    throw new Error(t('tabelaImport.xlsx'));
  }
  return {
    arkusze,
    odczytaj: (i) => {
      let arkusz: ReturnType<typeof read>['Sheets'][string] | undefined;
      const nazwa = arkusze[i];
      try {
        if (!nazwa) throw new Error('XLSX');
        arkusz = read(dane, {
          type: 'array',
          sheets: i,
          cellFormula: false,
          cellHTML: false,
          bookVBA: false,
          nodim: true,
        }).Sheets[nazwa];
      } catch {
        throw new Error(t('tabelaImport.xlsx'));
      }
      const komorki = Object.entries(arkusz ?? {}).flatMap(([adres, k]) => {
        if (!/^[A-Z]+[1-9]\d*$/.test(adres)) return [];
        const liczba = k.t === 'n' && typeof k.v === 'number' ? k.v : undefined;
        const wartosc = utils.format_cell(k) || (liczba === undefined ? '' : String(liczba));
        return k.t === 'e' || wartosc.trim()
          ? [
              {
                ...utils.decode_cell(adres),
                wartosc,
                blad: k.t === 'e',
                liczba,
              },
            ]
          : [];
      });
      const pierwsza = komorki.reduce((min, k) => Math.min(min, k.c), Infinity);
      const wiersze = new Map<number, WierszImportu>();
      for (const k of komorki) {
        const i = k.c - pierwsza;
        if (i >= LIMIT_TABELI.kolumny) throw new Error(t('tabelaImport.limit', LIMIT_TABELI));
        const r = wiersze.get(k.r) ?? { numer: k.r + 1, komorki: [] };
        r.komorki[i] = k.wartosc;
        if (k.blad) (r.bledy ??= new Set()).add(i);
        if (k.liczba !== undefined) (r.liczby ??= new Map()).set(i, k.liczba);
        wiersze.set(k.r, r);
        if (wiersze.size > LIMIT_TABELI.wiersze + 1)
          throw new Error(t('tabelaImport.limit', LIMIT_TABELI));
      }
      return tabelaZKomorek([...wiersze.values()].sort((a, b) => a.numer - b.numer));
    },
  };
}
