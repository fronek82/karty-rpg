import { useEffect, useRef, useState } from 'react';
import { BladDanych } from '../../dane/schemat';
import { formatujLiczbe, t } from '../../i18n';
import { gry } from '../../pakiety/gry';
import type { GotowyUklad, Pakiet } from '../../pakiety/typy';
import { nowyProjektZPakietu } from '../baza';
import { atrybucjaPakietu, nazwaGryDo, nazwaUkladu } from '../nazwyPakietu';
import { ID_PUSTEJ } from './idPodgladow';
import {
  ponowPodglady,
  useBladLadowania,
  useUruchomPodglady,
  useWynikPodgladu,
} from './ladujPodglady';
import { PodgladKartki } from './PodgladKartki';

type Grupa = 'pusta' | 'uklady';

/** Kafelek układu: sam subskrybuje swój podgląd, więc gotowy podgląd nie przerysowuje ekranu. */
function KafelekUkladu({
  pakietId,
  uklad,
  wylaczony,
  utworz,
}: {
  pakietId: string;
  uklad: GotowyUklad;
  wylaczony: boolean;
  utworz: (uklad: string) => void;
}) {
  const wynik = useWynikPodgladu(pakietId, uklad.id);
  return (
    <button
      type="button"
      className="kafelek-podgladu"
      data-podglad={uklad.id}
      aria-labelledby={`uklad-${uklad.id}-nazwa`}
      aria-describedby={`uklad-${uklad.id}-podpowiedz`}
      disabled={wylaczony}
      onClick={() => utworz(uklad.id)}
    >
      <span className="miniatura-podgladu">
        <PodgladKartki wynik={wynik} stos={uklad.arkusze.length > 1} />
      </span>
      <span className="opis-podgladu">
        <b id={`uklad-${uklad.id}-nazwa`}>{nazwaUkladu(uklad)}</b>
        <span id={`uklad-${uklad.id}-podpowiedz`} className="podpowiedz">
          {t('start.kliknijAbyZaczac')}
        </span>
      </span>
    </button>
  );
}

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
  // Ostatnio wybrana grupa (aria-current); położenie przewijania jej nie zmienia (B146).
  const [aktywna, ustawAktywna] = useState<Grupa>('pusta');
  // Ref chroni przed podwójnym kliknięciem w tym samym renderze (stan `trwa` bywa spóźniony).
  const wToku = useRef(false);
  useUruchomPodglady(pakiet);
  const pusta = useWynikPodgladu(pakiet?.id, ID_PUSTEJ);
  const bladPodgladow = useBladLadowania(pakiet?.id);
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
    if (!pakiet || wToku.current) return;
    wToku.current = true;
    ustawTrwa(true);
    ustawBlad(undefined);
    try {
      const idProjektu = await nowyProjektZPakietu(pakiet, uklad);
      window.location.hash = `#/projekt/${encodeURIComponent(idProjektu)}`;
    } catch (e) {
      ustawBlad(e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e));
      wToku.current = false;
      ustawTrwa(false);
    }
  };

  // Skrót w menu: podświetla grupę, przewija do niej i przenosi fokus na jej nagłówek.
  const idz = (g: Grupa) => {
    ustawAktywna(g);
    const sekcja = document.querySelector<HTMLElement>(`[data-grupa="${g}"]`);
    if (!sekcja) return;
    const spokojnie = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    sekcja.scrollIntoView?.({ behavior: spokojnie ? 'auto' : 'smooth', block: 'start' });
    sekcja.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  };

  const siatkaPustej = pusta && 'podglad' in pusta ? pusta.podglad.strony[0]?.siatka : undefined;
  const wylaczone = !pakiet || trwa;

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
            aria-current={aktywna === 'pusta' ? 'true' : undefined}
            aria-labelledby="skrot-pusta-nazwa"
            aria-describedby={`skrot-pusta-opis${aktywna === 'pusta' ? ' skrot-pusta-stan' : ''}`}
            onClick={() => idz('pusta')}
          >
            <b id="skrot-pusta-nazwa">{t('start.pustaKartka')}</b>
            <span id="skrot-pusta-opis" className="opis-skrotu">
              {siatkaPustej
                ? t('start.pustaKartkaOpis', {
                    kolumny: siatkaPustej.kolumny,
                    rzedy: siatkaPustej.rzedy,
                  })
                : '\u00a0'}
            </span>
            {aktywna === 'pusta' && (
              <span id="skrot-pusta-stan" className="ukryte">
                {t('start.ostatnioWybrane')}
              </span>
            )}
          </button>
          <button
            type="button"
            className="pasek-menu pasek-turkus"
            aria-current={aktywna === 'uklady' ? 'true' : undefined}
            aria-labelledby="skrot-uklady-nazwa"
            aria-describedby={`skrot-uklady-opis${aktywna === 'uklady' ? ' skrot-uklady-stan' : ''}`}
            onClick={() => idz('uklady')}
          >
            <b id="skrot-uklady-nazwa">{t('start.gotowyUklad')}</b>
            <span id="skrot-uklady-opis" className="opis-skrotu">
              {t('start.gotowyUkladOpis')}
            </span>
            {aktywna === 'uklady' && (
              <span id="skrot-uklady-stan" className="ukryte">
                {t('start.ostatnioWybrane')}
              </span>
            )}
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
              disabled={wylaczone}
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
                    : '\u00a0'}
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
                <KafelekUkladu
                  key={u.id}
                  pakietId={pakiet.id}
                  uklad={u}
                  wylaczony={wylaczone}
                  utworz={(uk) => void utworz(uk)}
                />
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
      {bladPodgladow && pakiet && (
        <p role="alert" className="uwaga">
          {t('start.podgladyBladLadowania', { szczegoly: bladPodgladow })}{' '}
          <button type="button" onClick={() => void ponowPodglady(pakiet)}>
            {t('start.sprobujPonownie')}
          </button>
        </p>
      )}
      {gra.id === 'mausritter' && pakiet && <p className="podpis">{atrybucjaPakietu(pakiet)}</p>}
    </section>
  );
}
