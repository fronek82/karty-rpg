import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { WpisBibliotekiGlobalnej } from '../dane/baza';
import { BladDanych } from '../dane/schemat';
import { t } from '../i18n';
import { useAktywnyProjekt } from './AktywnyProjektKontekst';
import { baza } from './baza';
import { KatalogGoogleFonts } from './kartka/KatalogGoogleFonts';
import {
  dodajGlobalnaCzcionkeDoProjektu,
  dodajGlobalnyObrazDoProjektu,
  wgrajCzcionkiGlobalnie,
  wgrajObrazyGlobalnie,
} from './zasobyGlobalne';

const komunikat = (e: unknown) =>
  e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e);

const FOKUSOWALNE =
  'a[href], button:not(:disabled), input:not(:disabled):not([hidden]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

function OknoModalne({
  tytul,
  zamknij,
  children,
}: {
  tytul: string;
  zamknij: () => void;
  children: ReactNode;
}) {
  const idTytulu = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const przyciskZamknij = useRef<HTMLButtonElement>(null);
  const zamknijRef = useRef(zamknij);
  useEffect(() => {
    zamknijRef.current = zamknij;
  });

  // Fokus początkowy wyłącznie przy otwarciu okna (bez kradzieży fokusu przy przerysowaniach).
  useEffect(() => {
    przyciskZamknij.current?.focus();
  }, []);

  // Escape zamyka okno (bez propagacji do edytora), a Tab / Shift+Tab trzyma fokus wewnątrz dialogu.
  useEffect(() => {
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        zamknijRef.current();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const elementy = [...dialogRef.current.querySelectorAll<HTMLElement>(FOKUSOWALNE)].filter(
          (el) => !el.hidden && el.offsetParent !== null,
        );
        if (elementy.length === 0) return;
        const pierwszy = elementy[0]!;
        const ostatni = elementy[elementy.length - 1]!;
        const aktywny = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (!aktywny || aktywny === pierwszy || !dialogRef.current.contains(aktywny)) {
            e.preventDefault();
            ostatni.focus();
          }
        } else if (!aktywny || aktywny === ostatni || !dialogRef.current.contains(aktywny)) {
          e.preventDefault();
          pierwszy.focus();
        }
      }
    };
    window.addEventListener('keydown', klawisz, true);
    return () => window.removeEventListener('keydown', klawisz, true);
  }, []);

  return createPortal(
    <div
      className="okno-zasobow-tlo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) zamknijRef.current();
      }}
    >
      <div
        ref={dialogRef}
        className="okno-zasobow"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTytulu}
      >
        <div className="okno-zasobow-naglowek">
          <h2 id={idTytulu}>{tytul}</h2>
          <button
            ref={przyciskZamknij}
            type="button"
            className="zamknij"
            aria-label={t('zasobyOkno.zamknij')}
            onClick={() => zamknijRef.current()}
          >
            ✕
          </button>
        </div>
        <div className="okno-zasobow-tresc">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Okno wgrywania czcionek (globalnych w przeglądarce, a w projekcie także do projektu i Google Fonts). */
export function OknoCzcionek({ zamknij }: { zamknij: () => void }) {
  const edycja = useAktywnyProjekt();
  const plik = useRef<HTMLInputElement>(null);
  const zamontowany = useRef(true);
  const [wpisy, ustawWpisy] = useState<WpisBibliotekiGlobalnej[]>([]);
  const [status, ustawStatus] = useState('');
  const [blad, ustawBlad] = useState<string>();
  const [trwa, ustawTrwa] = useState(false);

  useEffect(() => {
    zamontowany.current = true;
    void baza()
      .bibliotekaGlobalna('czcionka')
      .then((lista) => zamontowany.current && ustawWpisy(lista))
      .catch(() => zamontowany.current && ustawWpisy([]));
    return () => {
      zamontowany.current = false;
    };
  }, []);

  const odswiez = async () => {
    try {
      const lista = await baza().bibliotekaGlobalna('czcionka');
      if (zamontowany.current) ustawWpisy(lista);
    } catch {
      if (zamontowany.current) ustawWpisy([]);
    }
  };

  const czcionkiProjektu = edycja
    ? edycja.projekt.zasoby.filter((z) => z.rodzaj === 'czcionka')
    : [];
  const nazwyCzcionekWProjekcie = new Set(czcionkiProjektu.map((c) => c.nazwa));

  const wgraj = async (pliki: File[]) => {
    ustawBlad(undefined);
    ustawStatus('');
    ustawTrwa(true);
    try {
      const lista = await wgrajCzcionkiGlobalnie(pliki, edycja);
      await odswiez();
      if (zamontowany.current) ustawStatus(t('czcionki.wgrano', { lista: lista.join(', ') }));
    } catch (e) {
      if (zamontowany.current) ustawBlad(komunikat(e));
    } finally {
      if (zamontowany.current) ustawTrwa(false);
    }
  };

  const dodajDoProjektu = async (w: WpisBibliotekiGlobalnej) => {
    if (!edycja) return;
    ustawBlad(undefined);
    ustawStatus('');
    ustawTrwa(true);
    try {
      const nazwa = await dodajGlobalnaCzcionkeDoProjektu(w, edycja);
      if (zamontowany.current) ustawStatus(t('zasobyOkno.dodanoDoProjektu', { nazwa }));
    } catch (e) {
      if (zamontowany.current) ustawBlad(komunikat(e));
    } finally {
      if (zamontowany.current) ustawTrwa(false);
    }
  };

  const usun = async (w: WpisBibliotekiGlobalnej) => {
    ustawBlad(undefined);
    ustawStatus('');
    ustawTrwa(true);
    try {
      await baza().usunZBiblioteki(w.id);
      await odswiez();
      if (zamontowany.current) ustawStatus(t('zasobyOkno.usunieto', { nazwa: w.nazwa }));
    } catch (e) {
      if (zamontowany.current) ustawBlad(komunikat(e));
    } finally {
      if (zamontowany.current) ustawTrwa(false);
    }
  };

  return (
    <OknoModalne tytul={t('zasobyOkno.czcionkiTytul')} zamknij={zamknij}>
      <p className="podpis">
        {t(edycja ? 'zasobyOkno.czcionkiOpisProjekt' : 'zasobyOkno.czcionkiOpis')}
      </p>
      <div className="okno-zasobow-akcje">
        <button
          type="button"
          className="glowny"
          disabled={trwa}
          onClick={() => plik.current?.click()}
        >
          {t('zasobyOkno.wgrajCzcionki')}
        </button>
        <input
          ref={plik}
          type="file"
          multiple
          accept=".ttf,.otf,.woff,.woff2"
          hidden
          data-testid="plik-czcionki-globalny"
          onChange={(e) => {
            const lista = [...(e.target.files ?? [])];
            e.target.value = '';
            if (lista.length) void wgraj(lista);
          }}
        />
      </div>
      {status && (
        <p role="status" aria-live="polite" className="podpis">
          {status}
        </p>
      )}
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      <section className="okno-zasobow-sekcja">
        <h3>{t('zasobyOkno.czcionkiZapisane')}</h3>
        {wpisy.length === 0 ? (
          <p className="podpis">{t('zasobyOkno.czcionkiBrak')}</p>
        ) : (
          <ul className="lista-zasobow-okna">
            {wpisy.map((w) => (
              <li key={w.id}>
                <span className="nazwa-zasobu">{w.nazwa}</span>
                {edycja && (
                  <button
                    type="button"
                    disabled={trwa || nazwyCzcionekWProjekcie.has(w.nazwa)}
                    onClick={() => void dodajDoProjektu(w)}
                  >
                    {t('zasobyOkno.dodajDoProjektu')}
                  </button>
                )}
                <button type="button" disabled={trwa} onClick={() => void usun(w)}>
                  {t('zasobyOkno.usun')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {edycja && (
        <>
          {czcionkiProjektu.length > 0 && (
            <section className="okno-zasobow-sekcja">
              <h3>{t('zasobyOkno.czcionkiWProjekcie')}</h3>
              <ul className="lista-zasobow-okna">
                {czcionkiProjektu.map((c) => (
                  <li key={c.id}>
                    <span className="nazwa-zasobu">
                      {c.rodzina} ({t(`wariant.${c.wariant}`)})
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="okno-zasobow-sekcja">
            <KatalogGoogleFonts edycja={edycja} onStatus={ustawStatus} onBlad={ustawBlad} />
          </section>
        </>
      )}
    </OknoModalne>
  );
}

/** Okno wgrywania obrazów (globalnych w przeglądarce, a w projekcie także do zasobów projektu). */
export function OknoObrazow({ zamknij }: { zamknij: () => void }) {
  const edycja = useAktywnyProjekt();
  const plik = useRef<HTMLInputElement>(null);
  const zamontowany = useRef(true);
  const [wpisy, ustawWpisy] = useState<WpisBibliotekiGlobalnej[]>([]);
  const [status, ustawStatus] = useState('');
  const [blad, ustawBlad] = useState<string>();
  const [trwa, ustawTrwa] = useState(false);

  useEffect(() => {
    zamontowany.current = true;
    void baza()
      .bibliotekaGlobalna('obraz')
      .then((lista) => zamontowany.current && ustawWpisy(lista))
      .catch(() => zamontowany.current && ustawWpisy([]));
    return () => {
      zamontowany.current = false;
    };
  }, []);

  const odswiez = async () => {
    try {
      const lista = await baza().bibliotekaGlobalna('obraz');
      if (zamontowany.current) ustawWpisy(lista);
    } catch {
      if (zamontowany.current) ustawWpisy([]);
    }
  };

  const obrazyProjektu = edycja ? edycja.projekt.zasoby.filter((z) => z.rodzaj === 'obraz') : [];
  const nazwyObrazowWProjekcie = new Set(obrazyProjektu.map((o) => o.nazwa));

  const wgraj = async (pliki: File[]) => {
    ustawBlad(undefined);
    ustawStatus('');
    ustawTrwa(true);
    try {
      const lista = await wgrajObrazyGlobalnie(pliki, edycja);
      await odswiez();
      if (zamontowany.current)
        ustawStatus(t('zasobyOkno.obrazyWgrano', { lista: lista.join(', ') }));
    } catch (e) {
      if (zamontowany.current) ustawBlad(komunikat(e));
    } finally {
      if (zamontowany.current) ustawTrwa(false);
    }
  };

  const dodajDoProjektu = async (w: WpisBibliotekiGlobalnej) => {
    if (!edycja) return;
    ustawBlad(undefined);
    ustawStatus('');
    ustawTrwa(true);
    try {
      const nazwa = await dodajGlobalnyObrazDoProjektu(w, edycja);
      if (zamontowany.current) ustawStatus(t('zasobyOkno.dodanoDoProjektu', { nazwa }));
    } catch (e) {
      if (zamontowany.current) ustawBlad(komunikat(e));
    } finally {
      if (zamontowany.current) ustawTrwa(false);
    }
  };

  const usun = async (w: WpisBibliotekiGlobalnej) => {
    ustawBlad(undefined);
    ustawStatus('');
    ustawTrwa(true);
    try {
      await baza().usunZBiblioteki(w.id);
      await odswiez();
      if (zamontowany.current) ustawStatus(t('zasobyOkno.usunieto', { nazwa: w.nazwa }));
    } catch (e) {
      if (zamontowany.current) ustawBlad(komunikat(e));
    } finally {
      if (zamontowany.current) ustawTrwa(false);
    }
  };

  return (
    <OknoModalne tytul={t('zasobyOkno.obrazyTytul')} zamknij={zamknij}>
      <p className="podpis">
        {t(edycja ? 'zasobyOkno.obrazyOpisProjekt' : 'zasobyOkno.obrazyOpis')}
      </p>
      <div className="okno-zasobow-akcje">
        <button
          type="button"
          className="glowny"
          disabled={trwa}
          onClick={() => plik.current?.click()}
        >
          {t('zasobyOkno.wgrajObrazy')}
        </button>
        <input
          ref={plik}
          type="file"
          multiple
          accept="image/png,image/jpeg"
          hidden
          data-testid="plik-obrazu-globalny"
          onChange={(e) => {
            const lista = [...(e.target.files ?? [])];
            e.target.value = '';
            if (lista.length) void wgraj(lista);
          }}
        />
      </div>
      {status && (
        <p role="status" aria-live="polite" className="podpis">
          {status}
        </p>
      )}
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      <section className="okno-zasobow-sekcja">
        <h3>{t('zasobyOkno.obrazyZapisane')}</h3>
        {wpisy.length === 0 ? (
          <p className="podpis">{t('zasobyOkno.obrazyBrak')}</p>
        ) : (
          <ul className="lista-zasobow-okna">
            {wpisy.map((w) => (
              <li key={w.id}>
                <span className="nazwa-zasobu">{w.nazwa}</span>
                {edycja && (
                  <button
                    type="button"
                    disabled={trwa || nazwyObrazowWProjekcie.has(w.nazwa)}
                    onClick={() => void dodajDoProjektu(w)}
                  >
                    {t('zasobyOkno.dodajDoProjektu')}
                  </button>
                )}
                <button type="button" disabled={trwa} onClick={() => void usun(w)}>
                  {t('zasobyOkno.usun')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {edycja && obrazyProjektu.length > 0 && (
        <section className="okno-zasobow-sekcja">
          <h3>{t('zasobyOkno.obrazyWProjekcie')}</h3>
          <ul className="lista-zasobow-okna">
            {obrazyProjektu.map((o) => (
              <li key={o.id}>
                <span className="nazwa-zasobu">
                  {o.nazwa} ({o.szerokosc}×{o.wysokosc} px)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </OknoModalne>
  );
}
