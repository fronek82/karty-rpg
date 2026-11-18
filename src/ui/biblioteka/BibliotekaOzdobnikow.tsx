import { useMemo, useRef, useState } from 'react';
import { dodajZasoby } from '../../dane/edycja';
import { MAKS_BAJTOW_OBRAZU, opisObrazu } from '../../dane/obrazy';
import {
  MAKS_ELEMENTOW_BIBLIOTEKI,
  dodajElementDoBiblioteki,
  dodajRamke9ZObrazu,
  ramka9Domyslna,
  elementyProjektu,
  noweIdElementu,
  szablonyUzywajace,
  usunElementZBiblioteki,
  zmienElementBiblioteki,
} from '../../dane/biblioteka';
import { formatujLiczbe, t, tn, type KluczTekstu } from '../../i18n';
import { NarzedziaPaska } from '../NaglowekAplikacji';
import {
  ELEMENTY_WBUDOWANE,
  BladImportuSvg,
  TRESC_DOMYSLNA,
  importujSvg,
  LIMITY_SVG,
  LIMITY_XML,
  type ElementOzdobny,
  type RodzajElementu,
  type WynikImportuSvg,
} from '../../ozdobniki';
import { Liczba } from '../szablon/Kontrolki';
import { MiniaturaOzdobnika } from '../szablon/MiniaturaOzdobnika';
import { nazwaElementu } from '../szablon/PanelWygladu';
import { tekstZapisu, type ProjektWEdycji } from '../useProjekt';
import { przygotujObraz } from '../obrazy';
import { EdytorRamki9 } from './EdytorRamki9';
import { KOLOR_PODGLADU, podgladElementu } from './podgladElementu';

/** Rodzaje, w których można użyć własnego elementu z SVG. */
const RODZAJE: RodzajElementu[] = [
  'naroznik',
  'motyw',
  'zakonczenie',
  'srodek',
  'ksztalt',
  'ramka9',
];
const GRUPY_WBUDOWANE = ['motyw', 'naroznik', 'zakonczenie', 'srodek'] as const;

/** Import w toku: wynik sanityzacji z edytowalnymi ustawieniami przed dodaniem do biblioteki. */
interface Wczytany {
  plik: string;
  wynik: WynikImportuSvg;
  rodzaj: RodzajElementu;
  kolorowanie: 'jednolity' | 'oryginal';
  nazwa: string;
}

const bezRozszerzenia = (n: string) => n.replace(/\.[^.]+$/, '');

function Przyciski<T extends string>({
  etykieta,
  opcje,
  wartosc,
  zmien,
}: {
  etykieta: string;
  opcje: { wartosc: T; tekst: string }[];
  wartosc: T;
  zmien: (v: T) => void;
}) {
  return (
    <div className="pole-panelu">
      <span className="etykieta-grupy">{etykieta}</span>
      <div className="przelacznik-segmentowy" role="group" aria-label={etykieta}>
        {opcje.map((o) => (
          <button
            key={o.wartosc}
            type="button"
            aria-pressed={wartosc === o.wartosc}
            onClick={() => zmien(o.wartosc)}
          >
            {o.tekst}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Podgląd elementu w użyciu (ten sam silnik co karty); bez podglądu – sama miniatura. */
function Podglad({
  element,
  czcionki,
  prefiks,
}: {
  element: ElementOzdobny;
  czcionki: ProjektWEdycji['zasoby']['zasoby']['czcionki'];
  prefiks: string;
}) {
  const p = useMemo(
    () => podgladElementu(element, czcionki, prefiks),
    [element, czcionki, prefiks],
  );
  if (!p)
    return (
      <div className="podglad-elementu" style={{ color: KOLOR_PODGLADU }}>
        <MiniaturaOzdobnika element={element} />
      </div>
    );
  return (
    <div
      className="podglad-elementu"
      data-testid="podglad-elementu"
      style={{ aspectRatio: `${p.szer} / ${p.wys}`, width: `min(100%, ${p.szer * 4}px)` }}
      dangerouslySetInnerHTML={{ __html: p.svg }}
    />
  );
}

/**
 * „Biblioteka ozdobników” projektu (makieta M2b-3, lewa i prawa kolumna): lista elementów
 * wbudowanych i własnych, import własnego SVG z raportem „co pominięto”, rodzaj i kolorowanie,
 * podgląd, usuwanie. Elementy własne leżą w `Projekt.biblioteka.ozdobniki` (R12).
 */
export function BibliotekaOzdobnikow({ edycja }: { edycja: ProjektWEdycji }) {
  const { projekt, zmien } = edycja;
  const wlasne = elementyProjektu(projekt);
  const plik = useRef<HTMLInputElement>(null);
  const plikPng = useRef<HTMLInputElement>(null);
  const [wczytany, ustawWczytany] = useState<Wczytany>();
  const [blad, ustawBlad] = useState<string>();
  const [status, ustawStatus] = useState('');
  const [wybrany, ustawWybrany] = useState<string>();
  const [usuwanie, ustawUsuwanie] = useState(false);
  const idProjektu = encodeURIComponent(projekt.id);
  const czcionki = edycja.zasoby.zasoby.czcionki;
  const element = wlasne.find((e) => e.id === wybrany);

  const importuj = async (f: File) => {
    ustawBlad(undefined);
    ustawStatus('');
    ustawWybrany(undefined);
    try {
      const wynik = importujSvg(new Uint8Array(await f.arrayBuffer()));
      ustawWczytany({
        plik: f.name,
        wynik,
        rodzaj: wynik.element.rodzaj,
        kolorowanie: wynik.element.kolorowanie ?? 'jednolity',
        nazwa: bezRozszerzenia(f.name),
      });
    } catch (e) {
      ustawWczytany(undefined);
      const powod =
        e instanceof BladImportuSvg
          ? t(`biblioteka.blad.${e.kod}`, {
              szczegoly: e.szczegol
                ? t(e.szczegol.klucz as KluczTekstu, e.szczegol.parametry)
                : e.message,
              limit: LIMITY_SVG.bajty / 1024,
              limitElementow: LIMITY_XML.elementy,
              limitGlebokosci: LIMITY_XML.glebokosc,
              limitKsztaltow: LIMITY_SVG.ksztalty,
              limitKomend: LIMITY_SVG.komendy,
            })
          : String(e instanceof Error ? e.message : e);
      ustawBlad(t('biblioteka.import.blad', { plik: f.name, powod }));
    }
  };

  /** PNG → obraz w zasobach projektu + element `ramka9` ze źródłem „obraz” (wcięcia po trzecim). */
  const importujPng = async (f: File) => {
    ustawBlad(undefined);
    ustawStatus('');
    try {
      if (wlasne.length >= MAKS_ELEMENTOW_BIBLIOTEKI)
        throw new Error(tn('biblioteka.limit', MAKS_ELEMENTOW_BIBLIOTEKI));
      if (f.size > MAKS_BAJTOW_OBRAZU)
        throw new Error(
          t('dane.zaDuzy', { plik: f.name, mb: formatujLiczbe(f.size / 1024 / 1024, 1) }),
        );
      const { dane, ...wymiary } = await przygotujObraz(new Uint8Array(await f.arrayBuffer()));
      const nazwa = bezRozszerzenia(f.name);
      let nowyId = '';
      await edycja.zmienZZasobami((p, d) => {
        const opis = opisObrazu(f.name, dane, wymiary, new Set(p.zasoby.map((z) => z.id)));
        const w = dodajZasoby(p, d, [{ opis, dane }]);
        const r = dodajRamke9ZObrazu(w.projekt, nazwa, opis);
        nowyId = r.id;
        return { projekt: r.projekt, dane: w.dane };
      });
      ustawWczytany(undefined);
      ustawWybrany(nowyId);
      ustawStatus(t('biblioteka.ramka9.obrazZnaleziony', { nazwa }));
    } catch (e) {
      ustawBlad(
        t('biblioteka.import.blad', {
          plik: f.name,
          powod: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  };

  const dodaj = () => {
    if (!wczytany) return;
    if (wlasne.length >= MAKS_ELEMENTOW_BIBLIOTEKI) {
      ustawBlad(tn('biblioteka.limit', MAKS_ELEMENTOW_BIBLIOTEKI));
      return;
    }
    const nazwa = wczytany.nazwa.trim() || bezRozszerzenia(wczytany.plik);
    const id = noweIdElementu(nazwa, projekt);
    zmien(
      (p) =>
        dodajElementDoBiblioteki(p, nazwa, {
          ...wczytany.wynik.element,
          rodzaj: wczytany.rodzaj,
          kolorowanie: wczytany.kolorowanie,
          ...(wczytany.rodzaj === 'ramka9'
            ? {
                ramka9: ramka9Domyslna(
                  { typ: 'svg' },
                  wczytany.wynik.element.szer,
                  wczytany.wynik.element.wys,
                ),
              }
            : {}),
        }).projekt,
    );
    ustawWczytany(undefined);
    ustawWybrany(id);
    ustawStatus(t('biblioteka.zaimportowano', { nazwa }));
  };

  // Element do podglądu przy imporcie – jeszcze nie w bibliotece (id tymczasowe).
  const roboczy: ElementOzdobny | undefined = wczytany && {
    ...wczytany.wynik.element,
    id: 'wl:import',
    nazwa: wczytany.nazwa,
    rodzaj: wczytany.rodzaj,
    kolorowanie: wczytany.kolorowanie,
    ...(wczytany.rodzaj === 'ramka9'
      ? {
          ramka9: ramka9Domyslna(
            { typ: 'svg' },
            wczytany.wynik.element.szer,
            wczytany.wynik.element.wys,
          ),
        }
      : {}),
  };
  // Ramka z obrazu PNG nie ma konturów: ani rodzaju do wyboru, ani koloru.
  const obrazowa = element?.ramka9?.zrodlo.typ === 'obraz';
  const uzywajace = element ? szablonyUzywajace(projekt, element.id) : [];

  return (
    <div className="biblioteka-ozdobnikow">
      <h1 className="tylko-czytnik">{t('biblioteka.tytul')}</h1>
      <header className="pasek-gorny">
        <a href="#/" className="logo">
          {t('aplikacja.nazwa')}
        </a>
        <strong className="nazwa-projektu-tekst">{projekt.nazwa}</strong>
        <span className="okruszek">› {t('biblioteka.tytul')}</span>
        <span className="status-zapisu" role="status">
          {tekstZapisu(edycja.zapis)}
        </span>
        <span className="odstep" />
        <button type="button" onClick={() => plik.current?.click()}>
          {t('biblioteka.importuj')}
        </button>
        <input
          ref={plik}
          type="file"
          accept=".svg,image/svg+xml"
          hidden
          data-testid="plik-svg"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void importuj(f);
          }}
        />
        <button type="button" onClick={() => plikPng.current?.click()}>
          {t('biblioteka.importujPng')}
        </button>
        <input
          ref={plikPng}
          type="file"
          accept=".png,image/png"
          hidden
          data-testid="plik-png"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void importujPng(f);
          }}
        />
        <a className="przycisk glowny" href={`#/projekt/${idProjektu}`}>
          {t('biblioteka.gotowe')}
        </a>
        <NarzedziaPaska />
      </header>
      <div className="uklad-biblioteki">
        <aside className="panel-biblioteki" aria-label={t('biblioteka.tytul')}>
          <h2>{t('biblioteka.tytul')}</h2>
          <h3>{t('biblioteka.wbudowane')}</h3>
          <ul className="lista-biblioteki wbudowane">
            {GRUPY_WBUDOWANE.map((g) => {
              const lista = ELEMENTY_WBUDOWANE.filter((e) => e.rodzaj === g);
              return (
                <li key={g}>
                  <span className="miniatury">
                    {lista.slice(0, 2).map((e) => (
                      <MiniaturaOzdobnika key={e.id} element={e} />
                    ))}
                  </span>
                  <span>
                    {t(`biblioteka.grupa.${g}`)} ({lista.length})
                  </span>
                </li>
              );
            })}
          </ul>
          <h3>{t('biblioteka.wProjekcie')}</h3>
          {wlasne.length === 0 && <p className="podpis">{t('biblioteka.brakWlasnych')}</p>}
          <ul className="lista-biblioteki wlasne" data-testid="lista-wlasnych">
            {wlasne.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  aria-pressed={wybrany === e.id && !wczytany}
                  onClick={() => {
                    ustawWybrany(e.id);
                    ustawWczytany(undefined);
                    ustawUsuwanie(false);
                  }}
                >
                  <span className="miniatury" style={{ color: KOLOR_PODGLADU }}>
                    <MiniaturaOzdobnika
                      element={e}
                      {...(e.ramka9?.zrodlo.typ === 'obraz'
                        ? { adres: edycja.zasoby.zasoby.obrazy.get(e.ramka9.zrodlo.zasob)?.adres }
                        : {})}
                    />
                  </span>
                  <span className="nazwa">{nazwaElementu(e)}</span>
                  <span className="podpis">{t(`biblioteka.rodzaj.${e.rodzaj}`)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="podpis">{t('biblioteka.objasnienie')}</p>
        </aside>
        <section className="panel-importu" aria-live="polite">
          {blad && (
            <p role="alert" className="uwaga" data-testid="blad-importu">
              {blad}
            </p>
          )}
          {status && !wczytany && (
            <p role="status" className="podpis">
              {status}
            </p>
          )}
          {wczytany && roboczy && (
            <>
              <h2>{t('biblioteka.import.tytul', { plik: wczytany.plik })}</h2>
              <Podglad element={roboczy} czcionki={czcionki} prefiks="bi-" />
              <p className="raport-ok" data-testid="raport-import">
                ✓{' '}
                {t('biblioteka.import.podsumowanie', {
                  sciezki: wczytany.wynik.liczbaSciezek,
                  kolory: wczytany.wynik.liczbaKolorow,
                })}
              </p>
              {wczytany.wynik.raport.length > 0 ? (
                <div className="uwaga" data-testid="raport-pominieto">
                  <strong>{t('biblioteka.import.pominieto')}</strong>
                  <ul>
                    {wczytany.wynik.raport.map((r) => (
                      <li key={r.kod}>
                        {t(`svg.pominieto.${r.kod}`, { szczegoly: r.szczegoly ?? '' })}
                        {r.ile > 1 ? ` × ${r.ile}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="podpis">{t('biblioteka.import.bezPominiec')}</p>
              )}
              <Przyciski
                etykieta={t('biblioteka.uzyjJako')}
                opcje={RODZAJE.map((r) => ({ wartosc: r, tekst: t(`biblioteka.rodzaj.${r}`) }))}
                wartosc={wczytany.rodzaj}
                zmien={(r) => ustawWczytany({ ...wczytany, rodzaj: r })}
              />
              <Przyciski
                etykieta={t('biblioteka.kolor')}
                opcje={(['jednolity', 'oryginal'] as const).map((k) => ({
                  wartosc: k,
                  tekst: t(`biblioteka.kolor.${k}`),
                }))}
                wartosc={wczytany.kolorowanie}
                zmien={(k) => ustawWczytany({ ...wczytany, kolorowanie: k })}
              />
              <div className="pole-panelu">
                <label htmlFor="nazwa-importu">{t('biblioteka.nazwa')}</label>
                <input
                  id="nazwa-importu"
                  value={wczytany.nazwa}
                  onChange={(e) => ustawWczytany({ ...wczytany, nazwa: e.target.value })}
                />
              </div>
              <div className="akcje-importu">
                <button type="button" className="glowny" onClick={dodaj}>
                  {t('biblioteka.import.dodaj')}
                </button>
                <button type="button" onClick={() => ustawWczytany(undefined)}>
                  {t('biblioteka.import.anuluj')}
                </button>
              </div>
            </>
          )}
          {!wczytany && element && (
            <>
              <h2>{nazwaElementu(element)}</h2>
              {element.rodzaj === 'ramka9' ? (
                <EdytorRamki9 key={element.id} element={element} edycja={edycja} />
              ) : (
                <Podglad
                  key={`${element.id}-${element.rodzaj}-${element.kolorowanie}-${JSON.stringify(element.tresc)}`}
                  element={element}
                  czcionki={czcionki}
                  prefiks="be-"
                />
              )}
              {!obrazowa && (
                <>
                  <Przyciski
                    etykieta={t('biblioteka.uzyjJako')}
                    opcje={RODZAJE.map((r) => ({
                      wartosc: r,
                      tekst: t(`biblioteka.rodzaj.${r}`),
                    }))}
                    wartosc={element.rodzaj}
                    zmien={(r) =>
                      zmien((p) => zmienElementBiblioteki(p, element.id, { rodzaj: r }))
                    }
                  />
                  <Przyciski
                    etykieta={t('biblioteka.kolor')}
                    opcje={(['jednolity', 'oryginal'] as const).map((k) => ({
                      wartosc: k,
                      tekst: t(`biblioteka.kolor.${k}`),
                    }))}
                    wartosc={element.kolorowanie ?? 'oryginal'}
                    zmien={(k) =>
                      zmien((p) => zmienElementBiblioteki(p, element.id, { kolorowanie: k }))
                    }
                  />
                </>
              )}
              <div className="pole-panelu">
                <label htmlFor="nazwa-elementu">{t('biblioteka.nazwa')}</label>
                <input
                  id="nazwa-elementu"
                  value={element.nazwa ?? ''}
                  onChange={(e) =>
                    zmien((p) => zmienElementBiblioteki(p, element.id, { nazwa: e.target.value }), {
                      klucz: `biblioteka:nazwa:${element.id}`,
                    })
                  }
                />
              </div>
              {element.rodzaj === 'ksztalt' && (
                <fieldset className="tresc-ksztaltu">
                  <legend>{t('biblioteka.tresc')}</legend>
                  <div className="dwa-pola">
                    {(['x', 'y', 'szer', 'wys'] as const).map((k) => (
                      <Liczba
                        key={k}
                        etykieta={t(`biblioteka.tresc.${k}`)}
                        wartosc={Math.round((element.tresc ?? TRESC_DOMYSLNA)[k] * 100)}
                        min={k === 'szer' || k === 'wys' ? 1 : 0}
                        max={100}
                        krok={1}
                        zmien={(v) =>
                          zmien(
                            (p) =>
                              zmienElementBiblioteki(p, element.id, {
                                tresc: { ...(element.tresc ?? TRESC_DOMYSLNA), [k]: v / 100 },
                              }),
                            { klucz: `biblioteka:tresc:${element.id}:${k}` },
                          )
                        }
                      />
                    ))}
                  </div>
                </fieldset>
              )}
              <p className="podpis" data-testid="uzycie-elementu">
                {uzywajace.length > 0
                  ? t('biblioteka.uzywany', { szablony: uzywajace.map((s) => s.nazwa).join(', ') })
                  : t('biblioteka.nieuzywany')}
              </p>
              {usuwanie && uzywajace.length > 0 && (
                <p role="alert" className="uwaga">
                  {t('biblioteka.usunUzywany', {
                    szablony: uzywajace.map((s) => s.nazwa).join(', '),
                  })}
                </p>
              )}
              <div className="akcje-importu">
                <button
                  type="button"
                  className="niebezpieczny"
                  onClick={() => {
                    if (uzywajace.length > 0 && !usuwanie) {
                      ustawUsuwanie(true);
                      return;
                    }
                    zmien((p) => usunElementZBiblioteki(p, element.id));
                    ustawWybrany(undefined);
                    ustawUsuwanie(false);
                  }}
                >
                  {usuwanie && uzywajace.length > 0
                    ? t('biblioteka.usunMimoTo')
                    : t('biblioteka.usun')}
                </button>
              </div>
            </>
          )}
          {!wczytany && !element && !blad && <p className="podpis">{t('biblioteka.wybierz')}</p>}
        </section>
      </div>
    </div>
  );
}
