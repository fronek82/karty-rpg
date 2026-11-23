import { useId, useState, type ReactNode } from 'react';
import { t } from '../../i18n';
import { rozwinOdstepy, type Odstepy } from '../../model/szablon';
import { PoleLiczby } from '../kartka/PoleLiczby';

/** Zwijana sekcja panelu właściwości. */
export function Sekcja({
  tytul,
  otwarta = false,
  children,
}: {
  tytul: string;
  otwarta?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="sekcja-panelu" open={otwarta}>
      <summary>{tytul}</summary>
      {children}
    </details>
  );
}

/** Przełącznik segmentowy (jedna z opcji). */
export function Przelacznik<T extends string>({
  etykieta,
  opcje,
  wartosc,
  zmien,
}: {
  etykieta: string;
  opcje: readonly { wartosc: T; tekst: string; wylaczona?: boolean }[];
  wartosc: T | undefined;
  zmien: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="pole-panelu">
      <span id={id}>{etykieta}</span>
      <div className="przelacznik-segmentowy" role="group" aria-labelledby={id}>
        {opcje.map((o) => (
          <button
            key={o.wartosc}
            type="button"
            aria-pressed={wartosc === o.wartosc}
            disabled={o.wylaczona}
            onClick={() => zmien(o.wartosc)}
          >
            {o.tekst}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pole wyboru z listy. */
export function Lista<T extends string>({
  etykieta,
  opcje,
  wartosc,
  zmien,
}: {
  etykieta: string;
  opcje: readonly { wartosc: T; tekst: string; wylaczona?: boolean }[];
  wartosc: T;
  zmien: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="pole-panelu">
      <label htmlFor={id}>{etykieta}</label>
      <select
        id={id}
        value={wartosc}
        onChange={(e) => {
          const wybrana = opcje.find((o) => o.wartosc === e.target.value);
          if (wybrana && !wybrana.wylaczona) zmien(wybrana.wartosc);
        }}
      >
        {opcje.map((o) => (
          <option key={o.wartosc} value={o.wartosc} disabled={o.wylaczona}>
            {o.tekst}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Pole tak/nie. */
export function Wybor({
  etykieta,
  wartosc,
  zmien,
}: {
  etykieta: string;
  wartosc: boolean;
  zmien: (v: boolean) => void;
}) {
  return (
    <label className="wiersz-pola">
      <input type="checkbox" checked={wartosc} onChange={(e) => zmien(e.target.checked)} />
      {etykieta}
    </label>
  );
}

/** Kolor z możliwością „brak” (undefined). */
export function PoleKoloru({
  etykieta,
  wartosc,
  zmien,
  moznaBrak = true,
  domyslny = '#000000',
  id: wlasneId,
}: {
  etykieta: string;
  wartosc: string | undefined;
  zmien: (v: string | undefined) => void;
  moznaBrak?: boolean;
  domyslny?: string;
  id?: string;
}) {
  const autoId = useId();
  const id = wlasneId ?? autoId;
  return (
    <div className="pole-panelu pole-koloru">
      <label htmlFor={id}>{etykieta}</label>
      <span className="wiersz-pola">
        {moznaBrak && (
          <input
            type="checkbox"
            aria-label={t('wlasciwosci.wlacz', { pole: etykieta })}
            checked={wartosc !== undefined}
            onChange={(e) => zmien(e.target.checked ? domyslny : undefined)}
          />
        )}
        <input
          id={id}
          type="color"
          value={wartosc ?? domyslny}
          disabled={moznaBrak && wartosc === undefined}
          onChange={(e) => zmien(e.target.value)}
        />
      </span>
    </div>
  );
}

/** Liczba w mm (albo innej jednostce) – pole zsynchronizowane z modelem. */
export function Liczba({
  etykieta,
  wartosc,
  zmien,
  min = 0,
  max = 500,
  krok = 0.5,
}: {
  etykieta: string;
  wartosc: number;
  zmien: (v: number) => void;
  min?: number;
  max?: number;
  krok?: number;
}) {
  const id = useId();
  return (
    <PoleLiczby
      id={id}
      etykieta={etykieta}
      wartosc={wartosc}
      min={min}
      max={max}
      krok={krok}
      zmien={zmien}
    />
  );
}

/**
 * Odstępy z czterech stron (margines, padding): jedna liczba dla wszystkich albo osobno.
 * Zapis: liczba, gdy wszystkie równe – jak w modelu. Tryb „osobno” trzyma się do zamknięcia
 * panelu (pola nie zwijają się w trakcie wpisywania). Zmiana jako funkcja – przy kilku
 * zaznaczonych stosowana do odstępów każdego elementu.
 */
export function PoleOdstepow({
  etykieta,
  wartosc,
  zmien,
  min = 0,
}: {
  etykieta: string;
  wartosc: number | Partial<Odstepy> | undefined;
  zmien: (f: (o: number | Partial<Odstepy> | undefined) => number | Odstepy) => void;
  min?: number;
}) {
  const o = rozwinOdstepy(wartosc);
  const rowne = o.gora === o.prawo && o.gora === o.dol && o.gora === o.lewo;
  const [osobno, ustawOsobno] = useState(!rowne || typeof wartosc === 'object');
  const ustaw = (k: keyof Odstepy, v: number) =>
    zmien((stare) => {
      const n = { ...rozwinOdstepy(stare), [k]: v };
      return n.gora === n.prawo && n.gora === n.dol && n.gora === n.lewo ? n.gora : n;
    });
  return (
    <fieldset className="odstepy">
      <legend>{etykieta}</legend>
      {!osobno ? (
        <div className="dwa-pola">
          <Liczba
            etykieta={t('wlasciwosci.wszystkie')}
            wartosc={o.gora}
            min={min}
            zmien={(v) => zmien(() => v)}
          />
          <button type="button" className="maly" onClick={() => ustawOsobno(true)}>
            {t('wlasciwosci.osobno')}
          </button>
        </div>
      ) : (
        <div className="cztery-pola">
          {(['gora', 'prawo', 'dol', 'lewo'] as const).map((k) => (
            <Liczba
              key={k}
              etykieta={t(`wlasciwosci.strona.${k}`)}
              wartosc={o[k]}
              min={min}
              zmien={(v) => ustaw(k, v)}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}
