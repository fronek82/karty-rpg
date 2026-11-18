import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { gry } from '../../pakiety/gry';
import { nazwaGryDo } from '../nazwyPakietu';
import { ListaProjektow } from './ListaProjektow';
import { PanelImportu } from './PanelImportu';

/** Czcionka tytułu (Cinzel Decorative Bold, `public/czcionki/`) – ładowana wcześniej tylko na starcie. */
const CZCIONKA_TYTULU = `${import.meta.env.BASE_URL}czcionki/CinzelDecorative-Bold.ttf`;

/**
 * Ekran startowy: tytuł i opis u góry, pod nimi trzy kolumny – menu „Nowy projekt”,
 * „Moje projekty” i „Import”. Poniżej 900 px kolumny układają się jedna pod drugą w tej kolejności.
 */
export function Start() {
  const [odswiezenie, ustawOdswiezenie] = useState(0);

  // Preload czcionki tytułu tylko na tym ekranie (reszta aplikacji jej nie używa).
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/ttf';
    link.crossOrigin = 'anonymous';
    link.href = CZCIONKA_TYTULU;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  return (
    <div className="start">
      <header className="start-naglowek">
        <h1>{t('start.tytul')}</h1>
        <p>{t('start.opis')}</p>
      </header>
      <div className="start-kolumny">
        <nav className="start-menu" aria-labelledby="start-nowy">
          <p id="start-nowy" className="etykieta-sekcji">
            {t('start.nowyProjekt')}
          </p>
          <a href="#/wlasne" className="pasek-menu pasek-bordo">
            <b>{t('start.stworzWlasne')}</b>
            <span>{t('start.wlasneOpis')}</span>
          </a>
          {gry.map((g) => (
            <a key={g.id} href={`#/gra/${g.id}`} className="pasek-menu pasek-granat">
              <b>{t('start.stworzDo', { gra: nazwaGryDo(g) })}</b>
              <span>{t('start.gotoweOpis')}</span>
            </a>
          ))}
        </nav>
        <ListaProjektow odswiezenie={odswiezenie} />
        <PanelImportu onZmiana={() => ustawOdswiezenie((n) => n + 1)} />
      </div>
    </div>
  );
}
