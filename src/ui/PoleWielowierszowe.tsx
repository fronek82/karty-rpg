import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';

const KLUCZ_STORAGE = 'karty-rpg:wysokosc-pol';
const MIN_WYSOKOSC_PX = 40;
const MAKS_WYSOKOSC_PX = 800;

let pamiec: Map<string, number> | null = null;

function zaladuj(): Map<string, number> {
  if (pamiec) return pamiec;
  const mapa = new Map<string, number>();
  try {
    const surowy = globalThis.localStorage?.getItem(KLUCZ_STORAGE);
    if (surowy) {
      const dane = JSON.parse(surowy) as unknown;
      if (dane && typeof dane === 'object' && !Array.isArray(dane)) {
        for (const [k, v] of Object.entries(dane as Record<string, unknown>)) {
          if (typeof v === 'number' && Number.isFinite(v)) {
            mapa.set(k, Math.min(MAKS_WYSOKOSC_PX, Math.max(MIN_WYSOKOSC_PX, Math.round(v))));
          }
        }
      }
    }
  } catch {
    // Tryb prywatny lub uszkodzony wpis w localStorage – działamy na pamięci sesji.
  }
  pamiec = mapa;
  return mapa;
}

/** Odczytuje zapamiętaną wysokość pola tekstowego (w px) dla podanego klucza. */
export function odczytajWysokoscPola(klucz: string): number | undefined {
  return zaladuj().get(klucz);
}

/** Zapisuje wysokość pola tekstowego ustawioną przez użytkownika (w px). */
export function zapiszWysokoscPola(klucz: string, wysokoscPx: number): void {
  if (!Number.isFinite(wysokoscPx)) return;
  const zaokr = Math.min(MAKS_WYSOKOSC_PX, Math.max(MIN_WYSOKOSC_PX, Math.round(wysokoscPx)));
  const mapa = zaladuj();
  if (mapa.get(klucz) === zaokr) return;
  mapa.set(klucz, zaokr);
  try {
    globalThis.localStorage?.setItem(KLUCZ_STORAGE, JSON.stringify(Object.fromEntries(mapa)));
  } catch {
    // Brak miejsca lub zablokowane localStorage – wysokość zostaje w pamięci bieżącej sesji.
  }
}

/** Czyści zapamiętane wysokości pól (do testów). */
export function wyczyscWysokosciPol(): void {
  pamiec = new Map();
  try {
    globalThis.localStorage?.removeItem(KLUCZ_STORAGE);
  } catch {
    // ignoruj
  }
}

function aktualnaWysokoscInline(el: HTMLTextAreaElement): number | undefined {
  const inline = el.style.height.trim();
  if (!inline) return undefined;
  const zmierzona = el.getBoundingClientRect().height;
  const parsed = Number.parseFloat(inline);
  const wartosc = zmierzona > 0 ? zmierzona : parsed;
  return Number.isFinite(wartosc) && wartosc > 0 ? wartosc : undefined;
}

/**
 * Wielowierszowe pole tekstowe (`<textarea>`), które zapamiętuje ręcznie rozciągniętą wysokość
 * przy przełączaniu kart oraz elementów w edytorze szablonu.
 */
export function PoleWielowierszowe({
  kluczRozmiaru,
  style,
  onPointerUp,
  onMouseUp,
  ...reszta
}: ComponentPropsWithoutRef<'textarea'> & { kluczRozmiaru: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const zapamietana = odczytajWysokoscPola(kluczRozmiaru);
  const zewnetrznaWysokosc = style?.height;

  const utrwal = () => {
    const el = ref.current;
    if (!el) return;
    const h = aktualnaWysokoscInline(el);
    if (h === undefined) return;
    zapiszWysokoscPola(kluczRozmiaru, h);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Przy zmianie klucza na tym samym zamontowanym polu jawnie przywróć lub wyczyść wysokość DOM,
    // zanim ResizeObserver odczyta bieżący rozmiar – zapobiega to nadpisaniu nowego klucza starą wysokością.
    const docelowa =
      zewnetrznaWysokosc !== undefined
        ? typeof zewnetrznaWysokosc === 'number'
          ? `${zewnetrznaWysokosc}px`
          : zewnetrznaWysokosc
        : zapamietana !== undefined
          ? `${zapamietana}px`
          : '';
    if (el.style.height !== docelowa) el.style.height = docelowa;

    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => {
      const h = aktualnaWysokoscInline(el);
      if (h !== undefined) zapiszWysokoscPola(kluczRozmiaru, h);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [kluczRozmiaru, zapamietana, zewnetrznaWysokosc]);

  return (
    <textarea
      ref={ref}
      style={{
        ...(zapamietana !== undefined ? { height: `${zapamietana}px` } : {}),
        ...style,
      }}
      onPointerUp={(e) => {
        utrwal();
        onPointerUp?.(e);
      }}
      onMouseUp={(e) => {
        utrwal();
        onMouseUp?.(e);
      }}
      {...reszta}
    />
  );
}
