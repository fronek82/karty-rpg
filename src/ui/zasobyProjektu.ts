import { rejestrZProjektu } from '../dane/pakiet';
import type { DaneZasobow, Projekt } from '../model/projekt';
import type { ObrazWPamieci, ZasobyPakietu } from './zasoby';

export interface ZasobyProjektu {
  zasoby: ZasobyPakietu;
  /** Ostrzeżenia (np. uszkodzona czcionka) – projekt i tak się otwiera. */
  ostrzezenia: string[];
  /** Zwalnia adresy `blob:` obrazów – wołać, gdy zasoby przestają być używane. */
  zwolnij(): void;
}

/**
 * Zasoby projektu do silnika i podglądu: rejestr czcionek z biblioteki i obrazy z adresami
 * `blob:` (bez kopii base64 w pamięci i w każdym SVG strony).
 */
export function zasobyProjektu(projekt: Projekt, dane: DaneZasobow): ZasobyProjektu {
  const { rejestr, ostrzezenia } = rejestrZProjektu(projekt, dane);
  // Brak czcionki (np. rola bez rodziny po usunięciu pliku) nie przerywa podglądu ani PDF.
  const rodziny = rejestr.nazwyRodzin;
  const tresc = projekt.role.tresc;
  const zapasowa = tresc && rodziny.includes(tresc) ? tresc : rodziny[0];
  rejestr.ustawZapasowa(zapasowa);
  const plikiCzcionek = projekt.zasoby.flatMap((o) => {
    const d = o.rodzaj === 'czcionka' ? dane.get(o.id) : undefined;
    return o.rodzaj === 'czcionka' && d
      ? [{ id: o.id, rodzina: o.rodzina, wariant: o.wariant, dane: d }]
      : [];
  });
  const obrazy = new Map<string, ObrazWPamieci>();
  const adresy: string[] = [];
  for (const opis of projekt.zasoby) {
    if (opis.rodzaj !== 'obraz') continue;
    const bajty = dane.get(opis.id);
    if (!bajty) continue;
    const typ = opis.format === 'png' ? 'image/png' : 'image/jpeg';
    const adres = URL.createObjectURL(new Blob([bajty as Uint8Array<ArrayBuffer>], { type: typ }));
    adresy.push(adres);
    obrazy.set(opis.id, {
      info: { szerokosc: opis.szerokosc, wysokosc: opis.wysokosc },
      dane: bajty,
      format: opis.format,
      adres,
    });
  }
  return {
    zasoby: {
      czcionki: rejestr,
      plikiCzcionek,
      role: projekt.role,
      ...(zapasowa !== undefined ? { zapasowa } : {}),
      szablony: new Map(projekt.szablony.map((s) => [s.id, s])),
      obrazy,
    },
    ostrzezenia,
    zwolnij: () => adresy.forEach((a) => URL.revokeObjectURL(a)),
  };
}
