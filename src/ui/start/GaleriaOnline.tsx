import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  adresPlikuGalerii,
  filtrujGalerie,
  KATEGORIE_GALERII,
  pobierzManifestGalerii,
  pobierzSzablonZUrl,
  type KategoriaGalerii,
  type WpisGaleriiOnline,
} from '../../dane/galeriaOnline';
import { danePodgladu } from '../../dane/szablon';
import { formatujLiczbe, jezyk as aktualnyJezyk, t } from '../../i18n';
import { opisBleduImportu } from './importSzablonu';

interface PodgladSvgWpisu {
  awers: string;
  rewers?: string;
}

const WARIANTY_CZCIONKI = [
  ['normalny', 'EBGaramond-Regular.ttf'],
  ['pogrubiony', 'EBGaramond-Bold.ttf'],
  ['kursywa', 'EBGaramond-Italic.ttf'],
  ['pogrubiona-kursywa', 'EBGaramond-BoldItalic.ttf'],
] as const;

let obietnicaCzcionekGalerii: Promise<import('../../silnik/czcionki').RejestrCzcionek> | undefined;

async function czcionkiPodgladuGalerii() {
  if (!obietnicaCzcionekGalerii) {
    obietnicaCzcionekGalerii = (async () => {
      const { RejestrCzcionek, wczytajCzcionke } = await import('../../silnik/czcionki');
      const bazaUrl = import.meta.env.BASE_URL;
      const rejestr = new RejestrCzcionek();
      const bufory = await Promise.all(
        WARIANTY_CZCIONKI.map(async ([wariant, plik]) => {
          const odp = await fetch(`${bazaUrl}czcionki/${plik}`);
          if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
          return [wariant, plik, new Uint8Array(await odp.arrayBuffer())] as const;
        }),
      );
      for (const [wariant, plik, dane] of bufory) {
        rejestr.dodaj('EB Garamond', wariant, wczytajCzcionke(plik, dane));
      }
      rejestr.przypiszRole('tresc', 'EB Garamond');
      rejestr.przypiszRole('tytul', 'EB Garamond');
      rejestr.ustawZapasowa('EB Garamond');
      return rejestr;
    })().catch((e) => {
      obietnicaCzcionekGalerii = undefined;
      throw e;
    });
  }
  return obietnicaCzcionekGalerii;
}

/**
 * Kuratorowana galeria neutralnych szablonów i rewersów online (statyczny manifest + paczki
 * `.kartyrpg-szablon`) oraz formularz importu szablonu z bezpośredniego adresu URL.
 */
export function GaleriaOnline({
  zablokowana,
  uzyjSzablonu,
}: {
  zablokowana: boolean;
  uzyjSzablonu: (bajty: Uint8Array, zrodlo: HTMLElement | null) => Promise<boolean>;
}) {
  const idSzukaj = useId();
  const idKategoria = useId();
  const idUrl = useId();
  const jezyk = aktualnyJezyk();

  const [wpisy, ustawWpisy] = useState<WpisGaleriiOnline[]>();
  const [bladManifestu, ustawBladManifestu] = useState<string>();
  const [ladowanieManifestu, ustawLadowanieManifestu] = useState(true);
  const [zapytanie, ustawZapytanie] = useState('');
  const [kategoria, ustawKategoria] = useState<KategoriaGalerii | 'wszystkie'>('wszystkie');
  const [tylkoZRewersem, ustawTylkoZRewersem] = useState(false);

  const [urlWejscie, ustawUrlWejscie] = useState('');
  const [pobieranieId, ustawPobieranieId] = useState<string>();
  const [bladAkcji, ustawBladAkcji] = useState<string>();
  const [podglady, ustawPodglady] = useState<Record<string, PodgladSvgWpisu>>({});
  const [otwartyPodglad, ustawOtwartyPodglad] = useState<string>();
  const [ladujePodglad, ustawLadujePodglad] = useState<string>();

  const zamontowany = useRef(true);
  const wToku = useRef(false);
  const manifestCtrl = useRef<AbortController | null>(null);
  const akcjaCtrl = useRef<AbortController | null>(null);
  const podgladCtrl = useRef<AbortController | null>(null);

  useEffect(() => {
    zamontowany.current = true;
    return () => {
      zamontowany.current = false;
      manifestCtrl.current?.abort();
      akcjaCtrl.current?.abort();
      podgladCtrl.current?.abort();
    };
  }, []);

  const wczytajManifest = useCallback(() => {
    manifestCtrl.current?.abort();
    const kontroler = new AbortController();
    manifestCtrl.current = kontroler;
    ustawLadowanieManifestu(true);
    ustawBladManifestu(undefined);
    pobierzManifestGalerii({ bazaUrl: import.meta.env.BASE_URL, signal: kontroler.signal })
      .then((m) => {
        if (!zamontowany.current || manifestCtrl.current !== kontroler) return;
        ustawWpisy(m.szablony);
        ustawLadowanieManifestu(false);
      })
      .catch((e) => {
        if (!zamontowany.current || manifestCtrl.current !== kontroler) return;
        if (e instanceof Error && e.name === 'AbortError') return;
        ustawBladManifestu(opisBleduImportu(e));
        ustawLadowanieManifestu(false);
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => wczytajManifest(), 0);
    return () => {
      window.clearTimeout(timer);
      manifestCtrl.current?.abort();
    };
  }, [wczytajManifest]);

  const widoczne = useMemo(
    () => (wpisy ? filtrujGalerie(wpisy, { zapytanie, kategoria, tylkoZRewersem }) : undefined),
    [wpisy, zapytanie, kategoria, tylkoZRewersem],
  );

  const zajete = zablokowana || pobieranieId !== undefined;

  const pobierzIWykonaj = async (
    idZadania: string,
    adres: string,
    wymagajHttp: boolean,
    akcja: (bajty: Uint8Array, nazwa: string) => Promise<void>,
  ) => {
    if (wToku.current || zablokowana) return;
    wToku.current = true;
    akcjaCtrl.current?.abort();
    const kontroler = new AbortController();
    akcjaCtrl.current = kontroler;
    ustawPobieranieId(idZadania);
    ustawBladAkcji(undefined);
    try {
      const { bajty, paczka } = await pobierzSzablonZUrl(adres, {
        wymagajHttp,
        signal: kontroler.signal,
      });
      if (!zamontowany.current || akcjaCtrl.current !== kontroler) return;
      await akcja(bajty, paczka.szablon.nazwa);
    } catch (e) {
      if (!zamontowany.current || akcjaCtrl.current !== kontroler) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      ustawBladAkcji(opisBleduImportu(e));
    } finally {
      if (akcjaCtrl.current === kontroler) {
        wToku.current = false;
        if (zamontowany.current) ustawPobieranieId(undefined);
      }
    }
  };

  const uzyjWpisu = (wpis: WpisGaleriiOnline, przycisk: HTMLButtonElement) =>
    void pobierzIWykonaj(
      `uzyj:${wpis.id}`,
      adresPlikuGalerii(import.meta.env.BASE_URL, wpis.plik),
      false,
      async (bajty) => {
        await uzyjSzablonu(bajty, przycisk);
      },
    );

  const przelaczPodglad = async (wpis: WpisGaleriiOnline) => {
    podgladCtrl.current?.abort();
    if (otwartyPodglad === wpis.id) {
      podgladCtrl.current = null;
      ustawOtwartyPodglad(undefined);
      ustawLadujePodglad(undefined);
      return;
    }
    ustawOtwartyPodglad(wpis.id);
    if (podglady[wpis.id]) {
      ustawLadujePodglad(undefined);
      return;
    }
    const kontroler = new AbortController();
    podgladCtrl.current = kontroler;
    ustawLadujePodglad(wpis.id);
    ustawBladAkcji(undefined);
    try {
      const [{ paczka }, czcionki, { renderujKarte, renderujRewers }, { scenaDoSvg }] =
        await Promise.all([
          pobierzSzablonZUrl(adresPlikuGalerii(import.meta.env.BASE_URL, wpis.plik), {
            signal: kontroler.signal,
          }),
          czcionkiPodgladuGalerii(),
          import('../../silnik/karta'),
          import('../../silnik/svg'),
        ]);
      if (!zamontowany.current || podgladCtrl.current !== kontroler) return;
      const ctx = {
        czcionki,
        ...(paczka.biblioteka ? { elementy: paczka.biblioteka } : {}),
      };
      const karta = { dane: danePodgladu(paczka.szablon) };
      const awers = scenaDoSvg(renderujKarte(paczka.szablon, karta, ctx).scena, {
        przedrostekId: `gal-${wpis.id}-a-`,
      });
      const rewers = paczka.rewers
        ? scenaDoSvg(renderujRewers(paczka.rewers, ctx).scena, {
            przedrostekId: `gal-${wpis.id}-r-`,
          })
        : undefined;
      if (!zamontowany.current || podgladCtrl.current !== kontroler) return;
      ustawPodglady((pop) => ({
        ...pop,
        [wpis.id]: rewers ? { awers, rewers } : { awers },
      }));
    } catch (e) {
      if (!zamontowany.current || podgladCtrl.current !== kontroler) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      ustawOtwartyPodglad(undefined);
      ustawBladAkcji(opisBleduImportu(e));
    } finally {
      if (zamontowany.current && podgladCtrl.current === kontroler) {
        ustawLadujePodglad(undefined);
      }
    }
  };

  const importujZLinku = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const przycisk = e.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]');
    void pobierzIWykonaj('url', urlWejscie, true, async (bajty) => {
      await uzyjSzablonu(bajty, przycisk);
    });
  };

  return (
    <section className="galeria-online" aria-labelledby="galeria-online-tytul">
      <div className="galeria-online-naglowek">
        <h2 id="galeria-online-tytul">
          {t('galeria.tytul')} <small>{t('galeria.podpis')}</small>
        </h2>
      </div>

      <div className="galeria-online-filtry">
        <div className="pole">
          <label htmlFor={idSzukaj}>{t('galeria.szukaj')}</label>
          <input
            id={idSzukaj}
            type="search"
            value={zapytanie}
            placeholder={t('galeria.szukajPlaceholder')}
            onChange={(e) => ustawZapytanie(e.target.value)}
          />
        </div>
        <div className="pole">
          <label htmlFor={idKategoria}>{t('galeria.kategoria')}</label>
          <select
            id={idKategoria}
            value={kategoria}
            onChange={(e) => ustawKategoria(e.target.value as KategoriaGalerii | 'wszystkie')}
          >
            <option value="wszystkie">{t('galeria.kategoria.wszystkie')}</option>
            {KATEGORIE_GALERII.map((k) => (
              <option key={k} value={k}>
                {t(`galeria.kategoria.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <label className="pole-checkbox galeria-online-rewers-filtr">
          <input
            type="checkbox"
            checked={tylkoZRewersem}
            onChange={(e) => ustawTylkoZRewersem(e.target.checked)}
          />
          <span>{t('galeria.tylkoZRewersem')}</span>
        </label>
      </div>

      {ladowanieManifestu && (
        <p className="podpis" role="status">
          {t('galeria.ladowanie')}
        </p>
      )}

      {bladManifestu && (
        <p role="alert" className="uwaga">
          {bladManifestu}{' '}
          <button type="button" onClick={() => wczytajManifest()}>
            {t('start.sprobujPonownie')}
          </button>
        </p>
      )}

      {widoczne && widoczne.length === 0 && <p className="podpis">{t('galeria.brakWynikow')}</p>}

      {widoczne && widoczne.length > 0 && (
        <div className="galeria-online-siatka">
          {widoczne.map((wpis) => {
            const podglad = podglady[wpis.id];
            const otwarty = otwartyPodglad === wpis.id;
            return (
              <article key={wpis.id} className="galeria-karta" data-galeria-szablon={wpis.id}>
                <div className="galeria-karta-gora">
                  <h3>{wpis.nazwa[jezyk]}</h3>
                  <div className="galeria-karta-etykiety">
                    <span className="galeria-etykieta">
                      {t('rozmiar.mm', {
                        szer: formatujLiczbe(wpis.format.szerokosc, 0),
                        wys: formatujLiczbe(wpis.format.wysokosc, 0),
                      })}
                    </span>
                    <span className="galeria-etykieta">
                      {t(`galeria.kategoria.${wpis.kategoria}`)}
                    </span>
                    {wpis.maRewers && (
                      <span className="galeria-etykieta galeria-etykieta-akcent">
                        {t('galeria.maRewers')}
                      </span>
                    )}
                  </div>
                </div>
                <p className="galeria-karta-opis">{wpis.opis[jezyk]}</p>
                <p className="galeria-karta-licencja">
                  {t('galeria.licencja', { autor: wpis.autor, licencja: wpis.licencja })}
                </p>

                {otwarty && (
                  <div className="galeria-karta-podglad">
                    {ladujePodglad === wpis.id || !podglad ? (
                      <p className="podpis">{t('galeria.pobieram')}</p>
                    ) : (
                      <div className="galeria-podglad-strony">
                        <figure className="galeria-podglad-figura">
                          <div
                            className="galeria-podglad-svg"
                            dangerouslySetInnerHTML={{ __html: podglad.awers }}
                          />
                          <figcaption>{t('galeria.podgladAwers')}</figcaption>
                        </figure>
                        {podglad.rewers && (
                          <figure className="galeria-podglad-figura">
                            <div
                              className="galeria-podglad-svg"
                              dangerouslySetInnerHTML={{ __html: podglad.rewers }}
                            />
                            <figcaption>{t('galeria.podgladRewers')}</figcaption>
                          </figure>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="galeria-karta-akcje">
                  <button
                    type="button"
                    className="glowny"
                    disabled={zajete}
                    onClick={(e) => uzyjWpisu(wpis, e.currentTarget)}
                  >
                    {pobieranieId === `uzyj:${wpis.id}` ? t('galeria.pobieram') : t('galeria.uzyj')}
                  </button>
                  <button
                    type="button"
                    aria-expanded={otwarty}
                    onClick={() => void przelaczPodglad(wpis)}
                  >
                    {otwarty ? t('galeria.ukryjPodglad') : t('galeria.podglad')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <form className="galeria-url-formularz" onSubmit={importujZLinku} noValidate>
        <h3>{t('galeria.urlTytul')}</h3>
        <div className="galeria-url-wiersz">
          <div className="pole galeria-url-pole">
            <label htmlFor={idUrl}>{t('galeria.urlEtykieta')}</label>
            <input
              id={idUrl}
              type="url"
              value={urlWejscie}
              placeholder={t('galeria.urlPlaceholder')}
              onChange={(e) => ustawUrlWejscie(e.target.value)}
            />
          </div>
          <button type="submit" disabled={zajete}>
            {pobieranieId === 'url' ? t('galeria.pobieram') : t('galeria.urlPobierz')}
          </button>
        </div>
      </form>

      {bladAkcji && (
        <p role="alert" className="uwaga">
          {bladAkcji}
        </p>
      )}
    </section>
  );
}
