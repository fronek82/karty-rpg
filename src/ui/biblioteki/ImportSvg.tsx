import { noweIdElementu, ramka9Domyslna } from '../../dane/biblioteka';
import { t } from '../../i18n';
import type { ElementOzdobny, RodzajElementu, WynikImportuSvg } from '../../ozdobniki';
import type { ZasobyPakietu } from '../zasoby';
import { PodgladElementu, Przyciski, RODZAJE_ELEMENTU } from './EdytorOzdobnika';

/** Import w toku: wynik sanityzacji z edytowalnymi ustawieniami przed dodaniem do biblioteki. */
export interface Wczytany {
  plik: string;
  wynik: WynikImportuSvg;
  rodzaj: RodzajElementu;
  kolorowanie: 'jednolity' | 'oryginal';
  nazwa: string;
}

/** Element z importowanego SVG z wybranymi ustawieniami (id unikalne w bibliotece). */
export function elementZImportu(
  w: Wczytany,
  zajete: readonly ElementOzdobny[],
  id?: string,
): ElementOzdobny {
  const nazwa = w.nazwa.trim() || w.plik.replace(/\.[^.]+$/, '');
  return {
    ...w.wynik.element,
    id: id ?? noweIdElementu(nazwa, { biblioteka: { ozdobniki: [...zajete] } }),
    nazwa,
    rodzaj: w.rodzaj,
    kolorowanie: w.kolorowanie,
    ...(w.rodzaj === 'ramka9'
      ? { ramka9: ramka9Domyslna({ typ: 'svg' }, w.wynik.element.szer, w.wynik.element.wys) }
      : {}),
  };
}

/**
 * Import SVG przed dodaniem do biblioteki: podgląd, raport „co pominięto” (sanityzacja), rodzaj,
 * kolorowanie i nazwa (makieta M2b-3; od N8 na stronie Biblioteki → Ozdobniki).
 */
export function ImportSvg({
  wczytany,
  zmien,
  dodaj,
  anuluj,
  zasoby,
}: {
  wczytany: Wczytany;
  zmien: (w: Wczytany) => void;
  dodaj: () => void;
  anuluj: () => void;
  zasoby: ZasobyPakietu | undefined;
}) {
  const roboczy = elementZImportu(wczytany, [], 'wl:import');
  return (
    <section className="panel-importu panel-ozdobnika">
      <h2>{t('biblioteka.import.tytul', { plik: wczytany.plik })}</h2>
      <PodgladElementu element={roboczy} zasoby={zasoby} prefiks="bi-" />
      <p className="raport-ok" data-testid="raport-import" aria-live="polite">
        ✓{' '}
        {t('biblioteka.import.podsumowanie', {
          sciezki: wczytany.wynik.liczbaSciezek,
          kolory: wczytany.wynik.liczbaKolorow,
        })}
      </p>
      {wczytany.wynik.raport.length > 0 ? (
        <div className="uwaga" data-testid="raport-pominieto">
          <strong>{t('biblioteka.import.pominieto')}</strong>
          <ul>
            {wczytany.wynik.raport.map((r) => (
              <li key={r.kod}>
                {t(`svg.pominieto.${r.kod}`, { szczegoly: r.szczegoly ?? '' })}
                {r.ile > 1 ? ` × ${r.ile}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="podpis">{t('biblioteka.import.bezPominiec')}</p>
      )}
      <Przyciski
        etykieta={t('biblioteka.uzyjJako')}
        opcje={RODZAJE_ELEMENTU.map((r) => ({ wartosc: r, tekst: t(`biblioteka.rodzaj.${r}`) }))}
        wartosc={wczytany.rodzaj}
        zmien={(r) => zmien({ ...wczytany, rodzaj: r })}
      />
      <Przyciski
        etykieta={t('biblioteka.kolor')}
        opcje={(['jednolity', 'oryginal'] as const).map((k) => ({
          wartosc: k,
          tekst: t(`biblioteka.kolor.${k}`),
        }))}
        wartosc={wczytany.kolorowanie}
        zmien={(k) => zmien({ ...wczytany, kolorowanie: k })}
      />
      <div className="pole-panelu">
        <label htmlFor="nazwa-importu">{t('biblioteka.nazwa')}</label>
        <input
          id="nazwa-importu"
          value={wczytany.nazwa}
          onChange={(e) => zmien({ ...wczytany, nazwa: e.target.value })}
        />
      </div>
      <div className="akcje-importu">
        <button type="button" className="glowny" onClick={dodaj}>
          {t('biblioteka.import.dodaj')}
        </button>
        <button type="button" onClick={anuluj}>
          {t('biblioteka.import.anuluj')}
        </button>
      </div>
    </section>
  );
}
