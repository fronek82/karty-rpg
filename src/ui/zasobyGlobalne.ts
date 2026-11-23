import { useCallback, useEffect, useRef, useState } from 'react';
import type { WpisBibliotekiGlobalnej, WpisCzcionkiZProjektu } from '../dane/baza';
import { dodajZasoby } from '../dane/edycja';
import { KATALOG_GOOGLE_FONTS } from '../dane/googleFonts';
import { MAKS_BAJTOW_OBRAZU, opisObrazu } from '../dane/obrazy';
import { BladDanych } from '../dane/schemat';
import { formatujLiczbe, t } from '../i18n';
import type {
  DaneZasobow,
  OpisCzcionki,
  OpisZasobu,
  Projekt,
  ZrodloCzcionki,
} from '../model/projekt';
import type { WariantCzcionki } from '../model/szablon';
import { baza } from './bazaUI';
import type { ProjektWEdycji } from './useProjekt';

const kluczCzcionki = (rodzina: string, wariant: string) =>
  `${rodzina.trim().toLowerCase()}\0${wariant}`;

const ZDARZENIE_CZCIONEK = 'karty-rpg:czcionki-globalne';

/** Powiadamia otwarte edytory, że zmieniła się globalna lista czcionek w przeglądarce. */
export function powiadomZmianeCzcionekGlobalnych(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ZDARZENIE_CZCIONEK));
  }
}

interface MetaCzcionkiGlobalnej {
  rodzina: string;
  wariant: WariantCzcionki;
  zrodlo: ZrodloCzcionki;
}

const pamiecMetaCzcionek = new Map<string, MetaCzcionkiGlobalnej>();

/** Szybka mapa nazwy pliku TTF z katalogu Google Fonts → rodzina i wariant (bez parsowania fontkit). */
const mapaKataloguGoogle = new Map<string, MetaCzcionkiGlobalnej>(
  KATALOG_GOOGLE_FONTS.flatMap((p) =>
    p.warianty.map((w) => [
      w.plik.split('/').pop()!.toLowerCase(),
      { rodzina: p.rodzina, wariant: w.wariant, zrodlo: 'google' as const },
    ]),
  ),
);

/** Czyści pamięć podręczną metadanych czcionek globalnych (używane w testach). */
export function wyczyscPamiecCzcionekGlobalnych(): void {
  pamiecMetaCzcionek.clear();
}

/** Zastępuje w bibliotece globalnej wcześniejszy wpis tego samego rodzaju i nazwy, unikając duplikatów. */
async function zapiszUnikalnyWBibliotece(
  rodzaj: 'czcionka' | 'obraz',
  nazwa: string,
  dane: Uint8Array,
): Promise<string> {
  const istniejace = await baza().bibliotekaGlobalna(rodzaj);
  for (const w of istniejace) {
    if (w.nazwa === nazwa) {
      await baza().usunZBiblioteki(w.id);
      pamiecMetaCzcionek.delete(w.id);
    }
  }
  const id = crypto.randomUUID();
  await baza().zapiszWBibliotece(rodzaj, nazwa, dane, id);
  return id;
}

/**
 * Zapisuje wgrane lub pobrane z Google Fonts warianty czcionek w globalnej bibliotece przeglądarki,
 * dzięki czemu są natychmiast dostępne we wszystkich projektach (istniejących i nowych).
 */
export async function zapiszCzcionkiGlobalnie(
  wgrane: readonly { opis: OpisCzcionki; dane: Uint8Array }[],
): Promise<void> {
  if (wgrane.length === 0) return;
  for (const w of wgrane) {
    const id = await zapiszUnikalnyWBibliotece('czcionka', w.opis.nazwa, w.dane);
    pamiecMetaCzcionek.set(id, {
      rodzina: w.opis.rodzina,
      wariant: w.opis.wariant,
      zrodlo: w.opis.zrodlo,
    });
  }
  powiadomZmianeCzcionekGlobalnych();
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
    const id = await zapiszUnikalnyWBibliotece('czcionka', nazwa, wgrana.dane);
    pamiecMetaCzcionek.set(id, {
      rodzina: wgrana.opis.rodzina,
      wariant: wgrana.opis.wariant,
      zrodlo: wgrana.opis.zrodlo,
    });
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
  powiadomZmianeCzcionekGlobalnych();
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
  const { przygotujObraz } = await import('./obrazyUI');
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

/** Rodzina i wariant czcionki zapisanej w przeglądarce (z pamięci, katalogu Google Fonts albo pliku). */
export async function metaWpisuCzcionki(
  wpis: WpisBibliotekiGlobalnej,
): Promise<MetaCzcionkiGlobalnej | undefined> {
  const zPamieci = pamiecMetaCzcionek.get(wpis.id);
  if (zPamieci) return zPamieci;
  const zKatalogu = mapaKataloguGoogle.get(wpis.nazwa.toLowerCase());
  if (zKatalogu) {
    pamiecMetaCzcionek.set(wpis.id, zKatalogu);
    return zKatalogu;
  }
  try {
    const [{ wgrajCzcionke }, bajty] = await Promise.all([
      import('../dane/czcionki'),
      baza().odczytajZBiblioteki(wpis.id),
    ]);
    const w = wgrajCzcionke(wpis.nazwa, bajty);
    const meta: MetaCzcionkiGlobalnej = {
      rodzina: w.opis.rodzina,
      wariant: w.opis.wariant,
      zrodlo: w.opis.zrodlo,
    };
    pamiecMetaCzcionek.set(wpis.id, meta);
    return meta;
  } catch {
    return undefined;
  }
}

export interface RodzinaCzcionkiGlobalnej {
  rodzina: string;
  wpisyBiblioteki: WpisBibliotekiGlobalnej[];
  wpisyZProjektow: WpisCzcionkiZProjektu[];
}

/**
 * Zwraca listę rodzin czcionek zapisanych w bibliotece globalnej oraz w innych projektach
 * w tej przeglądarce (z pominięciem rodzin już obecnych w bieżącym projekcie).
 */
export async function listaRodzinCzcionekGlobalnych(
  biezacyProjektId?: string,
  rodzinyWProjekcie?: ReadonlySet<string>,
): Promise<RodzinaCzcionkiGlobalnej[]> {
  let wpisyBiblioteki: WpisBibliotekiGlobalnej[];
  let wpisyZProjektow: WpisCzcionkiZProjektu[];
  try {
    const db = baza();
    [wpisyBiblioteki, wpisyZProjektow] = await Promise.all([
      db.bibliotekaGlobalna('czcionka'),
      typeof db.czcionkiZProjektow === 'function'
        ? db.czcionkiZProjektow(biezacyProjektId)
        : Promise.resolve([]),
    ]);
  } catch {
    return [];
  }

  const obecneNorm = new Set([...(rodzinyWProjekcie ?? [])].map((r) => r.trim().toLowerCase()));
  const grupy = new Map<string, RodzinaCzcionkiGlobalnej>();

  for (const wpis of wpisyBiblioteki) {
    const meta = await metaWpisuCzcionki(wpis);
    if (!meta) continue;
    const klucz = meta.rodzina.trim().toLowerCase();
    if (obecneNorm.has(klucz)) continue;
    const g = grupy.get(klucz) ?? {
      rodzina: meta.rodzina,
      wpisyBiblioteki: [],
      wpisyZProjektow: [],
    };
    g.wpisyBiblioteki.push(wpis);
    grupy.set(klucz, g);
  }

  for (const wpis of wpisyZProjektow) {
    const klucz = wpis.rodzina.trim().toLowerCase();
    if (obecneNorm.has(klucz)) continue;
    const g = grupy.get(klucz) ?? {
      rodzina: wpis.rodzina,
      wpisyBiblioteki: [],
      wpisyZProjektow: [],
    };
    g.wpisyZProjektow.push(wpis);
    grupy.set(klucz, g);
  }

  return [...grupy.values()].sort((a, b) => a.rodzina.localeCompare(b.rodzina));
}

/**
 * Dołącza wszystkie warianty wybranej globalnej rodziny czcionek (z biblioteki przeglądarki
 * lub z innego projektu) do aktywnego projektu i opcjonalnie wykonuje od razu aktualizację
 * projektu (np. przypisanie roli czcionki) w jednym kroku.
 */
export async function dolaczRodzineGlobalnaDoProjektu(
  rodzina: string,
  edycja: ProjektWEdycji,
  poDodaniu?: (p: Projekt) => Projekt,
): Promise<boolean> {
  const szukana = rodzina.trim().toLowerCase();
  const grupy = await listaRodzinCzcionekGlobalnych(edycja.projekt.id);
  const grupa = grupy.find((g) => g.rodzina.trim().toLowerCase() === szukana);
  if (!grupa) {
    if (poDodaniu) edycja.zmien(poDodaniu);
    return false;
  }

  const { unikalneId, wgrajCzcionke } = await import('../dane/czcionki');
  const przygotowane: { opis: OpisCzcionki; dane: Uint8Array }[] = [];
  const dodaneWarianty = new Set<string>();

  for (const wpis of grupa.wpisyBiblioteki) {
    try {
      const bajty = await baza().odczytajZBiblioteki(wpis.id);
      const meta =
        (await metaWpisuCzcionki(wpis)) ?? mapaKataloguGoogle.get(wpis.nazwa.toLowerCase());
      const w = wgrajCzcionke(wpis.nazwa, bajty, { zrodlo: meta?.zrodlo ?? 'wlasna' });
      const opis: OpisCzcionki = meta
        ? { ...w.opis, rodzina: meta.rodzina, wariant: meta.wariant, zrodlo: meta.zrodlo }
        : w.opis;
      if (dodaneWarianty.has(opis.wariant)) continue;
      dodaneWarianty.add(opis.wariant);
      przygotowane.push({ opis, dane: w.dane });
    } catch {
      // Pomijamy pojedynczy uszkodzony wpis.
    }
  }

  if (grupa.wpisyZProjektow.length > 0) {
    const poProjekcie = new Map<string, WpisCzcionkiZProjektu[]>();
    for (const w of grupa.wpisyZProjektow) {
      if (dodaneWarianty.has(w.wariant)) continue;
      const lista = poProjekcie.get(w.projektId) ?? [];
      lista.push(w);
      poProjekcie.set(w.projektId, lista);
    }
    for (const [pid, wpisy] of poProjekcie) {
      try {
        const { projekt: zrodlowy, zasoby } = await baza().wczytaj(pid);
        for (const w of wpisy) {
          if (dodaneWarianty.has(w.wariant)) continue;
          const opis = zrodlowy.zasoby.find(
            (z): z is OpisCzcionki => z.rodzaj === 'czcionka' && z.id === w.zasobId,
          );
          const dane = zasoby.get(w.zasobId);
          if (!opis || !dane) continue;
          dodaneWarianty.add(opis.wariant);
          przygotowane.push({ opis, dane });
        }
      } catch {
        // Pomijamy niedostępny projekt źródłowy.
      }
    }
  }

  if (przygotowane.length === 0) {
    if (poDodaniu) edycja.zmien(poDodaniu);
    return false;
  }

  await edycja.zmienZZasobami((p, d) => {
    const zajete = new Set([...p.zasoby.map((z) => z.id), ...d.keys()]);
    const obecne = new Set(
      p.zasoby
        .filter((z): z is OpisCzcionki => z.rodzaj === 'czcionka')
        .map((z) => kluczCzcionki(z.rodzina, z.wariant)),
    );
    const nowe: { opis: OpisZasobu; dane: Uint8Array }[] = [];
    for (const { opis, dane } of przygotowane) {
      const klucz = kluczCzcionki(opis.rodzina, opis.wariant);
      if (obecne.has(klucz)) continue;
      const id = unikalneId(opis.id, zajete);
      zajete.add(id);
      obecne.add(klucz);
      nowe.push({ opis: { ...opis, id }, dane });
    }
    const poZasobach = nowe.length > 0 ? dodajZasoby(p, d, nowe) : { projekt: p, dane: d };
    return poDodaniu
      ? { projekt: poDodaniu(poZasobach.projekt), dane: poZasobach.dane }
      : poZasobach;
  });
  return true;
}

/**
 * Hook zwracający nazwy rodzin czcionek zapamiętanych globalnie w przeglądarce
 * (lub w innych projektach), których jeszcze nie ma w bieżącym projekcie.
 */
export function useCzcionkiGlobalne(projekt: Projekt): {
  rodzinyGlobalne: string[];
  odswiez: () => Promise<void>;
} {
  const [rodziny, ustawRodziny] = useState<string[]>([]);
  const podpis = projekt.zasoby
    .filter((z): z is OpisCzcionki => z.rodzaj === 'czcionka')
    .map((z) => `${z.rodzina}:${z.wariant}`)
    .sort()
    .join('|');

  const odswiez = useCallback(async () => {
    const obecne = new Set(
      projekt.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [z.rodzina] : [])),
    );
    const grupy = await listaRodzinCzcionekGlobalnych(projekt.id, obecne);
    ustawRodziny(grupy.map((g) => g.rodzina));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- odświeżamy przy zmianie projektu lub jego czcionek
  }, [projekt.id, podpis]);

  useEffect(() => {
    let aktywny = true;
    const obecne = new Set(
      projekt.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [z.rodzina] : [])),
    );
    const laduj = () => {
      void listaRodzinCzcionekGlobalnych(projekt.id, obecne).then((grupy) => {
        if (aktywny) ustawRodziny(grupy.map((g) => g.rodzina));
      });
    };
    laduj();
    window.addEventListener(ZDARZENIE_CZCIONEK, laduj);
    return () => {
      aktywny = false;
      window.removeEventListener(ZDARZENIE_CZCIONEK, laduj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- odświeżamy przy zmianie projektu lub jego czcionek
  }, [projekt.id, podpis]);

  return { rodzinyGlobalne: rodziny, odswiez };
}

/**
 * Automatycznie dołącza do projektu globalną rodzinę czcionek w momencie, gdy użytkownik wybierze ją
 * w edytorze szablonu lub rewersu (w stylu pola, etykiety, tabeli lub grupy stylów).
 */
export function useSynchronizujCzcionkiGlobalne(
  edycja: ProjektWEdycji,
  rodzinyGlobalne: readonly string[],
  uzyteCzcionki: readonly string[],
): void {
  const wTrakcie = useRef(new Set<string>());
  const kluczUzytych = [...new Set(uzyteCzcionki)].sort().join('|');
  const kluczGlobalnych = rodzinyGlobalne.join('|');

  useEffect(() => {
    const globalne = new Set(rodzinyGlobalne);
    const brakujace = [...new Set(uzyteCzcionki)].filter(
      (r) => globalne.has(r) && !wTrakcie.current.has(r),
    );
    if (brakujace.length === 0) return;
    for (const r of brakujace) wTrakcie.current.add(r);
    void (async () => {
      for (const r of brakujace) {
        try {
          await dolaczRodzineGlobalnaDoProjektu(r, edycja);
        } catch {
          // Błąd pojedynczej czcionki nie blokuje edytora.
        } finally {
          wTrakcie.current.delete(r);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagujemy na zmiany użytych i globalnych rodzin
  }, [edycja.projekt.id, kluczUzytych, kluczGlobalnych]);
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
        const metaKatalogu = mapaKataloguGoogle.get(wpis.nazwa.toLowerCase());
        const w = wgrajCzcionke(wpis.nazwa, bajty, {
          zrodlo: metaKatalogu?.zrodlo ?? 'wlasna',
          zajete,
        });
        const opis: OpisCzcionki = metaKatalogu
          ? {
              ...w.opis,
              rodzina: metaKatalogu.rodzina,
              wariant: metaKatalogu.wariant,
              zrodlo: 'google',
            }
          : w.opis;
        const klucz = kluczCzcionki(opis.rodzina, opis.wariant);
        if (obecneCzcionki.has(klucz)) continue;
        zajete.add(opis.id);
        obecneCzcionki.add(klucz);
        nowe.push({ opis, dane: w.dane });
      } catch {
        // Uszkodzony pojedynczy wpis globalny nie może zablokować tworzenia projektu.
      }
    }
  }

  if (obrazy.length > 0) {
    const { przygotujObraz } = await import('./obrazyUI');
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
