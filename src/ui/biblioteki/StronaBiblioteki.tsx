import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { RodzajWpisuBiblioteki, WpisBiblioteki } from '../../dane/bibliotekaUzytkownika';
import { formatujLiczbe, t } from '../../i18n';
import { baza } from '../bazaUI';
import { usePasekKomunikatu } from '../PasekKomunikatu';
import { doSzukania } from '../start/mojeSzablony';
import { opisBleduImportu } from '../start/importSzablonu';
import { useBiblioteka } from '../useBiblioteka';

/** Podstrony „Bibliotek” w kolejności zakładek (adres `#/biblioteki/<zakladka>`). */
export const ZAKLADKI_BIBLIOTEK = ['obrazy', 'czcionki', 'ozdobniki'] as const;
export type ZakladkaBiblioteki = (typeof ZAKLADKI_BIBLIOTEK)[number];

export const RODZAJ_ZAKLADKI: Record<ZakladkaBiblioteki, RodzajWpisuBiblioteki> = {
  obrazy: 'obraz',
  czcionki: 'czcionka',
  ozdobniki: 'ozdobnik',
};

/** Wpisy pasujące do frazy (bez wielkości liter i znaków diakrytycznych). */
export function filtrujWpisy<T extends { nazwa: string }>(lista: readonly T[], fraza: string): T[] {
  const szukane = doSzukania(fraza.trim());
  return szukane ? lista.filter((w) => doSzukania(w.nazwa).includes(szukane)) : [...lista];
}

/** Próg zajętości miejsca w przeglądarce, od którego strona ostrzega (N8). */
const PROG_MIEJSCA = 0.8;

/** Ostrzeżenie o kończącym się miejscu w przeglądarce (`navigator.storage.estimate`). */
function useOstrzezenieMiejsca(wpisy: readonly WpisBiblioteki[] | undefined): string | undefined {
  const [zajete, ustawZajete] = useState<number>();
  useEffect(() => {
    let aktywny = true;
    void navigator.storage
      ?.estimate?.()
      .then((e) => {
        if (aktywny && e.usage !== undefined && e.quota) ustawZajete(e.usage / e.quota);
      })
      .catch(() => undefined);
    return () => {
      aktywny = false;
    };
  }, [wpisy?.length]);
  if (zajete === undefined || zajete < PROG_MIEJSCA) return undefined;
  const bajty = (wpisy ?? []).reduce((s, w) => s + w.rozmiar, 0);
  return t('biblioteki.miejsce', {
    mb: formatujLiczbe(bajty / 1024 / 1024, 1),
    procent: Math.round(zajete * 100),
  });
}

/**
 * Wspólna strona biblioteki użytkownika (N7, N8): zakładki Ozdobniki / Obrazy / Czcionki, „Dodaj”,
 * wyszukiwarka, siatka podglądów z „Zmień nazwę”, „Pobierz” i „Usuń” (z ostrzeżeniem o projektach,
 * które używają wpisu, i paskiem „Usunięto: … — Cofnij”). Z `powrot` – przycisk „Gotowe”.
 */
export function StronaBiblioteki({
  zakladka,
  opis,
  powrot,
  dodaj,
  podglad,
  pobierz,
  dodatkoweDodaj,
  narzedzia,
  panel,
  dodatki,
  wybrany,
  wybierz,
  szczegoly,
  poZmianie,
}: {
  zakladka: ZakladkaBiblioteki;
  opis: string;
  /** Adres powrotu (np. edytor szablonu) – przycisk „Gotowe”. */
  powrot?: string | undefined;
  dodaj: {
    accept: string;
    testId: string;
    /** Zapisuje pliki w bibliotece; zwraca komunikat. */
    wykonaj: (pliki: File[]) => Promise<string>;
  };
  /** Podgląd w kafelku (ładuje dane sam). */
  podglad: (w: WpisBiblioteki) => ReactNode;
  /** Pobranie wpisu jako pliku. */
  pobierz: (w: WpisBiblioteki) => Promise<void>;
  /** Dodatkowe przyciski dodawania z węższym wyborem plików (np. „Importuj SVG…”). */
  dodatkoweDodaj?: { tekst: string; accept: string; testId: string }[];
  /** Dodatkowe kontrolki paska narzędzi z własną obsługą (np. import SVG z raportem). */
  narzedzia?: ReactNode;
  /** Panel w kolumnie szczegółów zamiast szczegółów zaznaczonego wpisu (np. import w toku). */
  panel?: ReactNode;
  /** Treść pod paskiem narzędzi (np. katalog Google Fonts). */
  dodatki?: (komunikaty: {
    status: (s: string) => void;
    blad: (s: string | undefined) => void;
  }) => ReactNode;
  /** Zaznaczony kafelek (np. ozdobnik w edycji) i jego wybór kliknięciem podglądu. */
  wybrany?: string | undefined;
  wybierz?: (w: WpisBiblioteki | undefined) => void;
  /** Panel szczegółów zaznaczonego wpisu (obok siatki). */
  szczegoly?: (w: WpisBiblioteki) => ReactNode;
  /** Np. powiadomienie edytorów o zmianie listy czcionek. */
  poZmianie?: () => void;
}) {
  const rodzaj = RODZAJ_ZAKLADKI[zakladka];
  const id = useId();
  const wszystkie = useBiblioteka(rodzaj);
  const wpisy = wszystkie?.filter((w) => !w.wewnetrzny);
  const [fraza, ustawFraze] = useState('');
  const [status, ustawStatus] = useState('');
  const [blad, ustawBlad] = useState<string>();
  const [zajeta, ustawZajeta] = useState(false);
  const [zmieniany, ustawZmieniany] = useState<{ id: string; nazwa: string }>();
  const [potwierdzenie, ustawPotwierdzenie] = useState<{
    wpis: WpisBiblioteki;
    projekty: string[];
  }>();
  const trwa = useRef(false);
  const plik = useRef<HTMLInputElement>(null);
  const plikiDodatkowe = useRef<Record<string, HTMLInputElement | null>>({});
  /** Zmiana nazwy anulowana Escape – `onBlur` odmontowywanego pola nie zapisuje. */
  const anulowano = useRef(false);
  const naglowek = useRef<HTMLHeadingElement>(null);
  const { pasek, pokaz, ukryj } = usePasekKomunikatu();
  const miejsce = useOstrzezenieMiejsca(wszystkie);

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

  /** Usunięcie wpisu; używany w projektach – najpierw ostrzeżenie z ich nazwami. */
  const usun = (w: WpisBiblioteki, mimoTo = false) =>
    wykonaj(async () => {
      if (!mimoTo) {
        const projekty = (await baza().projektyUzywajace(w.id)).map((p) => p.nazwa);
        if (projekty.length > 0) {
          ustawPotwierdzenie({ wpis: w, projekty });
          return '';
        }
      }
      ustawPotwierdzenie(undefined);
      await baza().usunZBiblioteki(w.id);
      if (wybrany === w.id) wybierz?.(undefined);
      poZmianie?.();
      naglowek.current?.focus();
      pokaz({
        tekst: t('pasek.usunieto', { nazwa: w.nazwa }),
        akcja: {
          etykieta: t('pasek.cofnij'),
          wykonaj: () =>
            wykonaj(async () => {
              // Wpis wraca z kosza sesji w tej samej postaci (id, opis, bajty).
              await baza().zapiszWBibliotece(rodzaj, w.nazwa, new Uint8Array(), w.id);
              poZmianie?.();
              return t('pasek.przywrocono', { nazwa: w.nazwa });
            }, true),
        },
      });
      return '';
    });

  const zapiszNazwe = () => {
    if (anulowano.current) {
      anulowano.current = false;
      return;
    }
    const z = zmieniany;
    ustawZmieniany(undefined);
    const nazwa = z?.nazwa.trim();
    const w = wpisy?.find((x) => x.id === z?.id);
    if (!z || !w || !nazwa || nazwa === w.nazwa) return;
    wykonaj(async () => {
      await baza().zmienNazweWBibliotece(z.id, nazwa.slice(0, 200));
      poZmianie?.();
      return '';
    });
  };

  const widoczne = wpisy ? filtrujWpisy(wpisy, fraza) : [];
  const zaznaczony = wpisy?.find((w) => w.id === wybrany);

  return (
    <section className="strona-biblioteki" aria-labelledby={`${id}-tytul`}>
      <div className="naglowek-biblioteki">
        <h1 id={`${id}-tytul`} ref={naglowek} tabIndex={-1}>
          {t('biblioteki.tytul')}
        </h1>
        {powrot && (
          <a className="przycisk glowny" href={powrot} data-testid="biblioteka-gotowe">
            {t('biblioteka.gotowe')}
          </a>
        )}
      </div>
      <nav className="zakladki-bibliotek" aria-label={t('biblioteki.zakladki')}>
        {ZAKLADKI_BIBLIOTEK.map((z) => (
          <a
            key={z}
            href={`#/biblioteki/${z}${powrot ? `?powrot=${encodeURIComponent(powrot)}` : ''}`}
            aria-current={z === zakladka ? 'page' : undefined}
            onClick={ukryj}
          >
            {t(`biblioteki.${z}`)}
          </a>
        ))}
      </nav>
      <p className="podpis">{opis}</p>
      {miejsce && (
        <p role="alert" className="uwaga" data-testid="ostrzezenie-miejsca">
          {miejsce}
        </p>
      )}
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
        {dodatkoweDodaj?.map((d) => (
          <span key={d.testId}>
            <button
              type="button"
              aria-disabled={zajeta}
              onClick={() => !trwa.current && plikiDodatkowe.current[d.testId]?.click()}
            >
              {d.tekst}
            </button>
            <input
              ref={(el) => {
                plikiDodatkowe.current[d.testId] = el;
              }}
              type="file"
              multiple
              hidden
              accept={d.accept}
              data-testid={d.testId}
              onChange={(e) => {
                const pliki = [...(e.target.files ?? [])];
                e.target.value = '';
                if (pliki.length) {
                  ukryj();
                  wykonaj(() => dodaj.wykonaj(pliki));
                }
              }}
            />
          </span>
        ))}
        {narzedzia}
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
      {potwierdzenie && (
        <div role="alert" className="uwaga" data-testid="ostrzezenie-usuwania">
          <p>
            {t('biblioteki.usunUzywany', {
              nazwa: potwierdzenie.wpis.nazwa,
              liczba: potwierdzenie.projekty.length,
              projekty: potwierdzenie.projekty.join(', '),
            })}
          </p>
          <button
            type="button"
            className="niebezpieczny"
            onClick={() => usun(potwierdzenie.wpis, true)}
          >
            {t('biblioteki.usunMimoTo')}
          </button>{' '}
          <button type="button" onClick={() => ustawPotwierdzenie(undefined)}>
            {t('biblioteki.anuluj')}
          </button>
        </div>
      )}
      <div className={szczegoly || panel ? 'uklad-strony-biblioteki ze-szczegolami' : undefined}>
        {!wpisy ? (
          <p role="status">{t('projekty.wczytywanie')}</p>
        ) : !wpisy.length ? (
          <p className="pusta-biblioteka">{t(`biblioteki.pusta.${zakladka}`)}</p>
        ) : !widoczne.length ? (
          <p className="pusta-biblioteka">{t('lista.brakWynikow', { fraza: fraza.trim() })}</p>
        ) : (
          <ul className="siatka-biblioteki" data-testid="siatka-biblioteki">
            {widoczne.map((w) => (
              <li
                key={w.id}
                className="kafelek-biblioteki"
                aria-current={wybrany === w.id ? 'true' : undefined}
              >
                {wybierz ? (
                  <button
                    type="button"
                    className="podglad-biblioteki"
                    aria-pressed={wybrany === w.id}
                    aria-label={w.nazwa}
                    onClick={() => wybierz(wybrany === w.id ? undefined : w)}
                  >
                    {podglad(w)}
                  </button>
                ) : (
                  <div className="podglad-biblioteki">{podglad(w)}</div>
                )}
                {zmieniany?.id === w.id ? (
                  <input
                    className="nazwa-biblioteki"
                    aria-label={t('biblioteki.nowaNazwa', { nazwa: w.nazwa })}
                    value={zmieniany.nazwa}
                    autoFocus
                    onChange={(e) => ustawZmieniany({ id: w.id, nazwa: e.target.value })}
                    onBlur={zapiszNazwe}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') zapiszNazwe();
                      if (e.key === 'Escape') {
                        anulowano.current = true;
                        ustawZmieniany(undefined);
                      }
                    }}
                  />
                ) : (
                  <span className="nazwa-biblioteki" title={w.nazwa}>
                    {w.nazwa}
                  </span>
                )}
                <span className="akcje-biblioteki">
                  <button
                    type="button"
                    aria-disabled={zajeta}
                    aria-label={t('biblioteki.zmienNazweEtykieta', { nazwa: w.nazwa })}
                    onClick={() => {
                      anulowano.current = false;
                      ustawZmieniany({ id: w.id, nazwa: w.nazwa });
                    }}
                  >
                    {t('biblioteki.zmienNazwe')}
                  </button>
                  <button
                    type="button"
                    aria-disabled={zajeta}
                    aria-label={t('biblioteki.eksportujEtykieta', { nazwa: w.nazwa })}
                    onClick={() =>
                      wykonaj(async () => {
                        await pobierz(w);
                        return '';
                      })
                    }
                  >
                    {t('biblioteki.eksportuj')}
                  </button>
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
        {panel ?? (szczegoly && zaznaczony && szczegoly(zaznaczony))}
      </div>
      {pasek}
    </section>
  );
}
