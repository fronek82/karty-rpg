import { useEffect, useRef, useState } from 'react';
import { kluczMiniaturySzablonu } from '../../dane/baza';
import { ACCEPT_PLIKU_SZABLONU, LIMITY_ARCHIWUM } from '../../dane/archiwum';
import { formatujLiczbe, t } from '../../i18n';
import { rozpoznajRodzaj } from './importPlikow';
import { KAFELKI_SZABLONOW } from '../../przyklady';
import type { OpisPrzykladu } from '../../przyklady/typy';
import {
  baza,
  nowyProjektZAwersuZProjektu,
  nowyProjektZRewersuZProjektu,
  zapiszProjektZPrzykladu,
} from '../bazaUI';
import { poOstatnimZapisie } from '../useProjekt';
import { GaleriaOnline } from './GaleriaOnline';
import { pokazMojeSzablony } from './ListaProjektow';
import {
  adresMiniatury,
  brakujacaDlaPozycji,
  dorysujMiniatury,
  wczytajPozycjeSzablonow,
  type PozycjaSzablonu,
} from './mojeSzablony';
import { adresProjektu, importujPlikSzablonu, opisBleduImportu } from './importSzablonu';
import {
  ponowPodgladyPrzykladow,
  useBladPodgladowPrzykladow,
  useUruchomPodgladyPrzykladow,
  useWynikPrzykladu,
} from './ladujPrzyklady';
import { PodgladKartki } from './PodgladKartki';

const MB = 1024 * 1024;

/** Ile ostatnio zmienionych „Moich szablonów” pokazuje ekran (reszta – „Pokaż wszystkie”). */
export const LIMIT_OSTATNICH = 8;

/**
 * „Moje szablony” na ekranie „Stwórz własne karty”: ostatnio zmienione szablony awersów i rewersy
 * z miniaturą. Kliknięcie tworzy nowy projekt z kopią szablonu (oryginał zostaje bez zmian).
 */
function OstatnieSzablony({
  wylaczony,
  uzyj,
}: {
  wylaczony: boolean;
  uzyj: (poz: PozycjaSzablonu, el: HTMLElement) => void;
}) {
  const [pozycje, ustawPozycje] = useState<PozycjaSzablonu[]>();
  const [miniatury, ustawMiniatury] = useState<Map<string, string>>(new Map());
  const [blad, ustawBlad] = useState<string>();

  useEffect(() => {
    let aktywny = true;
    void (async () => {
      try {
        await poOstatnimZapisie();
        const [wszystkie, zapisane] = await Promise.all([
          wczytajPozycjeSzablonow(),
          baza().miniatury(),
        ]);
        if (!aktywny) return;
        const ostatnie = wszystkie.slice(0, LIMIT_OSTATNICH);
        ustawPozycje(ostatnie);
        ustawMiniatury(zapisane);
        const brakujace = ostatnie.filter((p) => !zapisane.has(p.klucz)).map(brakujacaDlaPozycji);
        if (!brakujace.length) return;
        const nowe = await dorysujMiniatury(
          brakujace,
          () => aktywny,
          () => undefined,
        );
        if (aktywny && nowe.size) ustawMiniatury((m) => new Map([...m, ...nowe]));
      } catch (e) {
        if (aktywny) ustawBlad(opisBleduImportu(e));
      }
    })();
    return () => {
      aktywny = false;
    };
  }, []);

  return (
    <section className="grupa-podgladow moje-szablony" aria-labelledby="wlasne-moje">
      <div className="naglowek-moich">
        <h2 id="wlasne-moje">
          {t('start.mojeSzablony')} <small>{t('wlasne.mojePodpis')}</small>
        </h2>
        {pozycje && pozycje.length > 0 && (
          <button type="button" className="pokaz-wszystkie" onClick={pokazMojeSzablony}>
            {t('wlasne.pokazWszystkie')}
          </button>
        )}
      </div>
      {blad ? (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      ) : !pozycje ? (
        <p className="podpis">{t('projekty.wczytywanie')}</p>
      ) : pozycje.length === 0 ? (
        <p className="podpis">{t('wlasne.brakMoich')}</p>
      ) : (
        <div className="siatka-szablonow">
          {pozycje.map((poz) => {
            const svg =
              miniatury.get(poz.klucz) ??
              (poz.rodzaj === 'awers'
                ? miniatury.get(kluczMiniaturySzablonu(poz.awers.projektId, poz.awers.szablonId))
                : undefined);
            return (
              <button
                key={poz.klucz}
                type="button"
                className="kafelek-podgladu"
                data-moj-szablon={poz.klucz}
                disabled={wylaczony}
                aria-describedby="wlasne-moje-podpowiedz"
                onClick={(e) => uzyj(poz, e.currentTarget)}
              >
                <span className="miniatura-podgladu miniatura-karty">
                  {svg ? (
                    <img className="miniatura-wlasna" alt="" src={adresMiniatury(svg)} />
                  ) : (
                    <span className="bez-miniatury" aria-hidden="true">
                      🂠
                    </span>
                  )}
                </span>
                <span className="opis-podgladu">
                  <b>
                    {poz.nazwa}{' '}
                    <span className={`znacznik-strony-karty znacznik-strony-karty-${poz.rodzaj}`}>
                      {poz.rodzaj === 'rewers'
                        ? t('projekty.stronaRewers')
                        : t('projekty.stronaAwers')}
                    </span>
                  </b>
                  <span className="podpowiedz" aria-hidden="true">
                    {t('wlasne.kliknijMoj')}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p id="wlasne-moje-podpowiedz" className="ukryte">
        {t('wlasne.kliknijMoj')}
      </p>
    </section>
  );
}

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
 * „Stwórz własne karty”: lewe menu (AI, „Importuj szablon”), a w środku od góry: „Moje szablony”
 * (ostatnie), przykładowe szablony z `src/przyklady/` (podglądy liczy silnik – ten sam SVG co
 * w PDF) i galeria online. Kliknięcie kafelka tworzy projekt z szablonem i otwiera edytor kartki.
 * „Nowy szablon od zera” jest na stronie głównej.
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
        return { id: await zapiszProjektZPrzykladu(await opis.laduj()) };
      } catch (e) {
        return { blad: opisBleduImportu(e) };
      }
    }, el);

  const uzyjMojego = (poz: PozycjaSzablonu, el: HTMLElement) =>
    void wykonaj(async () => {
      try {
        return {
          id:
            poz.rodzaj === 'rewers'
              ? await nowyProjektZRewersuZProjektu(poz.rewers.projektId, poz.rewers.rewersId)
              : await nowyProjektZAwersuZProjektu(poz.awers.projektId, poz.awers.szablonId),
        };
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
          <a href="#/wlasne/ai" className="pasek-menu pasek-wlasne-2">
            <b>{t('wlasne.aiNazwa')}</b>
            <span>{t('wlasne.aiOpis')}</span>
          </a>
          <button
            type="button"
            ref={przyciskImportu}
            className="pasek-menu pasek-wlasne-2"
            disabled={trwa}
            onClick={() => plik.current?.click()}
          >
            <b>{t('wlasne.importNazwa')}</b>
            <span>{t('wlasne.importOpis')}</span>
          </button>
          <input
            ref={plik}
            type="file"
            accept={ACCEPT_PLIKU_SZABLONU}
            hidden
            data-testid="plik-szablonu-start"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) importuj(f);
            }}
          />
        </nav>

        <div className="grupy-podgladow">
          <OstatnieSzablony wylaczony={trwa} uzyj={uzyjMojego} />
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
          <GaleriaOnline
            zablokowana={trwa}
            uzyjSzablonu={(bajty, zrodlo) => wykonaj(() => importujPlikSzablonu(bajty), zrodlo)}
          />
        </div>
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
