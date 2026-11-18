import { t } from '../../i18n';
import { gry } from '../../pakiety/gry';
import { nazwaGryDo, opisGry } from '../nazwyPakietu';
import { ListaProjektow } from './ListaProjektow';

/** Ekran startowy: kafelki gier z rejestru, „Stwórz własne karty” i „Moje projekty”. */
export function Start() {
  return (
    <div className="start">
      <h1>{t('start.tytul')}</h1>
      <p className="podpis">{t('aplikacja.opis')}</p>
      <div className="kafelki-gier">
        {gry.map((g) => (
          <a key={g.id} href={`#/gra/${g.id}`} className="kafelek-gry glowny">
            <span className="tytul-kafelka">＋ {t('start.stworzDo', { gra: nazwaGryDo(g) })}</span>
            <span className="opis-kafelka">{opisGry(g)}</span>
          </a>
        ))}
        <a href="#/wlasne" className="kafelek-gry">
          <span className="tytul-kafelka">＋ {t('start.stworzWlasne')}</span>
          <span className="opis-kafelka">{t('start.wlasneOpis')}</span>
        </a>
      </div>
      <ListaProjektow />
    </div>
  );
}
