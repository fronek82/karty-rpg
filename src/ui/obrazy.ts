import { formatObrazu } from '../dane/czcionki';
import { macierzOrientacji, orientacjaExif, wymiaryJpeg, wymiaryPoObrocie } from '../dane/obrazy';
import { BladDanych } from '../dane/schemat';
import { t } from '../i18n';

export interface PrzygotowanyObraz {
  dane: Uint8Array;
  /** Wymiary w pikselach (0, gdy przeglądarka nie odczyta pliku – opis obrazu go odrzuci). */
  szerokosc: number;
  wysokosc: number;
}

/** Bezpieczny limit powierzchni kanwy (Safari na iOS: ~16,7 Mpx). */
const MAKS_PIKSELI = 16_000_000;

const dekoduj = (dane: Uint8Array, typ: string) =>
  createImageBitmap(new Blob([dane as Uint8Array<ArrayBuffer>], { type: typ }), {
    imageOrientation: 'none',
  });

/**
 * Obraz do biblioteki. Zdjęcie JPEG z orientacją EXIF ≠ 1 (typowe z telefonu) jest
 * przekodowywane z zastosowanym obrotem i bez znacznika – podgląd i PDF pokazują wtedy to samo.
 * Obrót liczymy sami (macierz z orientacji), więc wynik nie zależy od przeglądarki; zbyt duże
 * zdjęcie jest przy tym zmniejszane do limitu kanwy. Pozostałe pliki zostają bez zmian.
 */
export async function przygotujObraz(dane: Uint8Array): Promise<PrzygotowanyObraz> {
  const format = formatObrazu(dane);
  if (!format) return { dane, szerokosc: 0, wysokosc: 0 };
  const typ = format === 'png' ? 'image/png' : 'image/jpeg';
  let bitmapa: ImageBitmap;
  try {
    bitmapa = await dekoduj(dane, typ);
  } catch {
    return { dane, szerokosc: 0, wysokosc: 0 };
  }
  try {
    const orientacja = format === 'jpg' ? (orientacjaExif(dane) ?? 1) : 1;
    if (orientacja === 1) return { dane, szerokosc: bitmapa.width, wysokosc: bitmapa.height };

    // Czy przeglądarka mimo „none” obróciła już piksele (wymiary zamienione względem SOF)?
    const sof = wymiaryJpeg(dane);
    const juzObrocona =
      orientacja >= 5 &&
      !!sof &&
      sof.szerokosc !== sof.wysokosc &&
      bitmapa.width === sof.wysokosc &&
      bitmapa.height === sof.szerokosc;
    const o = juzObrocona ? 1 : orientacja;
    const k = Math.min(1, Math.sqrt(MAKS_PIKSELI / (bitmapa.width * bitmapa.height)));
    const szer = Math.max(1, Math.round(bitmapa.width * k));
    const wys = Math.max(1, Math.round(bitmapa.height * k));
    const wynik = wymiaryPoObrocie(o, szer, wys);

    const kanwa = document.createElement('canvas');
    kanwa.width = wynik.szerokosc;
    kanwa.height = wynik.wysokosc;
    const ctx = kanwa.getContext('2d');
    if (!ctx) throw new BladDanych(t('dane.bladObrotu'));
    ctx.setTransform(...macierzOrientacji(o, szer, wys));
    ctx.drawImage(bitmapa, 0, 0, szer, wys);
    const blob = await new Promise<Blob | null>((ok) => kanwa.toBlob(ok, 'image/jpeg', 0.92));
    // Bez przekodowania obraz w PDF byłby nieobrócony i zniekształcony – lepiej jasny błąd.
    if (!blob) throw new BladDanych(t('dane.bladObrotu'));
    return { dane: new Uint8Array(await blob.arrayBuffer()), ...wynik };
  } finally {
    bitmapa.close();
  }
}
