import { useEffect, useState } from 'react';
import { BladDanych } from '../../dane/schemat';
import { formatujLiczbe, t } from '../../i18n';
import { gry } from '../../pakiety/gry';
import type { Pakiet } from '../../pakiety/typy';
import { nowyProjektZPakietu } from '../baza';
import { atrybucjaPakietu, nazwaGryDo, nazwaUkladu } from '../nazwyPakietu';
import { ID_PUSTEJ } from './idPodgladow';
import { usePodglady } from './ladujPodglady';
import { PodgladKartki } from './PodgladKartki';

type Grupa = 'pusta' | 'uklady';

/**
 * Drugi ekran gry: lewe menu to skróty do dwóch grup w środku – „Pusta kartka” (podgląd kartki
 * A4 z siatką slotów) i „Gotowe układy” (podgląd każdego układu pakietu). Podglądy liczy silnik
 * układu (ten sam SVG co w PDF); kliknięcie podglądu tworzy projekt i otwiera kartkę.
 */
export function WyborGry({ id }: { id: string }) {
  const gra = gry.find((g) => g.id === id);
  const [pakiet, ustawPakiet] = useState<Pakiet>();
  const [blad, ustawBlad] = useState<string>();
  const [trwa, ustawTrwa] = useState(false);
  const [aktywna, ustawAktywna] = useState<Grupa>('pusta');
  const podglad = usePodglady(pakiet);
  useEffect(() => {
    let aktywny = true;
    void gra?.pakiet?.().then(
      (p) => aktywny && ustawPakiet(p),
      (e: unknown) =>
        aktywny &&
        ustawBlad(
          t('start.bladPakietu', { szczegoly: String(e instanceof Error ? e.message : e) }),
        ),
    );
    return () => {
      aktywny = false;
    };
  }, [gra]);

  if (!gra?.pakiet) {
    return (
      <section>
        <h1>{t('nawigacja.nieZnaleziono')}</h1>
        <a href="#/">{t('nawigacja.wrocNaStart')}</a>
      </section>
    );
  }

  const utworz = async (uklad?: string) => {
    if (!pakiet) return;
    ustawTrwa(true);
    ustawBlad(undefined);
    try {
      const idProjektu = await nowyProjektZPakietu(pakiet, uklad);
      window.location.hash = `#/projekt/${encodeURIComponent(idProjektu)}`;
    } catch (e) {
      ustawBlad(e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e));
      ustawTrwa(false);
    }
  };

  // Skrót w menu: podświetla grupę, przewija do niej i przenosi fokus na jej nagłówek.
  const idz = (g: Grupa) => {
    ustawAktywna(g);
    const naglowek = document.getElementById(`grupa-${g}`);
    if (!naglowek) return;
    const spokojnie = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    naglowek.closest('section')?.scrollIntoView?.({
      behavior: spokojnie ? 'auto' : 'smooth',
      block: 'start',
    });
    naglowek.focus({ preventScroll: true });
  };

  const pusta = podglad(ID_PUSTEJ);
  const siatkaPustej = pusta && 'podglad' in pusta ? pusta.podglad.strony[0]?.siatka : undefined;
  const parametrySiatki = siatkaPustej
    ? { kolumny: siatkaPustej.kolumny, rzedy: siatkaPustej.rzedy }
    : undefined;

  return (
    <section className="wybor-gry">
      <nav aria-label={t('projekt.nawigacja')} className="okruszki">
        <a href="#/">{t('nawigacja.start')}</a> ›{' '}
        <span aria-current="page">{t('start.kartyDo', { gra: nazwaGryDo(gra) })}</span>
      </nav>
      <h1 className="ukryte">{t('start.kartyDo', { gra: nazwaGryDo(gra) })}</h1>
      <div className="wybor-kolumny">
        <nav className="start-menu" aria-labelledby="wybor-od-czego">
          <p id="wybor-od-czego" className="etykieta-sekcji">
            {t('start.odCzegoZaczac')}
          </p>
          <button
            type="button"
            className="pasek-menu pasek-bursztyn"
            aria-pressed={aktywna === 'pusta'}
            onClick={() => idz('pusta')}
          >
            <b>{t('start.pustaKartka')}</b>
            <span>{parametrySiatki ? t('start.pustaKartkaOpis', parametrySiatki) : ' '}</span>
          </button>
          <button
            type="button"
            className="pasek-menu pasek-turkus"
            aria-pressed={aktywna === 'uklady'}
            onClick={() => idz('uklady')}
          >
            <b>{t('start.gotowyUklad')}</b>
            <span>{t('start.gotowyUkladOpis')}</span>
          </button>
        </nav>

        <div className="grupy-podgladow">
          <section
            className={`grupa-podgladow${aktywna === 'pusta' ? ' wyrozniona' : ''}`}
            aria-labelledby="grupa-pusta"
            data-grupa="pusta"
          >
            <h2 id="grupa-pusta" tabIndex={-1}>
              {t('start.pustaKartka')}
            </h2>
            <button
              type="button"
              className="kafelek-podgladu szeroki"
              data-podglad={ID_PUSTEJ}
              aria-labelledby="pusta-nazwa"
              aria-describedby="pusta-opis pusta-podpowiedz"
              disabled={!pakiet || trwa}
              onClick={() => void utworz()}
            >
              <span className="miniatura-podgladu">
                <PodgladKartki wynik={pusta} />
              </span>
              <span className="opis-podgladu">
                <b id="pusta-nazwa">{t('start.pustaKartkaA4')}</b>
                <span id="pusta-opis" className="opis-tekst">
                  {siatkaPustej
                    ? t('start.pustaKartkaPodglad', {
                        kolumny: siatkaPustej.kolumny,
                        rzedy: siatkaPustej.rzedy,
                        slot: formatujLiczbe(siatkaPustej.slot.szerokosc, 2),
                      })
                    : ' '}
                </span>
                <span id="pusta-podpowiedz" className="podpowiedz">
                  {t('start.kliknijAbyZaczac')}
                </span>
              </span>
            </button>
          </section>

          <section
            className={`grupa-podgladow${aktywna === 'uklady' ? ' wyrozniona' : ''}`}
            aria-labelledby="grupa-uklady"
            data-grupa="uklady"
          >
            <h2 id="grupa-uklady" tabIndex={-1}>
              {t('start.gotoweUklady')} <small>{t('start.gotoweUkladyPodpis')}</small>
            </h2>
            <div className="siatka-ukladow">
              {pakiet?.gotoweUklady.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="kafelek-podgladu"
                  data-podglad={u.id}
                  aria-labelledby={`uklad-${u.id}-nazwa`}
                  aria-describedby={`uklad-${u.id}-podpowiedz`}
                  disabled={trwa}
                  onClick={() => void utworz(u.id)}
                >
                  <span className="miniatura-podgladu">
                    <PodgladKartki wynik={podglad(u.id)} stos={u.arkusze.length > 1} />
                  </span>
                  <span className="opis-podgladu">
                    <b id={`uklad-${u.id}-nazwa`}>{nazwaUkladu(u)}</b>
                    <span id={`uklad-${u.id}-podpowiedz`} className="podpowiedz">
                      {t('start.kliknijAbyZaczac')}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
      <p role="status" aria-live="polite" className="status">
        {trwa ? t('start.tworze') : !pakiet && !blad ? t('projekty.wczytywanie') : ''}
      </p>
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      {gra.id === 'mausritter' && pakiet && <p className="podpis">{atrybucjaPakietu(pakiet)}</p>}
    </section>
  );
}
