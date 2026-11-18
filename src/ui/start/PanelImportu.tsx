import { useRef, useState, type DragEvent } from 'react';
import { importujProjekt, jakoKopia } from '../../dane/archiwum';
import { BladDanych } from '../../dane/schemat';
import { t } from '../../i18n';
import type { DaneZasobow, Projekt } from '../../model/projekt';
import { baza, nowyProjektZSzablonu } from '../baza';
import { ACCEPT_IMPORTU, rozpoznajRodzaj } from './importPlikow';

interface Wynik {
  nazwa: string;
  ok: boolean;
  /** Plik pominięty na prośbę użytkownika (kolizja id) – nie liczy się do wczytanych. */
  pominiety?: boolean;
  tekst: string;
}

type Wybor = 'zastap' | 'kopia' | 'anuluj';

interface Kolizja {
  projekt: Projekt;
  rozwiaz: (wybor: Wybor) => void;
}

const szczegoly = (e: unknown) =>
  e instanceof BladDanych ? e.message : e instanceof Error ? e.message : String(e);

/**
 * Prawa kolumna startu: „Importuj pliki…” i strefa przeciągnij-i-upuść. Rodzaj pliku wynika
 * z rozszerzenia (`.kartyrpg` – projekt, `.kartyrpg-szablon` – szablon; `.zip` – z zawartości).
 * Pliki idą po kolei; kolizja id projektu czeka na decyzję użytkownika.
 */
export function PanelImportu({ onZmiana }: { onZmiana: () => void }) {
  const plik = useRef<HTMLInputElement>(null);
  const [trwa, ustawTrwa] = useState(false);
  const [nad, ustawNad] = useState(false);
  const [wyniki, ustawWyniki] = useState<Wynik[]>([]);
  const [kolizja, ustawKolizje] = useState<Kolizja>();

  const zapytajOKolizje = (projekt: Projekt) =>
    new Promise<Wybor>((rozwiaz) => {
      ustawKolizje({
        projekt,
        rozwiaz: (wybor) => {
          ustawKolizje(undefined);
          rozwiaz(wybor);
        },
      });
    });

  const importujProjektZPliku = async (
    nazwaPliku: string,
    wynik: { projekt: Projekt; zasoby: DaneZasobow },
  ): Promise<Wynik> => {
    let projekt = wynik.projekt;
    if (await baza().istnieje(projekt.id)) {
      const wybor = await zapytajOKolizje(projekt);
      if (wybor === 'anuluj') {
        return {
          nazwa: nazwaPliku,
          ok: true,
          pominiety: true,
          tekst: t('import.pominiety', { plik: nazwaPliku, nazwa: projekt.nazwa }),
        };
      }
      if (wybor === 'kopia')
        projekt = jakoKopia(projekt, t('projekty.nazwaKopii', { nazwa: projekt.nazwa }));
    }
    await baza().zapisz(projekt, wynik.zasoby);
    // Zastąpiony projekt – stara miniatura nieaktualna (nowa powstanie przy otwarciu).
    await baza().usunMiniature(projekt.id);
    return {
      nazwa: nazwaPliku,
      ok: true,
      tekst: t('projekty.zaimportowano', { nazwa: projekt.nazwa }),
    };
  };

  const przetworz = async (pliki: File[]) => {
    if (pliki.length === 0 || trwa) return;
    ustawTrwa(true);
    ustawWyniki([]);
    const zebrane: Wynik[] = [];
    for (const f of pliki) {
      try {
        const bajty = new Uint8Array(await f.arrayBuffer());
        const rodzaj = rozpoznajRodzaj(f.name, bajty);
        if (!rodzaj) {
          zebrane.push({
            nazwa: f.name,
            ok: false,
            tekst: t('import.blad', { plik: f.name, szczegoly: t('import.nieznanyRodzaj') }),
          });
        } else if (rodzaj === 'szablon') {
          try {
            const id = await nowyProjektZSzablonu(bajty);
            if (pliki.length === 1) {
              // Pojedynczy szablon: od razu do edytora kartki nowego projektu.
              window.location.hash = `#/projekt/${encodeURIComponent(id)}`;
              return;
            }
            zebrane.push({ nazwa: f.name, ok: true, tekst: t('import.szablon', { plik: f.name }) });
          } catch (e) {
            throw new BladDanych(t('szablony.bladImportu', { szczegoly: szczegoly(e) }));
          }
        } else {
          zebrane.push(await importujProjektZPliku(f.name, importujProjekt(bajty)));
        }
      } catch (e) {
        const opis =
          e instanceof BladDanych
            ? e.message
            : t('projekty.bladNieoczekiwany', { szczegoly: szczegoly(e) });
        zebrane.push({
          nazwa: f.name,
          ok: false,
          tekst: t('import.blad', { plik: f.name, szczegoly: opis }),
        });
      }
      ustawWyniki([...zebrane]);
    }
    ustawWyniki([...zebrane]);
    ustawTrwa(false);
    onZmiana();
  };

  const przeciaganePliki = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  const sukcesy = wyniki.filter((w) => w.ok && !w.pominiety).length;

  return (
    <section className="panel-importu" aria-labelledby="start-import">
      <p id="start-import" className="etykieta-sekcji">
        {t('start.import')}
      </p>
      <button
        type="button"
        className="glowny duzy"
        disabled={trwa}
        onClick={() => plik.current?.click()}
      >
        {t('start.importujPliki')}
      </button>
      <input
        ref={plik}
        type="file"
        multiple
        accept={ACCEPT_IMPORTU}
        hidden
        data-testid="plik-importu"
        onChange={(e) => {
          const pliki = Array.from(e.target.files ?? []);
          e.target.value = '';
          void przetworz(pliki);
        }}
      />
      <p className="opis-importu">{t('start.importOpis')}</p>
      <button
        type="button"
        className={`strefa-upuszczania${nad ? ' nad' : ''}`}
        disabled={trwa}
        data-testid="strefa-importu"
        onClick={() => plik.current?.click()}
        onDragEnter={(e) => {
          if (!przeciaganePliki(e)) return;
          e.preventDefault();
          ustawNad(true);
        }}
        onDragOver={(e) => {
          if (!przeciaganePliki(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          ustawNad(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) ustawNad(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          ustawNad(false);
          void przetworz(Array.from(e.dataTransfer.files));
        }}
      >
        <b>{t('start.strefaTytul')}</b> <span>{t('start.strefaOpis')}</span>
      </button>
      {kolizja && (
        <div
          role="alertdialog"
          aria-labelledby="kolizja-tytul"
          className="uwaga"
          onKeyDown={(e) => e.key === 'Escape' && kolizja.rozwiaz('anuluj')}
        >
          <p id="kolizja-tytul">{t('projekty.kolizja', { nazwa: kolizja.projekt.nazwa })}</p>
          <button type="button" autoFocus onClick={() => kolizja.rozwiaz('zastap')}>
            {t('projekty.zastap')}
          </button>{' '}
          <button type="button" onClick={() => kolizja.rozwiaz('kopia')}>
            {t('projekty.jakoKopia')}
          </button>{' '}
          <button type="button" onClick={() => kolizja.rozwiaz('anuluj')}>
            {t('projekty.anuluj')}
          </button>
        </div>
      )}
      <p role="status" aria-live="polite" className="status">
        {trwa
          ? t('projekty.trwa')
          : wyniki.length > 1
            ? t('import.podsumowanie', { ok: sukcesy, wszystkie: wyniki.length })
            : ''}
      </p>
      {wyniki.length > 0 && (
        <ul className="wyniki-importu" aria-label={t('import.wyniki')}>
          {wyniki.map((w, i) => (
            <li key={`${i}-${w.nazwa}`}>
              {w.ok ? (
                <p role="status" className="status">
                  {w.tekst}
                </p>
              ) : (
                <p role="alert" className="uwaga">
                  {w.tekst}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
