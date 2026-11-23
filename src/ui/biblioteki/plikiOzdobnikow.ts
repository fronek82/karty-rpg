import { LIMITY_ARCHIWUM, spakujOzdobnik } from '../../dane/archiwum';
import { noweIdElementu, ramka9Domyslna } from '../../dane/biblioteka';
import { opisObrazu } from '../../dane/obrazy';
import { BladDanych } from '../../dane/schemat';
import { t, type KluczTekstu } from '../../i18n';
import {
  BladImportuSvg,
  importujSvg,
  LIMITY_SVG,
  LIMITY_XML,
  type ElementOzdobny,
} from '../../ozdobniki';
import { przygotujObraz } from '../obrazyUI';

/** Nazwa pliku bez rozszerzenia (nazwa elementu biblioteki). */
export const bezRozszerzenia = (n: string) => n.replace(/\.[^.]+$/, '');

/** Czytelny powód odrzucenia pliku SVG (limity, niedozwolona treść). */
export function opisBleduSvg(e: unknown): string {
  return e instanceof BladImportuSvg
    ? t(`biblioteka.blad.${e.kod}`, {
        szczegoly: e.szczegol
          ? t(e.szczegol.klucz as KluczTekstu, e.szczegol.parametry)
          : e.message,
        limit: LIMITY_SVG.bajty / 1024,
        limitElementow: LIMITY_XML.elementy,
        limitGlebokosci: LIMITY_XML.glebokosc,
        limitKsztaltow: LIMITY_SVG.ksztalty,
        limitKomend: LIMITY_SVG.komendy,
      })
    : String(e instanceof Error ? e.message : e);
}

const czySvg = (f: File) => /\.svg$/i.test(f.name) || f.type === 'image/svg+xml';
const czyPng = (f: File) => /\.png$/i.test(f.name) || f.type === 'image/png';

/**
 * Paczka ozdobnika z pliku dodawanego wprost do biblioteki w przeglądarce (N7):
 * SVG – element z rodzajem rozpoznanym przy imporcie (kolor jednolity), PNG – ramka 9-slice
 * z wcięciami po trzecim, `.kartyrpg-ozdobnik` – bez zmian. Rodzaj i wcięcia zmienia się
 * w bibliotece ozdobników projektu.
 */
export async function paczkaOzdobnikaZPliku(f: File): Promise<Uint8Array> {
  if (f.size > LIMITY_ARCHIWUM.suma)
    throw new BladDanych(
      t('dane.zaDuzy', { plik: f.name, mb: LIMITY_ARCHIWUM.suma / (1024 * 1024) }),
    );
  const bajty = new Uint8Array(await f.arrayBuffer());
  const nazwa = bezRozszerzenia(f.name);
  const id = noweIdElementu(nazwa, { biblioteka: { ozdobniki: [] } });
  if (czySvg(f)) {
    let wynik;
    try {
      wynik = importujSvg(bajty);
    } catch (e) {
      throw new BladDanych(t('biblioteka.import.blad', { plik: f.name, powod: opisBleduSvg(e) }));
    }
    const element: ElementOzdobny = {
      ...wynik.element,
      id,
      nazwa,
      kolorowanie: wynik.element.kolorowanie ?? 'jednolity',
      ...(wynik.element.rodzaj === 'ramka9'
        ? { ramka9: ramka9Domyslna({ typ: 'svg' }, wynik.element.szer, wynik.element.wys) }
        : {}),
    };
    return spakujOzdobnik(element);
  }
  if (czyPng(f)) {
    const { dane, ...wymiary } = await przygotujObraz(bajty);
    const opis = opisObrazu(f.name, dane, wymiary, new Set());
    const element: ElementOzdobny = {
      id,
      nazwa,
      rodzaj: 'ramka9',
      szer: opis.szerokosc,
      wys: opis.wysokosc,
      kontury: [],
      ramka9: ramka9Domyslna({ typ: 'obraz', zasob: opis.id }, opis.szerokosc, opis.wysokosc),
    };
    return spakujOzdobnik(element, { opis, dane });
  }
  return bajty;
}
