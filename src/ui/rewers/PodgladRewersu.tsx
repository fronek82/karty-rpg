import { useId, useMemo } from 'react';
import { t } from '../../i18n';
import type { Rewers, Szablon } from '../../model/szablon';
import { renderujRewers } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import type { ProjektWEdycji } from '../useProjekt';

/**
 * Zwarty podgląd rozstrzygniętego rewersu w docelowych wymiarach karty (używany w panelu
 * karty, szablonu i talii).
 */
export function PodgladRewersu({
  rewers,
  docelowy,
  awers,
  zasoby,
  komunikatBraku,
  etykieta,
}: {
  rewers: Rewers | undefined;
  docelowy?: { szer: number; wys: number; promienRogow?: number };
  awers?: { szablon: Szablon; dane: Record<string, string> };
  zasoby: ProjektWEdycji['zasoby']['zasoby'];
  komunikatBraku?: string;
  etykieta?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const szerDoc = docelowy?.szer;
  const wysDoc = docelowy?.wys;
  const promienDoc = docelowy?.promienRogow;
  const szablonAwersu = awers?.szablon;
  const daneAwersu = awers?.dane;
  const wynik = useMemo(() => {
    if (!rewers) return undefined;
    const daneDoRewersu =
      szablonAwersu && daneAwersu ? { szablon: szablonAwersu, dane: daneAwersu } : undefined;
    const opcje =
      szerDoc !== undefined && wysDoc !== undefined
        ? {
            szer: szerDoc,
            wys: wysDoc,
            ...(promienDoc !== undefined ? { promienRogow: promienDoc } : {}),
            ...(daneDoRewersu ? { awers: daneDoRewersu } : {}),
          }
        : daneDoRewersu
          ? { awers: daneDoRewersu }
          : undefined;
    const w = renderujRewers(
      rewers,
      {
        czcionki: zasoby.czcionki,
        obraz: (id) => zasoby.obrazy.get(id)?.info,
        ...(zasoby.elementy ? { elementy: zasoby.elementy } : {}),
      },
      opcje,
    );
    return {
      svg: scenaDoSvg(w.scena, {
        adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
        przedrostekId: `pr-${uid}-`,
      }),
      szer: w.scena.szer,
      wys: w.scena.wys,
    };
  }, [
    rewers,
    szerDoc,
    wysDoc,
    promienDoc,
    szablonAwersu,
    daneAwersu,
    zasoby.czcionki,
    zasoby.obrazy,
    zasoby.elementy,
    uid,
  ]);

  if (!wynik) {
    return komunikatBraku ? <p className="podpis">{komunikatBraku}</p> : null;
  }

  return (
    <div className="podglad-rewersu-kontener">
      <div
        className="podglad-rewersu-mini"
        role="img"
        aria-label={etykieta ?? t('rewers.podgladEtykieta')}
        style={{ aspectRatio: `${wynik.szer} / ${wynik.wys}` }}
        dangerouslySetInnerHTML={{ __html: wynik.svg }}
      />
    </div>
  );
}
