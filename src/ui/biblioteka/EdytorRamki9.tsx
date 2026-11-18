import { useMemo, useRef, useState } from 'react';
import { zmienElementBiblioteki } from '../../dane/biblioteka';
import { formatujLiczbe, t } from '../../i18n';
import {
  MIN_DPI_RAMKI,
  dpiRogow,
  type ElementOzdobny,
  type UstawieniaRamki9,
} from '../../ozdobniki';
import { konturNaD } from '../../silnik/svg';
import { Liczba } from '../szablon/Kontrolki';
import type { ProjektWEdycji } from '../useProjekt';
import { KOLOR_PODGLADU, podgladElementu } from './podgladElementu';

type Strona = keyof UstawieniaRamki9['wciecia'];
const STRONY: Strona[] = ['gora', 'prawo', 'dol', 'lewo'];

const POMOC_PODGLADY = [
  { szer: 63, wys: 88, klucz: 'karta' },
  { szer: 88, wys: 63, klucz: 'karta' },
  { szer: 50, wys: 18, klucz: 'mala' },
] as const;

const PRZECIWNA: Record<Strona, Strona> = {
  lewo: 'prawo',
  prawo: 'lewo',
  gora: 'dol',
  dol: 'gora',
};

/** Największe wcięcie strony: wymiar źródła minus wcięcie strony przeciwnej (przeciwna się nie zmienia). */
export const maksWciecie = (
  strona: Strona,
  element: Pick<ElementOzdobny, 'szer' | 'wys'>,
  wciecia: UstawieniaRamki9['wciecia'],
) =>
  Math.max(
    0,
    (strona === 'lewo' || strona === 'prawo' ? element.szer : element.wys) -
      wciecia[PRZECIWNA[strona]],
  );

/** Wartość wcięcia: piksele PNG – całkowite, jednostki SVG – do 0,01 (jak z myszy). */
const zaokraglij = (v: number, calkowite: boolean) =>
  calkowite ? Math.round(v) : Math.round(v * 100) / 100;

/**
 * Linia wcięcia na podglądzie źródła: przeciągana myszą, sterowana klawiaturą (strzałki ±1,
 * Shift/PageUp/PageDown ±10, Home/End – skrajne wartości); wartość w jednostkach źródła.
 */
function LiniaWciecia({
  strona,
  element,
  wciecia,
  ustaw,
  pojemnik,
  jednostka,
}: {
  strona: Strona;
  element: ElementOzdobny;
  wciecia: UstawieniaRamki9['wciecia'];
  ustaw: (strona: Strona, v: number) => void;
  pojemnik: React.RefObject<HTMLDivElement | null>;
  jednostka: string;
}) {
  const pionowa = strona === 'lewo' || strona === 'prawo';
  const rozmiar = pionowa ? element.szer : element.wys;
  const wartosc = wciecia[strona];
  const max = maksWciecie(strona, element, wciecia);
  // Położenie linii od lewej / od góry.
  const pozycja = strona === 'lewo' || strona === 'gora' ? wartosc : rozmiar - wartosc;
  const calkowite = element.ramka9?.zrodlo.typ === 'obraz';
  const krok = calkowite ? 1 : Math.max(0.01, Math.round(rozmiar) / 200);
  const przelicz = (clientX: number, clientY: number) => {
    const r = pojemnik.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return;
    const p = pionowa
      ? ((clientX - r.left) / r.width) * rozmiar
      : ((clientY - r.top) / r.height) * rozmiar;
    ustaw(strona, zaokraglij(strona === 'lewo' || strona === 'gora' ? p : rozmiar - p, calkowite));
  };
  const nazwa = t('biblioteka.ramka9.liniaWciecia', { strona: t(`biblioteka.ramka9.${strona}`) });
  return (
    <div
      className={`linia-wciecia ${pionowa ? 'pionowa' : 'pozioma'}`}
      role="slider"
      tabIndex={0}
      aria-label={nazwa}
      aria-orientation={pionowa ? 'horizontal' : 'vertical'}
      aria-valuemin={0}
      aria-valuemax={zaokraglij(max, calkowite)}
      aria-valuenow={wartosc}
      aria-valuetext={`${wartosc} ${jednostka}`}
      data-testid={`linia-${strona}`}
      style={
        pionowa
          ? { left: `${(pozycja / rozmiar) * 100}%` }
          : { top: `${(pozycja / rozmiar) * 100}%` }
      }
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) przelicz(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onKeyDown={(e) => {
        // Strzałka przesuwa linię na ekranie; dla prawej i dolnej wcięcie rośnie w przeciwną stronę.
        const odwrotnie = strona === 'prawo' || strona === 'dol';
        const znak =
          e.key === 'ArrowRight' || e.key === 'ArrowDown'
            ? 1
            : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
              ? -1
              : e.key === 'PageUp'
                ? 10
                : e.key === 'PageDown'
                  ? -10
                  : 0;
        if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          ustaw(strona, e.key === 'Home' ? 0 : zaokraglij(max, calkowite));
          return;
        }
        if (!znak) return;
        e.preventDefault();
        const przyrost = (odwrotnie && Math.abs(znak) === 1 ? -znak : znak) * krok;
        const mnoznik = e.shiftKey && Math.abs(znak) === 1 ? 10 : 1;
        ustaw(strona, zaokraglij(Math.max(0, wartosc + przyrost * mnoznik), calkowite));
      }}
    />
  );
}

/**
 * Edytor wcięć ramki 9-slice (makieta M2b-3, środkowa kolumna): źródło z czterema przeciąganymi
 * liniami, pola liczb, boki, środek, grubość próbna z informacją o dpi oraz podglądy w trzech
 * rozmiarach (ten sam silnik co na kartach).
 */
export function EdytorRamki9({
  element,
  edycja,
}: {
  element: ElementOzdobny;
  edycja: ProjektWEdycji;
}) {
  const { zmien } = edycja;
  const u = element.ramka9;
  const pojemnik = useRef<HTMLDivElement>(null);
  const [jednakowe, ustawJednakowe] = useState(false);
  const png = u?.zrodlo.typ === 'obraz';
  const [grubosc, ustawGrubosc] = useState(png ? 2.5 : 4);
  const zasoby = edycja.zasoby.zasoby;
  const adres = u?.zrodlo.typ === 'obraz' ? zasoby.obrazy.get(u.zrodlo.zasob)?.adres : undefined;
  const jednostka = t(png ? 'biblioteka.ramka9.jednostkaPx' : 'biblioteka.ramka9.jednostkaSvg');

  const podglady = useMemo(
    () =>
      u
        ? POMOC_PODGLADY.map((p, i) => ({
            ...p,
            wynik: podgladElementu(element, zasoby.czcionki, `r9${i}-`, {
              obrazy: zasoby.obrazy,
              rozmiar: { szer: p.szer, wys: p.wys, grubosc },
              ...(zasoby.elementy ? { elementy: zasoby.elementy } : {}),
            }),
          }))
        : [],
    [element, u, zasoby.czcionki, zasoby.obrazy, zasoby.elementy, grubosc],
  );
  if (!u) return null;

  const zmienUstawienia = (z: Partial<UstawieniaRamki9>, klucz?: string) =>
    zmien(
      (p) => zmienElementBiblioteki(p, element.id, { ramka9: { ...u, ...z } }),
      klucz ? { klucz } : undefined,
    );
  // „Takie same na wszystkich bokach”: samo zaznaczenie niczego nie zmienia (poprzednie wartości
  // zostają, aż do pierwszej zmiany); dopiero zmiana ustawia wszystkie cztery wcięcia naraz.
  const ustawWciecie = (strona: Strona, v: number) => {
    const wartosc = (max: number) => Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0));
    const nowe = jednakowe
      ? (() => {
          const w = wartosc(Math.min(element.szer, element.wys) / 2);
          return { gora: w, prawo: w, dol: w, lewo: w };
        })()
      : { ...u.wciecia, [strona]: wartosc(maksWciecie(strona, element, u.wciecia)) };
    zmienUstawienia({ wciecia: nowe }, `biblioteka:wciecia:${element.id}`);
  };
  const najgrubsze = Math.max(...STRONY.map((s) => u.wciecia[s]));
  const dpi = png && najgrubsze > 0 ? dpiRogow(grubosc / najgrubsze) : undefined;
  const kolor = (k: string) => (k === 'kolor' ? KOLOR_PODGLADU : k);

  return (
    <div className="edytor-ramki9" data-testid="edytor-ramki9">
      <p className="podpis">
        {png && u.zrodlo.typ === 'obraz'
          ? t('biblioteka.ramka9.zrodloPng', {
              zasob: u.zrodlo.zasob,
              szer: element.szer,
              wys: element.wys,
            })
          : t('biblioteka.ramka9.zrodloSvg', {
              szer: formatujLiczbe(element.szer, 2),
              wys: formatujLiczbe(element.wys, 2),
            })}
      </p>
      <div className="ramka9-glowna">
        <div
          ref={pojemnik}
          className="zrodlo-ramki9"
          style={{ aspectRatio: `${element.szer} / ${element.wys}` }}
        >
          {adres ? (
            <img src={adres} alt="" draggable={false} />
          ) : png ? (
            <p role="alert" className="uwaga">
              {t('biblioteka.ramka9.brakObrazu')}
            </p>
          ) : (
            <svg viewBox={`0 0 ${element.szer} ${element.wys}`} aria-hidden="true">
              {element.kontury.map((c, i) => (
                <path
                  key={i}
                  d={konturNaD(c.kontur)}
                  fill={c.wypelnienie ? kolor(c.wypelnienie) : 'none'}
                  fillRule={c.evenodd ? 'evenodd' : 'nonzero'}
                  stroke={c.obrys ? kolor(c.obrys.kolor) : 'none'}
                  strokeWidth={c.obrys?.grubosc}
                />
              ))}
            </svg>
          )}
          {STRONY.map((s) => (
            <LiniaWciecia
              key={s}
              strona={s}
              element={element}
              wciecia={u.wciecia}
              ustaw={ustawWciecie}
              pojemnik={pojemnik}
              jednostka={jednostka}
            />
          ))}
        </div>
        <div className="ustawienia-ramki9">
          <span className="etykieta-grupy">{t('biblioteka.ramka9.wciecia', { jednostka })}</span>
          <div className="dwa-pola">
            {STRONY.map((s) => (
              <Liczba
                key={s}
                etykieta={t(`biblioteka.ramka9.${s}`)}
                wartosc={u.wciecia[s]}
                min={0}
                max={maksWciecie(s, element, u.wciecia)}
                krok={png ? 1 : 0.1}
                zmien={(v) => ustawWciecie(s, v)}
              />
            ))}
          </div>
          <label className="wybor-prosty">
            <input
              type="checkbox"
              checked={jednakowe}
              onChange={(e) => ustawJednakowe(e.target.checked)}
            />{' '}
            {t('biblioteka.ramka9.jednakowe')}
          </label>
          <Przyciski
            etykieta={t('biblioteka.ramka9.boki')}
            wartosc={u.boki}
            opcje={(['rozciagnij', 'powtarzaj'] as const).map((k) => ({
              wartosc: k,
              tekst: t(`biblioteka.ramka9.boki.${k}`),
            }))}
            zmien={(boki) => zmienUstawienia({ boki })}
          />
          <Przyciski
            etykieta={t('biblioteka.ramka9.srodek')}
            wartosc={u.srodek}
            opcje={(['wypelnij', 'pomin'] as const).map((k) => ({
              wartosc: k,
              tekst: t(`biblioteka.ramka9.srodek.${k}`),
            }))}
            zmien={(srodek) => zmienUstawienia({ srodek })}
          />
          <Liczba
            etykieta={t('biblioteka.ramka9.grubosc')}
            wartosc={grubosc}
            min={0.2}
            max={30}
            krok={0.1}
            zmien={ustawGrubosc}
          />
          {dpi !== undefined && (
            <p
              className={dpi < MIN_DPI_RAMKI ? 'uwaga' : 'podpis'}
              role={dpi < MIN_DPI_RAMKI ? 'alert' : undefined}
              data-testid="dpi-ramki"
            >
              {t('biblioteka.ramka9.dpi', {
                wciecie: najgrubsze,
                grubosc: formatujLiczbe(grubosc, 2),
                dpi: Math.round(dpi),
              })}
              {dpi < MIN_DPI_RAMKI && (
                <> {t('biblioteka.ramka9.dpiNiskie', { dpi: Math.round(dpi) })}</>
              )}
            </p>
          )}
        </div>
      </div>
      <p className="podpis">{t('biblioteka.ramka9.podglad')}</p>
      <div className="podglady-ramki9">
        {podglady.map((p, i) =>
          p.wynik ? (
            <figure key={i}>
              <div
                className="podglad-elementu"
                data-testid={`podglad-ramki9-${i}`}
                style={{
                  aspectRatio: `${p.wynik.szer} / ${p.wynik.wys}`,
                  width: `${p.wynik.szer * 2.4}px`,
                }}
                dangerouslySetInnerHTML={{ __html: p.wynik.svg }}
              />
              <figcaption className="podpis">
                {p.klucz === 'karta'
                  ? t('biblioteka.ramka9.podgladKarta', {
                      szer: formatujLiczbe(p.szer, 2),
                      wys: formatujLiczbe(p.wys, 2),
                    })
                  : t('biblioteka.ramka9.podgladMala', {
                      szer: p.szer,
                      wys: p.wys,
                      grubosc: formatujLiczbe(grubosc, 2),
                    })}
              </figcaption>
            </figure>
          ) : null,
        )}
      </div>
    </div>
  );
}

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
