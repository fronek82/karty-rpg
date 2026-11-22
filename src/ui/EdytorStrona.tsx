import { czyProjektWlasny, dodajSzablonZKartka } from '../dane/wlasneKarty';
import { t } from '../i18n';
import { AktywnyProjektKontekst } from './AktywnyProjektKontekst';
import { BibliotekaOzdobnikow } from './biblioteka/BibliotekaOzdobnikow';
import { EdytorKartki } from './kartka/EdytorKartki';
import { EdytorRewersu } from './rewers/EdytorRewersu';
import { EdytorSzablonu } from './szablon/EdytorSzablonu';
import { Kreator } from './szablon/Kreator';
import { szablonZKreatora } from './szablon/nowySzablonUI';
import { useProjekt } from './useProjekt';

/**
 * Strona projektu: edytor kart (domyślnie), widok drukowania (`drukuj`), edytor szablonu
 * (`szablon/<id>`), edytor rewersu (`rewers/<id>`) albo kreator nowego szablonu w projekcie
 * (`nowy-szablon`). Projekt wczytany raz – przejścia nie przeładowują.
 */
export function EdytorStrona({ id, podtrasa = '' }: { id: string; podtrasa?: string }) {
  const czyEdytorKart =
    !podtrasa ||
    podtrasa === 'drukuj' ||
    podtrasa.startsWith('drukuj/') ||
    podtrasa.startsWith('kartka/');
  const stan = useProjekt(id, { autozapis: !czyEdytorKart });
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
  const zGry = !czyProjektWlasny(stan.projekt);

  const zawartosc = (() => {
    if (podtrasa === 'biblioteka') return <BibliotekaOzdobnikow edycja={stan} />;
    const rewersDop = /^rewers\/(.+)$/.exec(podtrasa)?.[1];
    if (rewersDop) {
      const rewersId = decodeURIComponent(rewersDop);
      return <EdytorRewersu key={rewersId} edycja={stan} rewersId={rewersId} />;
    }
    const identyfikator = /^szablon\/(.+)$/.exec(podtrasa)?.[1];
    const szablon = identyfikator && decodeURIComponent(identyfikator);
    const szablonWlasny =
      szablon && stan.projekt.arkusze.some((a) => a.wlasnySzablonId === szablon);
    if (zGry && (podtrasa === 'nowy-szablon' || (szablon && !szablonWlasny)))
      // Projekt gry (np. Mausritter): szablony z pakietu nie są edytowane w edytorze od zera.
      return (
        <section className="tresc">
          <p role="alert" className="uwaga">
            {t('szablon.tylkoWlasne')}
          </p>
          <a href={sciezka}>{t('szablon.wrocDoKartek')}</a>
        </section>
      );
    if (szablon) return <EdytorSzablonu key={szablon} edycja={stan} szablonId={szablon} />;
    if (podtrasa === 'nowy-szablon')
      return (
        <div className="tresc tresc-start kreator-w-projekcie">
          <Kreator
            anuluj={() => (window.location.hash = sciezka)}
            utworz={(u) => {
              // Nowy szablon bez zasobów – zwykła zmiana projektu (zapis w tle, jak każda edycja);
              // id szablonu z wyniku (dodajSzablon nadaje unikalne).
              let szablonId = '';
              stan.zmien((p) => {
                const w = dodajSzablonZKartka(p, stan.dane, {
                  szablon: szablonZKreatora(u),
                  role: {},
                  zasoby: [],
                  dane: new Map(),
                });
                szablonId = w.szablonId;
                return w.projekt;
              });
              window.location.hash = `${sciezka}/szablon/${encodeURIComponent(szablonId)}`;
            }}
          />
        </div>
      );
    if (podtrasa === 'drukuj') return <EdytorKartki edycja={stan} tryb="drukuj" />;
    const drukujKartka = /^drukuj\/(.+)$/.exec(podtrasa)?.[1];
    if (drukujKartka)
      return (
        <EdytorKartki edycja={stan} tryb="drukuj" pokazKartke={decodeURIComponent(drukujKartka)} />
      );
    const kartka = /^kartka\/(.+)$/.exec(podtrasa)?.[1];
    return (
      <EdytorKartki
        edycja={stan}
        tryb="edycja"
        {...(kartka ? { pokazKartke: decodeURIComponent(kartka) } : {})}
      />
    );
  })();

  return (
    <AktywnyProjektKontekst.Provider value={stan}>{zawartosc}</AktywnyProjektKontekst.Provider>
  );
}
