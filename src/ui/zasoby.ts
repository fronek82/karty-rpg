import type { PlikCzcionki } from '../druk/budowaPdf';
import type { Szablon } from '../model/szablon';
import type { RejestrCzcionek } from '../silnik/czcionki';
import type { InformacjaOObrazie } from '../silnik/karta';

/**
 * Zasoby projektu w przeglądarce dla silnika i PDF: rejestr czcionek (z bajtami do workera),
 * szablony i obrazy z adresami do podglądu.
 */

export interface ObrazWPamieci {
  info: InformacjaOObrazie;
  dane: Uint8Array;
  format: 'png' | 'jpg';
  /** Adres do podglądu SVG: `data:` w pakiecie wbudowanym, `blob:` w projektach (zwalniany). */
  adres: string;
}

export interface ZasobyPakietu {
  czcionki: RejestrCzcionek;
  /** Bajty czcionek i role – do budowy PDF w workerze (rejestru fontkit nie da się przesłać). */
  plikiCzcionek: PlikCzcionki[];
  role: Record<string, string>;
  zapasowa?: string;
  szablony: Map<string, Szablon>;
  obrazy: Map<string, ObrazWPamieci>;
}
