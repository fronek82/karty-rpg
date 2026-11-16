import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import type { TypKarty } from '../../pakiety/typy';

const rozmiar = (r: { kolumny: number; rzedy: number; nazwa?: string }) =>
  `${r.nazwa ? `${r.nazwa} ` : ''}${r.kolumny}×${r.rzedy}`;

/** Menu „Dodaj kartę w tym slocie” – typy kart pakietu; wariant (np. sakiewka) jako podwybór. */
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
  const pierwszy = useRef<HTMLButtonElement>(null);
  useEffect(() => pierwszy.current?.focus(), []);
  return (
    <div
      className="menu-typu"
      role="menu"
      aria-label={t('kartka.dodajKarte')}
      style={styl}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          zamknij();
        }
      }}
    >
      <div className="menu-tytul">{t('kartka.dodajKarteTutaj')}</div>
      {typy.map((typ, i) => {
        const mozna = miesciSie(typ);
        const warianty = typ.warianty.length > 1;
        return (
          <div key={typ.id}>
            <button
              ref={i === 0 ? pierwszy : undefined}
              type="button"
              role="menuitem"
              className="menu-pozycja"
              disabled={!mozna}
              title={mozna ? undefined : t('kartka.nieMiesci')}
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
