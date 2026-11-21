#!/usr/bin/env node
/**
 * Generuje zweryfikowany, kompaktowy katalog wszystkich łacińskich rodzin Google Fonts
 * (`src/dane/katalogGoogleFonts.json`) na podstawie oficjalnych metadanych Google Fonts
 * oraz drzewa plików repozytorium `google/fonts` (`ofl`, `apache`, `ufl`).
 *
 * Uruchomienie: `node scripts/generuj-katalog-google-fonts.mjs`
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KATEGORIE = {
  Display: 0,
  Serif: 1,
  'Sans Serif': 2,
  Handwriting: 3,
  Monospace: 4,
};

const GRUPY = {
  ofl: 0,
  apache: 1,
  ufl: 2,
};

function wybierzWarianty(pliki) {
  const wKataloguGlownym = pliki.filter((p) => !p.includes('/'));
  const wStatic = pliki
    .filter((p) => p.startsWith('static/'))
    .map((p) => p.slice('static/'.length));

  const wybierzStatyczne = (lista, prefiks) => {
    const statyczne = lista.filter((f) => !f.includes('['));
    if (statyczne.length === 0) return null;
    const znajdz = (re) => statyczne.find((f) => re.test(f));
    const reg =
      znajdz(/(?:^|-)Regular\.ttf$/i) ??
      (statyczne.length === 1 ? statyczne[0] : undefined) ??
      statyczne.find(
        (f) => !/(?:Bold|Italic|Light|Thin|Black|Medium|SemiBold|ExtraBold)/i.test(f),
      ) ??
      statyczne[0];
    const bold = znajdz(/(?:^|-)Bold\.ttf$/i);
    const ital = znajdz(/(?:^|-)Italic\.ttf$/i);
    const bi = znajdz(/(?:^|-)BoldItalic\.ttf$/i);
    const wynik = {};
    if (reg) wynik.n = `${prefiks}${reg}`;
    if (bold && bold !== reg) wynik.b = `${prefiks}${bold}`;
    if (ital && ital !== reg) wynik.i = `${prefiks}${ital}`;
    if (bi && bi !== reg) wynik.bi = `${prefiks}${bi}`;
    return Object.keys(wynik).length > 0 ? wynik : null;
  };

  const zGlownego = wybierzStatyczne(wKataloguGlownym, '');
  if (zGlownego) return zGlownego;

  const zeStatic = wybierzStatyczne(wStatic, 'static/');
  if (zeStatic) return zeStatic;

  const zmienne = wKataloguGlownym.filter((f) => f.includes('['));
  if (zmienne.length === 0) return null;
  const norm = zmienne.find((f) => !/italic/i.test(f)) ?? zmienne[0];
  const kurs = zmienne.find((f) => /italic/i.test(f));
  const wynik = { n: norm };
  if (kurs && kurs !== norm) wynik.i = kurs;
  return wynik;
}

function ghJson(sciezka) {
  return JSON.parse(
    execSync(`gh api ${sciezka}`, { maxBuffer: 100 * 1024 * 1024 }).toString('utf8'),
  );
}

async function main() {
  const res = await fetch('https://fonts.google.com/metadata/fonts');
  if (!res.ok) throw new Error(`HTTP ${res.status} z fonts.google.com/metadata/fonts`);
  const surowy = (await res.text()).replace(/^\)\]\}'\n/, '');
  const meta = JSON.parse(surowy).familyMetadataList;

  const mainTree = ghJson('repos/google/fonts/git/trees/main').tree;
  const katalogi = new Map();

  for (const grupa of ['ofl', 'apache', 'ufl']) {
    const wpis = mainTree.find((e) => e.path === grupa);
    if (!wpis) continue;
    const drzewo = ghJson(`repos/google/fonts/git/trees/${wpis.sha}?recursive=1`);
    if (drzewo.truncated) throw new Error(`Drzewo ${grupa} zostało ucięte przez GitHub API`);
    for (const item of drzewo.tree) {
      if (item.type !== 'blob' || !item.path.toLowerCase().endsWith('.ttf')) continue;
      const czesci = item.path.split('/');
      if (czesci.length < 2) continue;
      if (czesci.length > 2 && czesci[1] !== 'static') continue;
      const kat = czesci[0];
      const rel = czesci.slice(1).join('/');
      const klucz = kat.toLowerCase();
      if (!katalogi.has(klucz)) katalogi.set(klucz, { grupa, katalog: kat, pliki: [] });
      const cel = katalogi.get(klucz);
      if (cel.grupa === grupa) cel.pliki.push(rel);
    }
  }

  const pozycje = [];
  const widziane = new Set();

  for (const f of meta) {
    if (!Array.isArray(f.subsets) || !f.subsets.includes('latin')) continue;
    const katKod = KATEGORIE[f.category];
    if (katKod === undefined) continue;
    const slug = f.family.toLowerCase().replace(/[^a-z0-9]/g, '');
    const traf = katalogi.get(slug);
    if (!traf) continue;
    const warianty = wybierzWarianty(traf.pliki);
    if (!warianty || !warianty.n) continue;
    if (widziane.has(f.family.toLowerCase())) continue;
    widziane.add(f.family.toLowerCase());

    const autor =
      Array.isArray(f.designers) && f.designers.length > 0
        ? f.designers.join(', ')
        : 'Google Fonts';
    const polskie = f.subsets.includes('latin-ext') ? 1 : 0;
    const popularnosc = typeof f.popularity === 'number' ? f.popularity : 999_999;
    // Format krotki: [rodzina, kategoriaKod, autor, grupaKod, katalog, polskieZnaki, warianty]
    pozycje.push({
      popularnosc,
      krotka: [f.family, katKod, autor, GRUPY[traf.grupa], traf.katalog, polskie, warianty],
    });
  }

  pozycje.sort(
    (a, b) => a.popularnosc - b.popularnosc || a.krotka[0].localeCompare(b.krotka[0], 'en'),
  );
  const krotki = pozycje.map((p) => p.krotka);

  const cel = resolve('src/dane/katalogGoogleFonts.json');
  writeFileSync(cel, `${JSON.stringify(krotki)}\n`, 'utf8');
  const zPolskimi = krotki.filter((p) => p[5] === 1).length;
  console.log(`Zapisano ${krotki.length} rodzin (${zPolskimi} z polskimi znakami) do ${cel}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
