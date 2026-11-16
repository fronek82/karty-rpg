import { formatObrazu } from '../dane/czcionki';
import { orientacjaExif } from '../dane/obrazy';

export interface PrzygotowanyObraz {
  dane: Uint8Array;
  /** Wymiary w pikselach po zastosowaniu orientacji (0, gdy przeglądarka nie odczyta pliku). */
  szerokosc: number;
  wysokosc: number;
}

/**
 * Obraz do biblioteki. Zdjęcie JPEG z orientacją EXIF ≠ 1 (typowe z telefonu) jest
 * przekodowywane z zastosowanym obrotem i bez znacznika – podgląd (przeglądarka obraca wg EXIF)
 * i PDF (pdf-lib nie obraca) pokazują wtedy to samo. Pozostałe pliki zostają bez zmian.
 */
export async function przygotujObraz(dane: Uint8Array): Promise<PrzygotowanyObraz> {
  const format = formatObrazu(dane);
  const typ = format === 'png' ? 'image/png' : 'image/jpeg';
  let bitmapa: ImageBitmap;
  try {
    bitmapa = await createImageBitmap(new Blob([dane as Uint8Array<ArrayBuffer>], { type: typ }), {
      imageOrientation: 'from-image',
    });
  } catch {
    return { dane, szerokosc: 0, wysokosc: 0 };
  }
  try {
    const orientacja = format === 'jpg' ? orientacjaExif(dane) : undefined;
    const wymiary = { szerokosc: bitmapa.width, wysokosc: bitmapa.height };
    if (orientacja === undefined || orientacja === 1) return { dane, ...wymiary };
    const kanwa = document.createElement('canvas');
    kanwa.width = bitmapa.width;
    kanwa.height = bitmapa.height;
    const ctx = kanwa.getContext('2d');
    if (!ctx) return { dane, ...wymiary };
    ctx.drawImage(bitmapa, 0, 0);
    const blob = await new Promise<Blob | null>((ok) => kanwa.toBlob(ok, 'image/jpeg', 0.92));
    if (!blob) return { dane, ...wymiary };
    return { dane: new Uint8Array(await blob.arrayBuffer()), ...wymiary };
  } finally {
    bitmapa.close();
  }
}
