// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as PointerReact } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pole, Szablon } from '../../model/szablon';
import { useGestSwobodny } from './useGestSwobodny';

const ik = (id: string, x: number): Pole =>
  ({
    id,
    typ: 'ikona',
    ikona: 'gwiazdka',
    rozmiar: 4,
    szerokosc: { mm: 10 },
    wysokosc: { mm: 10 },
    pozycja: { x, y: 3 },
  }) as Pole;
const szablon: Szablon = {
  id: 's',
  nazwa: 'S',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  korzen: { id: 'k', typ: 'swobodny', dzieci: [ik('a', 3), ik('b', 30)] },
};
// Układ jak z silnika (jsdom nie ładuje czcionek testowych): korzeń i dwa pola 10 × 10 mm.
const prost = (id: string, x: number, y: number, szer: number, wys: number) => ({
  id,
  x,
  y,
  szer,
  wys,
  lokalne: { x, y, szer, wys },
});
const wezly = [prost('k', 0, 0, 63, 88), prost('a', 3, 3, 10, 10), prost('b', 30, 3, 10, 10)];

/** Zdarzenie wskaźnika: 8 px na mm (karta 504 px szerokości). */
const zd = (o: Partial<Record<string, unknown>> = {}) =>
  ({
    button: 0,
    buttons: 1,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'mouse',
    clientX: 0,
    clientY: 0,
    altKey: false,
    shiftKey: false,
    stopPropagation: () => undefined,
    ...o,
  }) as unknown as PointerReact;
const mm = (x: number, y: number) => ({ clientX: x * 8, clientY: y * 8 });

let klatki: (() => void)[];
beforeEach(() => {
  klatki = [];
  vi.stubGlobal('requestAnimationFrame', (f: () => void) => klatki.push(f));
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => vi.unstubAllGlobals());
const klatka = () => act(() => klatki.splice(0).forEach((f) => f()));

function uchwyt(zaznaczone: string[] = ['a']) {
  const el = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 504, height: 704 }),
    focus: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  };
  const ustawTmp = vi.fn();
  const zatwierdz = vi.fn();
  const ustawZazn = vi.fn();
  const w = renderHook(() =>
    useGestSwobodny({
      szablon,
      wezly,
      zaznaczone,
      ustawZazn,
      karta: { current: el as unknown as HTMLElement },
      szerMm: 63,
      przyciaganie: { siatka: 0.5, obiekty: false },
      ustawTmp,
      zatwierdz,
    }),
  );
  return { w, el, ustawTmp, zatwierdz, ustawZazn };
}

describe('useGestSwobodny', () => {
  it('przeciągnięcie: stan tymczasowy na klatkę, zapis dopiero na pointerup (jeden zapis)', () => {
    const { w, ustawTmp, zatwierdz } = uchwyt();
    act(() => w.result.current.onPointerDown(zd(mm(8, 8))));
    act(() => w.result.current.onPointerMove(zd(mm(18, 8))));
    // Ruch czeka na klatkę: jeszcze nic nie pokazano.
    expect(ustawTmp).not.toHaveBeenCalled();
    klatka();
    expect(ustawTmp).toHaveBeenCalledTimes(1);
    expect(zatwierdz).not.toHaveBeenCalled();
    act(() => w.result.current.onPointerUp(zd(mm(18, 8))));
    expect(zatwierdz).toHaveBeenCalledTimes(1);
    expect([...zatwierdz.mock.calls[0]![0].values()][0].pozycja.x).toBe(13);
  });

  it('ruch poniżej 3 px to klik: bez zapisu', () => {
    const { w, zatwierdz } = uchwyt();
    act(() => w.result.current.onPointerDown(zd(mm(8, 8))));
    act(() => w.result.current.onPointerMove(zd({ clientX: 64 + 2, clientY: 64 })));
    klatka();
    act(() => w.result.current.onPointerUp(zd({ clientX: 66, clientY: 64 })));
    expect(zatwierdz).not.toHaveBeenCalled();
  });

  it('pointercancel, utrata przechwytu i ruch bez wciśniętego przycisku anulują gest bez zapisu', () => {
    for (const przerwij of [
      (h: ReturnType<typeof uchwyt>['w']) => h.result.current.onPointerCancel(zd()),
      (h: ReturnType<typeof uchwyt>['w']) => h.result.current.onLostPointerCapture(zd()),
      (h: ReturnType<typeof uchwyt>['w']) => h.result.current.onPointerMove(zd({ buttons: 0 })),
    ]) {
      const { w, ustawTmp, zatwierdz } = uchwyt();
      act(() => w.result.current.onPointerDown(zd(mm(8, 8))));
      act(() => w.result.current.onPointerMove(zd(mm(18, 8))));
      klatka();
      act(() => przerwij(w));
      expect(w.result.current.aktywny()).toBe(false);
      expect(ustawTmp).toHaveBeenLastCalledWith(undefined);
      act(() => w.result.current.onPointerUp(zd(mm(18, 8))));
      expect(zatwierdz).not.toHaveBeenCalled();
    }
  });

  it('anuluj() zwalnia przechwyt; nowy pointerdown w trakcie gestu jest ignorowany', () => {
    const { w, el, ustawZazn } = uchwyt();
    act(() => w.result.current.onPointerDown(zd(mm(8, 8))));
    act(() => w.result.current.onPointerDown(zd({ ...mm(35, 8), pointerId: 2 })));
    expect(ustawZazn).not.toHaveBeenCalled();
    expect(w.result.current.anuluj()).toBe(true);
    expect(el.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(w.result.current.anuluj()).toBe(false);
    // Wskaźnik niegłówny nie zaczyna gestu.
    act(() => w.result.current.onPointerDown(zd({ ...mm(8, 8), isPrimary: false })));
    expect(w.result.current.aktywny()).toBe(false);
  });

  it('start gestu: element zaznacza się i przechwytuje wskaźnik, punkt poza kartą to tło', () => {
    const { w, el } = uchwyt([]);
    // Korzeń jest największy; trafiamy w element „b”, którego nie ma w zaznaczeniu: zaznacza się i jest celem.
    act(() => w.result.current.onPointerDown(zd(mm(34, 8))));
    expect(el.setPointerCapture).toHaveBeenCalled();
    // Punkt poza kartą: nic nie trafiono i nie jest to tło – gest nie startuje bez celów.
    const inny = uchwyt([]);
    act(() => inny.w.result.current.onPointerDown(zd({ clientX: 5000, clientY: 5000 })));
    expect(inny.w.result.current.aktywny()).toBe(true);
  });

  it('zwężenie: klik bez ruchu w jeden z kilku zaznaczonych zostawia tylko jego', () => {
    const { w, ustawZazn } = uchwyt(['a', 'b']);
    act(() => w.result.current.onPointerDown(zd(mm(8, 8))));
    act(() => w.result.current.onPointerUp(zd(mm(8, 8))));
    expect(ustawZazn).toHaveBeenCalledWith(['a']);
  });
});
