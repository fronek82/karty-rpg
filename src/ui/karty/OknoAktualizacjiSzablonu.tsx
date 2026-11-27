import { useMemo } from 'react';
import {
  aktualizujRewersWProjekcie,
  aktualizujSzablonWProjekcie,
  type NowaWersjaSzablonu,
} from '../../dane/aktualizacjaSzablonu';
import { t } from '../../i18n';
import type { Projekt } from '../../model/projekt';
import type { Karta } from '../../model/szablon';
import { renderujKarte, renderujRewers, type KontekstRenderowania } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import { OknoModalne } from '../OknoModalne';
import type { ProjektWEdycji } from '../useProjekt';

export interface OknoAktualizacjiSzablonuProps {
  projekt: Projekt;
  zmiana: NowaWersjaSzablonu;
  zasoby: ProjektWEdycji['zasoby']['zasoby'];
  ctxRenderu: KontekstRenderowania;
  onZatwierdz: () => void;
  onAnuluj: () => void;
}

function bezpieczneSvg(fn: () => string): string {
  try {
    return fn();
  } catch {
    return '';
  }
}

/**
 * Okno potwierdzenia aktualizacji kopii szablonu/tyłu z „Moich szablonów” (Plan S, S2):
 * pokazuje podgląd „Przed / Po” jednej karty oraz listę pól przeniesionych, pominiętych i nowych.
 */
export function OknoAktualizacjiSzablonu({
  projekt,
  zmiana,
  zasoby,
  ctxRenderu,
  onZatwierdz,
  onAnuluj,
}: OknoAktualizacjiSzablonuProps) {
  const podglad = useMemo(() => {
    const adresObrazu = (id: string) => zasoby.obrazy.get(id)?.adres;
    if (zmiana.rodzaj === 'awers') {
      const stary = projekt.szablony.find((s) => s.id === zmiana.idWProjekcie);
      if (!stary) return undefined;
      const wynik = aktualizujSzablonWProjekcie(
        projekt,
        zmiana.idWProjekcie,
        zmiana.wpisBiblioteki,
      );
      const nowy = wynik.projekt.szablony.find((s) => s.id === zmiana.idWProjekcie);
      if (!nowy) return undefined;

      // Pierwsza karta z projektu używająca tego szablonu albo karta z danymi przykładowymi.
      const istniejacyPrzed = projekt.talie
        .flatMap((tl) => tl.karty)
        .find((k) => k.szablonId === stary.id);
      const kartaPrzed: Karta = istniejacyPrzed ?? {
        id: 'podglad',
        szablonId: stary.id,
        dane: { ...(stary.przyklad ?? {}) },
        ilosc: 1,
      };
      const kartaPo: Karta = (istniejacyPrzed &&
        wynik.projekt.talie.flatMap((tl) => tl.karty).find((k) => k.id === istniejacyPrzed.id)) ?? {
        id: 'podglad',
        szablonId: nowy.id,
        dane: { ...(nowy.przyklad ?? {}) },
        ilosc: 1,
      };

      const svgPrzed = bezpieczneSvg(() =>
        scenaDoSvg(renderujKarte(stary, kartaPrzed, ctxRenderu).scena, {
          adresObrazu,
          przedrostekId: 'akt-przed-',
        }),
      );
      const svgPo = bezpieczneSvg(() =>
        scenaDoSvg(renderujKarte(nowy, kartaPo, ctxRenderu).scena, {
          adresObrazu,
          przedrostekId: 'akt-po-',
        }),
      );
      return { svgPrzed, svgPo, dopasowanie: wynik.dopasowanie };
    }

    const staryR = (projekt.rewersy ?? []).find((r) => r.id === zmiana.idWProjekcie);
    if (!staryR) return undefined;
    const po = aktualizujRewersWProjekcie(projekt, zmiana.idWProjekcie, zmiana.wpisBiblioteki);
    const nowyR = (po.rewersy ?? []).find((r) => r.id === zmiana.idWProjekcie);
    if (!nowyR) return undefined;
    const svgPrzed = bezpieczneSvg(() =>
      scenaDoSvg(renderujRewers(staryR, ctxRenderu).scena, {
        adresObrazu,
        przedrostekId: 'akt-r-przed-',
      }),
    );
    const svgPo = bezpieczneSvg(() =>
      scenaDoSvg(renderujRewers(nowyR, ctxRenderu).scena, {
        adresObrazu,
        przedrostekId: 'akt-r-po-',
      }),
    );
    return { svgPrzed, svgPo, dopasowanie: undefined };
  }, [projekt, zmiana, zasoby.obrazy, ctxRenderu]);

  const etykietaPotwierdz =
    zmiana.liczbaKart > 0
      ? t('karty.aktualizujKarty', { n: zmiana.liczbaKart })
      : t('karty.aktualizujSzablon');

  const opis =
    zmiana.liczbaKart > 0
      ? t('karty.aktualizacja.opis', { n: zmiana.liczbaKart })
      : t('karty.aktualizacja.opisBezKart');

  return (
    <OknoModalne
      tytul={t('karty.aktualizacja.tytul', { nazwa: zmiana.nazwaWProjekcie })}
      zamknij={onAnuluj}
    >
      <div className="karty-ui2-modal-tresc">
        <p className="karty-ui2-modal-opis">{opis}</p>

        {podglad && (
          <div className="karty-ui2-porownanie">
            <div className="karty-ui2-porownanie-kol">
              <span className="karty-ui2-porownanie-etykieta">{t('karty.aktualizacja.przed')}</span>
              <div
                className="karty-ui2-svg-box"
                dangerouslySetInnerHTML={{ __html: podglad.svgPrzed }}
              />
            </div>
            <div className="karty-ui2-porownanie-kol">
              <span className="karty-ui2-porownanie-etykieta">{t('karty.aktualizacja.po')}</span>
              <div
                className="karty-ui2-svg-box"
                dangerouslySetInnerHTML={{ __html: podglad.svgPo }}
              />
            </div>
          </div>
        )}

        {podglad?.dopasowanie && (
          <div className="karty-ui2-dopasowanie">
            {podglad.dopasowanie.przeniesione.length > 0 && (
              <div>
                <strong>{t('karty.aktualizacja.polaPrzeniesione')}:</strong>{' '}
                {podglad.dopasowanie.przeniesione.map((p) => p.nazwa).join(', ')}
              </div>
            )}
            {podglad.dopasowanie.pominiete.length > 0 && (
              <div className="ostrzezenie">
                <strong>{t('karty.aktualizacja.polaPominiete')}:</strong>{' '}
                {podglad.dopasowanie.pominiete.map((p) => p.nazwa).join(', ')}
              </div>
            )}
            {podglad.dopasowanie.nowe.length > 0 && (
              <div>
                <strong>{t('karty.aktualizacja.polaNowe')}:</strong>{' '}
                {podglad.dopasowanie.nowe.map((p) => p.nazwa).join(', ')}
              </div>
            )}
          </div>
        )}

        <div className="karty-ui2-modal-akcje">
          <button type="button" className="karty-ui2-przycisk" onClick={onAnuluj}>
            {t('nowyProjekt.anuluj')}
          </button>
          <button type="button" className="karty-ui2-przycisk glowny" onClick={onZatwierdz}>
            {etykietaPotwierdz}
          </button>
        </div>
      </div>
    </OknoModalne>
  );
}
