import { useCallback, useState, type DragEvent, type ReactNode } from 'react';
import { t } from '../../i18n';
import { PREFIKS_PASKA_BOCZNEGO } from '../../wspolne/ustawienia';
import { IkonaKreskowa } from './Ikony';

export interface PozycjaPaskaBocznego {
  id: string;
  nazwa: string;
  /** Podtytuł pod nazwą w stanie rozwiniętym (i w dymku po „ · ” w stanie zwiniętym). */
  podtytul?: string;
  /** Krótka podpowiedź wyświetlana w dymku obok nazwy w stanie zwiniętym. */
  podpowiedz?: string;
  /** Ścieżka SVG (viewBox 0 0 24 24) albo własny element ikony. */
  ikona: string | ReactNode;
  odznaka?: string;
  aktywna?: boolean;
  wylaczona?: boolean;
  przeciagane?: boolean;
  onKlik?: () => void;
  onPoczatekPrzeciagania?: (e: DragEvent<HTMLButtonElement>) => void;
  onKoniecPrzeciagania?: (e: DragEvent<HTMLButtonElement>) => void;
}

export interface GrupaPaskaBocznego {
  id: string;
  nazwa?: string;
  /** Dodatkowy element pod tytułem grupy w stanie rozwiniętym (np. wyszukiwarka). */
  naglowekDodatkowy?: ReactNode;
  pozycje: readonly PozycjaPaskaBocznego[];
}

export interface PasekBocznyProps {
  /** Identyfikator ekranu do zapamiętania stanu rozwinięcia w localStorage (np. 'edytor', 'karty'). */
  ekranId: string;
  /** Etykieta nawigacji (`aria-label`) i tytuł nagłówka w stanie rozwiniętym. */
  tytul: string;
  /** Opcjonalny element po prawej stronie nagłówka w stanie rozwiniętym (np. licznik sztuk w druku). */
  naglowekPrawa?: ReactNode;
  grupy: readonly GrupaPaskaBocznego[];
  /** Krótka wskazówka na dole listy w stanie rozwiniętym. */
  wskazowka?: string;
  /** Domyślny stan przy pierwszym otwarciu (brak wpisu w localStorage). */
  domyslnieRozwiniety?: boolean;
  /** Strona paska: lewy (domyślnie, dymki po prawej) lub prawy (dymki po lewej). */
  strona?: 'lewy' | 'prawy';
  /** Dodatkowa zawartość pod grupami (np. gdy ekran renderuje własne kafelki). */
  dzieci?: ReactNode;
  /** Opcjonalny render zawartości zależny od stanu rozwinięcia (np. lista kart w druku). */
  renderujTresc?: (rozwiniety: boolean) => ReactNode;
}

function odczytajStanPaska(ekranId: string, domyslny: boolean): boolean {
  try {
    const v = window.localStorage.getItem(`${PREFIKS_PASKA_BOCZNEGO}${ekranId}`);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    // Brak dostępu do localStorage (np. tryb prywatny) – zostaje domyślny.
  }
  return domyslny;
}

function zapiszStanPaska(ekranId: string, rozwiniety: boolean): void {
  try {
    window.localStorage.setItem(`${PREFIKS_PASKA_BOCZNEGO}${ekranId}`, rozwiniety ? '1' : '0');
  } catch {
    // Best-effort.
  }
}

/**
 * Wspólny wąski pasek boczny (sekcja 4.2 planu UI2):
 * - zwinięty (60 px, same ikony + dymek DOM po 0,5 s) lub rozwinięty (224 px, ikony + nazwy + grupy),
 * - nagłówek o wysokości paska narzędzi obok (42 px z linią),
 * - przycisk zwijania na dole o wysokości paska stanu (44 px z linią),
 * - stan zapamiętywany w localStorage osobno dla każdego ekranu.
 */
export function PasekBoczny({
  ekranId,
  tytul,
  naglowekPrawa,
  grupy,
  wskazowka,
  domyslnieRozwiniety = false,
  strona = 'lewy',
  dzieci,
  renderujTresc,
}: PasekBocznyProps) {
  const [rozwiniety, ustawRozwiniety] = useState<boolean>(() =>
    odczytajStanPaska(ekranId, domyslnieRozwiniety),
  );

  const przelacz = useCallback(() => {
    ustawRozwiniety((poprzedni) => {
      const nowy = !poprzedni;
      zapiszStanPaska(ekranId, nowy);
      return nowy;
    });
  }, [ekranId]);

  const etykietaPrzelacznika = rozwiniety ? t('ui2.pasek.zwinOpis') : t('ui2.pasek.rozwinOpis');
  const strzalka = strona === 'lewy' ? (rozwiniety ? '«' : '»') : rozwiniety ? '»' : '«';

  return (
    <nav
      aria-label={tytul}
      className={`ui2-pasek-boczny${rozwiniety ? ' rozwiniety' : ''}${strona === 'prawy' ? ' prawy' : ''}`}
      data-stan={rozwiniety ? 'rozwiniety' : 'zwiniety'}
    >
      <div className="ui2-pasek-boczny-naglowek">
        {rozwiniety && (
          <>
            <span className="ui2-pasek-boczny-tytul">{tytul}</span>
            {naglowekPrawa && <span className="ui2-pasek-boczny-prawa">{naglowekPrawa}</span>}
          </>
        )}
      </div>

      <div className="ui2-pasek-boczny-lista">
        {grupy.map((grupa) => (
          <div key={grupa.id} className="ui2-pasek-grupa" data-grupa={grupa.id}>
            {rozwiniety && grupa.nazwa && (
              <span className="ui2-pasek-grupa-tytul">{grupa.nazwa}</span>
            )}
            {rozwiniety && grupa.naglowekDodatkowy}
            {grupa.pozycje.map((poz) => {
              const tekstDymku = poz.podpowiedz
                ? `${poz.nazwa} – ${poz.podpowiedz}`
                : poz.podtytul
                  ? `${poz.nazwa} · ${poz.podtytul}`
                  : poz.nazwa;
              return (
                <button
                  key={poz.id}
                  type="button"
                  disabled={poz.wylaczona}
                  draggable={!poz.wylaczona && poz.przeciagane}
                  onDragStart={poz.onPoczatekPrzeciagania}
                  onDragEnd={poz.onKoniecPrzeciagania}
                  onClick={poz.onKlik}
                  aria-label={poz.nazwa}
                  aria-pressed={poz.aktywna}
                  className={`ui2-pasek-pozycja${!rozwiniety ? ' ui2-ma-dymek' : ''}${poz.aktywna ? ' aktywna' : ''}${poz.podtytul ? ' z-podtytulem' : ''}`}
                >
                  {!rozwiniety && (
                    <span className="ui2-dymek" role="tooltip">
                      {tekstDymku}
                    </span>
                  )}
                  {typeof poz.ikona === 'string' ? (
                    <IkonaKreskowa sciezka={poz.ikona} />
                  ) : (
                    poz.ikona
                  )}
                  {rozwiniety && (
                    <>
                      {poz.podtytul ? (
                        <span className="ui2-pasek-pozycja-tekst">
                          <span className="ui2-pasek-pozycja-nazwa">{poz.nazwa}</span>
                          <span className="ui2-pasek-pozycja-podtytul">{poz.podtytul}</span>
                        </span>
                      ) : (
                        <span className="ui2-pasek-pozycja-nazwa">{poz.nazwa}</span>
                      )}
                      {poz.odznaka && <span className="ui2-pasek-odznaka">{poz.odznaka}</span>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
        {renderujTresc?.(rozwiniety)}
        {dzieci}
        {rozwiniety && wskazowka && <p className="ui2-pasek-wskazowka">{wskazowka}</p>}
      </div>

      <button
        type="button"
        onClick={przelacz}
        aria-label={etykietaPrzelacznika}
        aria-expanded={rozwiniety}
        className={`ui2-pasek-przelacznik${!rozwiniety ? ' ui2-ma-dymek' : ''}`}
      >
        {!rozwiniety && (
          <span className="ui2-dymek" role="tooltip">
            {etykietaPrzelacznika}
          </span>
        )}
        <span className="ui2-pasek-strzalka" aria-hidden="true">
          {strzalka}
        </span>
        {rozwiniety && <span>{t('ui2.pasek.zwin')}</span>}
      </button>
    </nav>
  );
}
