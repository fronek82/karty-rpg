import { liveQuery } from 'dexie';
import { useEffect, useRef, useState } from 'react';
import {
  importujSzablon,
  LIMITY_ARCHIWUM,
  ROZSZERZENIE_OZDOBNIKA,
  ROZSZERZENIE_SZABLONU,
  ACCEPT_PLIKU_SZABLONU,
} from '../../dane/archiwum';
import type { WpisBibliotekiGlobalnej } from '../../dane/baza';
import { BladDanych } from '../../dane/schemat';
import { t } from '../../i18n';
import { baza, zapiszOzdobnikWBibliotece } from '../bazaUI';
import { nazwaPliku, zapiszPlik } from '../pliki';
import { opisBleduImportu } from '../start/importSzablonu';

/** Zapisane kopie zasobów są wspólne dla projektów w tej przeglądarce. */
export function BibliotekaGlobalna({
  rodzaj,
  dodaj,
  zablokowana = false,
}: {
  rodzaj: 'szablon' | 'ozdobnik';
  dodaj: (bajty: Uint8Array, przycisk: HTMLButtonElement) => Promise<void | boolean>;
  zablokowana?: boolean;
}) {
  const [wpisy, ustawWpisy] = useState<WpisBibliotekiGlobalnej[]>();
  const [otwarta, ustawOtwarta] = useState(false);
  const [zajeta, ustawZajeta] = useState(false);
  const [bladOdczytu, ustawBladOdczytu] = useState('');
  const [blad, ustawBlad] = useState('');
  const [status, ustawStatus] = useState('');
  const naglowek = useRef<HTMLElement>(null);
  const plik = useRef<HTMLInputElement>(null);
  const trwa = useRef(false);
  const szablony = rodzaj === 'szablon';
  const rozszerzenie = szablony ? ROZSZERZENIE_SZABLONU : ROZSZERZENIE_OZDOBNIKA;
  useEffect(() => {
    if (!otwarta) return;
    const subskrypcja = liveQuery(() => baza().bibliotekaGlobalna(rodzaj)).subscribe({
      next: ustawWpisy,
      error: (e) => ustawBladOdczytu(opisBleduImportu(e)),
    });
    return () => subskrypcja.unsubscribe();
  }, [otwarta, rodzaj]);

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
    if (!szablony) return t('globalna.zapisano', { nazwa: await zapiszOzdobnikWBibliotece(bajty) });
    const { nazwa } = importujSzablon(bajty).szablon;
    await baza().zapiszWBibliotece('szablon', nazwa, bajty);
    return t('globalna.zapisano', { nazwa });
  };

  return (
    <details className="biblioteka-globalna" onToggle={(e) => ustawOtwarta(e.currentTarget.open)}>
      <summary ref={naglowek}>{t(`globalna.${rodzaj}`)}</summary>
      <p className="podpis">{t('globalna.opis')}</p>
      {szablony && <p className="podpis">{t('globalna.czcionki')}</p>}
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
        accept={szablony ? ACCEPT_PLIKU_SZABLONU : `${rozszerzenie},.zip`}
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
                <button
                  type="button"
                  aria-disabled={zajeta || zablokowana}
                  aria-label={t('globalna.usunEtykieta', { nazwa })}
                  onClick={() => {
                    if (trwa.current || zablokowana) return;
                    if (!window.confirm(t('globalna.potwierdz', { nazwa }))) return;
                    naglowek.current?.focus();
                    void wykonaj(async () => {
                      await baza().usunZBiblioteki(id);
                      return t('globalna.usunieto', { nazwa });
                    });
                  }}
                >
                  {t('projekty.usun')}
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
