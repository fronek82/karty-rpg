import type { Arkusz } from '../model/arkusz';
import type { Szablon, Talia, WariantCzcionki } from '../model/szablon';
import { RejestrCzcionek, wczytajCzcionke } from '../silnik/czcionki';
import type { InformacjaOObrazie } from '../silnik/karta';
import { zbudujArkusz, zSzarymiObrazami } from './arkusz';
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
  arkusze: Arkusz[];
  talie: Talia[];
  szablony: Szablon[];
  czcionki: PlikCzcionki[];
  role: Record<string, string>;
  zapasowa?: string;
  obrazy: ObrazDoPdf[];
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
  const sceny = z.arkusze.flatMap((a) => {
    const talia = z.talie.find((x) => x.id === a.taliaId);
    if (!talia) throw new Error(`talia ${a.taliaId}`);
    const strony = zbudujArkusz(a, talia, {
      czcionki: rejestr,
      szablony,
      obraz: (id) => obrazy.get(id)?.info,
    }).strony;
    return a.ustawienia.czarnoBialy ? strony.map(zSzarymiObrazami) : strony;
  });
  const { bajty } = await scenyDoPdf(sceny, {
    tytul: z.tytul,
    obraz: (id) => {
      const o = obrazy.get(id);
      return o ? { dane: o.dane, format: o.format } : undefined;
    },
  });
  return bajty;
}
