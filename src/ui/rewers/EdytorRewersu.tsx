import { useState } from 'react';
import { t } from '../../i18n';
import type { Projekt } from '../../model/projekt';
import type { PoleObraz, PrzypisanieRewersu, Rewers, Wezel } from '../../model/szablon';
import { dodajElementDoBiblioteki } from '../../dane/biblioteka';
import { dodajZasoby } from '../../dane/edycja';
import { opisObrazu } from '../../dane/obrazy';
import { dodajRewers, przypiszRewers, usunRewers } from '../../dane/rewers';
import { wymiaryKarty } from '../../model/szablon';
import { ELEMENTY_WBUDOWANE } from '../../ozdobniki/katalog';
import { LIMITY_SVG, importujSvg } from '../../ozdobniki/svgImport';
import { renderujRewers } from '../../silnik/rewers';
import { scenaDoSvg } from '../../silnik/svg';
import { NarzedziaPaska } from '../NaglowekAplikacji';
import { przygotujPlikObrazu } from '../obrazy';
import { Liczba, PoleKoloru } from '../szablon/Kontrolki';
import { nazwaElementu } from '../szablon/PanelWygladu';
import { tekstZapisu, type ProjektWEdycji } from '../useProjekt';

const TRYBY = ['wypelnij', 'dopasuj', 'rozciagnij', 'kafelki'] as const;
const osie = ['x', 'y'] as const;
const bladPliku = (e: unknown) => (e instanceof Error ? e.message : String(e));

function zmienProjekt(p: Projekt, id: string, f: (r: Rewers) => Rewers): Projekt {
  if (!p.rewersy?.some((r) => r.id === id)) return p;
  return {
    ...p,
    rewersy: p.rewersy.map((r) => (r.id === id ? f(r) : r)),
    zmieniono: new Date().toISOString(),
  };
}

function ustawWarstwe(r: Rewers, id: string, f: (w: Wezel) => Wezel): Rewers {
  return {
    ...r,
    korzen: { ...r.korzen, dzieci: r.korzen.dzieci.map((w) => (w.id === id ? f(w) : w)) },
  };
}

function Przypisanie({
  nazwa,
  wartosc,
  rewersy,
  zmien,
}: {
  nazwa: string;
  wartosc: PrzypisanieRewersu | undefined;
  rewersy: Rewers[];
  zmien: (id: PrzypisanieRewersu | undefined) => void;
}) {
  return (
    <label>
      {nazwa}
      <select
        value={wartosc === undefined ? '' : wartosc === null ? '-' : `r:${wartosc}`}
        onChange={(e) => {
          const v = e.target.value;
          zmien(v === '' ? undefined : v === '-' ? null : v.slice(2));
        }}
      >
        <option value="">{t('rewers.dziedzicz')}</option>
        <option value="-">{t('rewers.brak')}</option>
        {rewersy.map((r) => (
          <option key={r.id} value={`r:${r.id}`}>
            {r.nazwa}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EdytorRewersu({ edycja }: { edycja: ProjektWEdycji }) {
  const { projekt, zmien } = edycja;
  const [id, ustawId] = useState('');
  const [akt, ustawAkt] = useState('');
  const [taliaId, ustawTalie] = useState('');
  const [blad, ustawBlad] = useState('');
  const rewersy = projekt.rewersy ?? [];
  const r = rewersy.find((x) => x.id === id) ?? rewersy[0];
  const talia = projekt.talie.find((x) => x.id === taliaId) ?? projekt.talie[0];
  const z = edycja.zasoby.zasoby;
  const obrazy = projekt.zasoby.filter((o) => o.rodzaj === 'obraz');
  const ramki = [...ELEMENTY_WBUDOWANE, ...(z.elementy ?? [])].filter(
    (o) => o.rodzaj === 'motyw' || o.rodzaj === 'ramka9',
  );
  const sciezka = `#/projekt/${encodeURIComponent(projekt.id)}`;
  const edytuj = (f: (r: Rewers) => Rewers, klucz?: string) => {
    if (r)
      zmien((p) => zmienProjekt(p, r.id, f), klucz ? { klucz: `rewers:${r.id}:${klucz}` } : {});
  };
  const w = r?.korzen.dzieci.find((d) => d.id === akt);
  const grafika = w && r?.grafiki?.[w.id];
  const zmienWarstwe = (f: (d: Wezel) => Wezel, klucz?: string) => {
    if (w) edytuj((r) => ustawWarstwe(r, w.id, f), klucz && `${w.id}:${klucz}`);
  };
  function nowy() {
    const s = projekt.szablony[0];
    const { szer, wys } = s ? wymiaryKarty(s) : { szer: 63, wys: 88 };
    const id = crypto.randomUUID();
    zmien(
      (p) =>
        dodajRewers(p, {
          id,
          nazwa: t('rewers.domyslny', { numer: (p.rewersy?.length ?? 0) + 1 }),
          rozmiar: { tryb: 'mm', szerokosc: szer, wysokosc: wys },
          korzen: { id: 'korzen', typ: 'swobodny', dzieci: [] },
        }).projekt,
    );
    ustawId(id);
    ustawAkt('');
  }
  function dodajWarstwe(typ: 'tekst' | 'obraz') {
    const id = crypto.randomUUID();
    const wspolne = {
      id,
      szerokosc: { mm: 35 },
      wysokosc: { mm: 20 },
      pozycja: { x: 0, y: 0, kotwica: 'srodek' as const },
    };
    const warstwa: Wezel =
      typ === 'tekst'
        ? {
            ...wspolne,
            typ,
            tekst: t('rewers.tekst'),
            styl: { czcionka: 'tresc', rozmiar: 4, wyrownanie: 'srodek' },
          }
        : { ...wspolne, typ, dopasowanie: 'dopasuj' };
    edytuj((r) => ({ ...r, korzen: { ...r.korzen, dzieci: [...r.korzen.dzieci, warstwa] } }));
    ustawAkt(id);
  }
  function przesun(o: -1 | 1) {
    if (!w || !r) return;
    edytuj((r) => {
      const dzieci = [...r.korzen.dzieci];
      const i = dzieci.findIndex((d) => d.id === w.id);
      if (i < 0 || !dzieci[i + o]) return r;
      [dzieci[i], dzieci[i + o]] = [dzieci[i + o]!, dzieci[i]!];
      return { ...r, korzen: { ...r.korzen, dzieci } };
    });
  }
  function usunWarstwe() {
    if (!w) return;
    edytuj((r) => {
      const grafiki = { ...r.grafiki };
      delete grafiki[w.id];
      return {
        ...r,
        grafiki,
        korzen: { ...r.korzen, dzieci: r.korzen.dzieci.filter((d) => d.id !== w.id) },
      };
    });
    ustawAkt('');
  }
  async function wczytaj(plik: File, cel?: string) {
    if (!r) return;
    ustawBlad('');
    const id = r.id;
    try {
      if (cel && /\.svg$/i.test(plik.name)) {
        if (plik.size > LIMITY_SVG.bajty)
          throw new Error(t('biblioteka.blad.za-duzy', { limit: LIMITY_SVG.bajty / 1024 }));
        const svg = importujSvg(new Uint8Array(await plik.arrayBuffer()), {
          rodzaj: 'ksztalt',
          kolorowanie: 'jednolity',
        });
        if (svg.raport.length)
          ustawBlad(
            [
              t('biblioteka.import.pominieto'),
              ...svg.raport.map((r) =>
                t(`svg.pominieto.${r.kod}`, { szczegoly: r.szczegoly ?? '' }),
              ),
            ].join(' '),
          );
        zmien((p) => {
          if (!p.rewersy?.some((r) => r.id === id && r.korzen.dzieci.some((d) => d.id === cel)))
            return p;
          const w = dodajElementDoBiblioteki(p, plik.name, svg.element);
          return zmienProjekt(w.projekt, id, (r) => ({
            ...ustawRaster(r, cel, undefined),
            grafiki: { ...r.grafiki, [cel]: { element: w.id, kolor: '#000000' } },
          }));
        });
      } else {
        const obraz = await przygotujPlikObrazu(plik);
        await edycja.zmienZZasobami((p, dane) => {
          if (
            !p.rewersy?.some(
              (r) => r.id === id && (!cel || r.korzen.dzieci.some((d) => d.id === cel)),
            )
          )
            return { projekt: p, dane };
          const opis = opisObrazu(
            plik.name,
            obraz.dane,
            obraz,
            new Set([...dane.keys(), ...p.zasoby.map((z) => z.id)]),
          );
          const w = dodajZasoby(p, dane, [{ opis, dane: obraz.dane }]);
          return {
            ...w,
            projekt: zmienProjekt(w.projekt, id, (r) =>
              cel ? ustawRaster(r, cel, opis.id) : { ...r, teksturaTla: opis.id },
            ),
          };
        });
      }
    } catch (e) {
      ustawBlad(bladPliku(e));
    }
  }
  const podglad =
    r &&
    renderujRewers(r, {
      czcionki: z.czcionki,
      obraz: (id) => z.obrazy.get(id)?.info,
      ...(z.elementy ? { elementy: z.elementy } : {}),
    });
  const dzieci = r?.korzen.dzieci ?? [];
  return (
    <div className="edytor-szablonu">
      <header className="naglowek">
        <a className="przycisk-kontur" href={sciezka}>
          {t('szablon.wrocDoKartek')}
        </a>
        <button type="button" onClick={edycja.cofnij} disabled={!edycja.mozeCofnac}>
          {t('kartka.cofnij')}
        </button>
        <button type="button" onClick={edycja.ponow} disabled={!edycja.mozePonowic}>
          {t('kartka.ponow')}
        </button>
        <span role="status">{tekstZapisu(edycja.zapis)}</span>
        <span className="odstep" />
        <NarzedziaPaska />
      </header>
      <div className="uklad-szablonu">
        <aside className="panel-drzewa">
          <h1>{t('rewers.tytul')}</h1>
          <button type="button" onClick={nowy}>
            {t('rewers.nowy')}
          </button>
          {r && (
            <>
              <label>
                {t('rewers.wybierz')}
                <select
                  value={r.id}
                  onChange={(e) => {
                    ustawId(e.target.value);
                    ustawAkt('');
                  }}
                >
                  {rewersy.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nazwa}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('rewers.nazwa')}
                <input
                  value={r.nazwa}
                  onChange={(e) => edytuj((r) => ({ ...r, nazwa: e.target.value }), 'nazwa')}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const ile = [
                    ...projekt.szablony,
                    ...projekt.talie,
                    ...projekt.talie.flatMap((t) => t.karty),
                  ].filter((x) => x.rewersId === r.id).length;
                  if (window.confirm(t('rewers.usunPotwierdz', { liczba: ile })))
                    zmien((p) => usunRewers(p, r.id));
                }}
              >
                {t('rewers.usun')}
              </button>
              <h2>{t('rewers.warstwy')}</h2>
              <div className="wiersz-pola">
                <button type="button" onClick={() => dodajWarstwe('tekst')}>
                  {t('rewers.dodajTekst')}
                </button>
                <button type="button" onClick={() => dodajWarstwe('obraz')}>
                  {t('rewers.dodajGrafike')}
                </button>
              </div>
              <ol className="rewers-warstwy">
                {dzieci.map((d, i) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      aria-pressed={d.id === akt}
                      onClick={() => ustawAkt(d.id)}
                    >
                      {d.nazwa ||
                        (d.typ === 'tekst'
                          ? t('rewers.warstwaTekstu', { numer: i + 1 })
                          : t('rewers.warstwaGrafiki', { numer: i + 1 }))}
                    </button>
                  </li>
                ))}
              </ol>
              {w && (
                <div className="wiersz-pola">
                  <button
                    type="button"
                    disabled={dzieci.at(-1)?.id === w.id}
                    onClick={() => przesun(1)}
                  >
                    {t('rewers.nad')}
                  </button>
                  <button
                    type="button"
                    disabled={dzieci[0]?.id === w.id}
                    onClick={() => przesun(-1)}
                  >
                    {t('rewers.pod')}
                  </button>
                  <button type="button" onClick={usunWarstwe}>
                    {t('rewers.usunWarstwe')}
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
        <section className="podglad-szablonu" aria-label={t('rewers.podglad')}>
          {podglad && (
            <div
              className="karta-podgladu rewers-podglad"
              style={{ aspectRatio: `${podglad.scena.szer} / ${podglad.scena.wys}` }}
            >
              <div
                className="svg-opakowanie"
                dangerouslySetInnerHTML={{
                  __html: scenaDoSvg(podglad.scena, {
                    przedrostekId: 'rw-',
                    adresObrazu: (id) => z.obrazy.get(id)?.adres,
                  }),
                }}
              />
            </div>
          )}
        </section>
        {r && (
          <aside className="panel-edytora">
            <details open={!w}>
              <summary>{t('rewers.tlo')}</summary>
              <PoleKoloru
                etykieta={t('rewers.kolor')}
                wartosc={r.tlo}
                zmien={(v) => edytuj((r) => bezPola(r, 'tlo', v))}
              />
              <label>
                {t('rewers.obrazTla')}
                <select
                  value={r.teksturaTla ?? ''}
                  onChange={(e) =>
                    edytuj((r) => bezPola(r, 'teksturaTla', e.target.value || undefined))
                  }
                >
                  <option value="">{t('rewers.brak')}</option>
                  {obrazy.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nazwa}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('rewers.wgrajTlo')}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const plik = e.target.files?.[0];
                    e.target.value = '';
                    if (plik) void wczytaj(plik);
                  }}
                />
              </label>
              <label>
                {t('rewers.trybTla')}
                <select
                  value={r.dopasowanieTla ?? 'wypelnij'}
                  onChange={(e) =>
                    edytuj((r) => ({
                      ...r,
                      dopasowanieTla: TRYBY.find((v) => v === e.target.value) ?? 'wypelnij',
                    }))
                  }
                >
                  {TRYBY.map((v) => (
                    <option key={v} value={v}>
                      {t(`rewers.tryb.${v}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('rewers.ramka')}
                <select
                  value={r.ramka?.ozdoba?.element ?? ''}
                  onChange={(e) => {
                    const element = ramki.find((o) => o.id === e.target.value);
                    edytuj((r) =>
                      bezPola(
                        r,
                        'ramka',
                        element
                          ? {
                              kolor: '#000000',
                              grubosc: 1,
                              ozdoba:
                                element.rodzaj === 'ramka9'
                                  ? { rodzaj: 'ramka9', element: element.id, grubosc: 2 }
                                  : {
                                      rodzaj: 'motyw',
                                      element: element.id,
                                      szerokosc: 2,
                                      kolor: '#000000',
                                    },
                            }
                          : undefined,
                      ),
                    );
                  }}
                >
                  <option value="">{t('rewers.brak')}</option>
                  {ramki.map((o) => (
                    <option key={o.id} value={o.id}>
                      {nazwaElementu(o)}
                    </option>
                  ))}
                </select>
              </label>
            </details>
            {blad && <p role="alert">{blad}</p>}
            {w && (
              <>
                <h2>{t('szablon.wlasciwosci')}</h2>
                {osie.map((os) => (
                  <Liczba
                    key={os}
                    etykieta={t(`rewers.pozycja.${os}`)}
                    wartosc={w.pozycja?.[os] ?? 0}
                    min={-500}
                    zmien={(v) =>
                      zmienWarstwe(
                        (w) => ({
                          ...w,
                          pozycja: {
                            ...w.pozycja,
                            x: w.pozycja?.x ?? 0,
                            y: w.pozycja?.y ?? 0,
                            [os]: v,
                          },
                        }),
                        os,
                      )
                    }
                  />
                ))}
                <Liczba
                  etykieta={t('rewers.obrot')}
                  wartosc={w.pozycja?.obrot ?? 0}
                  min={0}
                  max={359.9}
                  krok={0.1}
                  zmien={(v) =>
                    zmienWarstwe(
                      (w) => ({ ...w, pozycja: { x: 0, y: 0, ...w.pozycja, obrot: v } }),
                      'obrot',
                    )
                  }
                />
                <Liczba
                  etykieta={t('rewers.szerokosc')}
                  wartosc={wartoscMm(w.szerokosc, 35)}
                  min={1}
                  zmien={(v) => zmienWarstwe((w) => ({ ...w, szerokosc: { mm: v } }), 'szer')}
                />
                <Liczba
                  etykieta={t('rewers.wysokosc')}
                  wartosc={wartoscMm(w.wysokosc, 20)}
                  min={1}
                  zmien={(v) => zmienWarstwe((w) => ({ ...w, wysokosc: { mm: v } }), 'wys')}
                />
                <div className="wiersz-pola">
                  {(['lewy-gorny', 'srodek', 'prawy-dolny'] as const).map((kotwica) => (
                    <button
                      key={kotwica}
                      type="button"
                      onClick={() =>
                        zmienWarstwe((d) => ({
                          ...d,
                          pozycja: { ...d.pozycja, x: 0, y: 0, kotwica },
                        }))
                      }
                    >
                      {t(`rewers.kotwica.${kotwica}`)}
                    </button>
                  ))}
                </div>
                {w.typ === 'tekst' && (
                  <>
                    <label>
                      {t('rewers.tekst')}
                      <textarea
                        value={typeof w.tekst === 'string' ? w.tekst : ''}
                        onChange={(e) =>
                          zmienWarstwe(
                            (w) => (w.typ === 'tekst' ? { ...w, tekst: e.target.value } : w),
                            'tekst',
                          )
                        }
                      />
                    </label>
                    <label>
                      {t('rewers.czcionka')}
                      <select
                        value={w.styl.czcionka}
                        onChange={(e) =>
                          zmienWarstwe((w) =>
                            w.typ === 'tekst'
                              ? { ...w, styl: { ...w.styl, czcionka: e.target.value } }
                              : w,
                          )
                        }
                      >
                        {[
                          ...new Set([
                            w.styl.czcionka,
                            ...Object.keys(projekt.role),
                            ...z.czcionki.nazwyRodzin,
                          ]),
                        ].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Liczba
                      etykieta={t('rewers.rozmiarTekstu')}
                      wartosc={w.styl.rozmiar}
                      min={1}
                      max={120}
                      zmien={(v) =>
                        zmienWarstwe(
                          (w) =>
                            w.typ === 'tekst' ? { ...w, styl: { ...w.styl, rozmiar: v } } : w,
                          'font-rozmiar',
                        )
                      }
                    />
                    <Liczba
                      etykieta={t('rewers.obrys')}
                      wartosc={w.styl.obwodka?.grubosc ?? 0}
                      max={4}
                      krok={0.1}
                      zmien={(v) =>
                        zmienWarstwe((d) => {
                          if (d.typ !== 'tekst') return d;
                          const styl = { ...d.styl };
                          if (v)
                            styl.obwodka = { grubosc: v, kolor: styl.obwodka?.kolor ?? '#000000' };
                          else delete styl.obwodka;
                          return { ...d, styl };
                        }, 'obrys')
                      }
                    />
                    {w.styl.obwodka && (
                      <PoleKoloru
                        etykieta={t('rewers.kolorObrysu')}
                        moznaBrak={false}
                        wartosc={w.styl.obwodka.kolor}
                        zmien={(v) =>
                          zmienWarstwe((d) =>
                            d.typ === 'tekst' && d.styl.obwodka && v
                              ? {
                                  ...d,
                                  styl: { ...d.styl, obwodka: { ...d.styl.obwodka, kolor: v } },
                                }
                              : d,
                          )
                        }
                      />
                    )}
                    <PoleKoloru
                      etykieta={t('rewers.kolor')}
                      moznaBrak={false}
                      wartosc={w.styl.kolor}
                      zmien={(v) =>
                        zmienWarstwe((w) =>
                          w.typ === 'tekst' && v ? { ...w, styl: { ...w.styl, kolor: v } } : w,
                        )
                      }
                    />
                  </>
                )}
                {w.typ === 'obraz' && (
                  <>
                    <label>
                      {t('rewers.wgrajGrafike')}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        onChange={(e) => {
                          const plik = e.target.files?.[0];
                          e.target.value = '';
                          if (plik) void wczytaj(plik, w.id);
                        }}
                      />
                    </label>
                    <label>
                      {t('wlasciwosci.obrazStaly')}
                      <select
                        value={grafika ? '!svg' : (w.zasob ?? '')}
                        onChange={(e) =>
                          edytuj((r) => ustawRaster(r, w.id, e.target.value || undefined))
                        }
                      >
                        {grafika && (
                          <option value="!svg" disabled>
                            {t('rewers.grafikaSvg')}
                          </option>
                        )}
                        <option value="">{t('rewers.brak')}</option>
                        {obrazy.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.nazwa}
                          </option>
                        ))}
                      </select>
                    </label>
                    {grafika && (
                      <PoleKoloru
                        etykieta={t('rewers.kolor')}
                        moznaBrak={false}
                        wartosc={grafika.kolor}
                        zmien={(v) => {
                          if (v)
                            edytuj((r) => ({
                              ...r,
                              grafiki: { ...r.grafiki, [w.id]: { ...grafika, kolor: v } },
                            }));
                        }}
                      />
                    )}
                  </>
                )}
              </>
            )}
            <details>
              <summary>{t('rewers.przypisania')}</summary>
              <h3>{t('rewers.szablony')}</h3>
              {projekt.szablony.map((s) => (
                <Przypisanie
                  key={s.id}
                  nazwa={s.nazwa}
                  wartosc={s.rewersId}
                  rewersy={rewersy}
                  zmien={(id) =>
                    zmien((p) => przypiszRewers(p, { rodzaj: 'szablon', id: s.id }, id))
                  }
                />
              ))}
              <h3>{t('rewers.talie')}</h3>
              {projekt.talie.map((talia) => (
                <Przypisanie
                  key={talia.id}
                  nazwa={talia.nazwa}
                  wartosc={talia.rewersId}
                  rewersy={rewersy}
                  zmien={(id) =>
                    zmien((p) => przypiszRewers(p, { rodzaj: 'talia', id: talia.id }, id))
                  }
                />
              ))}
              {talia && (
                <>
                  <h3>{t('rewers.karty')}</h3>
                  <label>
                    {t('rewers.talia')}
                    <select value={talia.id} onChange={(e) => ustawTalie(e.target.value)}>
                      {projekt.talie.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nazwa}
                        </option>
                      ))}
                    </select>
                  </label>
                  {talia.karty.map((k, i) => (
                    <Przypisanie
                      key={k.id}
                      nazwa={k.dane.nazwa || t('rewers.numerKarty', { numer: i + 1 })}
                      wartosc={k.rewersId}
                      rewersy={rewersy}
                      zmien={(id) =>
                        zmien((p) =>
                          przypiszRewers(p, { rodzaj: 'karta', taliaId: talia.id, id: k.id }, id),
                        )
                      }
                    />
                  ))}
                </>
              )}
            </details>
          </aside>
        )}
      </div>
    </div>
  );
}

function bezPola<K extends keyof Rewers>(r: Rewers, k: K, v: Rewers[K]): Rewers {
  const x = { ...r };
  if (v === undefined) delete x[k];
  else x[k] = v;
  return x;
}

function ustawRaster(r: Rewers, id: string, zasob: PoleObraz['zasob']): Rewers {
  const grafiki = { ...r.grafiki };
  delete grafiki[id];
  return ustawWarstwe({ ...r, grafiki }, id, (w) => {
    if (w.typ !== 'obraz') return w;
    const x = { ...w };
    if (zasob === undefined) delete x.zasob;
    else x.zasob = zasob;
    return x;
  });
}

function wartoscMm(v: Wezel['szerokosc'], domyslna: number): number {
  return v && typeof v === 'object' && 'mm' in v ? v.mm : domyslna;
}
