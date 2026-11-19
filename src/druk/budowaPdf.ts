import type { ElementOzdobny } from '../ozdobniki/typy';
import type { Arkusz } from '../model/arkusz';
import type { Mm } from '../model/jednostki';
import type { Szablon, Talia, WariantCzcionki } from '../model/szablon';
import { RejestrCzcionek, wczytajCzcionke } from '../silnik/czcionki';
import type { InformacjaOObrazie } from '../silnik/karta';
import { przesunScene, stronaTestowa, zbudujArkusz, zSzarymiObrazami } from './arkusz';
import { scenyDoPdf } from './pdf';

/** Plik czcionki z przypisaniem do rodziny – do odtworzenia rejestru poza wątkiem głównym. */
export interface PlikCzcionki {
  id: string;
  rodzina: string;
  wariant: WariantCzcionki;
  dane: Uint8Array;
}

export interface ObrazDoPdf {
  id: string;
  info: InformacjaOObrazie;
  dane: Uint8Array;
  format: 'png' | 'jpg';
}

/** Wszystko, czego potrzeba do PDF arkuszy – dane klonowalne (postMessage do workera). */
export interface ZadaniePdf {
  tytul: string;
  dopisekKontynuacji?: string;
  arkusze: Arkusz[];
  talie: Talia[];
  szablony: Szablon[];
  czcionki: PlikCzcionki[];
  role: Record<string, string>;
  zapasowa?: string;
  obrazy: ObrazDoPdf[];
  /** Własne elementy biblioteki ozdobników projektu (dane klonowalne). */
  elementy?: ElementOzdobny[];
  /** Kalibracja drukarki: przesunięcie zawartości stron (mm, + w prawo / w dół). */
  przesuniecie?: { x: Mm; y: Mm };
  /** Wydruk testowy tej kartki (obrysy slotów z numerami) zamiast kart. */
  testowy?: string;
}

/** Buduje arkusze i PDF (w workerze albo – awaryjnie – w wątku głównym). */
export async function zbudujPdf(z: ZadaniePdf): Promise<Uint8Array> {
  const rejestr = new RejestrCzcionek();
  for (const c of z.czcionki) {
    try {
      rejestr.dodaj(c.rodzina, c.wariant, wczytajCzcionke(c.id, c.dane));
    } catch {
      // Uszkodzona czcionka – jak w podglądzie: zastąpi ją czcionka zapasowa.
    }
  }
  for (const [rola, rodzina] of Object.entries(z.role)) rejestr.przypiszRole(rola, rodzina);
  rejestr.ustawZapasowa(z.zapasowa);
  const szablony = new Map(z.szablony.map((s) => [s.id, s]));
  const obrazy = new Map(z.obrazy.map((o) => [o.id, o]));
  const ctx = {
    czcionki: rejestr,
    szablony,
    ...(z.przesuniecie ? { kalibracja: z.przesuniecie } : {}),
    ...(z.dopisekKontynuacji ? { dopisekKontynuacji: z.dopisekKontynuacji } : {}),
    obraz: (id: string) => obrazy.get(id)?.info,
    ...(z.elementy ? { elementy: z.elementy } : {}),
  };
  const testowa = z.testowy ? z.arkusze.find((a) => a.id === z.testowy) : undefined;
  if (z.testowy && !testowa) throw new Error(`kartka ${z.testowy}`);
  const taliaKartki = (a: Arkusz) => {
    const t = z.talie.find((x) => x.id === a.taliaId);
    if (!t) throw new Error(`talia ${a.taliaId}`);
    return t;
  };
  const sceny = (
    testowa
      ? [stronaTestowa(testowa, taliaKartki(testowa), ctx)]
      : z.arkusze.flatMap((a) => {
          const strony = zbudujArkusz(a, taliaKartki(a), ctx).strony;
          return a.ustawienia.czarnoBialy ? strony.map(zSzarymiObrazami) : strony;
        })
  ).map((s) => (z.przesuniecie ? przesunScene(s, z.przesuniecie) : s));
  const { bajty } = await scenyDoPdf(sceny, {
    tytul: z.tytul,
    obraz: (id) => {
      const o = obrazy.get(id);
      return o ? { dane: o.dane, format: o.format } : undefined;
    },
  });
  return bajty;
}
