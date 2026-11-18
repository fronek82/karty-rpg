import { useRef, useState } from 'react';
import { LIMITY_ARCHIWUM, ROZSZERZENIE_SZABLONU } from '../../dane/archiwum';
import { formatujLiczbe, t } from '../../i18n';
import { KAFELKI_SZABLONOW } from '../../przyklady';
import type { OpisPrzykladu } from '../../przyklady/typy';
import { nowyProjektZPrzykladu } from '../baza';
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
  utworz: (opis: OpisPrzykladu) => void;
}) {
  const wynik = useWynikPrzykladu(opis.id);
  const { szerokosc, wysokosc } = opis.rozmiar;
  return (
    <button
      type="button"
      className="kafelek-podgladu"
      data-podglad={opis.id}
      aria-labelledby={`szablon-${opis.id}-nazwa`}
      aria-describedby={`szablon-${opis.id}-podpowiedz`}
      disabled={wylaczony}
      onClick={() => utworz(opis)}
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
        <span id={`szablon-${opis.id}-podpowiedz`} className="podpowiedz">
          {t('wlasne.kliknij')}
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
  // Ref chroni przed podwójnym kliknięciem w tym samym renderze (stan `trwa` bywa spóźniony).
  const wToku = useRef(false);
  const [trwa, ustawTrwa] = useState(false);
  const [blad, ustawBlad] = useState<string>();
  useUruchomPodgladyPrzykladow();
  const bladPodgladow = useBladPodgladowPrzykladow();

  /** Tworzy projekt (przykład albo import) i otwiera go; po błędzie wraca do ekranu. */
  const wykonaj = async (zadanie: () => Promise<{ id: string } | { blad: string }>) => {
    if (wToku.current) return;
    wToku.current = true;
    ustawTrwa(true);
    ustawBlad(undefined);
    try {
      const wynik = await zadanie();
      if ('blad' in wynik) throw new Error(wynik.blad);
      window.location.hash = adresProjektu(wynik.id);
    } catch (e) {
      ustawBlad(e instanceof Error ? e.message : String(e));
      wToku.current = false;
      ustawTrwa(false);
    }
  };

  const utworz = (opis: OpisPrzykladu) =>
    void wykonaj(async () => {
      try {
        return { id: await nowyProjektZPrzykladu(await opis.laduj()) };
      } catch (e) {
        throw new Error(opisBleduImportu(e));
      }
    });

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
      return importujPlikSzablonu(bajty);
    });

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
        </nav>

        <section className="grupa-podgladow" aria-labelledby="wlasne-przyklady">
          <h2 id="wlasne-przyklady">
            {t('wlasne.przyklady')} <small>{t('wlasne.przykladyPodpis')}</small>
          </h2>
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
