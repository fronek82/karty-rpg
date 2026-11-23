import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';

/** Treść paska: tekst i opcjonalna akcja (np. „Cofnij”). */
export interface Komunikat {
  tekst: string;
  akcja?: { etykieta: string; wykonaj: () => void };
}

/** Domyślny czas widoczności paska (ms). */
export const CZAS_PASKA = 8000;

/**
 * Pasek z komunikatem na dole ekranu, wyśrodkowany (wspólny dla całej aplikacji). Znika po
 * `czas` ms; licznik stoi, gdy kursor jest nad paskiem albo fokus jest w środku (klawiatura).
 * Akcja zamyka pasek. Nowy komunikat = nowy `key` u rodzica (licznik od początku).
 */
export function PasekKomunikatu({
  komunikat,
  zamknij,
  czas = CZAS_PASKA,
}: {
  komunikat: Komunikat;
  zamknij: () => void;
  czas?: number;
}) {
  const [wstrzymany, ustawWstrzymany] = useState({ mysz: false, fokus: false });
  const pozostalo = useRef(czas);
  const zamknijRef = useRef(zamknij);
  useEffect(() => {
    zamknijRef.current = zamknij;
  }, [zamknij]);
  const stoi = wstrzymany.mysz || wstrzymany.fokus;

  useEffect(() => {
    if (stoi) return;
    const start = Date.now();
    const id = window.setTimeout(() => zamknijRef.current(), pozostalo.current);
    return () => {
      window.clearTimeout(id);
      pozostalo.current = Math.max(0, pozostalo.current - (Date.now() - start));
    };
  }, [stoi]);

  return createPortal(
    <div
      className="pasek-komunikatu"
      role="status"
      aria-live="polite"
      data-testid="pasek-komunikatu"
      // Tylko mysz: po dotknięciu `pointerleave` często nie przychodzi i pasek by „zamarzł”.
      onPointerEnter={(e) =>
        e.pointerType !== 'touch' && ustawWstrzymany((w) => ({ ...w, mysz: true }))
      }
      onPointerLeave={() => ustawWstrzymany((w) => ({ ...w, mysz: false }))}
      onFocus={() => ustawWstrzymany((w) => ({ ...w, fokus: true }))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          ustawWstrzymany((w) => ({ ...w, fokus: false }));
      }}
      onKeyDown={(e) => e.key === 'Escape' && zamknij()}
    >
      <span>{komunikat.tekst}</span>
      {komunikat.akcja && (
        <>
          <span aria-hidden="true">—</span>
          <button
            type="button"
            className="akcja-paska"
            onClick={() => {
              komunikat.akcja!.wykonaj();
              zamknij();
            }}
          >
            {komunikat.akcja.etykieta}
          </button>
        </>
      )}
      <button
        type="button"
        className="zamknij-pasek"
        aria-label={t('pasek.zamknij')}
        onClick={zamknij}
      >
        ×
      </button>
    </div>,
    document.body,
  );
}

/**
 * Stan jednego paska komunikatu: `pokaz` zastępuje bieżący komunikat nowym (z nowym licznikiem),
 * `pasek` trzeba wyrenderować w komponencie.
 */
export function usePasekKomunikatu(): {
  pasek: ReactNode;
  pokaz: (k: Komunikat) => void;
  ukryj: () => void;
} {
  const [stan, ustawStan] = useState<{ numer: number; komunikat: Komunikat }>();
  const pokaz = useCallback(
    (komunikat: Komunikat) => ustawStan((s) => ({ numer: (s?.numer ?? 0) + 1, komunikat })),
    [],
  );
  const ukryj = useCallback(() => ustawStan(undefined), []);
  const pasek = stan ? (
    <PasekKomunikatu key={stan.numer} komunikat={stan.komunikat} zamknij={ukryj} />
  ) : null;
  return { pasek, pokaz, ukryj };
}
