import { useEffect, useRef, useState } from 'react';
import { t, type KluczTekstu } from '../../i18n';
import type { FormatObrazu } from '../eksportObrazow';

export type CoPobrac = { rodzaj: 'pdf' } | { rodzaj: 'strony' | 'karty'; format: FormatObrazu };

const POZYCJE: { klucz: KluczTekstu; co: CoPobrac }[] = [
  { klucz: 'pobierz.pdf', co: { rodzaj: 'pdf' } },
  { klucz: 'pobierz.stronyJpg', co: { rodzaj: 'strony', format: 'jpg' } },
  { klucz: 'pobierz.stronyPng', co: { rodzaj: 'strony', format: 'png' } },
  { klucz: 'pobierz.kartyJpg', co: { rodzaj: 'karty', format: 'jpg' } },
  { klucz: 'pobierz.kartyPng', co: { rodzaj: 'karty', format: 'png' } },
];

/**
 * Menu pobierania: PDF, obrazy stron, karty osobno (JPG/PNG 300 dpi). Klawiatura jak menu.
 * W trybie `ui2` (ekran Druk R12): główny przycisk „⤓ Pobierz PDF” + przycisk „▾” obok z listą formatów.
 */
export function MenuPobierz({
  wylaczone,
  pobierz,
  ui2 = false,
}: {
  wylaczone: boolean;
  pobierz: (co: CoPobrac) => void;
  ui2?: boolean;
}) {
  const [otwarte, ustawOtwarte] = useState(false);
  const przycisk = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!otwarte) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const poza = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && e.target !== przycisk.current)
        ustawOtwarte(false);
    };
    window.addEventListener('pointerdown', poza);
    return () => window.removeEventListener('pointerdown', poza);
  }, [otwarte]);
  const zamknij = () => {
    ustawOtwarte(false);
    przycisk.current?.focus();
  };
  const klawisz = (e: React.KeyboardEvent) => {
    const pozycje = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = pozycje.indexOf(document.activeElement as HTMLElement);
    const cel =
      e.key === 'ArrowDown'
        ? pozycje[(i + 1) % pozycje.length]
        : e.key === 'ArrowUp'
          ? pozycje[(i - 1 + pozycje.length) % pozycje.length]
          : e.key === 'Home'
            ? pozycje[0]
            : e.key === 'End'
              ? pozycje.at(-1)
              : undefined;
    if (cel) {
      e.preventDefault();
      cel.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      zamknij();
    }
  };
  return (
    <div className={ui2 ? 'menu-pobierz druk-ui2-pobierz-grupa' : 'menu-pobierz'}>
      {ui2 ? (
        <>
          <button
            type="button"
            className="ui2-przycisk-glowny druk-ui2-pobierz-pdf"
            disabled={wylaczone}
            onClick={() => pobierz({ rodzaj: 'pdf' })}
          >
            {t('druk.pobierzPdf')}
          </button>
          <button
            ref={przycisk}
            type="button"
            className="ui2-przycisk-glowny druk-ui2-pobierz-rozwin"
            disabled={wylaczone}
            aria-label={t('druk.inneFormaty')}
            title={t('druk.inneFormaty')}
            aria-haspopup="menu"
            aria-expanded={otwarte}
            aria-controls={otwarte ? 'menu-pobierz' : undefined}
            onClick={() => ustawOtwarte((x) => !x)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                ustawOtwarte(true);
              }
            }}
          >
            <span aria-hidden="true">▾</span>
          </button>
        </>
      ) : (
        <button
          ref={przycisk}
          type="button"
          className="glowny"
          disabled={wylaczone}
          aria-haspopup="menu"
          aria-expanded={otwarte}
          aria-controls={otwarte ? 'menu-pobierz' : undefined}
          onClick={() => ustawOtwarte((x) => !x)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              ustawOtwarte(true);
            }
          }}
        >
          {t('pobierz.menu')} <span aria-hidden="true">▾</span>
        </button>
      )}
      {otwarte && (
        <div
          ref={menu}
          id="menu-pobierz"
          className={ui2 ? 'menu-typu druk-ui2-pobierz-menu' : 'menu-typu'}
          role="menu"
          aria-label={t('pobierz.menu')}
          onKeyDown={klawisz}
        >
          {POZYCJE.map((p) => (
            <button
              key={p.klucz}
              type="button"
              role="menuitem"
              className="menu-pozycja"
              onClick={() => {
                zamknij();
                pobierz(p.co);
              }}
            >
              {t(p.klucz)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
