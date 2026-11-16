import { useEffect, useState } from 'react';
import { BladDanych } from '../../dane/schemat';
import { t } from '../../i18n';
import { gry } from '../../pakiety/gry';
import type { Pakiet } from '../../pakiety/typy';
import { nowyProjektZPakietu } from '../baza';

/** Drugi ekran gry: pusta kartka albo gotowy układ z pakietu → nowy projekt → kartka. */
export function WyborGry({ id }: { id: string }) {
  const gra = gry.find((g) => g.id === id);
  const [pakiet, ustawPakiet] = useState<Pakiet>();
  const [blad, ustawBlad] = useState<string>();
  const [trwa, ustawTrwa] = useState(false);
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

  return (
    <section className="wybor-gry">
      <nav aria-label={t('projekt.nawigacja')} className="okruszki">
        <a href="#/">{t('nawigacja.start')}</a> › {gra.nazwa}
      </nav>
      <h1>{t('start.kartyDo', { gra: gra.nazwaDo })}</h1>
      <div className="kafelki-gier">
        <button
          type="button"
          className="kafelek-gry glowny"
          disabled={!pakiet || trwa}
          onClick={() => void utworz()}
        >
          <span className="tytul-kafelka">{t('start.pustaKartka')}</span>
          <span className="opis-kafelka">{t('start.pustaKartkaOpis')}</span>
        </button>
        <div className="kafelek-gry">
          <span className="tytul-kafelka">{t('start.gotowyUklad')}</span>
          <span className="opis-kafelka">{t('start.gotowyUkladOpis')}</span>
          <span className="przyciski-ukladow">
            {pakiet?.gotoweUklady.map((u) => (
              <button key={u.id} type="button" disabled={trwa} onClick={() => void utworz(u.id)}>
                {u.nazwa}
              </button>
            ))}
          </span>
        </div>
      </div>
      <p role="status" aria-live="polite" className="status">
        {trwa ? t('start.tworze') : !pakiet ? t('projekty.wczytywanie') : ''}
      </p>
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      {gra.id === 'mausritter' && pakiet && <p className="podpis">{pakiet.atrybucja}</p>}
    </section>
  );
}
