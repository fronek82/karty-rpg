import { t } from '../../i18n';
import { nowyProjektZSzablonuKreatora, nowyProjektZTylemKreatora } from '../bazaUI';
import { Kreator } from '../szablon/Kreator';
import { szablonZKreatora } from '../szablon/nowySzablonUI';
import type { StronaKarty } from '../szablon/PanelKarty';

/**
 * „Stwórz własne karty” → nowy szablon przodu albo tyłu: kreator (krok 1), potem nowy projekt
 * i edytor karty.
 */
export function KreatorStrona({ strona }: { strona: StronaKarty }) {
  const anuluj = () => (window.location.hash = '#/wlasne/nowy');
  return (
    <>
      <nav aria-label={t('projekt.nawigacja')} className="okruszki">
        <a href="#/">{t('nawigacja.start')}</a> › <a href="#/wlasne">{t('start.stworzWlasne')}</a> ›{' '}
        <a href="#/wlasne/nowy">{t('wlasne.nowyNazwa')}</a> ›{' '}
        <span aria-current="page">
          {strona === 'tyl' ? t('wlasne.rewersNazwa') : t('wlasne.awersNazwa')}
        </span>
      </nav>
      {strona === 'tyl' ? (
        <Kreator
          strona="tyl"
          anuluj={anuluj}
          utworz={async (u) => {
            const { id, rewersId } = await nowyProjektZTylemKreatora(u);
            window.location.hash = `#/projekt/${encodeURIComponent(id)}/rewers/${encodeURIComponent(rewersId)}`;
          }}
        />
      ) : (
        <Kreator
          anuluj={anuluj}
          utworz={async (u) => {
            const s = szablonZKreatora(u);
            const id = await nowyProjektZSzablonuKreatora(s, undefined, undefined, u.przypiszTyl);
            window.location.hash = `#/projekt/${encodeURIComponent(id)}/szablon/${encodeURIComponent(s.id)}`;
          }}
        />
      )}
    </>
  );
}
