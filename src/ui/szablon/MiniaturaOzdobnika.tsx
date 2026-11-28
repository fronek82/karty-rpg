import { konturNaD } from '../../silnik/svg';
import type { ElementOzdobny } from '../../ozdobniki';
import { konturyOzdobnika } from '../../ozdobniki/ksztalt';

/** Miniatura elementu biblioteki – rysunek kolorowalny dziedziczy kolor tekstu (`currentColor`). */
export function MiniaturaOzdobnika({
  element,
  adres,
}: {
  element: ElementOzdobny;
  /** Adres obrazu (źródło PNG ramki 9-slice) – rysowany pod wcięciami. */
  adres?: string;
}) {
  // Motywy są szerokie – miniatura proporcjonalna do kafelka.
  const szeroki = element.szer > element.wys;
  const szerokosc = szeroki ? 52 : 40;
  const wysokosc = (szerokosc * (element.wys + 2)) / (element.szer + 2);
  const kolor = (k: string) => (k === 'kolor' ? 'currentColor' : k);
  return (
    <svg
      className="miniatura-ozdobnika"
      viewBox={`-1 -1 ${element.szer + 2} ${element.wys + 2}`}
      width={szerokosc}
      height={szeroki ? wysokosc : 40}
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
      {element.ramka9 && (
        <rect
          x={element.ramka9.wciecia.lewo}
          y={element.ramka9.wciecia.gora}
          width={Math.max(
            0,
            element.szer - element.ramka9.wciecia.lewo - element.ramka9.wciecia.prawo,
          )}
          height={Math.max(
            0,
            element.wys - element.ramka9.wciecia.gora - element.ramka9.wciecia.dol,
          )}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.5"
          strokeDasharray={`${element.szer / 20} ${element.szer / 20}`}
          strokeWidth={element.szer / 60}
        />
      )}
      {adres && <image href={adres} x="0" y="0" width={element.szer} height={element.wys} />}
      {konturyOzdobnika(element).map((c, i) => (
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
