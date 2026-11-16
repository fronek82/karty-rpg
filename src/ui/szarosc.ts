import type { ObrazWPamieci } from './zasoby';

/** Piksele RGBA → skala szarości (ta sama luminancja co kolory wektorowe arkusza). W miejscu. */
export function pikseleNaSzarosc(rgba: Uint8ClampedArray): Uint8ClampedArray {
  for (let i = 0; i < rgba.length; i += 4) {
    const v = Math.round(0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!);
    rgba[i] = rgba[i + 1] = rgba[i + 2] = v;
  }
  return rgba;
}

/**
 * Obraz w skali szarości jako PNG (przezroczystość zachowana) – do trybu czarno-białego arkusza.
 * Silnik i PDF dostają gotowy szary plik. Wołający zwalnia `adres` (blob:).
 */
export async function obrazNaSzarosc(o: ObrazWPamieci): Promise<ObrazWPamieci> {
  const typ = o.format === 'png' ? 'image/png' : 'image/jpeg';
  const bitmapa = await createImageBitmap(
    new Blob([o.dane as Uint8Array<ArrayBuffer>], { type: typ }),
  );
  const canvas = document.createElement('canvas');
  canvas.width = bitmapa.width;
  canvas.height = bitmapa.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d');
  ctx.drawImage(bitmapa, 0, 0);
  bitmapa.close();
  const obraz = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pikseleNaSzarosc(obraz.data);
  ctx.putImageData(obraz, 0, 0);
  const blob = await new Promise<Blob>((ok, blad) =>
    canvas.toBlob((b) => (b ? ok(b) : blad(new Error('toBlob'))), 'image/png'),
  );
  return {
    info: o.info,
    dane: new Uint8Array(await blob.arrayBuffer()),
    format: 'png',
    adres: URL.createObjectURL(blob),
  };
}
