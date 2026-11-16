import { useEffect, useMemo, useState } from 'react';
import { SUFIKS_SZARY, zbudujArkusz, zSzarymiObrazami, type WynikArkusza } from '../druk/arkusz';
import { ustawTytulArkusza, ustawUstawieniaArkusza } from '../dane/edycja';
import { t, tJesliJest } from '../i18n';
import { PAPIERY, type Arkusz, type Papier } from '../model/arkusz';
import { pakietMausritter } from '../pakiety/mausritter';
import type { Pakiet } from '../pakiety/typy';
import { scenaDoSvg } from '../silnik/svg';
import { NakladkaKorekty, PasekKorekty, przenies, type Zaznaczenie } from './arkusz/Korekta';
import { tekstOstrzezeniaArkusza } from './ostrzezenia';
import { pdfWWatku } from './pdfWWatku';
import { obrazNaSzarosc } from './szarosc';
import type { ProjektWEdycji } from './useProjekt';
import { zapiszPlik } from './pliki';
import { wczytajZasobyPakietu, type ObrazWPamieci, type ZasobyPakietu } from './zasoby';

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
  zasoby: zasobyWejscie,
  bladWczytywania,
  ponow,
  edycja,
}: {
  zrodlo: ZrodloArkuszy;
  zasoby?: ZasobyPakietu;
  bladWczytywania?: string;
  ponow?: () => void;
  /** Projekt w edycji – włącza ustawienia arkusza i ręczną korektę układu. */
  edycja?: ProjektWEdycji;
}) {
  const potrzebneSzare = pakiet.arkusze.some((a) => a.ustawienia.czarnoBialy);
  const zasobyPakietu = useZSzarymiObrazami(zasobyWejscie, potrzebneSzare);
  const [korekta, ustawKorekte] = useState(false);
  const [zaznaczona, ustawZaznaczona] = useState<Zaznaczenie>();
  const [komunikatKorekty, ustawKomunikatKorekty] = useState<string>();
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
  const nazwyKart = useMemo(
    () =>
      new Map(
        (pakiet.talie.find((x) => x.id === arkusz?.taliaId)?.karty ?? []).map((k) => [
          k.id,
          k.dane.nazwa ?? '',
        ]),
      ),
    [pakiet.talie, arkusz],
  );
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
            scenaDoSvg(arkusz?.ustawienia.czarnoBialy ? zSzarymiObrazami(s) : s, {
              adresObrazu: (id) => zasobyPakietu.obrazy.get(id)?.adres,
              przedrostekId: `a${wybrany}s${i}`,
              atrybuty: { role: 'img', 'aria-label': t('arkusze.strona', { numer: i + 1 }) },
            }),
          )
        : [],
    [wynik, zasobyPakietu, wybrany, arkusz],
  );

  const pobierz = async (wszystkie: boolean) => {
    if (!zasobyPakietu || !wynik || !arkusz) return;
    ustawTrwa(true);
    ustawPdfGotowy(false);
    try {
      const bajty = await pdfWWatku({
        tytul: wszystkie ? pakiet.nazwa : arkusz.nazwa,
        arkusze: wszystkie ? pakiet.arkusze : [arkusz],
        talie: pakiet.talie,
        szablony: [...zasobyPakietu.szablony.values()],
        czcionki: zasobyPakietu.plikiCzcionek,
        role: zasobyPakietu.role,
        ...(zasobyPakietu.zapasowa !== undefined ? { zapasowa: zasobyPakietu.zapasowa } : {}),
        obrazy: [...zasobyPakietu.obrazy].map(([id, o]) => ({
          id,
          info: o.info,
          dane: o.dane,
          format: o.format,
        })),
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
              ustawZaznaczona(undefined);
              ustawKomunikatKorekty(undefined);
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
      {edycja && arkusz && <UstawieniaArkusza edycja={edycja} arkusz={arkusz} />}
      {edycja && arkusz && wynik && (
        <div className="korekta">
          <label>
            <input
              type="checkbox"
              checked={korekta}
              disabled={wynik.siatka.grupy}
              onChange={(e) => {
                ustawKorekte(e.target.checked);
                ustawZaznaczona(undefined);
                ustawKomunikatKorekty(undefined);
              }}
            />{' '}
            {t('korekta.wlacz')}
          </label>
          {wynik.siatka.grupy ? (
            <p className="podpis">{t('korekta.grupy')}</p>
          ) : (
            korekta && (
              <PasekKorekty
                edycja={edycja}
                arkusz={arkusz}
                wynik={wynik}
                zaznaczona={zaznaczona}
                zaznacz={ustawZaznaczona}
                komunikat={komunikatKorekty}
              />
            )
          )}
        </div>
      )}
      {wynik && zasobyPakietu && zasobyPakietu.czcionki.brakujace.size > 0 && (
        <p className="uwaga">
          {t('czcionki.brakujace', {
            lista: [...zasobyPakietu.czcionki.brakujace]
              .map((r) => tJesliJest(`rola.${r}`) ?? r)
              .join(', '),
          })}
        </p>
      )}
      {wynik && wynik.ostrzezenia.length > 0 && (
        <details className="uwaga">
          <summary>{t('arkusze.ostrzezenia', { liczba: wynik.ostrzezenia.length })}</summary>
          <ul>
            {wynik.ostrzezenia.map((o, i) => (
              <li key={i}>{tekstOstrzezeniaArkusza(o, o.kartaId && nazwyKart.get(o.kartaId))}</li>
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
          <div key={i} className="strona-arkusza">
            <div dangerouslySetInnerHTML={{ __html: s }} />
            {edycja && arkusz && wynik && korekta && !wynik.siatka.grupy && (
              <NakladkaKorekty
                wynik={wynik}
                arkusz={arkusz}
                strona={i}
                nazwy={nazwyKart}
                zaznaczona={zaznaczona}
                zaznacz={(z) => {
                  ustawZaznaczona(z);
                  ustawKomunikatKorekty(undefined);
                }}
                doCelu={(cel) => {
                  if (!zaznaczona) return;
                  const blad = przenies(edycja, arkusz, wynik, zaznaczona, cel);
                  ustawKomunikatKorekty(blad);
                  if (!blad) ustawZaznaczona(undefined);
                }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Zasoby uzupełnione o szare wersje obrazów (`id#szary`), gdy któryś arkusz jest czarno-biały.
 * Do czasu konwersji – undefined (podgląd czeka). Adresy blob: szarych obrazów są zwalniane.
 */
function useZSzarymiObrazami(
  z: ZasobyPakietu | undefined,
  potrzebne: boolean,
): ZasobyPakietu | undefined {
  const [szare, ustawSzare] = useState<{
    zrodlo: ZasobyPakietu;
    mapa: Map<string, ObrazWPamieci>;
  }>();
  useEffect(() => {
    if (!z || !potrzebne) return;
    let aktywny = true;
    const utworzone: ObrazWPamieci[] = [];
    void Promise.all(
      [...z.obrazy].map(async ([id, o]) => {
        // Obraz, którego nie da się przetworzyć, zostaje kolorowy – lepsze niż brak obrazu.
        const s = await obrazNaSzarosc(o).catch(() => o);
        if (s !== o) utworzone.push(s);
        return [id + SUFIKS_SZARY, s] as const;
      }),
    ).then((pary) => {
      if (aktywny) ustawSzare({ zrodlo: z, mapa: new Map(pary) });
      else utworzone.forEach((o) => URL.revokeObjectURL(o.adres));
    });
    return () => {
      aktywny = false;
      utworzone.forEach((o) => URL.revokeObjectURL(o.adres));
    };
  }, [z, potrzebne]);
  return useMemo(() => {
    if (!z || !potrzebne) return z;
    if (szare?.zrodlo !== z) return undefined;
    return { ...z, obrazy: new Map([...z.obrazy, ...szare.mapa]) };
  }, [z, potrzebne, szare]);
}

/** Ustawienia arkusza projektu: tytuł, papier, orientacja, tryb czarno-biały. */
function UstawieniaArkusza({ edycja, arkusz }: { edycja: ProjektWEdycji; arkusz: Arkusz }) {
  const u = arkusz.ustawienia;
  const A = arkusz.id;
  return (
    <details className="ustawienia-arkusza">
      <summary>{t('ustawienia.tytul')}</summary>
      <div className="wiersz-pol">
        {u.tytul && (
          <label>
            {t('ustawienia.tytulArkusza')}{' '}
            <input
              type="text"
              value={u.tytul.tekst}
              onChange={(e) => edycja.zmien((p) => ustawTytulArkusza(p, A, e.target.value))}
            />
          </label>
        )}
        <label>
          {t('ustawienia.papier')}{' '}
          <select
            value={u.papier}
            onChange={(e) =>
              edycja.zmien((p) =>
                ustawUstawieniaArkusza(p, A, { papier: e.target.value as Papier }),
              )
            }
          >
            {Object.keys(PAPIERY).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('ustawienia.orientacja')}{' '}
          <select
            value={u.orientacja}
            onChange={(e) =>
              edycja.zmien((p) =>
                ustawUstawieniaArkusza(p, A, {
                  orientacja: e.target.value as 'pionowa' | 'pozioma',
                }),
              )
            }
          >
            <option value="pionowa">{t('ustawienia.pionowa')}</option>
            <option value="pozioma">{t('ustawienia.pozioma')}</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={!!u.czarnoBialy}
            onChange={(e) =>
              edycja.zmien((p) => ustawUstawieniaArkusza(p, A, { czarnoBialy: e.target.checked }))
            }
          />{' '}
          {t('ustawienia.czarnoBialy')}
        </label>
      </div>
    </details>
  );
}
