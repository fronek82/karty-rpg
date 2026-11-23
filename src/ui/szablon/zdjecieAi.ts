import { MAKS_BAJTOW_OBRAZU_AI, type TypMimeObrazuAi } from '../../dane/aiUklad';
import { BladDanych } from '../../dane/schemat';
import { t } from '../../i18n';

/** Najdłuższy bok zdjęcia wysyłanego do Claude API (zalecany przez API). */
const MAKS_BOK_AI_PX = 1568;

/** Zdjęcie przygotowane dla Claude API: podgląd (adres blob), base64 i bajty (podkład). */
export interface WgraneZdjecie {
  nazwa: string;
  podgladUrl: string;
  base64: string;
  typMime: TypMimeObrazuAi;
  bajty: Uint8Array;
  szerokosc: number;
  wysokosc: number;
}

function bajtyNaBase64(bajty: Uint8Array): string {
  let binarny = '';
  const krok = 0x8000;
  for (let i = 0; i < bajty.length; i += krok) {
    binarny += String.fromCharCode(...bajty.subarray(i, i + krok));
  }
  return btoa(binarny);
}

/**
 * Zmniejsza zdjęcie do max 1568 px przez `<canvas>` (wypala orientację EXIF z telefonu
 * i gwarantuje spójny format PNG/JPEG ≤ 5 MB) oraz zwraca bajty + base64 dla Claude API i podkładu.
 */
export async function przygotujZdjecieDlaAi(plik: File): Promise<WgraneZdjecie> {
  const zrodloUrl = URL.createObjectURL(plik);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new BladDanych(t('import.nieczytelny')));
      el.src = zrodloUrl;
    });
    const natSzer = img.naturalWidth;
    const natWys = img.naturalHeight;
    if (!natSzer || !natWys) throw new BladDanych(t('import.nieczytelny'));

    const skala = Math.min(1, MAKS_BOK_AI_PX / Math.max(natSzer, natWys));
    const szer = Math.max(1, Math.round(natSzer * skala));
    const wys = Math.max(1, Math.round(natWys * skala));

    const canvas = document.createElement('canvas');
    canvas.width = szer;
    canvas.height = wys;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new BladDanych(t('import.nieczytelny'));
    ctx.drawImage(img, 0, 0, szer, wys);

    let typMime: TypMimeObrazuAi = plik.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const koduj = (mime: TypMimeObrazuAi, jakosc?: number) =>
      new Promise<Blob | null>((res) => canvas.toBlob(res, mime, jakosc));

    let blob = await koduj(typMime, typMime === 'image/jpeg' ? 0.85 : undefined);
    if (blob && blob.size > MAKS_BAJTOW_OBRAZU_AI && typMime === 'image/png') {
      typMime = 'image/jpeg';
      blob = await koduj(typMime, 0.85);
    }
    if (!blob) throw new BladDanych(t('import.nieczytelny'));
    const bajty = new Uint8Array(await blob.arrayBuffer());
    if (bajty.byteLength > MAKS_BAJTOW_OBRAZU_AI) {
      throw new BladDanych(t('ai.zaDuzyObraz'));
    }

    const podgladUrl = URL.createObjectURL(blob);
    return {
      nazwa: plik.name,
      podgladUrl,
      base64: bajtyNaBase64(bajty),
      typMime,
      bajty,
      szerokosc: szer,
      wysokosc: wys,
    };
  } finally {
    URL.revokeObjectURL(zrodloUrl);
  }
}
