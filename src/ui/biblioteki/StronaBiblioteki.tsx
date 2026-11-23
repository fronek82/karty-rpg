import { liveQuery } from 'dexie';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { WpisBibliotekiGlobalnej } from '../../dane/baza';
import { t } from '../../i18n';
import { baza } from '../bazaUI';
import { usePasekKomunikatu } from '../PasekKomunikatu';
import { doSzukania } from '../start/mojeSzablony';
import { opisBleduImportu } from '../start/importSzablonu';

/** Podstrony „Bibliotek” w kolejności zakładek (adres `#/biblioteki/<zakladka>`). */
export const ZAKLADKI_BIBLIOTEK = ['obrazy', 'czcionki', 'ozdobniki'] as const;
export type ZakladkaBiblioteki = (typeof ZAKLADKI_BIBLIOTEK)[number];

const RODZAJ_WPISU: Record<ZakladkaBiblioteki, WpisBibliotekiGlobalnej['rodzaj']> = {
  obrazy: 'obraz',
  czcionki: 'czcionka',
  ozdobniki: 'ozdobnik',
};

/** Wpisy pasujące do frazy (bez wielkości liter i znaków diakrytycznych). */
export function filtrujWpisy<T extends { nazwa: string }>(lista: readonly T[], fraza: string): T[] {
  const szukane = doSzukania(fraza.trim());
  return szukane ? lista.filter((w) => doSzukania(w.nazwa).includes(szukane)) : [...lista];
}

/**
 * Wspólna strona biblioteki w przeglądarce (N7): zakładki Obrazy / Czcionki / Ozdobniki,
 * przycisk „Dodaj” (wybór plików), wyszukiwarka, wyśrodkowana siatka podglądów i usuwanie bez
 * potwierdzenia z paskiem „Usunięto: … — Cofnij” na dole ekranu (`PasekKomunikatu`, jak w N6).
 * Podstrony różnią się tylko podglądem, akceptowanymi plikami i dodatkami (np. Google Fonts).
 */
export function StronaBiblioteki({
  zakladka,
  opis,
  dodaj,
  podglad,
  akcje,
  dodatki,
  poUsunieciu,
}: {
  zakladka: ZakladkaBiblioteki;
  opis: string;
  dodaj: {
    accept: string;
    testId: string;
    /** Zapisuje pliki w bibliotece; zwraca komunikat. */
    wykonaj: (pliki: File[]) => Promise<string>;
  };
  /** Podgląd w kafelku (ładuje dane sam). */
  podglad: (w: WpisBibliotekiGlobalnej) => ReactNode;
  /** Dodatkowe przyciski kafelka (przed „Usuń”); `wykonaj` zwraca komunikat. */
  akcje?: (
    w: WpisBibliotekiGlobalnej,
  ) => { tekst: string; etykieta: string; wykonaj: () => Promise<string> }[];
  /** Treść pod paskiem narzędzi (np. katalog Google Fonts). */
  dodatki?: (komunikaty: {
    status: (s: string) => void;
    blad: (s: string | undefined) => void;
  }) => ReactNode;
  /** Np. powiadomienie edytorów o zmianie listy czcionek. */
  poUsunieciu?: () => void;
}) {
  const rodzaj = RODZAJ_WPISU[zakladka];
  const id = useId();
  const [wpisy, ustawWpisy] = useState<WpisBibliotekiGlobalnej[]>();
  const [bladOdczytu, ustawBladOdczytu] = useState('');
  const [fraza, ustawFraze] = useState('');
  const [status, ustawStatus] = useState('');
  const [blad, ustawBlad] = useState<string>();
  const [zajeta, ustawZajeta] = useState(false);
  const trwa = useRef(false);
  const plik = useRef<HTMLInputElement>(null);
  const naglowek = useRef<HTMLHeadingElement>(null);
  const { pasek, pokaz, ukryj } = usePasekKomunikatu();

  useEffect(() => {
    const subskrypcja = liveQuery(() => baza().bibliotekaGlobalna(rodzaj)).subscribe({
      next: (lista) => {
        ustawWpisy(lista);
        ustawBladOdczytu('');
      },
      error: (e) => ustawBladOdczytu(opisBleduImportu(e)),
    });
    return () => subskrypcja.unsubscribe();
  }, [rodzaj]);

  /**
   * Jedna operacja na bazie naraz (kolejka); komunikat albo błąd pod paskiem narzędzi. Kliknięcia
   * w trakcie innej operacji są pomijane, a „Cofnij” z paska (`wKolejce`) czeka na swoją kolej –
   * pasek zamyka się od razu, więc przywrócenie nie może przepaść.
   */
  const kolejka = useRef(Promise.resolve());
  const wykonaj = (f: () => Promise<string>, wKolejce = false) => {
    if (trwa.current && !wKolejce) return;
    trwa.current = true;
    ustawZajeta(true);
    kolejka.current = kolejka.current.then(async () => {
      trwa.current = true;
      ustawZajeta(true);
      ustawBlad(undefined);
      ustawStatus('');
      try {
        ustawStatus(await f());
      } catch (e) {
        ustawBlad(opisBleduImportu(e));
      } finally {
        trwa.current = false;
        ustawZajeta(false);
      }
    });
  };

  const usun = (w: WpisBibliotekiGlobalnej) =>
    wykonaj(async () => {
      // Wpis nieczytelny (podgląd „?”) też da się usunąć – wtedy bez „Cofnij”.
      const bajty = await baza()
        .odczytajZBiblioteki(w.id)
        .catch(() => undefined);
      await baza().usunZBiblioteki(w.id);
      poUsunieciu?.();
      naglowek.current?.focus();
      if (!bajty) {
        pokaz({ tekst: t('pasek.usunieto', { nazwa: w.nazwa }) });
        return '';
      }
      pokaz({
        tekst: t('pasek.usunieto', { nazwa: w.nazwa }),
        akcja: {
          etykieta: t('pasek.cofnij'),
          wykonaj: () =>
            wykonaj(async () => {
              await baza().zapiszWBibliotece(rodzaj, w.nazwa, bajty, w.id);
              poUsunieciu?.();
              return t('pasek.przywrocono', { nazwa: w.nazwa });
            }, true),
        },
      });
      return '';
    });

  const widoczne = wpisy ? filtrujWpisy(wpisy, fraza) : [];

  return (
    <section className="strona-biblioteki" aria-labelledby={`${id}-tytul`}>
      <h1 id={`${id}-tytul`} ref={naglowek} tabIndex={-1}>
        {t('biblioteki.tytul')}
      </h1>
      <nav className="zakladki-bibliotek" aria-label={t('biblioteki.zakladki')}>
        {ZAKLADKI_BIBLIOTEK.map((z) => (
          <a
            key={z}
            href={`#/biblioteki/${z}`}
            aria-current={z === zakladka ? 'page' : undefined}
            onClick={ukryj}
          >
            {t(`biblioteki.${z}`)}
          </a>
        ))}
      </nav>
      <p className="podpis">{opis}</p>
      <div className="narzedzia-biblioteki">
        <button
          type="button"
          className="glowny"
          aria-disabled={zajeta}
          onClick={() => !trwa.current && plik.current?.click()}
        >
          {t('biblioteki.dodaj')}
        </button>
        <input
          ref={plik}
          type="file"
          multiple
          hidden
          accept={dodaj.accept}
          data-testid={dodaj.testId}
          onChange={(e) => {
            const pliki = [...(e.target.files ?? [])];
            e.target.value = '';
            if (pliki.length) {
              ukryj();
              wykonaj(() => dodaj.wykonaj(pliki));
            }
          }}
        />
        <input
          type="search"
          className="szukaj-biblioteki"
          placeholder={t('lista.szukaj')}
          aria-label={t(`biblioteki.szukaj.${zakladka}`)}
          value={fraza}
          onChange={(e) => ustawFraze(e.target.value)}
        />
      </div>
      {dodatki?.({ status: ustawStatus, blad: ustawBlad })}
      {status && (
        <p role="status" className="podpis">
          {status}
        </p>
      )}
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      {bladOdczytu ? (
        <p role="alert">{bladOdczytu}</p>
      ) : !wpisy ? (
        <p role="status">{t('projekty.wczytywanie')}</p>
      ) : !wpisy.length ? (
        <p className="pusta-biblioteka">{t(`biblioteki.pusta.${zakladka}`)}</p>
      ) : !widoczne.length ? (
        <p className="pusta-biblioteka">{t('lista.brakWynikow', { fraza: fraza.trim() })}</p>
      ) : (
        <ul className="siatka-biblioteki" data-testid="siatka-biblioteki">
          {widoczne.map((w) => (
            <li key={w.id} className="kafelek-biblioteki">
              <div className="podglad-biblioteki">{podglad(w)}</div>
              <span className="nazwa-biblioteki" title={w.nazwa}>
                {w.nazwa}
              </span>
              <span className="akcje-biblioteki">
                {akcje?.(w).map((a) => (
                  <button
                    key={a.tekst}
                    type="button"
                    aria-disabled={zajeta}
                    aria-label={a.etykieta}
                    onClick={() => wykonaj(a.wykonaj)}
                  >
                    {a.tekst}
                  </button>
                ))}
                <button
                  type="button"
                  aria-disabled={zajeta}
                  aria-label={t('biblioteki.usunEtykieta', { nazwa: w.nazwa })}
                  onClick={() => usun(w)}
                >
                  {t('projekty.usun')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {pasek}
    </section>
  );
}
