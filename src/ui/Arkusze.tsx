import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { SUFIKS_SZARY, zbudujArkusz, zSzarymiObrazami, type WynikArkusza } from '../druk/arkusz';
import { ustawTytulArkusza, ustawUstawieniaArkusza } from '../dane/edycja';
import { zasobySzablonu } from '../dane/schemat';
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
  // Pisanie (np. tytułu) nie czeka na przebudowę arkusza i SVG wszystkich stron.
  const zrodloOdroczone = useDeferredValue(pakiet);
  const zasobyPakietu = useZSzarymiObrazami(zasobyWejscie, zrodloOdroczone);
  const [korekta, ustawKorekte] = useState(false);
  const [zaznaczona, ustawZaznaczona] = useState<Zaznaczenie>();
  const [komunikatKorekty, ustawKomunikatKorekty] = useState<string>();
  // Escape anuluje zaznaczenie karty w korekcie.
  useEffect(() => {
    if (!zaznaczona) return;
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ustawZaznaczona(undefined);
    };
    window.addEventListener('keydown', klawisz);
    return () => window.removeEventListener('keydown', klawisz);
  }, [zaznaczona]);
  const [blad, ustawBlad] = useState<Blad>();
  const [wybrany, ustawWybrany] = useState(0);
  const [skala, ustawSkala] = useState<Skala>('dopasuj');
  const [trwa, ustawTrwa] = useState(false);
  const [pdfGotowy, ustawPdfGotowy] = useState(false);

  const arkusz: Arkusz | undefined = pakiet.arkusze[wybrany] ?? pakiet.arkusze[0];
  const arkuszPodgladu: Arkusz | undefined =
    zrodloOdroczone.arkusze[wybrany] ?? zrodloOdroczone.arkusze[0];
  // Błąd silnika (np. brak czcionki) nie może wywrócić renderu całej aplikacji.
  const uklad = useMemo((): { wynik?: WynikArkusza; blad?: Blad } => {
    if (!zasobyPakietu || !arkuszPodgladu) return {};
    try {
      return { wynik: zbuduj(zrodloOdroczone, arkuszPodgladu!, zasobyPakietu) };
    } catch (e) {
      return { blad: { klucz: 'arkusze.bladUkladu', szczegoly: szczegoly(e) } };
    }
  }, [zrodloOdroczone, arkuszPodgladu, zasobyPakietu]);
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
            scenaDoSvg(arkuszPodgladu?.ustawienia.czarnoBialy ? zSzarymiObrazami(s) : s, {
              adresObrazu: (id) => zasobyPakietu.obrazy.get(id)?.adres,
              przedrostekId: `a${wybrany}s${i}`,
              atrybuty: { role: 'img', 'aria-label': t('arkusze.strona', { numer: i + 1 }) },
            }),
          )
        : [],
    [wynik, zasobyPakietu, wybrany, arkuszPodgladu],
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

/** Obrazy użyte na arkuszach czarno-białych: wartości danych kart i stałe obrazy szablonów. */
function obrazyCzarnoBialych(zrodlo: ZrodloArkuszy, z: ZasobyPakietu): Set<string> {
  const ids = new Set<string>();
  for (const a of zrodlo.arkusze) {
    if (!a.ustawienia.czarnoBialy) continue;
    for (const k of zrodlo.talie.find((x) => x.id === a.taliaId)?.karty ?? []) {
      for (const v of Object.values(k.dane)) if (z.obrazy.has(v)) ids.add(v);
      const s = z.szablony.get(k.szablonId);
      if (s) for (const id of zasobySzablonu(s)) ids.add(id);
    }
  }
  return ids;
}

/**
 * Zasoby uzupełnione o szare wersje obrazów (`id#szary`) użytych na arkuszach czarno-białych.
 * Konwersje pamiętane (po obiekcie obrazu) – edycja kart nie powtarza ich; do pierwszej
 * konwersji – undefined (podgląd czeka). Adresy blob: szarych obrazów zwalniane przy odmontowaniu.
 */
function useZSzarymiObrazami(
  z: ZasobyPakietu | undefined,
  zrodlo: ZrodloArkuszy,
): ZasobyPakietu | undefined {
  const pamiec = useRef(new Map<ObrazWPamieci, Promise<ObrazWPamieci>>());
  useEffect(() => {
    const m = pamiec.current;
    return () => {
      for (const p of m.values()) void p.then((o) => URL.revokeObjectURL(o.adres));
      m.clear();
    };
  }, []);
  const potrzebne = useMemo(
    () => (z ? [...obrazyCzarnoBialych(zrodlo, z)].sort().join('\n') : ''),
    [z, zrodlo],
  );
  const [szare, ustawSzare] = useState<{
    klucz: string;
    zrodlo: ZasobyPakietu;
    mapa: Map<string, ObrazWPamieci>;
  }>();
  useEffect(() => {
    if (!z || !potrzebne) return;
    let aktywny = true;
    void Promise.all(
      potrzebne.split('\n').flatMap((id) => {
        const o = z.obrazy.get(id);
        if (!o) return [];
        let p = pamiec.current.get(o);
        if (!p) {
          // Obraz, którego nie da się przetworzyć, zostaje kolorowy – lepsze niż brak obrazu.
          p = obrazNaSzarosc(o).catch(() => ({ ...o }));
          pamiec.current.set(o, p);
        }
        return [p.then((s) => [id + SUFIKS_SZARY, s] as const)];
      }),
    ).then((pary) => {
      if (aktywny) ustawSzare({ klucz: potrzebne, zrodlo: z, mapa: new Map(pary) });
    });
    return () => {
      aktywny = false;
    };
  }, [z, potrzebne]);
  return useMemo(() => {
    if (!z || !potrzebne) return z;
    if (szare?.zrodlo !== z || szare.klucz !== potrzebne) {
      // Do czasu nowej konwersji – poprzednie szare obrazy (bez znikania podglądu).
      return szare ? { ...z, obrazy: new Map([...z.obrazy, ...szare.mapa]) } : undefined;
    }
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
