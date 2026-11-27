import type { ReactNode } from 'react';

export interface PanelSekcjiProps {
  tytul: string;
  podtytul?: string;
  etykietaAria?: string;
  /** Opcjonalne akcje po prawej stronie nagłówka panelu (np. Duplikuj / Usuń). */
  akcjeNaglowka?: ReactNode;
  children: ReactNode;
  /** Opcjonalna dolna część panelu (np. przesuwana Struktura w edytorze). */
  stopka?: ReactNode;
}

/**
 * Prawy panel z nagłówkiem wyrównanym do paska roboczego (42 px z linią)
 * i przewijaną listą zwijanych sekcji (sekcja 4.3 planu UI2).
 */
export function PanelSekcji({
  tytul,
  podtytul,
  etykietaAria,
  akcjeNaglowka,
  children,
  stopka,
}: PanelSekcjiProps) {
  return (
    <aside aria-label={etykietaAria ?? tytul} className="ui2-panel-sekcji">
      <div className="ui2-panel-naglowek">
        <h2 className="ui2-panel-tytul" style={{ margin: 0 }}>
          {tytul}
        </h2>
        {podtytul && <span className="ui2-panel-podtytul">{podtytul}</span>}
        {akcjeNaglowka && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            {akcjeNaglowka}
          </div>
        )}
      </div>
      <div className="ui2-panel-tresc">{children}</div>
      {stopka}
    </aside>
  );
}

export interface SekcjaPaneluProps {
  tytul: string;
  domyslnieOtwarta?: boolean;
  children: ReactNode;
}

/** Pojedyncza zwijana sekcja w prawym panelu (`<details>` z pogrubionym nagłówkiem i strzałką ▾/▸). */
export function SekcjaPanelu({ tytul, domyslnieOtwarta = true, children }: SekcjaPaneluProps) {
  return (
    <details className="ui2-sekcja" open={domyslnieOtwarta}>
      <summary className="ui2-sekcja-naglowek">
        <span>{tytul}</span>
        <span className="ui2-sekcja-strzalka" aria-hidden="true" />
      </summary>
      <div className="ui2-sekcja-cialo">{children}</div>
    </details>
  );
}
