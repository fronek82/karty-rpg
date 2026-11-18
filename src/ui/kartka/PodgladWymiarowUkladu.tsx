import { useId } from 'react';
import { formatujLiczbe, t, type KluczTekstu } from '../../i18n';
import type { PresetUkladu, UkladArkusza, wymiaryUkladu } from '../../model/arkusz';

type Wymiar = {
  nazwa: KluczTekstu;
  mm: number;
  pole?: string;
  /** Oś, początek i koniec strzałki oraz położenie wzdłuż drugiej osi. */
  strzalka: { pionowa?: boolean; od: number; do: number; na: number };
};

const ustawFokus = (pole: string) => document.getElementById(pole)?.focus();
const zaokr = (mm: number) => formatujLiczbe(Math.abs(mm) < 1e-6 ? 0 : mm, 2);

/** Rysunek formularza przedstawia geometrię modelu. Nie należy do sceny eksportu. */
export function PodgladWymiarowUkladu({
  uklad,
  slot,
  papier,
  siatka,
  polaPapieru,
}: {
  uklad: UkladArkusza;
  slot: PresetUkladu['slot'];
  papier: { szer: number; wys: number };
  siatka: ReturnType<typeof wymiaryUkladu>;
  polaPapieru?: { szer: string; wys: string };
}) {
  const id = useId();
  const skala = Math.min(186 / papier.szer, 180 / papier.wys);
  const szer = papier.szer * skala;
  const wys = papier.wys * skala;
  const lewo = (320 - szer) / 2;
  const gora = 42;
  const prawo = lewo + szer;
  const dol = gora + wys;
  // Zbyt dużą siatkę widać do krawędzi papieru. Etykiety nadal podają rzeczywiste wymiary.
  const x = (mm: number) => Math.min(prawo + 8, lewo + mm * skala);
  const y = (mm: number) => Math.min(dol + 8, gora + mm * skala);
  const x1 = x(uklad.lewo);
  const y1 = y(uklad.gora);
  const x2 = x(uklad.lewo + slot.szerokosc);
  const y2 = y(uklad.gora + slot.wysokosc);
  const xKoniec = x(uklad.lewo + siatka.szer);
  const yKoniec = y(uklad.gora + siatka.wys);
  const pozioma = (od: number, do_: number, na: number) => ({ od, do: do_, na });
  const pionowa = (od: number, do_: number, na: number) => ({ pionowa: true, od, do: do_, na });
  const wymiary: Wymiar[] = [
    {
      nazwa: 'uklad.diagram.papierSzer',
      mm: papier.szer,
      ...(polaPapieru ? { pole: polaPapieru.szer } : {}),
      strzalka: pozioma(lewo, prawo, dol + 27),
    },
    {
      nazwa: 'uklad.diagram.papierWys',
      mm: papier.wys,
      ...(polaPapieru ? { pole: polaPapieru.wys } : {}),
      strzalka: pionowa(gora, dol, prawo + 27),
    },
    {
      nazwa: 'uklad.diagram.slotSzer',
      mm: slot.szerokosc,
      pole: 'uklad-szerokosc',
      strzalka: pozioma(x1, x2, y1 + 14),
    },
    {
      nazwa: 'uklad.diagram.slotWys',
      mm: slot.wysokosc,
      pole: 'uklad-wysokosc',
      strzalka: pionowa(y1, y2, x2 - 12),
    },
    {
      nazwa: 'uklad.diagram.lewo',
      mm: uklad.lewo,
      pole: 'uklad-lewo',
      strzalka: pozioma(lewo, x1, gora - 10),
    },
    {
      nazwa: 'uklad.diagram.gora',
      mm: uklad.gora,
      pole: 'uklad-gora',
      strzalka: pionowa(gora, y1, lewo - 10),
    },
    {
      nazwa: 'uklad.diagram.prawo',
      mm: siatka.prawo,
      strzalka: pozioma(xKoniec, prawo, gora - 10),
    },
    { nazwa: 'uklad.diagram.dol', mm: siatka.dol, strzalka: pionowa(yKoniec, dol, lewo - 10) },
  ];
  if (uklad.kolumny > 1)
    wymiary.push({
      nazwa: 'uklad.diagram.odstepX',
      mm: uklad.odstepPoziomy,
      pole: 'uklad-odstep-x',
      strzalka: pozioma(x2, x(uklad.lewo + slot.szerokosc + uklad.odstepPoziomy), y1 + 34),
    });
  if (uklad.rzedy > 1)
    wymiary.push({
      nazwa: 'uklad.diagram.odstepY',
      mm: uklad.odstepPionowy,
      pole: 'uklad-odstep-y',
      strzalka: pionowa(y2, y(uklad.gora + slot.wysokosc + uklad.odstepPionowy), x2 + 23),
    });

  const poza = siatka.prawo < -1e-6 || siatka.dol < -1e-6;
  return (
    <details className="podglad-wymiarow">
      <summary>{t('uklad.diagram.tytul')}</summary>
      <svg aria-hidden="true" viewBox={`0 0 320 ${dol + 48}`}>
        <defs>
          <clipPath id={`${id}-papier`}>
            <rect x={lewo} y={gora} width={szer} height={wys} />
          </clipPath>
          <pattern
            id={`${id}-slot`}
            patternUnits="userSpaceOnUse"
            x={lewo + uklad.lewo * skala}
            y={gora + uklad.gora * skala}
            width={(slot.szerokosc + uklad.odstepPoziomy) * skala}
            height={(slot.wysokosc + uklad.odstepPionowy) * skala}
          >
            <rect
              width={slot.szerokosc * skala}
              height={slot.wysokosc * skala}
              className="wymiary-slot"
            />
          </pattern>
        </defs>
        <rect className="wymiary-papier" x={lewo} y={gora} width={szer} height={wys} />
        <rect
          className={poza ? 'wymiary-siatka poza' : 'wymiary-siatka'}
          clipPath={`url(#${id}-papier)`}
          fill={`url(#${id}-slot)`}
          x={lewo + uklad.lewo * skala}
          y={gora + uklad.gora * skala}
          width={siatka.szer * skala}
          height={siatka.wys * skala}
        />
        {wymiary.map(({ nazwa, mm, pole, strzalka }) => {
          const { od, do: koniec, na, pionowa } = strzalka;
          const poczatek = Math.min(od, koniec);
          const kres = Math.max(od, koniec);
          const srodek = (od + koniec) / 2;
          const punkt = (a: number, b: number) => (pionowa ? `${b},${a}` : `${a},${b}`);
          const odcinek = kres - poczatek;
          const bok = Math.min(4, odcinek / 2);
          const d = bok
            ? `M${punkt(poczatek, na)} L${punkt(kres, na)}
               M${punkt(poczatek + bok, na - 2)} L${punkt(poczatek, na)} L${punkt(poczatek + bok, na + 2)}
               M${punkt(kres - bok, na - 2)} L${punkt(kres, na)} L${punkt(kres - bok, na + 2)}`
            : `M${punkt(srodek, na - 3)} L${punkt(srodek, na + 3)}`;
          return (
            <g key={nazwa} className={mm < -1e-6 ? 'wymiary-strzalka poza' : 'wymiary-strzalka'}>
              <path d={d} />
              <text
                x={pionowa ? na + (na < lewo ? -5 : 5) : srodek}
                y={pionowa ? srodek + 3 : na - 4}
                textAnchor={pionowa ? (na < lewo ? 'end' : 'start') : 'middle'}
                onClick={pole ? () => ustawFokus(pole) : undefined}
                className={pole ? 'wymiary-do-pola' : undefined}
                data-pole={pole}
              >
                {zaokr(mm)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="podpis">
        {t('uklad.diagram.siatka', {
          kolumny: uklad.kolumny,
          rzedy: uklad.rzedy,
          szer: zaokr(siatka.szer),
          wys: zaokr(siatka.wys),
        })}
      </p>
      <dl className="wymiary-lista">
        {wymiary.map(({ nazwa, mm, pole }) => (
          <div key={nazwa}>
            <dt>{t(nazwa)}</dt>
            <dd>
              {pole ? (
                <button
                  type="button"
                  aria-label={t('uklad.diagram.edytuj', {
                    pole: t(nazwa),
                    mm: zaokr(mm),
                  })}
                  onClick={() => ustawFokus(pole)}
                >
                  {t('uklad.diagram.mm', { mm: zaokr(mm) })}
                </button>
              ) : (
                <span className={mm < -1e-6 ? 'poza' : undefined}>
                  {t('uklad.diagram.mm', { mm: zaokr(mm) })}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
