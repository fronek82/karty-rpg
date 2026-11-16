import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import type { TypKarty } from '../../pakiety/typy';

const rozmiar = (r: { kolumny: number; rzedy: number; nazwa?: string }) =>
  `${r.nazwa ? `${r.nazwa} ` : ''}${r.kolumny}×${r.rzedy}`;

/**
 * Menu „Dodaj kartę w tym slocie” – typy kart pakietu; wariant (np. sakiewka) jako podwybór.
 * Klawiatura: fokus na pierwszej dostępnej pozycji, strzałki / Home / End, Escape zamyka.
 */
export function MenuTypu({
  typy,
  styl,
  miesciSie,
  wybierz,
  zamknij,
}: {
  typy: TypKarty[];
  styl: React.CSSProperties;
  miesciSie: (typ: TypKarty) => boolean;
  wybierz: (typ: TypKarty, wariant: number) => void;
  zamknij: () => void;
}) {
  const [rozwiniety, ustawRozwiniety] = useState<string>();
  const menu = useRef<HTMLDivElement>(null);
  const pozycje = () =>
    [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])].filter(
      (b) => !b.disabled,
    );
  useEffect(() => pozycje()[0]?.focus(), []);
  if (typy.length === 0) {
    return (
      <div className="menu-typu" role="menu" aria-label={t('kartka.dodajKarte')} style={styl}>
        <p className="podpis">{t('kartka.brakTypow')}</p>
      </div>
    );
  }
  return (
    <div
      ref={menu}
      className="menu-typu"
      role="menu"
      aria-label={t('kartka.dodajKarte')}
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
      <div className="menu-tytul">{t('kartka.dodajKarteTutaj')}</div>
      {typy.map((typ) => {
        const mozna = miesciSie(typ);
        const warianty = typ.warianty.length > 1;
        return (
          <div key={typ.id}>
            <button
              type="button"
              role="menuitem"
              className="menu-pozycja"
              disabled={!mozna}
              title={mozna ? undefined : t('kartka.nieMiesci')}
              aria-haspopup={warianty ? 'menu' : undefined}
              aria-expanded={warianty ? rozwiniety === typ.id : undefined}
              onClick={() =>
                warianty
                  ? ustawRozwiniety(rozwiniety === typ.id ? undefined : typ.id)
                  : wybierz(typ, 0)
              }
            >
              <span>
                <span className="ikona" aria-hidden="true">
                  {typ.ikona}
                </span>{' '}
                {typ.nazwa}
                {warianty && ' ▸'}
              </span>
              <small>{typ.rozmiary.map(rozmiar).join(' · ')}</small>
            </button>
            {warianty && rozwiniety === typ.id && (
              <div className="menu-warianty">
                {typ.warianty.map((w, j) => (
                  <button
                    key={w.szablonId}
                    type="button"
                    role="menuitem"
                    className="menu-pozycja"
                    onClick={() => wybierz(typ, j)}
                  >
                    {w.nazwa}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
