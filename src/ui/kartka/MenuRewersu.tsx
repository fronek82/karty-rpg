import { useEffect, useRef } from 'react';
import { t } from '../../i18n';
import type { PrzypisanieRewersu, Rewers } from '../../model/szablon';
import type { ZapisanyRewersGlobalny } from '../rewersyGlobalne';

/**
 * Menu kontekstowe wyboru rewersu dla pojedynczej karty klikniętej bezpośrednio na stronie rewersów.
 * Zawiera opcję dziedziczenia, „Bez rewersu”, rewersy z bieżącego projektu oraz rewersy ze wszystkich
 * pozostałych projektów i biblioteki globalnej.
 */
export function MenuRewersu({
  rewersyLokalne,
  rewersyGlobalne,
  maNadpisanie,
  styl,
  wybierzLokalny,
  wybierzGlobalny,
  zamknij,
}: {
  rewersyLokalne: readonly Rewers[];
  rewersyGlobalne: readonly ZapisanyRewersGlobalny[];
  maNadpisanie: boolean;
  styl: React.CSSProperties;
  wybierzLokalny: (id: PrzypisanieRewersu | undefined) => void;
  wybierzGlobalny: (wpis: ZapisanyRewersGlobalny) => void;
  zamknij: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const pozycje = () =>
    [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])].filter(
      (b) => !b.disabled,
    );

  useEffect(() => {
    pozycje()[0]?.focus();
  }, []);

  return (
    <div
      ref={menu}
      className="menu-typu"
      role="menu"
      aria-label={t('kartka.wybierzRewersKarty')}
      style={styl}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const lista = pozycje();
        const i = lista.indexOf(document.activeElement as HTMLButtonElement);
        const cel =
          e.key === 'ArrowDown'
            ? lista[(i + 1) % lista.length]
            : e.key === 'ArrowUp'
              ? lista[(i - 1 + lista.length) % lista.length]
              : e.key === 'Home'
                ? lista[0]
                : e.key === 'End'
                  ? lista.at(-1)
                  : undefined;
        if (cel) {
          e.preventDefault();
          cel.focus();
        } else if (e.key === 'Escape' || e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          zamknij();
        }
      }}
    >
      <div className="menu-tytul">{t('kartka.wybierzRewersKarty')}</div>
      {maNadpisanie && (
        <button
          type="button"
          role="menuitem"
          className="menu-pozycja"
          onClick={() => wybierzLokalny(undefined)}
        >
          <span>{t('kartka.dziedziczRewers')}</span>
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        className="menu-pozycja"
        onClick={() => wybierzLokalny(null)}
      >
        <span>{t('rewers.bezRewersu')}</span>
      </button>
      {rewersyLokalne.map((r) => (
        <button
          key={r.id}
          type="button"
          role="menuitem"
          className="menu-pozycja"
          onClick={() => wybierzLokalny(r.id)}
        >
          <span>{r.nazwa}</span>
        </button>
      ))}
      {rewersyGlobalne.length > 0 && (
        <>
          <div className="menu-sekcja">{t('rewersy.globalneGrupa')}</div>
          {rewersyGlobalne.map((w) => (
            <button
              key={w.klucz}
              type="button"
              role="menuitem"
              className="menu-pozycja"
              onClick={() => wybierzGlobalny(w)}
            >
              <span>{w.nazwa}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
