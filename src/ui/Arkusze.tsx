import { useEffect, useMemo, useState } from 'react';
import { zbudujArkusz, type WynikArkusza } from '../druk/arkusz';
import { t } from '../i18n';
import type { Arkusz } from '../model/arkusz';
import { pakietMausritter } from '../pakiety/mausritter';
import type { Pakiet } from '../pakiety/typy';
import { scenaDoSvg } from '../silnik/svg';
import { zapiszPlik } from './pliki';
import { wczytajZasobyPakietu, type ZasobyPakietu } from './zasoby';

/** Źródło arkuszy – pakiet albo projekt (oba mają talie i arkusze). */
export type ZrodloArkuszy = Pick<Pakiet, 'id' | 'nazwa' | 'talie' | 'arkusze'>;

/**
 * Arkusze do druku z pakietu lub projektu: podgląd (dopasowany do szerokości albo w skali 1:1)
 * i pobieranie PDF. Kod PDF (pdf-lib) ładowany dopiero przy pierwszym pobraniu.
 */

const pamiecZasobow = new Map<string, Promise<ZasobyPakietu>>();
function zasoby(pakiet: Pakiet): Promise<ZasobyPakietu> {
  let z = pamiecZasobow.get(pakiet.id);
  if (!z) {
    z = wczytajZasobyPakietu(pakiet);
    pamiecZasobow.set(pakiet.id, z);
    // Nieudane wczytanie nie zostaje w pamięci – „Spróbuj ponownie” pobiera pliki od nowa.
    z.catch(() => pamiecZasobow.delete(pakiet.id));
  }
  return z;
}

function zbuduj(pakiet: ZrodloArkuszy, arkusz: Arkusz, z: ZasobyPakietu): WynikArkusza {
  const talia = pakiet.talie.find((x) => x.id === arkusz.taliaId);
  if (!talia) throw new Error(`talia ${arkusz.taliaId}`);
  return zbudujArkusz(arkusz, talia, {
    czcionki: z.czcionki,
    szablony: z.szablony,
    obraz: (id) => z.obrazy.get(id)?.info,
  });
}

const szczegoly = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Skala = 'dopasuj' | 'rzeczywista';
type Status = 'wczytywanie' | 'gotowe' | 'generowanie' | 'pdfGotowy' | 'blad';
type Blad = {
  /** Błąd dotyczy tego pakietu – po zmianie pakietu przestaje być pokazywany. */
  pakietId?: string;
  klucz: 'arkusze.bladWczytywania' | 'arkusze.bladUkladu' | 'arkusze.bladPdf';
  szczegoly: string;
};

/** Strona arkuszy pakietu wbudowanego (zasoby z plików aplikacji). */
export function Arkusze({ pakiet = pakietMausritter }: { pakiet?: Pakiet }) {
  // Zasoby razem z id pakietu – po zmianie pakietu stare czcionki nie trafią do nowego układu.
  const [z, ustawZ] = useState<{ pakietId: string; zasoby: ZasobyPakietu }>();
  const [blad, ustawBlad] = useState<{ pakietId: string; szczegoly: string }>();
  const [proba, ustawProbe] = useState(0);

  useEffect(() => {
    let aktywny = true;
    zasoby(pakiet).then(
      (w) => aktywny && ustawZ({ pakietId: pakiet.id, zasoby: w }),
      (e: unknown) => aktywny && ustawBlad({ pakietId: pakiet.id, szczegoly: szczegoly(e) }),
    );
    return () => {
      aktywny = false;
    };
  }, [pakiet, proba]);

  return (
    <WidokArkuszy
      zrodlo={pakiet}
      zasoby={z?.pakietId === pakiet.id ? z.zasoby : undefined}
      bladWczytywania={blad?.pakietId === pakiet.id ? blad.szczegoly : undefined}
      ponow={() => {
        ustawBlad(undefined);
        ustawProbe((p) => p + 1);
      }}
    />
  );
}

/**
 * Podgląd i PDF arkuszy źródła. Zasoby wczytuje rodzic; `bladWczytywania` i `ponow`
 * pozwalają pokazać błąd wczytywania z przyciskiem „Spróbuj ponownie”.
 */
export function WidokArkuszy({
  zrodlo: pakiet,
  zasoby: zasobyPakietu,
  bladWczytywania,
  ponow,
}: {
  zrodlo: ZrodloArkuszy;
  zasoby?: ZasobyPakietu;
  bladWczytywania?: string;
  ponow?: () => void;
}) {
  const [blad, ustawBlad] = useState<Blad>();
  const [wybrany, ustawWybrany] = useState(0);
  const [skala, ustawSkala] = useState<Skala>('dopasuj');
  const [trwa, ustawTrwa] = useState(false);
  const [pdfGotowy, ustawPdfGotowy] = useState(false);

  const arkusz: Arkusz | undefined = pakiet.arkusze[wybrany] ?? pakiet.arkusze[0];
  // Błąd silnika (np. brak czcionki) nie może wywrócić renderu całej aplikacji.
  const uklad = useMemo((): { wynik?: WynikArkusza; blad?: Blad } => {
    if (!zasobyPakietu || !arkusz) return {};
    try {
      return { wynik: zbuduj(pakiet, arkusz, zasobyPakietu) };
    } catch (e) {
      return { blad: { klucz: 'arkusze.bladUkladu', szczegoly: szczegoly(e) } };
    }
  }, [pakiet, arkusz, zasobyPakietu]);
  const wynik = uklad.wynik;
  const widocznyBlad: Blad | undefined =
    (bladWczytywania !== undefined
      ? { klucz: 'arkusze.bladWczytywania', szczegoly: bladWczytywania }
      : undefined) ??
    (blad && (blad.pakietId === undefined || blad.pakietId === pakiet.id) ? blad : undefined) ??
    uklad.blad;

  const svg = useMemo(
    () =>
      wynik && zasobyPakietu
        ? wynik.strony.map((s, i) =>
            scenaDoSvg(s, {
              adresObrazu: (id) => zasobyPakietu.obrazy.get(id)?.adres,
              przedrostekId: `a${wybrany}s${i}`,
              atrybuty: { role: 'img', 'aria-label': t('arkusze.strona', { numer: i + 1 }) },
            }),
          )
        : [],
    [wynik, zasobyPakietu, wybrany],
  );

  const pobierz = async (wszystkie: boolean) => {
    if (!zasobyPakietu || !wynik || !arkusz) return;
    ustawTrwa(true);
    ustawPdfGotowy(false);
    try {
      // Najpierw kod PDF – w tym czasie React pokaże „Tworzę PDF…” i wyłączy przyciski.
      const { scenyDoPdf } = await import('../druk/pdf');
      await new Promise((r) => setTimeout(r, 0));
      const sceny = wszystkie
        ? pakiet.arkusze.flatMap((a) =>
            a === arkusz ? wynik.strony : zbuduj(pakiet, a, zasobyPakietu).strony,
          )
        : wynik.strony;
      const { bajty } = await scenyDoPdf(sceny, {
        tytul: wszystkie ? pakiet.nazwa : arkusz.nazwa,
        obraz: (id) => {
          const o = zasobyPakietu.obrazy.get(id);
          return o ? { dane: o.dane, format: o.format } : undefined;
        },
      });
      zapiszPlik(
        bajty,
        'application/pdf',
        wszystkie ? `${pakiet.id}-arkusze.pdf` : `${arkusz.id}.pdf`,
      );
      ustawPdfGotowy(true);
    } catch (e) {
      ustawBlad({ klucz: 'arkusze.bladPdf', szczegoly: szczegoly(e), pakietId: pakiet.id });
    } finally {
      ustawTrwa(false);
    }
  };

  const status: Status = widocznyBlad
    ? 'blad'
    : trwa
      ? 'generowanie'
      : !wynik
        ? 'wczytywanie'
        : pdfGotowy
          ? 'pdfGotowy'
          : 'gotowe';
  const tekstStatusu: Record<Status, string> = {
    wczytywanie: t('arkusze.wczytywanie'),
    generowanie: t('arkusze.generowanie'),
    pdfGotowy: t('arkusze.pdfGotowy'),
    gotowe: '',
    blad: '',
  };

  if (pakiet.arkusze.length === 0)
    return (
      <section className="arkusze">
        <h1>{t('arkusze.tytul')}</h1>
        <p>{t('arkusze.brakArkuszy')}</p>
      </section>
    );

  return (
    <section className="arkusze">
      <h1>{t('arkusze.tytul')}</h1>
      <p>{t('arkusze.opis', { pakiet: pakiet.nazwa })}</p>
      {widocznyBlad && (
        <div role="alert" className="uwaga">
          <p>{t(widocznyBlad.klucz)}</p>
          <details>
            <summary>{t('arkusze.szczegoly')}</summary>
            <code>{widocznyBlad.szczegoly}</code>
          </details>
          {widocznyBlad.klucz !== 'arkusze.bladUkladu' && (
            <button
              type="button"
              onClick={() => {
                ustawBlad(undefined);
                if (widocznyBlad.klucz === 'arkusze.bladWczytywania') ponow?.();
              }}
            >
              {t('arkusze.ponow')}
            </button>
          )}
        </div>
      )}
      <div className="pasek-narzedzi">
        <label>
          {t('arkusze.wybor')}{' '}
          <select
            value={wybrany}
            onChange={(e) => {
              ustawWybrany(Number(e.target.value));
              ustawPdfGotowy(false);
            }}
          >
            {pakiet.arkusze.map((a, i) => (
              <option key={a.id} value={i}>
                {a.nazwa}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="przelacznik">
          <legend>{t('arkusze.podglad')}</legend>
          {(['dopasuj', 'rzeczywista'] as const).map((s) => (
            <label key={s}>
              <input
                type="radio"
                name="skala"
                checked={skala === s}
                onChange={() => ustawSkala(s)}
              />{' '}
              {t(s === 'dopasuj' ? 'arkusze.skalaDopasuj' : 'arkusze.skalaRzeczywista')}
            </label>
          ))}
        </fieldset>
        <button type="button" disabled={!wynik || trwa} onClick={() => void pobierz(false)}>
          {t('arkusze.pobierzPdf')}
        </button>
        <button type="button" disabled={!wynik || trwa} onClick={() => void pobierz(true)}>
          {t('arkusze.pobierzWszystkie')}
        </button>
        {/* Region stale obecny w DOM – czytniki ekranu ogłaszają zmianę jego tekstu. */}
        <p role="status" aria-live="polite" className="status">
          {tekstStatusu[status]}
        </p>
      </div>
      {wynik && wynik.ostrzezenia.length > 0 && (
        <details className="uwaga">
          <summary>{t('arkusze.ostrzezenia', { liczba: wynik.ostrzezenia.length })}</summary>
          <ul>
            {wynik.ostrzezenia.map((o, i) => (
              <li key={i}>
                {o.kartaId ? `${o.kartaId}: ` : ''}
                <code>{o.komunikat}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
      {wynik && (
        <p className="podpis">
          {t('arkusze.liczbaStron', { liczba: wynik.strony.length })}
          {skala === 'rzeczywista' ? ` ${t('arkusze.uwagaSkali')}` : ''}
        </p>
      )}
      <div
        className={`podglad-arkusza ${skala === 'dopasuj' ? 'dopasuj' : 'rzeczywista'}`}
        aria-busy={!wynik && !widocznyBlad}
      >
        {svg.map((s, i) => (
          <div key={i} className="strona-arkusza" dangerouslySetInnerHTML={{ __html: s }} />
        ))}
      </div>
    </section>
  );
}
