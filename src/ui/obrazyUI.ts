import { formatObrazu } from '../dane/czcionki';
import {
  MAKS_PIKSELI,
  MAKS_BAJTOW_OBRAZU,
  macierzOrientacji,
  orientacjaExif,
  wymiaryJpeg,
  wymiaryPoObrocie,
} from '../dane/obrazy';
import { BladDanych } from '../dane/schemat';
import { formatujLiczbe, t } from '../i18n';

export interface PrzygotowanyObraz {
  dane: Uint8Array;
  /** Wymiary w pikselach (0, gdy przeglądarka nie odczyta pliku – opis obrazu go odrzuci). */
  szerokosc: number;
  wysokosc: number;
}

/** Odrzuca zbyt duży plik przed odczytem jego bajtów. */
export async function przygotujPlikObrazu(plik: File): Promise<PrzygotowanyObraz> {
  if (plik.size > MAKS_BAJTOW_OBRAZU)
    throw new BladDanych(
      t('dane.zaDuzy', { plik: plik.name, mb: formatujLiczbe(plik.size / 1024 / 1024, 1) }),
    );
  return przygotujObraz(new Uint8Array(await plik.arrayBuffer()));
}

/** Współczynnik zmniejszenia (≤ 1), by obraz mieścił się w limicie powierzchni kanwy. */
export const wspolczynnikSkali = (szer: number, wys: number, maks = MAKS_PIKSELI): number =>
  szer * wys > maks ? Math.sqrt(maks / (szer * wys)) : 1;

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
    // Obraz w limicie i bez obrotu zostaje bez zmian; zbyt duży (także PNG / JPEG bez EXIF) jest zmniejszany.
    if (orientacja === 1 && wspolczynnikSkali(bitmapa.width, bitmapa.height) === 1)
      return { dane, szerokosc: bitmapa.width, wysokosc: bitmapa.height };

    // Czy przeglądarka mimo „none” obróciła już piksele (wymiary zamienione względem SOF)?
    const sof = wymiaryJpeg(dane);
    const juzObrocona =
      orientacja >= 5 &&
      !!sof &&
      sof.szerokosc !== sof.wysokosc &&
      bitmapa.width === sof.wysokosc &&
      bitmapa.height === sof.szerokosc;
    const o = juzObrocona ? 1 : orientacja;
    const k = wspolczynnikSkali(bitmapa.width, bitmapa.height);
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
    const blob = await new Promise<Blob | null>((ok) =>
      kanwa.toBlob(ok, format === 'png' && orientacja === 1 ? 'image/png' : 'image/jpeg', 0.92),
    );
    // Bez przekodowania obraz w PDF byłby nieobrócony i zniekształcony – lepiej jasny błąd.
    if (!blob) throw new BladDanych(t('dane.bladObrotu'));
    return { dane: new Uint8Array(await blob.arrayBuffer()), ...wynik };
  } finally {
    bitmapa.close();
  }
}
