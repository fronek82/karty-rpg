import type { KeyboardEvent, PointerEvent } from 'react';
import { t } from '../../i18n';
import type { Mm } from '../../model/jednostki';
import { liczbaMm, UCHWYTY, punktUchwytu, type Uchwyt } from './swobodnyMysz';
import type { StanGestu } from './useGestSwobodny';

/**
 * Elementy rysowane nad podglądem karty wyłącznie w edytorze (nie ma ich w scenie, SVG ani PDF):
 * siatka i prowadnice w trakcie gestu, podpowiedź X · Y oraz 8 uchwytów rozmiaru zaznaczonego pola.
 * Położenia w % karty, więc skala podglądu nie ma znaczenia; uchwyty mają stały rozmiar w pikselach.
 */
export function NakladkaSwobodna({
  szer,
  wys,
  stan,
  siatka,
  prostokat,
  uchwytDown,
  uchwytKlawisz,
}: {
  szer: Mm;
  wys: Mm;
  stan: StanGestu | undefined;
  siatka: Mm;
  /** Prostokąt zaznaczonego pola (mm od rogu karty) – uchwyty tylko dla jednego pola; undefined = bez uchwytów. */
  prostokat: { x: Mm; y: Mm; szer: Mm; wys: Mm } | undefined;
  uchwytDown: (u: Uchwyt, e: PointerEvent) => void;
  uchwytKlawisz: (u: Uchwyt, e: KeyboardEvent) => void;
}) {
  const upuszczenie = stan?.upuszczenie;
  const px = stan?.skala ?? 0;
  const szerokoscPx = px * szer;
  // Siatka rysowana rzadziej, gdy kreski byłyby gęstsze niż co 6 px.
  let krok = siatka;
  if (siatka > 0 && px > 0) while (krok * px < 6) krok += siatka;
  return (
    <>
      {/* Aktualny rozmiar zaznaczonego pola dla czytników ekranu (po zmianie uchwytem z klawiatury). */}
      <div className="tylko-czytnik" role="status" aria-live="polite">
        {prostokat
          ? t('nakladka.rozmiarKomunikat', {
              szer: liczbaMm(prostokat.szer),
              wys: liczbaMm(prostokat.wys),
            })
          : ''}
      </div>
      {stan && !upuszczenie && siatka > 0 && px > 0 && (
        <div
          className="siatka-podgladu"
          aria-hidden="true"
          data-testid="siatka"
          style={{
            backgroundSize: `${krok * px}px ${krok * px}px`,
            backgroundPosition: `${stan.poczatekSiatki.x * px}px ${stan.poczatekSiatki.y * px}px`,
          }}
        />
      )}
      {upuszczenie && (
        <div
          aria-hidden="true"
          className="cel-upuszczenia"
          data-testid="cel-upuszczenia"
          style={{
            left: `${(upuszczenie.ramka.x / szer) * 100}%`,
            top: `${(upuszczenie.ramka.y / wys) * 100}%`,
            width: `${(upuszczenie.ramka.szer / szer) * 100}%`,
            height: `${(upuszczenie.ramka.wys / wys) * 100}%`,
          }}
        >
          {upuszczenie.wskaznik && (
            <div
              className={`prowadnica prowadnica-${upuszczenie.wskaznik.os}`}
              style={
                upuszczenie.wskaznik.os === 'x'
                  ? {
                      left: `${((upuszczenie.wskaznik.polozenie - upuszczenie.ramka.x) / upuszczenie.ramka.szer) * 100}%`,
                    }
                  : {
                      top: `${((upuszczenie.wskaznik.polozenie - upuszczenie.ramka.y) / upuszczenie.ramka.wys) * 100}%`,
                    }
              }
            />
          )}
        </div>
      )}
      {stan?.prowadnice.map((p) => (
        <div
          key={`${p.os}${p.polozenie}`}
          className={`prowadnica prowadnica-${p.os}`}
          aria-hidden="true"
          data-testid="prowadnica"
          data-os={p.os}
          style={
            p.os === 'x'
              ? { left: `${(p.polozenie / szer) * 100}%` }
              : { top: `${(p.polozenie / wys) * 100}%` }
          }
        />
      ))}
      {prostokat &&
        stan?.rodzaj !== 'przesun' &&
        UCHWYTY.map((u) => {
          const p = punktUchwytu(prostokat, u);
          const strona = t(`nakladka.strona.${u}`);
          return (
            <button
              key={u}
              type="button"
              className={`uchwyt uchwyt-${u}`}
              data-uchwyt={u}
              aria-label={t('nakladka.uchwyt', { strona })}
              title={t('nakladka.uchwyt.opis')}
              style={{ left: `${(p.x / szer) * 100}%`, top: `${(p.y / wys) * 100}%` }}
              onPointerDown={(e) => uchwytDown(u, e)}
              onKeyDown={(e) => uchwytKlawisz(u, e)}
            />
          );
        })}
      {stan?.podpowiedz && (
        <div
          className="podpowiedz-przeciagania"
          data-testid="podpowiedz-przeciagania"
          style={{
            left: `${Math.min(stan.kursor.x * px + 14, Math.max(0, szerokoscPx - 150))}px`,
            top: `${stan.kursor.y * px + 14}px`,
          }}
        >
          {stan.podpowiedz.szer !== undefined
            ? t('nakladka.podpowiedzRozmiar', {
                x: liczbaMm(stan.podpowiedz.x),
                y: liczbaMm(stan.podpowiedz.y),
                szer: liczbaMm(stan.podpowiedz.szer),
                wys: liczbaMm(stan.podpowiedz.wys ?? 0),
              })
            : t('nakladka.podpowiedz', {
                x: liczbaMm(stan.podpowiedz.x),
                y: liczbaMm(stan.podpowiedz.y),
              })}
        </div>
      )}
    </>
  );
}
