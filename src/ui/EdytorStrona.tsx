import { t } from '../i18n';
import { EdytorKartki } from './kartka/EdytorKartki';
import { useProjekt } from './useProjekt';

/** Strona projektu: edytor kartki (wczytanie projektu, błąd, edycja). */
export function EdytorStrona({ id }: { id: string }) {
  const stan = useProjekt(id);
  if (stan.stan === 'wczytywanie') return <p className="tresc">{t('projekty.wczytywanie')}</p>;
  if (stan.stan === 'blad')
    return (
      <section className="tresc">
        <h1>{t('projekt.bladTytul')}</h1>
        <p role="alert" className="uwaga">
          {stan.komunikat}
        </p>
        <a href="#/">{t('projekt.wrocDoListy')}</a>
      </section>
    );
  return <EdytorKartki edycja={stan} />;
}
