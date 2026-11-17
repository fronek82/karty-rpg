import { dodajSzablonZKartka } from '../dane/wlasneKarty';
import { t } from '../i18n';
import { EdytorKartki } from './kartka/EdytorKartki';
import { EdytorSzablonu } from './szablon/EdytorSzablonu';
import { Kreator } from './szablon/Kreator';
import { szablonZKreatora } from './szablon/nowySzablonUI';
import { useProjekt } from './useProjekt';

/**
 * Strona projektu: kartki (domyślnie), edytor szablonu (`szablon/<id>`) albo kreator nowego
 * szablonu w projekcie (`nowy-szablon`). Projekt wczytany raz – przejścia nie przeładowują.
 */
export function EdytorStrona({ id, podtrasa = '' }: { id: string; podtrasa?: string }) {
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
  const sciezka = `#/projekt/${encodeURIComponent(id)}`;
  const szablon = /^szablon\/(.+)$/.exec(podtrasa)?.[1];
  if (szablon)
    return <EdytorSzablonu key={szablon} edycja={stan} szablonId={decodeURIComponent(szablon)} />;
  if (podtrasa === 'nowy-szablon')
    return (
      <div className="tresc">
        <Kreator
          anuluj={() => (window.location.hash = sciezka)}
          utworz={async (u) => {
            const s = szablonZKreatora(
              u,
              stan.projekt.szablony.map((x) => x.id),
            );
            await stan.zmienZZasobami((p, d) => {
              const w = dodajSzablonZKartka(p, d, {
                szablon: s,
                role: {},
                zasoby: [],
                dane: new Map(),
              });
              return { projekt: w.projekt, dane: w.zasoby };
            });
            window.location.hash = `${sciezka}/szablon/${encodeURIComponent(s.id)}`;
          }}
        />
      </div>
    );
  return <EdytorKartki edycja={stan} />;
}
