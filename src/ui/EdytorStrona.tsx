import { przypiszRewers } from '../dane/rewers';
import { czyProjektWlasny, dodajSzablonZKartka } from '../dane/wlasneKarty';
import { t } from '../i18n';
import { AktywnyProjektKontekst } from './AktywnyProjektKontekst';
import { dolaczTyl, paczkaTyluZProjektu } from './bazaUI';
import { EdytorKartki } from './kartka/EdytorKartki';
import { EkranKart } from './karty/EkranKart';
import { EdytorKarty } from './szablon/EdytorKarty';
import { Kreator } from './szablon/Kreator';
import { szablonZKreatora } from './szablon/nowySzablonUI';
import { useProjekt } from './useProjekt';

/**
 * Strona projektu: edytor kart (domyślnie), widok kart UI2 (`karty`), widok drukowania (`drukuj`),
 * edytor szablonu (`szablon/<id>`), edytor rewersu (`rewers/<id>`) albo kreator nowego szablonu
 * w projekcie (`nowy-szablon`). Projekt wczytany raz – przejścia nie przeładowują.
 */
export function EdytorStrona({ id, podtrasa = '' }: { id: string; podtrasa?: string }) {
  const czyEdytorKart =
    !podtrasa ||
    podtrasa === 'karty' ||
    podtrasa === 'drukuj' ||
    podtrasa.startsWith('drukuj/') ||
    podtrasa.startsWith('kartka/');
  // Zapis ręczny (przycisk „Zapisz”, Ctrl+S) w Edytorze kart oraz Edytorze szablonu i rewersu.
  const zapisReczny =
    czyEdytorKart || podtrasa.startsWith('szablon/') || podtrasa.startsWith('rewers/');
  const stan = useProjekt(id, { autozapis: !zapisReczny });
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
    const rewersDop = /^rewers\/(.+)$/.exec(podtrasa)?.[1];
    if (rewersDop) {
      const rewersId = decodeURIComponent(rewersDop);
      return <EdytorKarty key={`tyl:${rewersId}`} edycja={stan} strona="tyl" id={rewersId} />;
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
    if (szablon)
      return <EdytorKarty key={`przod:${szablon}`} edycja={stan} strona="przod" id={szablon} />;
    if (podtrasa === 'nowy-szablon')
      return (
        <div className="tresc tresc-start kreator-w-projekcie">
          <Kreator
            anuluj={() => (window.location.hash = sciezka)}
            utworz={async (u) => {
              // Nowy szablon bez zasobów – zwykła zmiana projektu (zapis w tle, jak każda edycja);
              // id szablonu z wyniku (dodajSzablon nadaje unikalne). Tył z innego projektu
              // trafia do tego projektu jako kopia i jest przypisany do nowego szablonu.
              const zrodlo = u.przypiszTyl;
              const paczka =
                zrodlo && zrodlo.projektId !== stan.projekt.id
                  ? await paczkaTyluZProjektu(zrodlo)
                  : undefined;
              let szablonId = '';
              await stan.zmienZZasobami((p, d) => {
                const w = dodajSzablonZKartka(p, d, {
                  szablon: szablonZKreatora(u),
                  role: {},
                  zasoby: [],
                  dane: new Map(),
                });
                szablonId = w.szablonId;
                const przypisz = (q: typeof p, rewersId: string) =>
                  przypiszRewers(q, { rodzaj: 'szablon', id: w.szablonId }, rewersId);
                if (paczka) {
                  const z = dolaczTyl(w.projekt, w.zasoby, paczka, przypisz);
                  return { projekt: z.projekt, dane: z.zasoby };
                }
                return {
                  projekt: zrodlo ? przypisz(w.projekt, zrodlo.rewersId) : w.projekt,
                  dane: w.zasoby,
                };
              });
              window.location.hash = `${sciezka}/szablon/${encodeURIComponent(szablonId)}`;
            }}
          />
        </div>
      );
    if (podtrasa === 'karty') return <EkranKart edycja={stan} />;
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
