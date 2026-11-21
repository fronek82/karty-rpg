import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { gry } from '../../pakiety/gry';
import { nazwaGryDo } from '../nazwyPakietu';
import { ListaProjektow } from './ListaProjektow';
import { PanelImportu } from './PanelImportu';

/**
 * Ekran startowy: tytuł i opis u góry, pod nimi trzy kolumny – menu „Nowy projekt”,
 * „Moje projekty” i „Import”. Poniżej 900 px kolumny układają się jedna pod drugą w tej kolejności.
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
        <h1>{t('start.tytul')}</h1>
        <p>{t('start.opis')}</p>
      </header>
      <div className="start-kolumny">
        <nav className="start-menu" aria-labelledby="start-nowy">
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
        </nav>
        <ListaProjektow odswiezenie={odswiezenie} />
        <PanelImportu onZmiana={() => ustawOdswiezenie((n) => n + 1)} />
      </div>
    </div>
  );
}
