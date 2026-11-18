import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as PointerReact,
  type RefObject,
} from 'react';
import { rodzicWezla } from '../../dane/szablon';
import type { Mm } from '../../model/jednostki';
import type { Szablon } from '../../model/szablon';
import { przygotujUpuszczenie, type CelUpuszczenia } from './upuszczanie';
import {
  budujCele,
  celSkalowania,
  ograniczDoRodzica,
  KROK_STRZALKI,
  KROK_STRZALKI_DUZY,
  przesunCele,
  PROG_PRZYCIAGANIA_PX,
  trafionyWezel,
  zmienRozmiar,
  zmienRozmiarGrupy,
  type Cel,
  type Prowadnica,
  type Uchwyt,
  type WezlyKarty,
  type ZmianaPola,
} from './swobodnyMysz';

/** Ustawienia przyciągania wybrane przez użytkownika (Alt przy przeciąganiu wyłącza oba). */
export interface UstawieniaPrzyciagania {
  /** Krok siatki w mm; 0 = bez siatki. */
  siatka: Mm;
  obiekty: boolean;
}

/** To, co nakładka rysuje w trakcie gestu: prowadnice, podpowiedź, siatka. */
export interface StanGestu {
  rodzaj: 'przesun' | 'rozmiar';
  prowadnice: Prowadnica[];
  upuszczenie?: CelUpuszczenia;
  podpowiedz?: { x: Mm; y: Mm; szer?: Mm; wys?: Mm };
  /** Skala podglądu (px na mm) w chwili rozpoczęcia gestu. */
  skala: number;
  /** Położenie kursora w mm od rogu karty (do podpowiedzi). */
  kursor: { x: Mm; y: Mm };
  /** Początek siatki (róg wnętrza kontenera, mm) – siatka rysowana tylko w trakcie gestu. */
  poczatekSiatki: { x: Mm; y: Mm };
}

type Aktywny =
  | {
      rodzaj: 'przesun';
      pointerId: number;
      start: { x: number; y: number };
      skala: number;
      cele: Cel[];
      celPodKursorem?: (kursor: { x: Mm; y: Mm }) => CelUpuszczenia | undefined;
      upuszczenie?: CelUpuszczenia;
      ruszono: boolean;
      /** Klik bez ruchu w jeden z kilku zaznaczonych zawęża zaznaczenie do niego. */
      zwezDo?: string;
      /** Klik bez ruchu w tło (poza elementami) zdejmuje zaznaczenie. */
      tlo: boolean;
      ostatnie?: Map<string, ZmianaPola>;
    }
  | {
      rodzaj: 'rozmiar';
      pointerId: number;
      start: { x: number; y: number };
      skala: number;
      cel: Cel;
      cele: Cel[];
      szablon: Szablon;
      uchwyt: Uchwyt;
      ruszono: boolean;
      ostatnie?: Map<string, ZmianaPola>;
    };

/** Dopóki kursor nie oddali się o tyle pikseli, klik nie zamienia się w przeciąganie (żadnego kroku „Cofnij”). */
const PROG_RUCHU_PX = 3;

const jestPotomkiem = (szablon: Szablon, id: string, przodek: string): boolean => {
  for (let r = rodzicWezla(szablon, id); r; r = rodzicWezla(szablon, r.rodzic.id))
    if (r.rodzic.id === przodek) return true;
  return false;
};

/**
 * Gesty myszy i strzałek w podglądzie karty: przeciąganie pól kontenera swobodnego, uchwyty rozmiaru,
 * przyciąganie i prowadnice. W trakcie gestu zmiany są stanem tymczasowym (`ustawTmp`) – niczego nie
 * zapisują; dopiero `pointerup` wywołuje `zatwierdz` (jeden krok „Cofnij” na gest).
 */
export function useGestSwobodny({
  szablon,
  wezly,
  zaznaczone,
  ustawZazn,
  karta,
  szerMm,
  przyciaganie,
  ustawTmp,
  zatwierdz,
  upusc,
}: {
  szablon: Szablon | undefined;
  wezly: WezlyKarty | undefined;
  zaznaczone: readonly string[];
  ustawZazn: (ids: string[]) => void;
  karta: RefObject<HTMLElement | null>;
  szerMm: Mm;
  przyciaganie: UstawieniaPrzyciagania;
  ustawTmp: (z: Map<string, ZmianaPola> | undefined) => void;
  /** Zapis zmian w projekcie; `klucz` scala serię (np. wciśnięty klawisz strzałki) w jeden krok „Cofnij”. */
  upusc?: (cel: CelUpuszczenia) => void;
  zatwierdz: (zmiany: Map<string, ZmianaPola>, klucz?: string) => void;
}) {
  const aktywny = useRef<Aktywny | undefined>(undefined);
  const [stan, ustawStan] = useState<StanGestu | undefined>();

  const przyc = (alt: boolean, skala: number) => ({
    siatka: przyciaganie.siatka,
    obiekty: przyciaganie.obiekty,
    prog: PROG_PRZYCIAGANIA_PX / skala,
    wylacz: alt,
  });
  /** Skala podglądu (px na mm) i punkt zdarzenia w mm od rogu karty. */
  const pomiar = (e: { clientX: number; clientY: number }) => {
    const r = karta.current!.getBoundingClientRect();
    const skala = r.width / szerMm;
    return { skala, x: (e.clientX - r.left) / skala, y: (e.clientY - r.top) / skala };
  };
  /** Ostatnie zdarzenie ruchu czeka na klatkę (jedna aktualizacja na klatkę). */
  const oczekujacy = useRef<
    | { pointerId: number; clientX: number; clientY: number; altKey: boolean; shiftKey: boolean }
    | undefined
  >(undefined);
  const klatka = useRef<number | undefined>(undefined);
  const ostatniaMapa = useRef<Map<string, ZmianaPola> | undefined>(undefined);
  const przerwijKlatke = () => {
    if (klatka.current !== undefined) cancelAnimationFrame(klatka.current);
    klatka.current = undefined;
    oczekujacy.current = undefined;
  };
  // Odmontowanie w trakcie gestu: zwalniamy oczekującą klatkę.
  useEffect(() => przerwijKlatke, []);
  const rowne = (x: Map<string, ZmianaPola> | undefined, y: Map<string, ZmianaPola>) =>
    !!x && JSON.stringify([...x]) === JSON.stringify([...y]);

  /** Liczy i pokazuje stan tymczasowy dla ruchu myszy (z klatki albo przed zwolnieniem przycisku). */
  const ruch = (z: NonNullable<typeof oczekujacy.current>) => {
    const a = aktywny.current;
    if (!a || a.pointerId !== z.pointerId) return;
    const dpx = { x: z.clientX - a.start.x, y: z.clientY - a.start.y };
    if (!a.ruszono && Math.hypot(dpx.x, dpx.y) < PROG_RUCHU_PX) return;
    if (a.rodzaj === 'przesun' && a.cele.length === 0 && !a.celPodKursorem) return;
    a.ruszono = true;
    const dx = dpx.x / a.skala;
    const dy = dpx.y / a.skala;
    const kursor = pomiar(z);
    if (a.rodzaj === 'przesun' && a.celPodKursorem) {
      a.upuszczenie = a.celPodKursorem(kursor);
      if (a.upuszczenie || !a.cele.length) {
        a.ostatnie = undefined;
        if (ostatniaMapa.current) ustawTmp(undefined);
        ostatniaMapa.current = undefined;
        ustawStan(
          a.upuszczenie
            ? {
                rodzaj: 'przesun',
                skala: a.skala,
                prowadnice: [],
                kursor,
                poczatekSiatki: a.upuszczenie.ramka,
                upuszczenie: a.upuszczenie,
              }
            : undefined,
        );
        return;
      }
    }
    const w =
      a.rodzaj === 'przesun'
        ? przesunCele(a.cele, dx, dy, przyc(z.altKey, a.skala))
        : a.cele.length > 1
          ? zmienRozmiarGrupy(
              a.szablon,
              a.cele,
              a.cel,
              a.uchwyt,
              dx,
              dy,
              przyc(z.altKey, a.skala),
              z.shiftKey,
            )
          : zmienRozmiar(a.cel, a.uchwyt, dx, dy, przyc(z.altKey, a.skala), z.shiftKey);
    a.ostatnie = w.zmiany;
    // Ta sama mapa zmian (np. ruch w obrębie kroku siatki) – bez ponownego rysowania karty.
    if (!rowne(ostatniaMapa.current, w.zmiany)) {
      ostatniaMapa.current = w.zmiany;
      ustawTmp(w.zmiany);
    }
    const pierwszy = a.rodzaj === 'przesun' ? a.cele[0]! : a.cel;
    ustawStan({
      rodzaj: a.rodzaj,
      skala: a.skala,
      prowadnice: w.prowadnice,
      ...(w.podpowiedz ? { podpowiedz: w.podpowiedz } : {}),
      kursor: { x: kursor.x, y: kursor.y },
      poczatekSiatki: { x: pierwszy.ramka.x, y: pierwszy.ramka.y },
    });
  };
  const sprzatnij = () => {
    const a = aktywny.current;
    aktywny.current = undefined;
    przerwijKlatke();
    ostatniaMapa.current = undefined;
    if (a) {
      try {
        karta.current?.releasePointerCapture?.(a.pointerId);
      } catch {
        // Przechwyt już zwolniony.
      }
    }
    ustawTmp(undefined);
    ustawStan(undefined);
  };
  const zakoncz = (e: PointerReact, zapisz: boolean) => {
    const a = aktywny.current;
    if (!a || a.pointerId !== e.pointerId) return;
    // Przy zmianie kontenera o celu decyduje miejsce puszczenia wskaźnika.
    if (zapisz && a.rodzaj === 'przesun' && a.celPodKursorem) ruch(e);
    else if (zapisz && oczekujacy.current) ruch(oczekujacy.current);
    const ostatnie = a.ostatnie;
    const ruszono = a.ruszono;
    sprzatnij();
    if (zapisz && a.rodzaj === 'przesun' && a.upuszczenie) upusc?.(a.upuszczenie);
    else if (zapisz && ruszono && ostatnie) zatwierdz(ostatnie);
    else if (zapisz && !ruszono && a.rodzaj === 'przesun') {
      if (a.zwezDo) ustawZazn([a.zwezDo]);
      else if (a.tlo && !e.shiftKey) ustawZazn([]);
    }
  };

  return {
    stan,
    aktywny: () => !!aktywny.current,
    /** Anuluje trwający gest (Escape) – bez zapisu. */
    anuluj: () => {
      if (!aktywny.current) return false;
      sprzatnij();
      return true;
    },
    onPointerDown: (e: PointerReact) => {
      // Trwający gest (np. drugi palec) i nie-główne wskaźniki nie zaczynają nowego.
      if (e.button !== 0 || !e.isPrimary || aktywny.current || !szablon || !wezly) return;
      const m = pomiar(e);
      karta.current?.focus({ preventScroll: true });
      const trafiony = trafionyWezel(wezly, m.x, m.y);
      let id = trafiony;
      // Punkt w zaznaczonym polu swobodnym, a trafiony jest jego potomkiem (np. tekst w kolumnie):
      // przeciągamy zaznaczone pole, nie jego wnętrze.
      if (id && !e.shiftKey) {
        const wlasciciel = budujCele(szablon, wezly, zaznaczone).find(
          (c) => c.id !== id && jestPotomkiem(szablon, id!, c.id),
        );
        if (wlasciciel) id = wlasciciel.id;
      }
      let wybrane = [...zaznaczone];
      if (id) {
        if (e.shiftKey) {
          wybrane = zaznaczone.includes(id)
            ? zaznaczone.filter((x) => x !== id)
            : [...zaznaczone, id];
          ustawZazn(wybrane);
        } else if (!zaznaczone.includes(id)) {
          wybrane = [id];
          ustawZazn(wybrane);
        }
      }
      const cele =
        id && wybrane.includes(id) ? ograniczDoRodzica(budujCele(szablon, wezly, wybrane), id) : [];
      const celPodKursorem =
        upusc && id && wybrane.length === 1 && wybrane[0] === id && !e.shiftKey
          ? przygotujUpuszczenie(szablon, wezly, id, m)
          : undefined;
      if (cele.length === 0 && id && !celPodKursorem) return;
      aktywny.current = {
        rodzaj: 'przesun',
        pointerId: e.pointerId,
        start: { x: e.clientX, y: e.clientY },
        skala: m.skala,
        cele,
        celPodKursorem,
        ruszono: false,
        // Klik bez ruchu: zawęża zaznaczenie do klikniętego elementu (też gdy przeciągaliśmy
        // zaznaczone pole za jego wnętrze).
        ...(trafiony &&
        !e.shiftKey &&
        zaznaczone.includes(id ?? '') &&
        (zaznaczone.length > 1 || trafiony !== id)
          ? { zwezDo: trafiony }
          : {}),
        tlo: !id,
      };
      karta.current?.setPointerCapture?.(e.pointerId);
    },
    onUchwytDown: (uchwyt: Uchwyt, e: PointerReact) => {
      e.stopPropagation();
      if (e.button !== 0 || !e.isPrimary || aktywny.current || !szablon || !wezly) return;
      const cele = budujCele(szablon, wezly, zaznaczone);
      const cel = cele.length === zaznaczone.length ? celSkalowania(cele) : undefined;
      if (!cel) return;
      karta.current?.focus({ preventScroll: true });
      aktywny.current = {
        rodzaj: 'rozmiar',
        pointerId: e.pointerId,
        start: { x: e.clientX, y: e.clientY },
        skala: pomiar(e).skala,
        cel,
        cele,
        szablon,
        uchwyt,
        ruszono: false,
      };
      karta.current?.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: PointerReact) => {
      const a = aktywny.current;
      if (!a || a.pointerId !== e.pointerId) return;
      // Przycisk puszczony poza oknem / utracony: gest się kończy bez zapisu.
      if (e.buttons === 0 && e.pointerType === 'mouse') {
        sprzatnij();
        return;
      }
      oczekujacy.current = {
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
      };
      if (klatka.current === undefined)
        klatka.current = requestAnimationFrame(() => {
          klatka.current = undefined;
          const z = oczekujacy.current;
          oczekujacy.current = undefined;
          if (z) ruch(z);
        });
    },
    onPointerUp: (e: PointerReact) => zakoncz(e, true),
    onPointerCancel: (e: PointerReact) => zakoncz(e, false),
    /** Utrata przechwytu wskaźnika (inny element, zmiana karty) – anuluje gest bez zapisu. */
    onLostPointerCapture: (e: PointerReact) => {
      if (aktywny.current?.pointerId === e.pointerId) sprzatnij();
    },
    /**
     * Strzałki w podglądzie: zaznaczone pola swobodne o 0,5 mm (Shift – 5 mm). Zwraca, czy obsłużono.
     * Kolejne naciśnięcia scalają się w jeden krok „Cofnij” (klucz zależny od zaznaczenia).
     */
    strzalki: (e: { key: string; shiftKey: boolean }): boolean => {
      const kierunek = KIERUNKI[e.key];
      if (!kierunek || !szablon || !wezly) return false;
      const cele = ograniczDoRodzica(budujCele(szablon, wezly, zaznaczone));
      if (cele.length === 0) return false;
      const krok = e.shiftKey ? KROK_STRZALKI_DUZY : KROK_STRZALKI;
      const w = przesunCele(cele, kierunek[0] * krok, kierunek[1] * krok, {
        siatka: 0,
        obiekty: false,
        prog: 0,
        wylacz: true,
      });
      zatwierdz(w.zmiany, `strzalki:${zaznaczone.join(',')}`);
      return true;
    },
    /** Strzałki na uchwycie: ruchoma krawędź (róg) przesuwa się o 0,5 mm (Shift – 5 mm). */
    strzalkiUchwytu: (uchwyt: Uchwyt, e: { key: string; shiftKey: boolean }): boolean => {
      const kierunek = KIERUNKI[e.key];
      if (!kierunek || !szablon || !wezly) return false;
      const cele = budujCele(szablon, wezly, zaznaczone);
      const cel = cele.length === zaznaczone.length ? celSkalowania(cele) : undefined;
      if (!cel) return false;
      const krok = e.shiftKey ? KROK_STRZALKI_DUZY : KROK_STRZALKI;
      const [dx, dy] = kierunek.map((v) => v * krok) as [number, number];
      const p = { siatka: 0, obiekty: false, prog: 0, wylacz: true };
      const w =
        cele.length > 1
          ? zmienRozmiarGrupy(szablon, cele, cel, uchwyt, dx, dy, p)
          : zmienRozmiar(cel, uchwyt, dx, dy, p);
      zatwierdz(w.zmiany, `rozmiar-klawisz:${zaznaczone.join(',')}:${uchwyt}`);
      return true;
    },
  };
}

const KIERUNKI: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
