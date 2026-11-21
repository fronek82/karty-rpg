import type { WpisBibliotekiGlobalnej } from '../dane/baza';
import { dodajZasoby } from '../dane/edycja';
import { MAKS_BAJTOW_OBRAZU, opisObrazu } from '../dane/obrazy';
import { BladDanych } from '../dane/schemat';
import { formatujLiczbe, t } from '../i18n';
import type { DaneZasobow, OpisCzcionki, OpisZasobu, Projekt } from '../model/projekt';
import { baza } from './baza';
import type { ProjektWEdycji } from './useProjekt';

const kluczCzcionki = (rodzina: string, wariant: string) =>
  `${rodzina.trim().toLowerCase()}\0${wariant}`;

/** Zastępuje w bibliotece globalnej wcześniejszy wpis tego samego rodzaju i nazwy, unikając duplikatów. */
async function zapiszUnikalnyWBibliotece(
  rodzaj: 'czcionka' | 'obraz',
  nazwa: string,
  dane: Uint8Array,
): Promise<void> {
  const istniejace = await baza().bibliotekaGlobalna(rodzaj);
  for (const w of istniejace) {
    if (w.nazwa === nazwa) await baza().usunZBiblioteki(w.id);
  }
  await baza().zapiszWBibliotece(rodzaj, nazwa, dane);
}

/**
 * Wgrywa wybrane pliki czcionek do lokalnej biblioteki w przeglądarce (IndexedDB),
 * a gdy otwarty jest projekt – dodaje je jednocześnie do zasobów projektu.
 */
export async function wgrajCzcionkiGlobalnie(
  pliki: File[],
  edycja?: ProjektWEdycji,
): Promise<string[]> {
  const { unikalneId, wgrajCzcionke } = await import('../dane/czcionki');
  const odczytane = await Promise.all(
    pliki.map(async (f) => ({ nazwa: f.name, bajty: new Uint8Array(await f.arrayBuffer()) })),
  );
  // Najpierw pełna walidacja wszystkich plików – przy błędzie nic nie trafia częściowo do bazy.
  const zwalidowane = odczytane.map(({ nazwa, bajty }) => ({
    nazwa,
    wgrana: wgrajCzcionke(nazwa, bajty),
  }));
  for (const { nazwa, wgrana } of zwalidowane) {
    await zapiszUnikalnyWBibliotece('czcionka', nazwa, wgrana.dane);
  }
  const opisy = zwalidowane.map(
    ({ wgrana }) => `${wgrana.opis.rodzina} (${t(`wariant.${wgrana.opis.wariant}`)})`,
  );
  if (edycja) {
    await edycja.zmienZZasobami((p, d) => {
      const zajete = new Set([...p.zasoby.map((z) => z.id), ...d.keys()]);
      const obecne = new Set(
        p.zasoby
          .filter((z): z is OpisCzcionki => z.rodzaj === 'czcionka')
          .map((z) => kluczCzcionki(z.rodzina, z.wariant)),
      );
      const nowe: { opis: OpisZasobu; dane: Uint8Array }[] = [];
      for (const { wgrana } of zwalidowane) {
        const klucz = kluczCzcionki(wgrana.opis.rodzina, wgrana.opis.wariant);
        if (obecne.has(klucz)) continue;
        // Ponowne użycie już sparsowanego opisu czcionki (bez drugiego parsowania przez fontkit).
        const id = unikalneId(wgrana.opis.id, zajete);
        zajete.add(id);
        obecne.add(klucz);
        nowe.push({ opis: { ...wgrana.opis, id }, dane: wgrana.dane });
      }
      return nowe.length > 0 ? dodajZasoby(p, d, nowe) : { projekt: p, dane: d };
    });
  }
  return opisy;
}

/**
 * Wgrywa wybrane pliki obrazów (PNG/JPG) do lokalnej biblioteki w przeglądarce (IndexedDB),
 * a gdy otwarty jest projekt – dodaje je jednocześnie do zasobów projektu.
 */
export async function wgrajObrazyGlobalnie(
  pliki: File[],
  edycja?: ProjektWEdycji,
): Promise<string[]> {
  const { przygotujObraz } = await import('./obrazy');
  const przygotowane: { nazwa: string; dane: Uint8Array; szerokosc: number; wysokosc: number }[] =
    [];
  for (const plik of pliki) {
    if (plik.size > MAKS_BAJTOW_OBRAZU) {
      throw new BladDanych(
        t('dane.zaDuzy', { plik: plik.name, mb: formatujLiczbe(plik.size / 1024 / 1024, 1) }),
      );
    }
    const wynik = await przygotujObraz(new Uint8Array(await plik.arrayBuffer()));
    // Walidacja formatu i wymiarów przed zapisem.
    opisObrazu(plik.name, wynik.dane, wynik, new Set());
    przygotowane.push({ nazwa: plik.name, ...wynik });
  }
  for (const obr of przygotowane) {
    await zapiszUnikalnyWBibliotece('obraz', obr.nazwa, obr.dane);
  }
  if (edycja) {
    await edycja.zmienZZasobami((p, d) => {
      const zajete = new Set([...p.zasoby.map((z) => z.id), ...d.keys()]);
      const obecneNazwy = new Set(p.zasoby.filter((z) => z.rodzaj === 'obraz').map((z) => z.nazwa));
      const nowe: { opis: OpisZasobu; dane: Uint8Array }[] = [];
      for (const obr of przygotowane) {
        if (obecneNazwy.has(obr.nazwa)) continue;
        const opis = opisObrazu(
          obr.nazwa,
          obr.dane,
          { szerokosc: obr.szerokosc, wysokosc: obr.wysokosc },
          zajete,
        );
        zajete.add(opis.id);
        obecneNazwy.add(obr.nazwa);
        nowe.push({ opis, dane: obr.dane });
      }
      return nowe.length > 0 ? dodajZasoby(p, d, nowe) : { projekt: p, dane: d };
    });
  }
  return przygotowane.map((o) => o.nazwa);
}

/** Kopiuje zapisaną w przeglądarce czcionkę do aktywnego projektu. */
export async function dodajGlobalnaCzcionkeDoProjektu(
  wpis: WpisBibliotekiGlobalnej,
  edycja: ProjektWEdycji,
): Promise<string> {
  const [{ unikalneId, wgrajCzcionke }, bajty] = await Promise.all([
    import('../dane/czcionki'),
    baza().odczytajZBiblioteki(wpis.id),
  ]);
  const w = wgrajCzcionke(wpis.nazwa, bajty);
  const etykieta = `${w.opis.rodzina} (${t(`wariant.${w.opis.wariant}`)})`;
  await edycja.zmienZZasobami((p, d) => {
    const zajete = new Set([...p.zasoby.map((z) => z.id), ...d.keys()]);
    const id = unikalneId(w.opis.id, zajete);
    return dodajZasoby(p, d, [{ opis: { ...w.opis, id }, dane: w.dane }]);
  });
  return etykieta;
}

/** Kopiuje zapisany w przeglądarce obraz do aktywnego projektu. */
export async function dodajGlobalnyObrazDoProjektu(
  wpis: WpisBibliotekiGlobalnej,
  edycja: ProjektWEdycji,
): Promise<string> {
  const [{ przygotujObraz }, bajty] = await Promise.all([
    import('./obrazy'),
    baza().odczytajZBiblioteki(wpis.id),
  ]);
  const wynik = await przygotujObraz(bajty);
  await edycja.zmienZZasobami((p, d) => {
    const zajete = new Set([...p.zasoby.map((z) => z.id), ...d.keys()]);
    const opis = opisObrazu(wpis.nazwa, wynik.dane, wynik, zajete);
    return dodajZasoby(p, d, [{ opis, dane: wynik.dane }]);
  });
  return wpis.nazwa;
}

/**
 * Dołącza czcionki i obrazy zapisane globalnie w przeglądarce do nowo tworzonego projektu.
 * Pomija pozycje już obecne w projekcie (np. wbudowane kroje o tej samej rodzinie i wariancie).
 */
export async function dolaczZasobyGlobalne(
  projekt: Projekt,
  dane: DaneZasobow,
): Promise<{ projekt: Projekt; dane: DaneZasobow }> {
  let czcionki: WpisBibliotekiGlobalnej[];
  let obrazy: WpisBibliotekiGlobalnej[];
  try {
    [czcionki, obrazy] = await Promise.all([
      baza().bibliotekaGlobalna('czcionka'),
      baza().bibliotekaGlobalna('obraz'),
    ]);
  } catch {
    return { projekt, dane };
  }
  if (czcionki.length === 0 && obrazy.length === 0) return { projekt, dane };

  const zajete = new Set([...projekt.zasoby.map((z) => z.id), ...dane.keys()]);
  const obecneCzcionki = new Set(
    projekt.zasoby
      .filter((z): z is OpisCzcionki => z.rodzaj === 'czcionka')
      .map((z) => kluczCzcionki(z.rodzina, z.wariant)),
  );
  const obecneObrazy = new Set(
    projekt.zasoby.filter((z) => z.rodzaj === 'obraz').map((z) => z.nazwa),
  );
  const nowe: { opis: OpisZasobu; dane: Uint8Array }[] = [];

  if (czcionki.length > 0) {
    const { wgrajCzcionke } = await import('../dane/czcionki');
    for (const wpis of czcionki) {
      try {
        const bajty = await baza().odczytajZBiblioteki(wpis.id);
        const w = wgrajCzcionke(wpis.nazwa, bajty, { zajete });
        const klucz = kluczCzcionki(w.opis.rodzina, w.opis.wariant);
        if (obecneCzcionki.has(klucz)) continue;
        zajete.add(w.opis.id);
        obecneCzcionki.add(klucz);
        nowe.push({ opis: w.opis, dane: w.dane });
      } catch {
        // Uszkodzony pojedynczy wpis globalny nie może zablokować tworzenia projektu.
      }
    }
  }

  if (obrazy.length > 0) {
    const { przygotujObraz } = await import('./obrazy');
    for (const wpis of obrazy) {
      if (obecneObrazy.has(wpis.nazwa)) continue;
      try {
        const bajty = await baza().odczytajZBiblioteki(wpis.id);
        const wynik = await przygotujObraz(bajty);
        const opis = opisObrazu(wpis.nazwa, wynik.dane, wynik, zajete);
        zajete.add(opis.id);
        obecneObrazy.add(wpis.nazwa);
        nowe.push({ opis, dane: wynik.dane });
      } catch {
        // Uszkodzony pojedynczy wpis globalny nie może zablokować tworzenia projektu.
      }
    }
  }

  if (nowe.length === 0) return { projekt, dane };
  return dodajZasoby(projekt, dane, nowe);
}
