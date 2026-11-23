import { useEffect, useRef, useState, type DragEvent } from 'react';
import { importujProjekt, jakoKopia, LIMITY_ARCHIWUM } from '../../dane/archiwum';
import { formatujLiczbe, t } from '../../i18n';
import type { Projekt } from '../../model/projekt';
import { baza } from '../baza';
import { ACCEPT_IMPORTU, jestZip, rodzajPoNazwie, rozpoznajRodzaj } from './importPlikow';
import { adresProjektu, importujPlikSzablonu, opisBleduImportu } from './importSzablonu';

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

const MB = 1024 * 1024;

const blad = (nazwa: string, szczegoly: string): Wynik => ({
  nazwa,
  ok: false,
  tekst: t('import.blad', { plik: nazwa, szczegoly }),
});

/**
 * Prawa kolumna startu: „Importuj pliki…” i strefa przeciągnij-i-upuść. Rodzaj pliku wynika
 * z zawartości ZIP-a lub z rozszerzenia (`.kartyrpg` – projekt, `.kartyrpg-szablon` – szablon).
 * Pliki idą po kolei; kolizja id projektu czeka na decyzję użytkownika. Przyciski nie są
 * wyłączane w trakcie importu (fokus zostaje na miejscu) – ponowne wejście blokuje `useRef`.
 */
export function PanelImportu({ onZmiana }: { onZmiana: () => void }) {
  const plik = useRef<HTMLInputElement>(null);
  const przycisk = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const trwaRef = useRef(false);
  const zyje = useRef(true);
  const rozwiazZapytanie = useRef<((wybor: Wybor) => void) | undefined>(undefined);
  const [trwa, ustawTrwa] = useState(false);
  const [nad, ustawNad] = useState(false);
  const [komunikat, ustawKomunikat] = useState('');
  const [bledy, ustawBledy] = useState<string[]>([]);
  const [wczytane, ustawWczytane] = useState<string[]>([]);
  const [kolizja, ustawKolizje] = useState<Kolizja>();

  useEffect(() => {
    zyje.current = true;
    return () => {
      // Odmontowanie w trakcie pytania o kolizję: rozwiązujemy je jako „Anuluj”.
      zyje.current = false;
      rozwiazZapytanie.current?.('anuluj');
    };
  }, []);

  /** Zmiany stanu tylko dopóki panel jest zamontowany. */
  const gdyZywy = (zmiana: () => void) => {
    if (zyje.current) zmiana();
  };

  const zapytajOKolizje = (projekt: Projekt) =>
    new Promise<Wybor>((rozwiaz) => {
      if (!zyje.current) return rozwiaz('anuluj');
      const koniec = (wybor: Wybor) => {
        rozwiazZapytanie.current = undefined;
        gdyZywy(() => ustawKolizje(undefined));
        rozwiaz(wybor);
      };
      rozwiazZapytanie.current = koniec;
      ustawKolizje({ projekt, rozwiaz: koniec });
    });

  /** Wczytuje jeden plik; `undefined` – przejście do edytora (pojedynczy szablon). */
  const wczytaj = async (f: File, razem: number): Promise<Wynik | undefined> => {
    if (f.size > LIMITY_ARCHIWUM.suma) {
      return blad(
        f.name,
        t('import.zaDuzy', {
          mb: formatujLiczbe(f.size / MB, 1),
          limit: formatujLiczbe(LIMITY_ARCHIWUM.suma / MB, 0),
        }),
      );
    }
    let bajty: Uint8Array;
    try {
      // Nieznane rozszerzenie: czytamy tylko 4 pierwsze bajty (czy to ZIP), reszty nie.
      if (!rodzajPoNazwie(f.name) && !jestZip(new Uint8Array(await f.slice(0, 4).arrayBuffer())))
        return blad(f.name, t('import.nieznanyRodzaj'));
      bajty = new Uint8Array(await f.arrayBuffer());
    } catch {
      // Np. katalog upuszczony na strefę (NotFoundError).
      return blad(f.name, t('import.nieczytelny'));
    }
    const rodzaj = rozpoznajRodzaj(f.name, bajty);
    if (!rodzaj) return blad(f.name, t('import.nieznanyRodzaj'));

    if (rodzaj === 'szablon') {
      const wynikSzablonu = await importujPlikSzablonu(bajty);
      if ('blad' in wynikSzablonu) return blad(f.name, wynikSzablonu.blad);
      if (razem === 1) {
        // Pojedynczy szablon: od razu do edytora kartki nowego projektu.
        window.location.hash = adresProjektu(wynikSzablonu.id);
        return undefined;
      }
      return { nazwa: f.name, ok: true, tekst: t('import.szablon', { plik: f.name }) };
    }

    const wynik = importujProjekt(bajty);
    let projekt = wynik.projekt;
    // Ten sam id ma usunięty projekt, którego szablony zostały w „Moich szablonach” – import
    // dostaje nowe id (bez pytania o kolizję z niewidocznym projektem i bez nadpisania szablonów).
    if (await baza().czyTylkoSzablony(projekt.id)) projekt = jakoKopia(projekt);
    else if (await baza().istnieje(projekt.id)) {
      const wybor = await zapytajOKolizje(projekt);
      if (wybor === 'anuluj') {
        return {
          nazwa: f.name,
          ok: true,
          pominiety: true,
          tekst: t('import.pominiety', { plik: f.name, nazwa: projekt.nazwa }),
        };
      }
      if (wybor === 'kopia')
        projekt = jakoKopia(projekt, t('projekty.nazwaKopii', { nazwa: projekt.nazwa }));
    }
    await baza().zapisz(projekt, wynik.zasoby);
    // Zastąpiony projekt – stara miniatura nieaktualna (nowa powstanie przy otwarciu).
    await baza().usunMiniature(projekt.id);
    return {
      nazwa: f.name,
      ok: true,
      tekst: t('projekty.zaimportowano', { nazwa: projekt.nazwa }),
    };
  };

  const przetworz = async (pliki: File[]) => {
    if (pliki.length === 0 || trwaRef.current) return;
    trwaRef.current = true;
    ustawTrwa(true);
    ustawKomunikat('');
    ustawBledy([]);
    ustawWczytane([]);
    const wyniki: Wynik[] = [];
    try {
      for (const f of pliki) {
        try {
          const wynik = await wczytaj(f, pliki.length);
          if (!wynik) return; // przejście do edytora
          wyniki.push(wynik);
        } catch (e) {
          wyniki.push(blad(f.name, opisBleduImportu(e)));
        }
      }
    } finally {
      trwaRef.current = false;
      gdyZywy(() => {
        ustawTrwa(false);
        const udane = wyniki.filter((w) => w.ok);
        ustawBledy(wyniki.filter((w) => !w.ok).map((w) => w.tekst));
        if (pliki.length === 1) ustawKomunikat(udane[0]?.tekst ?? '');
        else {
          ustawKomunikat(
            t('import.podsumowanie', {
              ok: wyniki.filter((w) => w.ok && !w.pominiety).length,
              wszystkie: pliki.length,
            }),
          );
          ustawWczytane(udane.map((w) => w.tekst));
        }
        onZmiana();
        // Fokus wraca na „Importuj pliki…”, o ile użytkownik nie przeszedł już gdzie indziej.
        const aktywny = document.activeElement;
        if (!aktywny || aktywny === document.body || panel.current?.contains(aktywny))
          przycisk.current?.focus();
      });
    }
  };

  const przeciaganePliki = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  return (
    <section ref={panel} className="panel-importu" aria-labelledby="start-import" aria-busy={trwa}>
      <p id="start-import" className="etykieta-sekcji">
        {t('start.import')}
      </p>
      <button
        ref={przycisk}
        type="button"
        className="glowny duzy"
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
        aria-label={t('start.strefaEtykieta')}
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
          <button type="button" onClick={() => kolizja.rozwiaz('zastap')}>
            {t('projekty.zastap')}
          </button>{' '}
          <button type="button" onClick={() => kolizja.rozwiaz('kopia')}>
            {t('projekty.jakoKopia')}
          </button>{' '}
          <button type="button" autoFocus onClick={() => kolizja.rozwiaz('anuluj')}>
            {t('projekty.anuluj')}
          </button>
        </div>
      )}
      {/* Stałe regiony dla czytników: stan i podsumowanie (polite) oraz błędy (alert). */}
      <p role="status" aria-live="polite" className="status">
        {trwa ? t('projekty.trwa') : komunikat}
      </p>
      <div role="alert" className="bledy-importu">
        {bledy.map((b, i) => (
          <p key={i} className="uwaga">
            {b}
          </p>
        ))}
      </div>
      {wczytane.length > 0 && (
        <ul className="wyniki-importu" aria-label={t('import.wyniki')}>
          {wczytane.map((tekst, i) => (
            <li key={i}>{tekst}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
