import { createContext, useContext, useId, useMemo, useState, type ReactNode } from 'react';
import {
  dodajDoPalety,
  koloryUzyte,
  normalizujKolor,
  usunZPalety,
} from '../../dane/koloryProjektu';
import { t } from '../../i18n';
import type { Kolor } from '../../model/szablon';
import type { ProjektWEdycji } from '../useProjekt';

/** Kolory projektu dostępne przy polach koloru (patrz `docs/plan-N11.md`). */
export interface KoloryProjektu {
  /** Kolory zapisane przez użytkownika (`Projekt.paleta`). */
  zapisane: readonly Kolor[];
  /**
   * Kolory użyte w przodach i tyłach projektu (bez zapisanych). Liczone dopiero przy pierwszym
   * wywołaniu (otwarty panel), a nie przy każdej edycji dokumentu.
   */
  uzyte(): readonly Kolor[];
  zapisz(kolor: string): void;
  usun(kolor: string): void;
}

const Kontekst = createContext<KoloryProjektu | undefined>(undefined);

/** Podaje kolory projektu polom koloru w edytorze (przód i tył karty). */
export function DostawcaKolorowProjektu({
  edycja,
  children,
}: {
  edycja: Pick<ProjektWEdycji, 'projekt' | 'zmien'>;
  children: ReactNode;
}) {
  const { projekt, zmien } = edycja;
  const { szablony, rewersy, paleta } = projekt;
  const wartosc = useMemo<KoloryProjektu>(() => {
    const zapisane = paleta ?? [];
    let uzyte: readonly Kolor[] | undefined;
    return {
      zapisane,
      uzyte: () =>
        (uzyte ??= koloryUzyte({ szablony, rewersy }).filter((k) => !zapisane.includes(k))),
      zapisz: (kolor) => zmien((p) => dodajDoPalety(p, kolor)),
      usun: (kolor) => zmien((p) => usunZPalety(p, kolor)),
    };
  }, [paleta, szablony, rewersy, zmien]);
  return <Kontekst.Provider value={wartosc}>{children}</Kontekst.Provider>;
}

export function useKoloryProjektu(): KoloryProjektu | undefined {
  return useContext(Kontekst);
}

/** Próbka koloru – przycisk ustawiający kolor pola. */
function Probka({ kolor, wybrany, wybierz }: { kolor: Kolor; wybrany: boolean; wybierz(): void }) {
  return (
    <button
      type="button"
      className={`probka-koloru${wybrany ? ' wybrana' : ''}`}
      style={{ background: kolor }}
      title={kolor}
      aria-label={t('kolory.wybierz', { kolor })}
      aria-pressed={wybrany}
      data-kolor={kolor}
      onClick={wybierz}
    />
  );
}

/**
 * Przycisk „Kolory projektu” obok pola koloru i rozwijany pod polem panel z próbkami:
 * zapisane (z usuwaniem) i użyte w projekcie. Bez kontekstu (np. w kreatorze) – nic.
 */
export function useWyborKoloruProjektu({
  etykieta,
  wartosc,
  zmien,
  wylaczone,
}: {
  etykieta: string;
  wartosc: string | undefined;
  zmien: (kolor: string) => void;
  wylaczone?: boolean;
}): { przycisk: ReactNode; panel: ReactNode } {
  const kolory = useKoloryProjektu();
  const [otwarty, ustawOtwarty] = useState(false);
  const idPanelu = useId();
  if (!kolory) return { przycisk: null, panel: null };
  const biezacy = wartosc !== undefined ? normalizujKolor(wartosc) : undefined;
  const przycisk = (
    <button
      type="button"
      className="maly przycisk-kolorow-projektu"
      aria-expanded={otwarty}
      aria-controls={idPanelu}
      aria-label={t('kolory.pokaz', { pole: etykieta })}
      title={t('kolory.tytul')}
      disabled={wylaczone}
      onClick={() => ustawOtwarty((o) => !o)}
    >
      <span aria-hidden="true">🎨</span>
    </button>
  );
  const widoczny = otwarty && !wylaczone;
  const uzyte = widoczny ? kolory.uzyte() : [];
  const panel = widoczny ? (
    <div id={idPanelu} className="kolory-projektu" role="group" aria-label={t('kolory.tytul')}>
      <div className="kolory-projektu-grupa" data-grupa="zapisane">
        <small>{t('kolory.zapisane')}</small>
        {kolory.zapisane.length === 0 ? (
          <small className="podpis">{t('kolory.brakZapisanych')}</small>
        ) : (
          <ul className="probki-kolorow">
            {kolory.zapisane.map((k) => (
              <li key={k}>
                <Probka kolor={k} wybrany={k === biezacy} wybierz={() => zmien(k)} />
                <button
                  type="button"
                  className="usun-probke"
                  aria-label={t('kolory.usun', { kolor: k })}
                  title={t('kolory.usun', { kolor: k })}
                  onClick={() => kolory.usun(k)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {uzyte.length > 0 && (
        <div className="kolory-projektu-grupa" data-grupa="uzyte">
          <small>{t('kolory.uzyte')}</small>
          <ul className="probki-kolorow">
            {uzyte.map((k) => (
              <li key={k}>
                <Probka kolor={k} wybrany={k === biezacy} wybierz={() => zmien(k)} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {biezacy && !kolory.zapisane.includes(biezacy) && (
        <button type="button" className="maly" onClick={() => kolory.zapisz(biezacy)}>
          {t('kolory.zapiszBiezacy')}
        </button>
      )}
    </div>
  ) : null;
  return { przycisk, panel };
}
