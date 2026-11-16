import { t } from '../../i18n';
import { graDostepna, gry } from '../../pakiety/gry';
import { ListaProjektow } from './ListaProjektow';

/** Ekran startowy: wybór gry (kafelki z rejestru gier) i „Moje projekty”. */
export function Start() {
  return (
    <div className="start">
      <h1>{t('start.tytul')}</h1>
      <p className="podpis">{t('aplikacja.opis')}</p>
      <div className="kafelki-gier">
        {gry.filter(graDostepna).map((g) => (
          <a key={g.id} href={`#/gra/${g.id}`} className="kafelek-gry glowny">
            <span className="tytul-kafelka">＋ {t('start.stworzDo', { gra: g.nazwaDo })}</span>
            <span className="opis-kafelka">{g.opis}</span>
          </a>
        ))}
        <a href="#/gry/inne" className="kafelek-gry">
          <span className="tytul-kafelka">＋ {t('start.stworzInna')}</span>
          <span className="opis-kafelka">{t('start.innaOpis')}</span>
        </a>
      </div>
      <ListaProjektow />
    </div>
  );
}
