import { czyDwustronnyWlaczony } from '../dane/rewers';
import type { ElementOzdobny } from '../ozdobniki/typy';
import type { Arkusz } from '../model/arkusz';
import type { Mm } from '../model/jednostki';
import type { Rewers, Szablon, Talia, WariantCzcionki } from '../model/szablon';
import { RejestrCzcionek, wczytajCzcionke } from '../silnik/czcionki';
import type { InformacjaOObrazie } from '../silnik/karta';
import { przesunScene, stronaTestowa, zbudujArkusz, zSzarymiObrazami } from './arkusz';
import {
  przeplecStronyDwustronne,
  pustaStrona,
  stronyTestoweDwustronne,
  zbudujStronyRewersow,
} from './dwustronny';
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
  /** Współdzielone rewersy projektu (dla arkuszy z włączonym drukiem dwustronnym). */
  rewersy?: Rewers[];
  czcionki: PlikCzcionki[];
  role: Record<string, string>;
  zapasowa?: string;
  obrazy: ObrazDoPdf[];
  /** Własne elementy biblioteki ozdobników projektu (dane klonowalne). */
  elementy?: ElementOzdobny[];
  /** Kalibracja drukarki: przesunięcie zawartości stron przodu (mm, + w prawo / w dół). */
  przesuniecie?: { x: Mm; y: Mm };
  /** Osobna korekta przesunięcia dla stron rewersów (mm, + w prawo / w dół). */
  przesuniecieRewersu?: { x: Mm; y: Mm };
  /** Wydruk testowy tej kartki (obrysy slotów z numerami) zamiast kart. */
  testowy?: string;
  /** Dwustronny wydruk próbny tej kartki (2 strony: przód + lustrzany tył z korektą X/Y). */
  testowyDwustronny?: string;
  /** Etykiety stron na dwustronnym wydruku próbnym (z bieżącego języka UI). */
  etykietyTestowe?: { przod: string; tyl: string };
  /** Dodaje opcjonalną niewidoczną warstwę tekstową (`3 Tr`) do wyszukiwania w PDF. */
  warstwaTekstowa?: boolean;
}

/** Buduje listę scen stron PDF z uwzględnieniem druku dwustronnego, kalibracji przodu/tyłu i wydruku próbnego. */
export function scenyZadaniaPdf(z: ZadaniePdf) {
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
  const rewersy = new Map((z.rewersy ?? []).map((r) => [r.id, r]));
  const ctx = {
    czcionki: rejestr,
    szablony,
    ...(z.przesuniecie ? { kalibracja: z.przesuniecie } : {}),
    ...(z.dopisekKontynuacji ? { dopisekKontynuacji: z.dopisekKontynuacji } : {}),
    obraz: (id: string) => obrazy.get(id)?.info,
    ...(z.elementy ? { elementy: z.elementy } : {}),
  };
  const taliaKartki = (a: Arkusz) => {
    const t = z.talie.find((x) => x.id === a.taliaId);
    if (!t) throw new Error(`talia ${a.taliaId}`);
    return t;
  };
  const przesunPrzod = <T extends Parameters<typeof przesunScene>[0]>(s: T) =>
    z.przesuniecie ? przesunScene(s, z.przesuniecie) : s;
  const przesunTyl = <T extends Parameters<typeof przesunScene>[0]>(s: T) =>
    z.przesuniecieRewersu ? przesunScene(s, z.przesuniecieRewersu) : s;

  if (z.testowyDwustronny) {
    const ark = z.arkusze.find((a) => a.id === z.testowyDwustronny);
    if (!ark) throw new Error(`kartka ${z.testowyDwustronny}`);
    const [przod, tyl] = stronyTestoweDwustronne(ark, taliaKartki(ark), ctx, z.etykietyTestowe);
    return [przesunPrzod(przod), przesunTyl(tyl)];
  }
  if (z.testowy) {
    const testowa = z.arkusze.find((a) => a.id === z.testowy);
    if (!testowa) throw new Error(`kartka ${z.testowy}`);
    return [przesunPrzod(stronaTestowa(testowa, taliaKartki(testowa), ctx))];
  }
  const dwustronnyArkusza = (a: Arkusz) =>
    czyDwustronnyWlaczony(a, taliaKartki(a), szablony, rewersy);
  const jestDwustronny = z.arkusze.some(dwustronnyArkusza);
  return z.arkusze.flatMap((a) => {
    const talia = taliaKartki(a);
    const wynik = zbudujArkusz(a, talia, ctx);
    const przody = (
      a.ustawienia.czarnoBialy ? wynik.strony.map(zSzarymiObrazami) : wynik.strony
    ).map(przesunPrzod);
    if (!jestDwustronny) return przody;
    const tyly = dwustronnyArkusza(a)
      ? zbudujStronyRewersow(a, talia, wynik, { ...ctx, rewersy }).strony.map((s) =>
          przesunTyl(a.ustawienia.czarnoBialy ? zSzarymiObrazami(s) : s),
        )
      : przody.map((p) => pustaStrona({ szer: p.szer, wys: p.wys }));
    return przeplecStronyDwustronne(przody, tyly);
  });
}

/** Buduje arkusze i PDF (w workerze albo – awaryjnie – w wątku głównym). */
export async function zbudujPdf(z: ZadaniePdf): Promise<Uint8Array> {
  const obrazy = new Map(z.obrazy.map((o) => [o.id, o]));
  const sceny = scenyZadaniaPdf(z);
  const { bajty } = await scenyDoPdf(sceny, {
    tytul: z.tytul,
    ...(z.warstwaTekstowa ? { warstwaTekstowa: true } : {}),
    obraz: (id) => {
      const o = obrazy.get(id);
      return o ? { dane: o.dane, format: o.format } : undefined;
    },
  });
  return bajty;
}
