import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { gry } from '../../pakiety/gry';
import { nazwaGryDo } from '../nazwyPakietu';
import { ListaProjektow } from './ListaProjektow';
import { PanelImportu } from './PanelImportu';

/** Dekoracyjny emblemat trzech wachlarzowo ułożonych kart w banerze ekranu startowego. */
function EmblematKart() {
  return (
    <svg
      className="start-baner-ikona"
      viewBox="0 0 84 58"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g className="start-baner-karta-srodek" transform="translate(27, 3)">
        <rect className="start-baner-karta-obrys" x="0" y="0" width="30" height="42" rx="4" />
        <rect className="start-baner-karta-ramka" x="4" y="4" width="22" height="34" rx="2" />
        <path className="start-baner-karta-znak" d="M15 13 L20.5 21 L15 29 L9.5 21 Z" />
      </g>
      <g className="start-baner-karta-lewa" transform="translate(9, 10) rotate(-17 15 21)">
        <rect className="start-baner-karta-obrys" x="0" y="0" width="30" height="42" rx="4" />
        <rect className="start-baner-karta-ramka" x="4" y="4" width="22" height="34" rx="2" />
        <path
          className="start-baner-karta-znak"
          d="M15 13.5 L17.3 18.8 L22.5 21 L17.3 23.2 L15 28.5 L12.7 23.2 L7.5 21 L12.7 18.8 Z"
        />
      </g>
      <g className="start-baner-karta-prawa" transform="translate(45, 10) rotate(17 15 21)">
        <rect className="start-baner-karta-obrys" x="0" y="0" width="30" height="42" rx="4" />
        <rect className="start-baner-karta-ramka" x="4" y="4" width="22" height="34" rx="2" />
        <circle className="start-baner-karta-znak" cx="15" cy="21" r="5" />
      </g>
    </svg>
  );
}

/**
 * Ekran startowy: baner z emblematem kart i opis u góry, pod nimi trzy kolumny – menu „Nowy projekt”
 * i „Nowy szablon”, zakładki „Moje projekty” / „Moje szablony” oraz „Import”. Poniżej 900 px kolumny
 * układają się jedna pod drugą w tej kolejności.
 */
export function Start() {
  const [odswiezenie, ustawOdswiezenie] = useState(0);
  // Plik upuszczony poza strefą importu nie może zostać otwarty przez przeglądarkę
  // (zamiast aplikacji pokazałby się plik): blokujemy domyślną akcję, poza strefą kursor „zakaz”.
  useEffect(() => {
    const blokuj = (e: DragEvent) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
      const wStrefie = e.target instanceof Element && e.target.closest('.strefa-upuszczania');
      if (wStrefie) return;
      e.preventDefault();
      if (e.type === 'dragover') e.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragover', blokuj);
    window.addEventListener('drop', blokuj);
    return () => {
      window.removeEventListener('dragover', blokuj);
      window.removeEventListener('drop', blokuj);
    };
  }, []);

  return (
    <div className="start">
      <header className="start-naglowek">
        <div className="start-baner">
          <EmblematKart />
          <h1 className="start-baner-tytul">
            <span className="start-baner-glowny">{t('start.banerTytul')}</span>
            <span className="ukryte"> – </span>
            <span className="start-baner-podtytul">{t('start.banerPodtytul')}</span>
          </h1>
        </div>
        <p>{t('start.opis')}</p>
      </header>
      <div className="start-kolumny">
        <nav className="start-menu" aria-labelledby="start-nowy start-nowy-szablon">
          <p id="start-nowy" className="etykieta-sekcji">
            {t('start.nowyProjekt')}
          </p>
          <a href="#/wlasne" className="pasek-menu pasek-wlasne-1">
            <b>{t('start.stworzWlasne')}</b>
            <span>{t('start.wlasneOpis')}</span>
          </a>
          {gry.map((g) => (
            <a key={g.id} href={`#/gra/${g.id}`} className="pasek-menu pasek-gra-1">
              <b>{t('start.stworzDo', { gra: nazwaGryDo(g) })}</b>
              <span>{t('start.gotoweOpis')}</span>
            </a>
          ))}
          <p id="start-nowy-szablon" className="etykieta-sekcji etykieta-sekcji-odstep">
            {t('start.nowySzablon')}
          </p>
          <a href="#/wlasne/nowy/awers" className="pasek-menu pasek-awers">
            <b>{t('wlasne.awersNazwa')}</b>
            <span>{t('wlasne.awersOpis')}</span>
          </a>
          <a href="#/wlasne/nowy/rewers" className="pasek-menu pasek-rewers">
            <b>{t('wlasne.rewersNazwa')}</b>
            <span>{t('wlasne.rewersOpis')}</span>
          </a>
        </nav>
        <ListaProjektow odswiezenie={odswiezenie} />
        <PanelImportu onZmiana={() => ustawOdswiezenie((n) => n + 1)} />
      </div>
    </div>
  );
}
