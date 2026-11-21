import { czyProjektRewersowy, kluczMiniaturyRewersu } from '../dane/baza';
import type { DaneZasobow, OpisZasobu, Projekt } from '../model/projekt';
import { RejestrCzcionek, wczytajCzcionke } from '../silnik/czcionki';
import { renderujRewers } from '../silnik/karta';
import type { Scena } from '../silnik/scena';
import { scenaDoSvg } from '../silnik/svg';
import { baza } from './baza';

const MAKS_BAJTOW_OBRAZU_W_MINIATURZE = 1_500_000;
const MAKS_LACZNIE_BAJTOW_OBRAZOW = 2_000_000;

function bajtyDoBase64(bajty: Uint8Array): string {
  let binarny = '';
  const krok = 0x8000;
  for (let i = 0; i < bajty.length; i += krok) {
    binarny += String.fromCharCode(...bajty.subarray(i, i + krok));
  }
  return btoa(binarny);
}

function adresObrazuDataUri(
  zasoby: readonly OpisZasobu[],
  dane: DaneZasobow,
): (id: string) => string | undefined {
  const poId = new Map(zasoby.map((z) => [z.id, z] as const));
  const pamiec = new Map<string, string | undefined>();
  let uzytoBajtow = 0;
  return (id: string) => {
    if (pamiec.has(id)) return pamiec.get(id);
    const opis = poId.get(id);
    const bajty = dane.get(id);
    if (
      !opis ||
      opis.rodzaj !== 'obraz' ||
      !bajty ||
      bajty.byteLength > MAKS_BAJTOW_OBRAZU_W_MINIATURZE ||
      uzytoBajtow + bajty.byteLength > MAKS_LACZNIE_BAJTOW_OBRAZOW
    ) {
      pamiec.set(id, undefined);
      return undefined;
    }
    uzytoBajtow += bajty.byteLength;
    const mime = opis.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const uri = `data:${mime};base64,${bajtyDoBase64(bajty)}`;
    pamiec.set(id, uri);
    return uri;
  };
}

/** Zamienia gotową scenę rewersu na samodzielny SVG do podglądu na liście „Moje projekty”. */
export function scenaRewersuDoMiniaturySvg(
  scena: Scena,
  projekt: Projekt,
  dane: DaneZasobow,
): string {
  return scenaDoSvg(scena, {
    adresObrazu: adresObrazuDataUri(projekt.zasoby, dane),
    przedrostekId: 'min-rw-',
  });
}

/** Renderuje kartę rewersu z projektu i jego zasobów do samodzielnego SVG miniatury. */
export function renderujMiniatureRewersu(
  projekt: Projekt,
  dane: DaneZasobow,
  rewersId: string,
): string | undefined {
  const rewers = projekt.rewersy?.find((r) => r.id === rewersId);
  if (!rewers) return undefined;
  const rejestr = new RejestrCzcionek();
  for (const z of projekt.zasoby) {
    if (z.rodzaj !== 'czcionka') continue;
    const bajty = dane.get(z.id);
    if (!bajty) continue;
    try {
      rejestr.dodaj(z.rodzina, z.wariant, wczytajCzcionke(z.id, bajty));
    } catch {
      // Pomijamy pojedynczy uszkodzony zasób przy budowaniu miniatury.
    }
  }
  rejestr.ustawRole(projekt.role);
  const obrazy = new Map(
    projekt.zasoby.flatMap((z) =>
      z.rodzaj === 'obraz'
        ? [[z.id, { szerokosc: z.szerokosc, wysokosc: z.wysokosc }] as const]
        : [],
    ),
  );
  const wynik = renderujRewers(rewers, {
    czcionki: rejestr,
    obraz: (id) => obrazy.get(id),
    ...(projekt.biblioteka?.ozdobniki ? { elementy: projekt.biblioteka.ozdobniki } : {}),
  });
  return scenaRewersuDoMiniaturySvg(wynik.scena, projekt, dane);
}

/** Zapisuje miniaturę karty rewersu w IndexedDB (a dla samodzielnego projektu rewersowego także pod jego ID). */
export async function zapiszMiniatureRewersu(
  projekt: Projekt,
  dane: DaneZasobow,
  rewersId: string,
  scena?: Scena,
): Promise<string | undefined> {
  const svg = scena
    ? scenaRewersuDoMiniaturySvg(scena, projekt, dane)
    : renderujMiniatureRewersu(projekt, dane, rewersId);
  if (!svg) return undefined;
  const db = baza();
  await db.zapiszMiniature(kluczMiniaturyRewersu(projekt.id, rewersId), svg);
  if (czyProjektRewersowy(projekt) && projekt.rewersy?.[0]?.id === rewersId) {
    await db.zapiszMiniature(projekt.id, svg);
  }
  return svg;
}
