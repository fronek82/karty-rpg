import { useEffect, useRef, useState } from 'react';
import { LIMITY_ARCHIWUM, ROZSZERZENIE_SZABLONU } from '../../dane/archiwum';
import { formatujLiczbe, t } from '../../i18n';
import { rozpoznajRodzaj } from './importPlikow';
import { KAFELKI_SZABLONOW } from '../../przyklady';
import type { OpisPrzykladu } from '../../przyklady/typy';
import { nowyProjektZPrzykladu } from '../baza';
import { BibliotekaGlobalna } from '../biblioteka/BibliotekaGlobalna';
import { adresProjektu, importujPlikSzablonu, opisBleduImportu } from './importSzablonu';
import {
  ponowPodgladyPrzykladow,
  useBladPodgladowPrzykladow,
  useUruchomPodgladyPrzykladow,
  useWynikPrzykladu,
} from './ladujPrzyklady';
import { PodgladKartki } from './PodgladKartki';

const MB = 1024 * 1024;

/** Kafelek przykładu: sam subskrybuje swój podgląd, więc gotowy podgląd nie przerysowuje ekranu. */
function KafelekSzablonu({
  opis,
  wylaczony,
  utworz,
}: {
  opis: OpisPrzykladu;
  wylaczony: boolean;
  utworz: (opis: OpisPrzykladu, el: HTMLElement) => void;
}) {
  const wynik = useWynikPrzykladu(opis.id);
  const { szerokosc, wysokosc } = opis.rozmiar;
  return (
    <button
      type="button"
      className="kafelek-podgladu"
      data-podglad={opis.id}
      aria-labelledby={`szablon-${opis.id}-nazwa`}
      aria-describedby={`szablon-${opis.id}-rozmiar`}
      disabled={wylaczony}
      onClick={(e) => utworz(opis, e.currentTarget)}
    >
      <span className="miniatura-podgladu miniatura-karty">
        <PodgladKartki wynik={wynik} proporcje={opis.rozmiar} />
        {opis.id === 'pusta' && (
          <span className="rozmiar-pustej" aria-hidden="true">
            {t('rozmiar.mm', {
              szer: formatujLiczbe(szerokosc, 1),
              wys: formatujLiczbe(wysokosc, 1),
            })}
          </span>
        )}
      </span>
      <span className="opis-podgladu">
        <b id={`szablon-${opis.id}-nazwa`}>{t(`przyklad.${opis.id}.nazwa`)}</b>
        {/* Podpowiedź widoczna na każdym kafelku; czytnik dostaje ją raz, w opisie grupy. */}
        <span className="podpowiedz" aria-hidden="true">
          {t('wlasne.kliknij')}
        </span>
        <span id={`szablon-${opis.id}-rozmiar`} className="ukryte">
          {t('rozmiar.mm', {
            szer: formatujLiczbe(szerokosc, 1),
            wys: formatujLiczbe(wysokosc, 1),
          })}
        </span>
      </span>
    </button>
  );
}

/**
 * „Stwórz własne karty”: lewe menu („Nowy szablon od zera”, „Importuj szablon”) i w środku
 * kafelki z podglądem karty – pusta karta i przykładowe szablony z `src/przyklady/`. Podglądy
 * liczy silnik (ten sam SVG co w PDF); kliknięcie kafelka tworzy projekt z szablonem i jedną kartą
 * z danymi przykładowymi i otwiera edytor kartki.
 */
export function WlasneKarty() {
  const plik = useRef<HTMLInputElement>(null);
  const przyciskImportu = useRef<HTMLButtonElement>(null);
  // Element, który wywołał tworzenie – po błędzie dostaje fokus z powrotem (był `disabled`).
  const fokusPo = useRef<HTMLElement | null>(null);
  // Po odmontowaniu (np. przejście na inną trasę w trakcie tworzenia) nie nawigujemy ani nie ustawiamy stanu.
  const zamontowany = useRef(true);
  // Ref chroni przed podwójnym kliknięciem w tym samym renderze (stan `trwa` bywa spóźniony).
  const wToku = useRef(false);
  const [trwa, ustawTrwa] = useState(false);
  const [blad, ustawBlad] = useState<string>();
  useUruchomPodgladyPrzykladow();
  useEffect(() => {
    zamontowany.current = true;
    return () => {
      zamontowany.current = false;
    };
  }, []);
  useEffect(() => {
    if (!trwa && fokusPo.current) {
      fokusPo.current.focus();
      fokusPo.current = null;
    }
  }, [trwa]);
  const bladPodgladow = useBladPodgladowPrzykladow();

  /** Tworzy projekt (przykład albo import) i otwiera go; po błędzie wraca do ekranu. */
  const wykonaj = async (
    zadanie: () => Promise<{ id: string } | { blad: string }>,
    zrodlo: HTMLElement | null,
  ) => {
    if (wToku.current) return false;
    wToku.current = true;
    ustawTrwa(true);
    ustawBlad(undefined);
    let komunikat: string | undefined;
    let id = '';
    try {
      const wynik = await zadanie();
      if ('blad' in wynik) komunikat = wynik.blad;
      else id = wynik.id;
    } catch (e) {
      komunikat = e instanceof Error ? e.message : String(e);
    }
    if (!zamontowany.current) return false;
    if (komunikat === undefined) {
      window.location.hash = adresProjektu(id);
      return true;
    }
    fokusPo.current = zrodlo;
    ustawBlad(komunikat);
    wToku.current = false;
    ustawTrwa(false);
    return false;
  };

  const utworz = (opis: OpisPrzykladu, el: HTMLElement) =>
    void wykonaj(async () => {
      try {
        return { id: await nowyProjektZPrzykladu(await opis.laduj()) };
      } catch (e) {
        return { blad: opisBleduImportu(e) };
      }
    }, el);

  const importuj = (f: File) =>
    void wykonaj(async () => {
      if (f.size > LIMITY_ARCHIWUM.suma)
        return {
          blad: t('import.zaDuzy', {
            mb: formatujLiczbe(f.size / MB, 1),
            limit: formatujLiczbe(LIMITY_ARCHIWUM.suma / MB, 0),
          }),
        };
      let bajty: Uint8Array;
      try {
        bajty = new Uint8Array(await f.arrayBuffer());
      } catch {
        return { blad: t('import.nieczytelny') };
      }
      // Plik projektu (.kartyrpg) to nie szablon – podpowiadamy właściwe miejsce importu.
      if (rozpoznajRodzaj(f.name, bajty) === 'projekt')
        return { blad: t('wlasne.toProjekt', { przycisk: t('start.importujPliki') }) };
      return importujPlikSzablonu(bajty);
    }, przyciskImportu.current);

  return (
    <section className="wybor-gry wlasne-karty">
      <nav aria-label={t('projekt.nawigacja')} className="okruszki">
        <a href="#/">{t('nawigacja.start')}</a> ›{' '}
        <span aria-current="page">{t('start.stworzWlasne')}</span>
      </nav>
      <h1 className="ukryte">{t('start.stworzWlasne')}</h1>
      <div className="wybor-kolumny">
        <nav className="start-menu" aria-labelledby="wlasne-menu">
          <p id="wlasne-menu" className="etykieta-sekcji">
            {t('wlasne.menu')}
          </p>
          <a href="#/wlasne/nowy" className="pasek-menu pasek-koral">
            <b>{t('wlasne.nowyNazwa')}</b>
            <span>{t('wlasne.nowyOpis')}</span>
          </a>
          <button
            type="button"
            ref={przyciskImportu}
            className="pasek-menu pasek-turkus"
            disabled={trwa}
            onClick={() => plik.current?.click()}
          >
            <b>{t('wlasne.importNazwa')}</b>
            <span>{t('wlasne.importOpis')}</span>
          </button>
          <input
            ref={plik}
            type="file"
            accept={`${ROZSZERZENIE_SZABLONU},.zip`}
            hidden
            data-testid="plik-szablonu-start"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) importuj(f);
            }}
          />
          <BibliotekaGlobalna
            rodzaj="szablon"
            zablokowana={trwa}
            dodaj={(bajty, przycisk) => wykonaj(() => importujPlikSzablonu(bajty), przycisk)}
          />
        </nav>

        <section
          className="grupa-podgladow"
          aria-labelledby="wlasne-przyklady"
          aria-describedby="wlasne-podpowiedz"
        >
          <h2 id="wlasne-przyklady">
            {t('wlasne.przyklady')} <small>{t('wlasne.przykladyPodpis')}</small>
          </h2>
          <p id="wlasne-podpowiedz" className="ukryte">
            {t('wlasne.kliknij')}
          </p>
          <div className="siatka-szablonow">
            {KAFELKI_SZABLONOW.map((o) => (
              <KafelekSzablonu key={o.id} opis={o} wylaczony={trwa} utworz={utworz} />
            ))}
          </div>
        </section>
      </div>
      <p role="status" aria-live="polite" className="status">
        {trwa ? t('start.tworze') : ''}
      </p>
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      {bladPodgladow && (
        <p role="alert" className="uwaga">
          {t('wlasne.podgladyBlad', { szczegoly: bladPodgladow })}{' '}
          <button type="button" onClick={() => void ponowPodgladyPrzykladow()}>
            {t('start.sprobujPonownie')}
          </button>
        </p>
      )}
    </section>
  );
}
