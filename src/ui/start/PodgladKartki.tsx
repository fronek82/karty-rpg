import { memo } from 'react';
import { t } from '../../i18n';
import { useJezyk } from '../../i18n/react';
import type { StronaPodgladu } from './podglady';
import type { WynikPodgladu } from './pamiecPodgladow';

/** Przerywana siatka slotów nad pustą kartką – geometria z wyniku układu (silnik jej nie rysuje). */
export function SiatkaSlotow({ strona }: { strona: StronaPodgladu }) {
  const g = strona.siatka;
  if (!g) return null;
  const pola = [];
  for (let k = 0; k < g.kolumny; k++)
    for (let r = 0; r < g.rzedy; r++)
      pola.push(
        <rect
          key={`${k}-${r}`}
          x={g.poczatek.x + k * g.slot.szerokosc}
          y={g.poczatek.y + r * g.slot.wysokosc}
          width={g.slot.szerokosc}
          height={g.slot.wysokosc}
        />,
      );
  return (
    <svg
      className="siatka-slotow"
      viewBox={`0 0 ${strona.szerokosc} ${strona.wysokosc}`}
      aria-hidden="true"
      focusable="false"
    >
      {pola}
    </svg>
  );
}

/** Jedna kartka papieru z SVG sceny silnika (ten sam, który trafia do PDF). */
export function Papier({ strona, styl }: { strona: StronaPodgladu; styl?: React.CSSProperties }) {
  return (
    <span
      className="papier"
      style={{
        aspectRatio: `${strona.szerokosc} / ${strona.wysokosc}`,
        ['--proporcja' as string]: strona.szerokosc / strona.wysokosc,
        ...styl,
      }}
    >
      <span className="papier-svg" dangerouslySetInnerHTML={{ __html: strona.svg }} />
      <SiatkaSlotow strona={strona} />
    </span>
  );
}

/** Miejsce na podgląd: szkielet na czas liczenia, komunikat przy błędzie, papier lub stos kartek. */
export const PodgladKartki = memo(function PodgladKartki({
  wynik,
  stos = false,
  proporcje,
}: {
  wynik: WynikPodgladu | undefined;
  /** Proporcje szkieletu (np. karta 63×88); bez nich szkielet ma proporcje kartki A4 poziomo. */
  proporcje?: { szerokosc: number; wysokosc: number };
  /** Kilka kartek ułożonych jak stos (pierwsza na wierzchu). */
  stos?: boolean;
}) {
  // memo nie przepuszcza zmiany języka z rodzica – napisy szkieletu odświeżamy sami.
  useJezyk();
  const stylSzkieletu = proporcje
    ? ({
        aspectRatio: `${proporcje.szerokosc} / ${proporcje.wysokosc}`,
        '--proporcja': proporcje.szerokosc / proporcje.wysokosc,
      } as React.CSSProperties)
    : undefined;
  if (!wynik)
    return (
      <span className="szkielet" role="img" aria-label={t('start.podgladLiczy')}>
        <span className="szkielet-papier" style={stylSzkieletu} aria-hidden="true" />
      </span>
    );
  if ('blad' in wynik)
    return (
      <span
        className="szkielet blad-podgladu"
        role="img"
        aria-label={t('start.podgladBlad', { szczegoly: wynik.blad })}
      >
        <span className="szkielet-papier" style={stylSzkieletu} aria-hidden="true" />
      </span>
    );
  const strony = wynik.podglad.strony;
  if (!stos || strony.length < 2) return <Papier strona={strony[0]!} />;
  const n = strony.length;
  const pierwsza = strony[0]!;
  return (
    <span className="stos" style={{ aspectRatio: `${pierwsza.szerokosc} / ${pierwsza.wysokosc}` }}>
      {strony.map((s, j) => {
        // Pierwsza kartka na wierzchu (prawy górny róg), kolejne niżej, w lewo i za nią.
        const i = n - 1 - j;
        return (
          <Papier
            key={j}
            strona={s}
            styl={{
              position: 'absolute',
              width: '80%',
              left: `${(i * 20) / (n - 1)}%`,
              top: `${(j * 14) / (n - 1)}%`,
              zIndex: i,
            }}
          />
        );
      })}
    </span>
  );
});
