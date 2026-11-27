import { useEffect, useId, useRef, useState } from 'react';
import { JEZYKI, t, ustawJezyk } from '../../i18n';
import { useJezyk } from '../../i18n/react';
import { useMotyw } from '../motyw';
import { ADRES_BIBLIOTEK, adresInstrukcji } from '../NaglowekAplikacji';
import { OknoModalne } from '../OknoModalne';
import {
  ListaProjektow,
  odczytajZakladkeStart,
  zapiszZakladkeStart,
  type ZakladkaStart,
} from './ListaProjektow';
import { OknoNowyProjekt } from './OknoNowyProjekt';
import { OknoNowySzablon } from './OknoNowySzablon';
import { gry } from '../../pakiety/gry';
import { nowyProjektZPakietu } from '../bazaUI';
import { PanelImportu } from './PanelImportu';
import { ADRES_WSPARCIA } from './wsparcie';
import './startRiso.css';

const wersja = import.meta.env.VITE_WERSJA ?? '0.1.0';

/**
 * Strona główna „drukarnia riso” (Plan S, S3, sekcja 5.1):
 * - nagłówek z logo riso, tytułem KARTY RPG oraz przyciskami Biblioteka, Ustawienia, Kopia i import;
 * - lewa kolumna: + NOWE KARTY (nowy projekt), + NOWY SZABLON, Mausritter A4 oraz wsparcie;
 * - środek z równorzędnymi zakładkami „Moje projekty” | „Moje szablony”.
 */
export function Start({
  trescRef,
}: {
  trescRef?: React.RefObject<HTMLElement | null>;
} = {}) {
  const [odswiezenie, ustawOdswiezenie] = useState(0);
  const [zakladka, ustawZakladkeStan] = useState<ZakladkaStart>(odczytajZakladkeStart);
  const [importOtwarty, ustawImportOtwarty] = useState(false);
  const [nowyProjektOtwarty, ustawNowyProjektOtwarty] = useState(false);
  const [nowySzablonOtwarty, ustawNowySzablonOtwarty] = useState(false);
  const [tworzeMausritter, ustawTworzeMausritter] = useState(false);
  const [bladMausritter, ustawBladMausritter] = useState<string>();
  const [ustawieniaOtwarte, ustawUstawieniaOtwarte] = useState(false);
  const ustawZakladke = (z: ZakladkaStart) => {
    ustawZakladkeStan(z);
    zapiszZakladkeStart(z);
  };
  const otworzMausritter = async () => {
    if (tworzeMausritter) return;
    const gra = gry.find((g) => g.id === 'mausritter');
    if (!gra?.pakiet) return;
    ustawTworzeMausritter(true);
    ustawBladMausritter(undefined);
    try {
      const pakiet = await gra.pakiet();
      const id = await nowyProjektZPakietu(pakiet);
      window.location.hash = `#/projekt/${encodeURIComponent(id)}/start`;
    } catch (e) {
      ustawBladMausritter(
        t('start.bladPakietu', { szczegoly: String(e instanceof Error ? e.message : e) }),
      );
    } finally {
      ustawTworzeMausritter(false);
    }
  };
  const opakowanieUstawien = useRef<HTMLDivElement>(null);
  const przyciskUstawien = useRef<HTMLButtonElement>(null);
  const idPaneluUstawien = useId();
  const { motyw, ustaw: ustawMotyw } = useMotyw();
  const jezyk = useJezyk();

  useEffect(() => {
    if (!ustawieniaOtwarte) return;
    const klikPoza = (e: MouseEvent) => {
      if (opakowanieUstawien.current && !opakowanieUstawien.current.contains(e.target as Node)) {
        ustawUstawieniaOtwarte(false);
      }
    };
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        ustawUstawieniaOtwarte(false);
        przyciskUstawien.current?.focus();
      }
    };
    document.addEventListener('mousedown', klikPoza);
    window.addEventListener('keydown', klawisz);
    return () => {
      document.removeEventListener('mousedown', klikPoza);
      window.removeEventListener('keydown', klawisz);
    };
  }, [ustawieniaOtwarte]);

  // Plik upuszczony poza strefą importu nie może zostać otwarty przez przeglądarkę.
  useEffect(() => {
    const blokuj = (e: DragEvent) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
      const wStrefie = e.target instanceof Element && e.target.closest('.strefa-upuszczania');
      if (wStrefie) return;
      e.preventDefault();
      if (e.type === 'dragover') e.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragover', blokuj);
    window.addEventListener('drop', blokuj);
    return () => {
      window.removeEventListener('dragover', blokuj);
      window.removeEventListener('drop', blokuj);
    };
  }, []);

  return (
    <div className="riso-start">
      <header className="riso-naglowek">
        <div className="riso-marka">
          <div className="riso-logo" aria-hidden="true">
            <div className="riso-logo-a" />
            <div className="riso-logo-b" />
          </div>
          <div>
            <div className="riso-podtytul">{t('start.risoPodtytul', { wersja })}</div>
            <div className="riso-tytul">{t('start.risoTytul')}</div>
          </div>
        </div>

        <nav className="riso-nawigacja" aria-label={t('pasek.narzedzia')}>
          <a href={ADRES_BIBLIOTEK} className="riso-przycisk-nav">
            {t('start.biblioteka')}
          </a>

          <div className="ui2-ustawienia-opakowanie" ref={opakowanieUstawien}>
            <button
              ref={przyciskUstawien}
              type="button"
              className="riso-przycisk-nav"
              aria-expanded={ustawieniaOtwarte}
              aria-controls={idPaneluUstawien}
              onClick={() => ustawUstawieniaOtwarte((v) => !v)}
            >
              {t('pasek.ustawienia')}
            </button>
            {ustawieniaOtwarte && (
              <div
                id={idPaneluUstawien}
                className="ui2-ustawienia-panel panel-ustawien"
                role="region"
                aria-label={t('pasek.ustawienia')}
              >
                <div className="ui2-ustawienia-wiersz">
                  <span className="ui2-ustawienia-etykieta">{t('motyw.grupa')}</span>
                  <div className="ui2-segmenty" role="group" aria-label={t('motyw.grupa')}>
                    <button
                      type="button"
                      className="ui2-segment"
                      aria-label={t('motyw.jasny')}
                      aria-pressed={motyw === 'light'}
                      onClick={() => ustawMotyw('light')}
                    >
                      {t('motyw.jasnyKrotki')}
                    </button>
                    <button
                      type="button"
                      className="ui2-segment"
                      aria-label={t('motyw.ciemny')}
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

          <button
            type="button"
            className="riso-przycisk-nav"
            onClick={() => ustawImportOtwarty(true)}
          >
            {t('start.kopiaIImport')}
          </button>
        </nav>
      </header>

      <div className="riso-cialo">
        <aside className="riso-lewa" aria-label={t('start.nowyProjekt')}>
          <button
            type="button"
            className="riso-nowe-karty"
            data-testid="start-nowe-karty"
            onClick={() => ustawNowyProjektOtwarty(true)}
          >
            <span className="riso-nowe-karty-tytul">{t('start.noweKarty')}</span>
            <span className="riso-nowe-karty-opis">{t('start.noweKartyOpis')}</span>
          </button>

          <button
            type="button"
            className="riso-nowy-szablon"
            data-testid="start-nowy-szablon"
            onClick={() => ustawNowySzablonOtwarty(true)}
          >
            <span className="riso-nowy-szablon-tytul">{t('start.nowySzablonBtn')}</span>
            <span className="riso-nowy-szablon-opis">{t('start.nowySzablonOpis')}</span>
          </button>

          <div className="riso-gotowe">
            <span className="riso-etykieta-mono">{t('start.risoGotoweUklady')}</span>
            <button
              type="button"
              className="riso-kafelek-gry"
              data-testid="start-mausritter"
              disabled={tworzeMausritter}
              onClick={() => void otworzMausritter()}
            >
              <span>
                <span className="riso-kafelek-gry-nazwa">{t('start.mausritterTytul')}</span>
                <span className="riso-kafelek-gry-opis">{t('start.mausritterOpis')}</span>
              </span>
              <span className="riso-kafelek-gry-strzalka" aria-hidden="true">
                →
              </span>
            </button>
            {bladMausritter && (
              <p role="alert" className="uwaga">
                {bladMausritter}
              </p>
            )}
          </div>

          {ADRES_WSPARCIA && (
            <a
              href={ADRES_WSPARCIA}
              target="_blank"
              rel="noopener noreferrer"
              className="riso-kawa"
              aria-label={t('start.wsparcieEtykieta')}
            >
              <span className="riso-kawa-tytul">{t('start.kawaTytul')}</span>
              <span className="riso-kawa-opis">{t('start.kawaOpis')}</span>
            </a>
          )}
        </aside>

        <main ref={trescRef} id="tresc-aplikacji" tabIndex={-1} className="riso-glowna">
          <ListaProjektow
            odswiezenie={odswiezenie}
            zakladka={zakladka}
            onZmienZakladke={ustawZakladke}
          />
        </main>
      </div>

      {importOtwarty && (
        <OknoModalne tytul={t('start.kopiaIImportTytul')} zamknij={() => ustawImportOtwarty(false)}>
          <PanelImportu onZmiana={() => ustawOdswiezenie((n) => n + 1)} />
        </OknoModalne>
      )}

      {nowyProjektOtwarty && (
        <OknoNowyProjekt
          zamknij={() => ustawNowyProjektOtwarty(false)}
          onOtworzNowySzablon={() => ustawNowySzablonOtwarty(true)}
        />
      )}

      {nowySzablonOtwarty && (
        <OknoNowySzablon
          zamknij={() => ustawNowySzablonOtwarty(false)}
          onUtworzono={(wynik) => {
            ustawOdswiezenie((n) => n + 1);
            ustawZakladke('szablony');
            window.location.hash = `#/szablon/${encodeURIComponent(wynik.id)}`;
          }}
        />
      )}
    </div>
  );
}
