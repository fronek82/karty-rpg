import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { JEZYKI, t, ustawJezyk } from '../../i18n';
import { useJezyk } from '../../i18n/react';
import { useMotyw } from '../motyw';
import { adresInstrukcji } from '../NaglowekAplikacji';
import { IkonaCofnij, IkonaPonow, IkonaUstawien } from './Ikony';

export type KrokProjektu = 'szablony' | 'karty' | 'druk' | 'mausritter';
export type StanZapisuUi2 = 'zapisano' | 'zapisywanie' | 'niezapisane';

export interface DefinicjaKroku {
  id: KrokProjektu;
  numer: number;
  etykieta: string;
  href: string;
}

export interface NaglowekProjektuProps {
  nazwaProjektu: string;
  aktywnyKrok: KrokProjektu;
  kroki: readonly DefinicjaKroku[];
  mausritter?: boolean;
  hrefPowrotu?: string;
  /** Etykieta przycisku powrotu (domyślnie „← Projekty”). */
  etykietaPowrotu?: string;
  /** Dopisek pod nazwą (np. informacja o kopiach szablonu w projektach). */
  podtytul?: string;
  onNawiguj?: (e: MouseEvent, href: string) => void;
  mozeCofnac?: boolean;
  mozePonowic?: boolean;
  onCofnij?: () => void;
  onPonow?: () => void;
  stanZapisu?: StanZapisuUi2;
  /** Kliknięcie przycisku „● Zapisz” przy niezapisanych zmianach (R10 11.1). */
  onZapisz?: () => void;
  tytulZapisu?: string;
  /** Opcjonalna edycja nazwy bezpośrednio w nagłówku (np. nazwa szablonu w edytorze). */
  edycjaNazwy?: {
    wartosc: string;
    etykieta: string;
    onChange: (wartosc: string) => void;
  };
  /** Dodatkowy element przed statusem zapisu (np. menu „Szablon ▾” w edytorze). */
  dodatkowe?: ReactNode;
  /** Główny przycisk kroku (np. „Przejdź do kart →”, „Do druku →”, „⤓ Pobierz PDF”). */
  akcjaGlowna?:
    | {
        etykieta: string;
        href?: string;
        onClick?: () => void;
        wylaczony?: boolean;
      }
    | ReactNode;
}

/**
 * Wspólny nagłówek wszystkich ekranów projektu (edytor, karty, druk, Mausritter) – sekcja 4.1 planu UI2.
 * Bez przycisku „Biblioteka” (decyzja D8).
 */
export function NaglowekProjektu({
  nazwaProjektu,
  aktywnyKrok,
  kroki,
  mausritter = false,
  hrefPowrotu = '#/',
  etykietaPowrotu,
  podtytul,
  onNawiguj,
  mozeCofnac = false,
  mozePonowic = false,
  onCofnij,
  onPonow,
  stanZapisu = 'zapisano',
  onZapisz,
  tytulZapisu,
  edycjaNazwy,
  dodatkowe,
  akcjaGlowna,
}: NaglowekProjektuProps) {
  const { motyw, ustaw: ustawMotyw } = useMotyw();
  const jezyk = useJezyk();
  const [ustawieniaOtwarte, ustawUstawieniaOtwarte] = useState(false);
  const opakowanieUstawien = useRef<HTMLDivElement>(null);
  const przyciskUstawien = useRef<HTMLButtonElement>(null);
  const idPaneluUstawien = useId();

  useEffect(() => {
    if (!ustawieniaOtwarte) return;
    const klikPoza = (e: globalThis.MouseEvent) => {
      if (opakowanieUstawien.current && !opakowanieUstawien.current.contains(e.target as Node)) {
        ustawUstawieniaOtwarte(false);
      }
    };
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        ustawUstawieniaOtwarte(false);
        przyciskUstawien.current?.focus();
      }
    };
    document.addEventListener('mousedown', klikPoza);
    window.addEventListener('keydown', klawisz, true);
    return () => {
      document.removeEventListener('mousedown', klikPoza);
      window.removeEventListener('keydown', klawisz, true);
    };
  }, [ustawieniaOtwarte]);

  const tekstStanu =
    stanZapisu === 'zapisywanie'
      ? t('ui2.stan.zapisywanie')
      : stanZapisu === 'niezapisane'
        ? t('ui2.stan.niezapisane')
        : t('ui2.stan.zapisano');

  return (
    <header className="ui2-naglowek">
      <a
        href={hrefPowrotu}
        className="ui2-naglowek-powrot"
        onClick={(e) => onNawiguj?.(e, hrefPowrotu)}
      >
        {etykietaPowrotu ?? t('ui2.projektyPowrot')}
      </a>
      <div className="ui2-naglowek-tytul-grupa">
        {edycjaNazwy ? (
          <input
            className="ui2-naglowek-nazwa-input nazwa-projektu"
            title={edycjaNazwy.wartosc}
            aria-label={edycjaNazwy.etykieta}
            value={edycjaNazwy.wartosc}
            onChange={(e) => edycjaNazwy.onChange(e.target.value)}
          />
        ) : (
          <span className="ui2-naglowek-nazwa" title={nazwaProjektu}>
            {nazwaProjektu}
          </span>
        )}
        {podtytul && (
          <span className="ui2-naglowek-podtytul" data-testid="naglowek-dopisek-kopii">
            {podtytul}
          </span>
        )}
      </div>
      {mausritter && <span className="ui2-etykieta-mausritter">{t('ui2.mausritterEtykieta')}</span>}

      {kroki.length > 0 && (
        <nav aria-label={t('ui2.etapyProjektu')} className="ui2-kroki">
          {kroki.map((krok, idx) => {
            const aktywny = krok.id === aktywnyKrok;
            return (
              <span key={krok.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {idx > 0 && (
                  <span className="ui2-krok-strzalka" aria-hidden="true">
                    →
                  </span>
                )}
                {aktywny ? (
                  <span aria-current="page" className="ui2-krok ui2-krok-aktywny">
                    <span className="ui2-krok-numer">{krok.numer}</span>
                    {krok.etykieta}
                  </span>
                ) : (
                  <a
                    href={krok.href}
                    className="ui2-krok"
                    onClick={(e) => onNawiguj?.(e, krok.href)}
                  >
                    <span className="ui2-krok-numer">{krok.numer}</span>
                    {krok.etykieta}
                  </a>
                )}
              </span>
            );
          })}
        </nav>
      )}

      <div className="ui2-naglowek-prawa">
        <button
          type="button"
          className="ui2-przycisk-ikona"
          aria-label={t('ui2.cofnij')}
          title={t('ui2.cofnijSkrot')}
          disabled={!mozeCofnac}
          onClick={onCofnij}
        >
          <IkonaCofnij />
        </button>
        <button
          type="button"
          className="ui2-przycisk-ikona"
          aria-label={t('ui2.ponow')}
          title={t('ui2.ponowSkrot')}
          disabled={!mozePonowic}
          onClick={onPonow}
        >
          <IkonaPonow />
        </button>

        <span className="ui2-separator-pionowy" aria-hidden="true" />

        <div className="ui2-ustawienia-opakowanie" ref={opakowanieUstawien}>
          <button
            ref={przyciskUstawien}
            type="button"
            className="ui2-przycisk-ikona"
            aria-label={t('pasek.ustawienia')}
            title={t('ui2.ustawieniaOpis')}
            aria-expanded={ustawieniaOtwarte}
            aria-controls={idPaneluUstawien}
            onClick={() => ustawUstawieniaOtwarte((v) => !v)}
          >
            <IkonaUstawien />
          </button>
          {ustawieniaOtwarte && (
            <div id={idPaneluUstawien} className="ui2-ustawienia-panel" role="region">
              <div className="ui2-ustawienia-wiersz">
                <span className="ui2-ustawienia-etykieta">{t('motyw.grupa')}</span>
                <div className="ui2-segmenty" role="group" aria-label={t('motyw.grupa')}>
                  <button
                    type="button"
                    className="ui2-segment"
                    aria-pressed={motyw === 'light'}
                    onClick={() => ustawMotyw('light')}
                  >
                    {t('motyw.jasnyKrotki')}
                  </button>
                  <button
                    type="button"
                    className="ui2-segment"
                    aria-pressed={motyw === 'dark'}
                    onClick={() => ustawMotyw('dark')}
                  >
                    {t('motyw.ciemnyKrotki')}
                  </button>
                </div>
              </div>
              <div className="ui2-ustawienia-wiersz">
                <span className="ui2-ustawienia-etykieta">{t('jezyk.grupa')}</span>
                <div className="ui2-segmenty" role="group" aria-label={t('jezyk.grupa')}>
                  {JEZYKI.map((kod) => (
                    <button
                      key={kod}
                      type="button"
                      lang={kod}
                      className="ui2-segment"
                      aria-pressed={jezyk === kod}
                      onClick={() => ustawJezyk(kod)}
                    >
                      {kod === 'pl' ? t('jezyk.pl') : t('jezyk.en')}
                    </button>
                  ))}
                </div>
              </div>
              <a
                className="ui2-ustawienia-link"
                href={adresInstrukcji(jezyk)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('pasek.instrukcja')} ↗
              </a>
            </div>
          )}
        </div>

        {dodatkowe}

        {onZapisz && stanZapisu === 'niezapisane' ? (
          <button
            type="button"
            className="ui2-stan-zapisu-btn"
            title={tytulZapisu ?? t('projekt.zapiszPodpowiedz')}
            onClick={onZapisz}
          >
            <span className="ui2-stan-zapisu-kropka" aria-hidden="true" />
            {t('projekt.zapisz')}
          </button>
        ) : (
          <span className="ui2-stan-zapisu" role="status" aria-live="polite">
            {tekstStanu}
          </span>
        )}

        {akcjaGlowna &&
          (typeof akcjaGlowna === 'object' && akcjaGlowna !== null && 'etykieta' in akcjaGlowna ? (
            akcjaGlowna.href && !akcjaGlowna.wylaczony ? (
              <a
                href={akcjaGlowna.href}
                className="ui2-przycisk-glowny"
                onClick={(e) => {
                  akcjaGlowna.onClick?.();
                  onNawiguj?.(e, akcjaGlowna.href!);
                }}
              >
                {akcjaGlowna.etykieta}
              </a>
            ) : (
              <button
                type="button"
                className="ui2-przycisk-glowny"
                disabled={akcjaGlowna.wylaczony}
                onClick={akcjaGlowna.onClick}
              >
                {akcjaGlowna.etykieta}
              </button>
            )
          ) : (
            akcjaGlowna
          ))}
      </div>
    </header>
  );
}
