import { t } from '../../i18n';
import { nowyProjektZSzablonuKreatora } from '../baza';
import { Kreator } from '../szablon/Kreator';
import { szablonZKreatora } from '../szablon/nowySzablonUI';

/** „Stwórz własne karty” → nowy szablon: kreator, potem nowy projekt i edytor szablonu. */
export function KreatorStrona() {
  return (
    <>
      <nav aria-label={t('projekt.nawigacja')} className="okruszki">
        <a href="#/">{t('nawigacja.start')}</a> › <a href="#/wlasne">{t('start.stworzWlasne')}</a> ›{' '}
        <a href="#/wlasne/nowy">{t('wlasne.nowyNazwa')}</a> ›{' '}
        <span aria-current="page">{t('wlasne.awersNazwa')}</span>
      </nav>
      <Kreator
        anuluj={() => (window.location.hash = '#/wlasne/nowy')}
        utworz={async (u) => {
          const s = szablonZKreatora(u);
          const id = await nowyProjektZSzablonuKreatora(s);
          window.location.hash = `#/projekt/${encodeURIComponent(id)}/szablon/${encodeURIComponent(s.id)}`;
        }}
      />
    </>
  );
}
