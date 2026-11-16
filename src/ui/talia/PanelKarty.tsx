import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { dodajZasoby, ustawDane, ustawObrazKarty } from '../../dane/edycja';
import { opisObrazu } from '../../dane/obrazy';
import { BladDanych } from '../../dane/schemat';
import { t, tJesliJest } from '../../i18n';
import {
  czyKontener,
  korzenKarty,
  type Karta,
  type PoleObraz,
  type Szablon,
  type Talia,
  type UstawieniaObrazu,
  type Wezel,
} from '../../model/szablon';
import { normalizujUstawieniaObrazu, renderujKarte } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import { nazwaRoli } from '../czcionki/Czcionki';
import { przygotujObraz } from '../obrazy';
import { tekstOstrzezenia } from '../ostrzezenia';
import type { ProjektWEdycji } from '../useProjekt';

/** Skala podglądu karty (piksele CSS na milimetr). */
const PX_NA_MM = 6;
const SKALA_MIN = 0.05;
const SKALA_MAX = 20;

function polaObrazu(w: Wezel): PoleObraz[] {
  if (czyKontener(w)) return w.dzieci.flatMap(polaObrazu);
  return w.typ === 'obraz' ? [w] : [];
}

const zaokr = (v: number, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

/**
 * Panel zaznaczonej karty: podgląd (ten sam silnik SVG co arkusz i PDF) i ustawienia obrazu.
 * Na podglądzie: przeciąganie przesuwa obraz, kółko myszy go skaluje.
 */
export function PanelKarty({
  edycja,
  talia,
  karta,
}: {
  edycja: ProjektWEdycji;
  talia: Talia;
  karta: Karta;
}) {
  const { projekt, zmien, zasoby } = edycja;
  const szablon: Szablon | undefined = projekt.szablony.find((s) => s.id === karta.szablonId);
  const pola = useMemo(
    () => (szablon ? polaObrazu(korzenKarty(szablon, karta)) : []),
    [szablon, karta],
  );
  const [wybranePole, ustawWybranePole] = useState<string>();
  const pole = pola.find((p) => p.id === wybranePole) ?? pola[0];
  // Podczas przeciągania ustawienia są lokalne (płynny podgląd bez przeliczania całej strony);
  // do projektu trafiają raz, po puszczeniu przycisku.
  const [tymczasowe, ustawTymczasowe] = useState<UstawieniaObrazu>();
  const zapisane = pole ? karta.obrazy?.[pole.id] : undefined;
  const ustawienia = tymczasowe ?? zapisane;
  const u = normalizujUstawieniaObrazu(ustawienia);
  const kartaPodgladu = useMemo(
    () =>
      tymczasowe && pole ? { ...karta, obrazy: { ...karta.obrazy, [pole.id]: tymczasowe } } : karta,
    [karta, tymczasowe, pole],
  );
  const [blad, ustawBlad] = useState<string>();
  const [podglad, ustawPodglad] = useState<HTMLDivElement | null>(null);
  const plik = useRef<HTMLInputElement>(null);
  const T = talia.id;

  const render = useMemo(() => {
    if (!szablon) return { blad: t('karta.brakSzablonu', { id: karta.szablonId }) };
    try {
      const { wynik: w, braki } = zasoby.zasoby.czcionki.sledzBraki(() =>
        renderujKarte(szablon, kartaPodgladu, {
          czcionki: zasoby.zasoby.czcionki,
          obraz: (id) => zasoby.zasoby.obrazy.get(id)?.info,
        }),
      );
      return {
        wynik: w,
        brakujace: braki,
        svg: scenaDoSvg(w.scena, {
          adresObrazu: (id) => zasoby.zasoby.obrazy.get(id)?.adres,
          przedrostekId: 'podglad',
          atrybuty: {
            role: 'img',
            'aria-label': t('karta.podglad'),
          },
        }),
      };
    } catch (e) {
      return { blad: e instanceof Error ? e.message : String(e) };
    }
  }, [szablon, karta, kartaPodgladu, zasoby]);

  const zmienObraz = (f: (u: UstawieniaObrazu) => UstawieniaObrazu | undefined) => {
    if (!pole) return;
    zmien((p) => {
      const k = p.talie.find((x) => x.id === T)?.karty.find((x) => x.id === karta.id);
      const nowe = f(normalizujUstawieniaObrazu(k?.obrazy?.[pole.id]));
      return ustawObrazKarty(p, T, karta.id, pole.id, nowe && uprosc(nowe));
    });
  };

  // Kółko myszy – nasłuch niepasywny (bez przewijania strony), na bieżącym elemencie podglądu.
  const zmienObrazRef = useRef(zmienObraz);
  useEffect(() => {
    zmienObrazRef.current = zmienObraz;
  });
  const maObraz = !!pole;
  useEffect(() => {
    if (!podglad || !maObraz) return;
    const kolko = (e: WheelEvent) => {
      e.preventDefault();
      // Krok zależny od siły obrotu (touchpad daje małe deltaY), skala w granicach pola liczbowego.
      const mnoznik = Math.exp(-Math.max(-200, Math.min(200, e.deltaY)) * 0.00095);
      zmienObrazRef.current((x) => ({
        ...x,
        skala: zaokr(Math.min(SKALA_MAX, Math.max(SKALA_MIN, (x.skala ?? 1) * mnoznik)), 3),
      }));
    };
    podglad.addEventListener('wheel', kolko, { passive: false });
    return () => podglad.removeEventListener('wheel', kolko);
  }, [podglad, maObraz]);

  const przeciaganie = useRef<
    { x: number; y: number; mmNaPx: number; u: UstawieniaObrazu } | undefined
  >(undefined);
  const zakonczPrzeciaganie = () => {
    const p = przeciaganie.current;
    przeciaganie.current = undefined;
    if (p && tymczasowe) zmienObraz(() => p.u);
    ustawTymczasowe(undefined);
  };

  const wgraj = async (f: File) => {
    ustawBlad(undefined);
    try {
      // Zdjęcia z telefonu: obrót z EXIF zastosowany od razu (podgląd = PDF).
      const { dane: bajty, ...wymiary } = await przygotujObraz(
        new Uint8Array(await f.arrayBuffer()),
      );
      const klucz = pole?.klucz;
      // Id i przypisanie liczone z najnowszego projektu (edycje w trakcie wczytywania zostają).
      await edycja.zmienZZasobami((p, d) => {
        const opis = opisObrazu(f.name, bajty, wymiary, new Set(p.zasoby.map((z) => z.id)));
        const w = dodajZasoby(p, d, [{ opis, dane: bajty }]);
        return {
          projekt: klucz ? ustawDane(w.projekt, T, karta.id, klucz, opis.id) : w.projekt,
          dane: w.dane,
        };
      });
    } catch (e) {
      ustawBlad(e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e));
    }
  };

  const obrazy = projekt.zasoby.filter((z) => z.rodzaj === 'obraz');

  return (
    <aside className="panel-karty" aria-label={t('karta.panel')}>
      <h2>{karta.dane.nazwa || t('karta.bezNazwy')}</h2>
      {render.blad !== undefined ? (
        <p role="alert" className="uwaga">
          {render.blad}
        </p>
      ) : (
        <div
          ref={ustawPodglad}
          className={`podglad-karty ${pole ? 'przesuwalny' : ''}`}
          style={
            { '--szer-px': `${(render.wynik?.scena.szer ?? 0) * PX_NA_MM}px` } as CSSProperties
          }
          title={pole ? t('karta.wskazowkaMyszy') : undefined}
          onPointerDown={(e) => {
            if (!pole || e.button !== 0) return;
            const svg = podglad?.querySelector('svg');
            if (!svg || !render.wynik) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            przeciaganie.current = {
              x: e.clientX,
              y: e.clientY,
              mmNaPx: render.wynik.scena.szer / svg.getBoundingClientRect().width,
              u,
            };
          }}
          onPointerMove={(e) => {
            const p = przeciaganie.current;
            if (!p) return;
            const dx = (e.clientX - p.x) * p.mmNaPx;
            const dy = (e.clientY - p.y) * p.mmNaPx;
            if (Math.abs(dx) + Math.abs(dy) < 0.05) return;
            const nowe = {
              ...p.u,
              przesuniecie: {
                x: zaokr((p.u.przesuniecie?.x ?? 0) + dx),
                y: zaokr((p.u.przesuniecie?.y ?? 0) + dy),
              },
            };
            przeciaganie.current = { ...p, x: e.clientX, y: e.clientY, u: nowe };
            ustawTymczasowe(nowe);
          }}
          onPointerUp={zakonczPrzeciaganie}
          onPointerCancel={zakonczPrzeciaganie}
          dangerouslySetInnerHTML={{ __html: render.svg ?? '' }}
        />
      )}
      {render.brakujace && render.brakujace.length > 0 && (
        <p className="ostrzezenia-karty">
          {t('czcionki.brakujace', { lista: render.brakujace.map(nazwaRoli).join(', ') })}
        </p>
      )}
      {render.wynik && render.wynik.ostrzezenia.length > 0 && (
        <ul className="ostrzezenia-karty">
          {render.wynik.ostrzezenia.map((o, i) => (
            <li key={i}>{tekstOstrzezenia(o)}</li>
          ))}
        </ul>
      )}
      {pole && (
        <fieldset className="ustawienia-obrazu">
          <legend>{t('karta.obraz')}</legend>
          {pola.length > 1 && (
            <label>
              {t('karta.poleObrazu')}{' '}
              <select value={pole.id} onChange={(e) => ustawWybranePole(e.target.value)}>
                {pola.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.klucz && tJesliJest(`pole.${p.klucz}`)) || p.klucz || p.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          {pole.klucz && (
            <div className="wiersz-pol">
              <label>
                {t('karta.plikObrazu')}{' '}
                <select
                  value={karta.dane[pole.klucz] ?? ''}
                  onChange={(e) =>
                    zmien((p) => ustawDane(p, T, karta.id, pole.klucz!, e.target.value))
                  }
                >
                  <option value="">{t('karta.brakObrazu')}</option>
                  {obrazy.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nazwa}
                    </option>
                  ))}
                  {karta.dane[pole.klucz] &&
                    !obrazy.some((o) => o.id === karta.dane[pole.klucz!]) && (
                      <option value={karta.dane[pole.klucz]}>
                        {t('karta.nieznanyObraz', { id: karta.dane[pole.klucz]! })}
                      </option>
                    )}
                </select>
              </label>
              <button type="button" onClick={() => plik.current?.click()}>
                {t('karta.wgrajObraz')}
              </button>
              <input
                ref={plik}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                data-testid="plik-obrazu"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void wgraj(f);
                }}
              />
            </div>
          )}
          {blad && (
            <p role="alert" className="uwaga">
              {blad}
            </p>
          )}
          <div className="wiersz-pol">
            <Liczba
              etykieta={t('karta.skala')}
              wartosc={u.skala ?? 1}
              krok={0.05}
              min={SKALA_MIN}
              zmiana={(v) => zmienObraz((x) => ({ ...x, skala: v }))}
            />
            <Liczba
              etykieta={t('karta.przesuniecieX')}
              wartosc={u.przesuniecie?.x ?? 0}
              krok={0.5}
              zmiana={(v) =>
                zmienObraz((x) => ({ ...x, przesuniecie: { x: v, y: x.przesuniecie?.y ?? 0 } }))
              }
            />
            <Liczba
              etykieta={t('karta.przesuniecieY')}
              wartosc={u.przesuniecie?.y ?? 0}
              krok={0.5}
              zmiana={(v) =>
                zmienObraz((x) => ({ ...x, przesuniecie: { x: x.przesuniecie?.x ?? 0, y: v } }))
              }
            />
            <Liczba
              etykieta={t('karta.obrot')}
              wartosc={u.obrot ?? 0}
              krok={1}
              zmiana={(v) => zmienObraz((x) => ({ ...x, obrot: v }))}
            />
          </div>
          <div className="wiersz-pol">
            <label>
              {t('karta.dopasowanie')}{' '}
              <select
                value={ustawienia?.dopasowanie ?? ''}
                onChange={(e) =>
                  zmienObraz((x) => {
                    const { dopasowanie: _d, ...reszta } = x;
                    void _d;
                    const v = e.target.value as UstawieniaObrazu['dopasowanie'] | '';
                    return v ? { ...reszta, dopasowanie: v } : reszta;
                  })
                }
              >
                <option value="">
                  {t('karta.dopasowanieSzablonu', { tryb: t(`karta.tryb.${pole.dopasowanie}`) })}
                </option>
                <option value="dopasuj">{t('karta.tryb.dopasuj')}</option>
                <option value="wypelnij">{t('karta.tryb.wypelnij')}</option>
                <option value="rozciagnij">{t('karta.tryb.rozciagnij')}</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!ustawienia}
              onClick={() => zmienObraz(() => undefined)}
            >
              {t('karta.resetuj')}
            </button>
          </div>
        </fieldset>
      )}
    </aside>
  );
}

/** Usuwa wartości domyślne (skala 1, przesunięcie 0, obrót 0) – zapis tylko zmian. */
function uprosc(u: UstawieniaObrazu): UstawieniaObrazu {
  const w: UstawieniaObrazu = {};
  if (u.skala !== undefined && u.skala !== 1) w.skala = u.skala;
  if (u.przesuniecie && (u.przesuniecie.x !== 0 || u.przesuniecie.y !== 0))
    w.przesuniecie = u.przesuniecie;
  if (u.obrot) w.obrot = u.obrot;
  if (u.dopasowanie) w.dopasowanie = u.dopasowanie;
  return w;
}

function Liczba({
  etykieta,
  wartosc,
  krok,
  min,
  zmiana,
}: {
  etykieta: string;
  wartosc: number;
  krok: number;
  min?: number;
  zmiana: (v: number) => void;
}) {
  return (
    <label>
      {etykieta}{' '}
      <input
        type="number"
        step={krok}
        min={min}
        value={zaokr(wartosc, 3)}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v) && (min === undefined || v >= min)) zmiana(v);
        }}
      />
    </label>
  );
}
