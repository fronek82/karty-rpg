import { konturNaD } from '../../silnik/svg';
import type { ElementOzdobny } from '../../ozdobniki';

/** Miniatura elementu biblioteki – rysunek kolorowalny dziedziczy kolor tekstu (`currentColor`). */
export function MiniaturaOzdobnika({ element }: { element: ElementOzdobny }) {
  const kolor = (k: string) => (k === 'kolor' ? 'currentColor' : k);
  return (
    <svg
      className="miniatura-ozdobnika"
      viewBox={`-1 -1 ${element.szer + 2} ${element.wys + 2}`}
      width="40"
      height="40"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="0"
        y="0"
        width={element.szer}
        height={element.wys}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="0.15"
      />
      {element.kontury.map((c, i) => (
        <path
          key={i}
          d={konturNaD(c.kontur)}
          fill={c.wypelnienie ? kolor(c.wypelnienie) : 'none'}
          stroke={c.obrys ? kolor(c.obrys.kolor) : 'none'}
          strokeWidth={c.obrys?.grubosc}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
