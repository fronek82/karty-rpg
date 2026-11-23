import { liveQuery } from 'dexie';
import { useEffect, useRef, useState } from 'react';
import { LIMITY_ARCHIWUM, ROZSZERZENIE_OZDOBNIKA } from '../../dane/archiwum';
import type { WpisBibliotekiGlobalnej } from '../../dane/baza';
import { BladDanych } from '../../dane/schemat';
import { t } from '../../i18n';
import { baza, zapiszOzdobnikWBibliotece } from '../bazaUI';
import { nazwaPliku, zapiszPlik } from '../pliki';
import { opisBleduImportu } from '../start/importSzablonu';

/**
 * Globalna biblioteka ozdobników w bibliotece projektu: „Użyj” dodaje kopię do projektu.
 * Zapisane kopie są wspólne dla projektów w tej przeglądarce; podglądy i usuwanie –
 * w „Bibliotekach” (`#/biblioteki/ozdobniki`, N7).
 */
export function BibliotekaGlobalna({
  dodaj,
  zablokowana = false,
}: {
  dodaj: (bajty: Uint8Array, przycisk: HTMLButtonElement) => Promise<void | boolean>;
  zablokowana?: boolean;
}) {
  const [wpisy, ustawWpisy] = useState<WpisBibliotekiGlobalnej[]>();
  const [otwarta, ustawOtwarta] = useState(false);
  const [zajeta, ustawZajeta] = useState(false);
  const [bladOdczytu, ustawBladOdczytu] = useState('');
  const [blad, ustawBlad] = useState('');
  const [status, ustawStatus] = useState('');
  const plik = useRef<HTMLInputElement>(null);
  const trwa = useRef(false);
  const rodzaj = 'ozdobnik';
  const rozszerzenie = ROZSZERZENIE_OZDOBNIKA;
  useEffect(() => {
    if (!otwarta) return;
    const subskrypcja = liveQuery(() => baza().bibliotekaGlobalna(rodzaj)).subscribe({
      next: ustawWpisy,
      error: (e) => ustawBladOdczytu(opisBleduImportu(e)),
    });
    return () => subskrypcja.unsubscribe();
  }, [otwarta]);

  const wykonaj = async (f: () => Promise<string | undefined>) => {
    if (trwa.current || zablokowana) return;
    trwa.current = true;
    ustawZajeta(true);
    ustawBlad('');
    ustawStatus('');
    try {
      ustawStatus((await f()) ?? '');
    } catch (e) {
      ustawBlad(opisBleduImportu(e));
    } finally {
      trwa.current = false;
      ustawZajeta(false);
    }
  };

  const importuj = async (f: File) => {
    if (f.size > LIMITY_ARCHIWUM.suma) {
      throw new BladDanych(
        t('dane.zaDuzy', { plik: f.name, mb: LIMITY_ARCHIWUM.suma / (1024 * 1024) }),
      );
    }
    const bajty = new Uint8Array(await f.arrayBuffer());
    return t('globalna.zapisano', { nazwa: await zapiszOzdobnikWBibliotece(bajty) });
  };

  return (
    <details className="biblioteka-globalna" onToggle={(e) => ustawOtwarta(e.currentTarget.open)}>
      <summary>{t('globalna.ozdobnik')}</summary>
      <p className="podpis">
        {t('globalna.opis')} <a href="#/biblioteki/ozdobniki">{t('biblioteki.zarzadzaj')}</a>
      </p>
      <button
        type="button"
        aria-disabled={zajeta || zablokowana}
        onClick={() => {
          if (!trwa.current && !zablokowana) plik.current?.click();
        }}
      >
        {t('globalna.importuj')}
      </button>
      <input
        ref={plik}
        type="file"
        hidden
        accept={`${rozszerzenie},.zip`}
        data-testid={`globalna-import-${rodzaj}`}
        onChange={(e) => {
          const plik = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (plik) void wykonaj(() => importuj(plik));
        }}
      />
      {bladOdczytu ? (
        <p role="alert">{bladOdczytu}</p>
      ) : !wpisy ? (
        otwarta && <p role="status">{t('projekty.wczytywanie')}</p>
      ) : !wpisy.length ? (
        <p className="podpis">{t('globalna.pusta')}</p>
      ) : (
        <ul className="lista-szablonow">
          {wpisy.map(({ id, nazwa }) => (
            <li key={id}>
              <strong>{nazwa}</strong>
              <span className="akcje-szablonu">
                <button
                  type="button"
                  aria-disabled={zajeta || zablokowana}
                  aria-label={t('globalna.uzyjEtykieta', { nazwa })}
                  onClick={(e) => {
                    const przycisk = e.currentTarget;
                    void wykonaj(async () =>
                      (await dodaj(await baza().odczytajZBiblioteki(id), przycisk)) === false
                        ? undefined
                        : t('globalna.dodano', { nazwa }),
                    );
                  }}
                >
                  {t('globalna.uzyj')}
                </button>
                <button
                  type="button"
                  aria-disabled={zajeta || zablokowana}
                  aria-label={t('globalna.eksportujEtykieta', { nazwa })}
                  onClick={() =>
                    void wykonaj(async () => {
                      zapiszPlik(
                        await baza().odczytajZBiblioteki(id),
                        'application/zip',
                        nazwaPliku(nazwa, rozszerzenie),
                      );
                      return undefined;
                    })
                  }
                >
                  {t('szablony.eksportuj')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {blad && <p role="alert">{blad}</p>}
      {status && <p role="status">{status}</p>}
    </details>
  );
}
