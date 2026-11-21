import { useEffect, useId, useRef, useState } from 'react';
import {
  MAKS_BAJTOW_OBRAZU_AI,
  rozpoznajUkladZeZdjecia,
  usunKluczAi,
  wczytajKluczAi,
  zapiszKluczAi,
  type TypMimeObrazuAi,
} from '../../dane/aiUklad';
import { BladDanych } from '../../dane/schemat';
import { FORMATY_KART } from '../../dane/szablon';
import { formatujLiczbe, t, tn } from '../../i18n';
import type { OpisObrazu } from '../../model/projekt';
import type { Szablon } from '../../model/szablon';
import { RejestrCzcionek, wczytajCzcionke } from '../../silnik/czcionki';
import { renderujKarte } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import { nowyProjektZSzablonuKreatora } from '../baza';

const MAKS_BOK_AI_PX = 1568;
const zaokr = (x: number) => formatujLiczbe(x, 1);

interface WgraneZdjecie {
  nazwa: string;
  podgladUrl: string;
  base64: string;
  typMime: TypMimeObrazuAi;
  bajty: Uint8Array;
  szerokosc: number;
  wysokosc: number;
}

function bajtyNaBase64(bajty: Uint8Array): string {
  let binarny = '';
  const krok = 0x8000;
  for (let i = 0; i < bajty.length; i += krok) {
    binarny += String.fromCharCode(...bajty.subarray(i, i + krok));
  }
  return btoa(binarny);
}

/**
 * Zmniejsza zdjęcie do max 1568 px przez `<canvas>` (wypala orientację EXIF z telefonu
 * i gwarantuje spójny format PNG/JPEG ≤ 5 MB) oraz zwraca bajty + base64 dla Claude API i podkładu.
 */
async function przygotujZdjecieDlaAi(plik: File): Promise<WgraneZdjecie> {
  const zrodloUrl = URL.createObjectURL(plik);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new BladDanych(t('import.nieczytelny')));
      el.src = zrodloUrl;
    });
    const natSzer = img.naturalWidth;
    const natWys = img.naturalHeight;
    if (!natSzer || !natWys) throw new BladDanych(t('import.nieczytelny'));

    const skala = Math.min(1, MAKS_BOK_AI_PX / Math.max(natSzer, natWys));
    const szer = Math.max(1, Math.round(natSzer * skala));
    const wys = Math.max(1, Math.round(natWys * skala));

    const canvas = document.createElement('canvas');
    canvas.width = szer;
    canvas.height = wys;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new BladDanych(t('import.nieczytelny'));
    ctx.drawImage(img, 0, 0, szer, wys);

    let typMime: TypMimeObrazuAi = plik.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const koduj = (mime: TypMimeObrazuAi, jakosc?: number) =>
      new Promise<Blob | null>((res) => canvas.toBlob(res, mime, jakosc));

    let blob = await koduj(typMime, typMime === 'image/jpeg' ? 0.85 : undefined);
    if (blob && blob.size > MAKS_BAJTOW_OBRAZU_AI && typMime === 'image/png') {
      typMime = 'image/jpeg';
      blob = await koduj(typMime, 0.85);
    }
    if (!blob) throw new BladDanych(t('import.nieczytelny'));
    const bajty = new Uint8Array(await blob.arrayBuffer());
    if (bajty.byteLength > MAKS_BAJTOW_OBRAZU_AI) {
      throw new BladDanych(t('ai.zaDuzyObraz'));
    }

    const podgladUrl = URL.createObjectURL(blob);
    return {
      nazwa: plik.name,
      podgladUrl,
      base64: bajtyNaBase64(bajty),
      typMime,
      bajty,
      szerokosc: szer,
      wysokosc: wys,
    };
  } finally {
    URL.revokeObjectURL(zrodloUrl);
  }
}

let rejestrPodgladuObietnica: Promise<RejestrCzcionek> | undefined;

async function pobierzCzcionke(sciezka: string): Promise<Uint8Array> {
  const res = await fetch(sciezka);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function zaladujCzcionkiPodgladu(): Promise<RejestrCzcionek> {
  if (!rejestrPodgladuObietnica) {
    rejestrPodgladuObietnica = (async () => {
      const baza = import.meta.env.BASE_URL;
      const r = new RejestrCzcionek();
      const [reg, bold, italic, boldItalic] = await Promise.all([
        pobierzCzcionke(`${baza}czcionki/EBGaramond-Regular.ttf`),
        pobierzCzcionke(`${baza}czcionki/EBGaramond-Bold.ttf`),
        pobierzCzcionke(`${baza}czcionki/EBGaramond-Italic.ttf`),
        pobierzCzcionke(`${baza}czcionki/EBGaramond-BoldItalic.ttf`),
      ]);
      r.dodaj('EB Garamond', 'normalny', wczytajCzcionke('eb-r', reg));
      r.dodaj('EB Garamond', 'pogrubiony', wczytajCzcionke('eb-b', bold));
      r.dodaj('EB Garamond', 'kursywa', wczytajCzcionke('eb-i', italic));
      r.dodaj('EB Garamond', 'pogrubiona-kursywa', wczytajCzcionke('eb-bi', boldItalic));
      r.ustawRole({ tytul: 'EB Garamond', tresc: 'EB Garamond' });
      r.ustawZapasowa('EB Garamond');
      return r;
    })().catch((e) => {
      rejestrPodgladuObietnica = undefined;
      throw e;
    });
  }
  return rejestrPodgladuObietnica;
}

/**
 * Ekran rozpoznawania układu karty ze zdjęcia przez Claude API (M5-2).
 * Klucz API użytkownika żyje wyłącznie w `localStorage`; wynik to czysty `Szablon` gotowy do edycji.
 */
export function KreatorAiStrona() {
  const idFormularza = useId();
  const [klucz, ustawKlucz] = useState(() => wczytajKluczAi());
  const [zapamietaj, ustawZapamietaj] = useState(() => wczytajKluczAi() !== '');
  const [maZapisanyKlucz, ustawMaZapisanyKlucz] = useState(() => wczytajKluczAi() !== '');
  const [nazwa, ustawNazwe] = useState('');
  const [format, ustawFormat] = useState<string>('poker');
  const [wlasny, ustawWlasny] = useState({ szer: 63, wys: 88 });
  const [pozioma, ustawPozioma] = useState(false);
  const [dolaczPodklad, ustawDolaczPodklad] = useState(true);
  const [zdjecie, ustawZdjecie] = useState<WgraneZdjecie>();
  const [rozpoznany, ustawRozpoznany] = useState<Szablon>();
  const [podgladSvg, ustawPodgladSvg] = useState<{ id: string; svg: string }>();
  const [trwa, ustawTrwa] = useState(false);
  const [tworze, ustawTworze] = useState(false);
  const [blad, ustawBlad] = useState<string>();
  const [status, ustawStatus] = useState('');

  const plikRef = useRef<HTMLInputElement>(null);
  const kontrolerRef = useRef<AbortController | null>(null);
  const podgladUrlRef = useRef<string | undefined>(undefined);
  const zamontowanyRef = useRef(true);
  const numerWyboruRef = useRef(0);

  useEffect(() => {
    zamontowanyRef.current = true;
    return () => {
      zamontowanyRef.current = false;
      kontrolerRef.current?.abort();
      kontrolerRef.current = null;
      if (podgladUrlRef.current) {
        URL.revokeObjectURL(podgladUrlRef.current);
        podgladUrlRef.current = undefined;
      }
    };
  }, []);

  useEffect(() => {
    if (!rozpoznany) return;
    let aktualne = true;
    void zaladujCzcionkiPodgladu()
      .then((czcionki) => {
        if (!aktualne) return;
        const karta = {
          id: 'podglad-ai',
          szablonId: rozpoznany.id,
          ilosc: 1,
          dane: rozpoznany.przyklad ?? {},
        };
        const wynik = renderujKarte(rozpoznany, karta, { czcionki });
        ustawPodgladSvg({
          id: rozpoznany.id,
          svg: scenaDoSvg(wynik.scena, { przedrostekId: 'ai-' }),
        });
      })
      .catch(() => {
        if (aktualne) ustawPodgladSvg(undefined);
      });
    return () => {
      aktualne = false;
    };
  }, [rozpoznany]);

  const bazowy =
    format === 'wlasny' ? wlasny : (FORMATY_KART.find((f) => f.id === format) ?? FORMATY_KART[0]);
  const krotszy = Math.min(bazowy.szer, bazowy.wys);
  const dluzszy = Math.max(bazowy.szer, bazowy.wys);
  const wymiar =
    format === 'wlasny'
      ? { szer: wlasny.szer, wys: wlasny.wys }
      : pozioma
        ? { szer: dluzszy, wys: krotszy }
        : { szer: krotszy, wys: dluzszy };
  const wymiaryPoprawne =
    wymiar.szer >= 10 && wymiar.wys >= 10 && wymiar.szer <= 300 && wymiar.wys <= 300;

  const wybierzPlik = async (f: File) => {
    const nr = ++numerWyboruRef.current;
    ustawBlad(undefined);
    ustawStatus('');
    ustawRozpoznany(undefined);
    try {
      const nowe = await przygotujZdjecieDlaAi(f);
      if (!zamontowanyRef.current || numerWyboruRef.current !== nr) {
        URL.revokeObjectURL(nowe.podgladUrl);
        return;
      }
      if (podgladUrlRef.current) URL.revokeObjectURL(podgladUrlRef.current);
      podgladUrlRef.current = nowe.podgladUrl;
      ustawZdjecie(nowe);
    } catch (e) {
      if (!zamontowanyRef.current || numerWyboruRef.current !== nr) return;
      ustawBlad(e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e));
    }
  };

  const rozpoznaj = async () => {
    if (kontrolerRef.current || !wymiaryPoprawne) return;
    ustawBlad(undefined);
    ustawStatus('');
    if (!klucz.trim()) {
      ustawBlad(t('ai.brakKlucza'));
      return;
    }
    if (!zdjecie) {
      ustawBlad(t('ai.brakObrazu'));
      return;
    }
    if (zapamietaj) {
      zapiszKluczAi(klucz);
      ustawMaZapisanyKlucz(true);
    } else {
      usunKluczAi();
      ustawMaZapisanyKlucz(false);
    }

    const kontroler = new AbortController();
    kontrolerRef.current = kontroler;
    ustawTrwa(true);
    try {
      const szablon = await rozpoznajUkladZeZdjecia({
        obrazBase64: zdjecie.base64,
        typMime: zdjecie.typMime,
        kluczApi: klucz,
        szer: wymiar.szer,
        wys: wymiar.wys,
        nazwa: nazwa.trim() || undefined,
        podkladZasob: dolaczPodklad ? 'podklad-ai' : undefined,
        signal: kontroler.signal,
      });
      if (!kontroler.signal.aborted && zamontowanyRef.current) {
        ustawRozpoznany(szablon);
      }
    } catch (e) {
      if (!kontroler.signal.aborted && zamontowanyRef.current) {
        ustawBlad(e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e));
      }
    } finally {
      if (kontrolerRef.current === kontroler) {
        kontrolerRef.current = null;
        if (zamontowanyRef.current) ustawTrwa(false);
      }
    }
  };

  const otworzWEdytorze = async () => {
    if (!rozpoznany || tworze) return;
    ustawTworze(true);
    ustawBlad(undefined);
    try {
      const szablonDocelowy: Szablon =
        dolaczPodklad && zdjecie
          ? {
              ...rozpoznany,
              podklad: { zasob: 'podklad-ai', przezroczystosc: 55, widoczny: true },
            }
          : { ...rozpoznany, podklad: undefined };
      const dodatkowe =
        dolaczPodklad && zdjecie
          ? {
              zasoby: [
                {
                  id: 'podklad-ai',
                  rodzaj: 'obraz' as const,
                  nazwa: zdjecie.nazwa,
                  format: zdjecie.typMime === 'image/png' ? ('png' as const) : ('jpg' as const),
                  szerokosc: zdjecie.szerokosc,
                  wysokosc: zdjecie.wysokosc,
                } satisfies OpisObrazu,
              ],
              dane: new Map([['podklad-ai', zdjecie.bajty]]),
            }
          : undefined;

      const id = await nowyProjektZSzablonuKreatora(
        szablonDocelowy,
        import.meta.env.BASE_URL,
        dodatkowe,
      );
      if (!zamontowanyRef.current) return;
      window.location.hash = `#/projekt/${encodeURIComponent(id)}/szablon/${encodeURIComponent(szablonDocelowy.id)}`;
    } catch (e) {
      if (!zamontowanyRef.current) return;
      ustawTworze(false);
      ustawBlad(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <nav aria-label={t('projekt.nawigacja')} className="okruszki">
        <a href="#/">{t('nawigacja.start')}</a> › <a href="#/wlasne">{t('start.stworzWlasne')}</a> ›{' '}
        <span aria-current="page">{t('ai.tytul')}</span>
      </nav>
      <section className="kreator kreator-ai">
        <div className="kreator-formularz">
          <h1>{t('ai.tytul')}</h1>
          <p className="podpis">{t('ai.opis')}</p>
          <form
            id={idFormularza}
            onSubmit={(e) => {
              e.preventDefault();
              if (!trwa && wymiaryPoprawne) void rozpoznaj();
            }}
          >
            <div className="pole-panelu">
              <label htmlFor="ai-klucz">{t('ai.kluczEtykieta')}</label>
              <input
                id="ai-klucz"
                type="password"
                autoComplete="off"
                value={klucz}
                onChange={(e) => ustawKlucz(e.target.value)}
              />
              <p className="podpis">{t('ai.kluczPodpowiedz')}</p>
              <div className="wiersz-pol">
                <label className="pole-checkbox">
                  <input
                    type="checkbox"
                    checked={zapamietaj}
                    onChange={(e) => ustawZapamietaj(e.target.checked)}
                  />
                  <span>{t('ai.zapiszKlucz')}</span>
                </label>
                {maZapisanyKlucz && (
                  <button
                    type="button"
                    onClick={() => {
                      usunKluczAi();
                      ustawKlucz('');
                      ustawZapamietaj(false);
                      ustawMaZapisanyKlucz(false);
                      ustawStatus(t('ai.kluczUsuniety'));
                    }}
                  >
                    {t('ai.usunKlucz')}
                  </button>
                )}
              </div>
            </div>

            <div className="pole-panelu">
              <label htmlFor="ai-nazwa">{t('kreator.nazwa')}</label>
              <input
                id="ai-nazwa"
                placeholder={t('ai.nazwaDomyslna')}
                value={nazwa}
                onChange={(e) => ustawNazwe(e.target.value)}
              />
            </div>

            <fieldset className="formaty">
              <legend>{t('kreator.format')}</legend>
              {[...FORMATY_KART, { id: 'wlasny', szer: 0, wys: 0 }].map((f) => (
                <label key={f.id} className={`format${format === f.id ? ' wybrany' : ''}`}>
                  <input
                    type="radio"
                    name="ai-format"
                    value={f.id}
                    checked={format === f.id}
                    onChange={() => ustawFormat(f.id)}
                  />
                  <span>{t(`kreator.format.${f.id}` as 'kreator.format.poker')}</span>
                  {f.id !== 'wlasny' && (
                    <small className="podpis">
                      {t('rozmiar.mm', { szer: zaokr(f.szer), wys: zaokr(f.wys) })}
                    </small>
                  )}
                </label>
              ))}
            </fieldset>

            {format === 'wlasny' ? (
              <div className="pole-panelu dwa-pola">
                {(['szer', 'wys'] as const).map((os) => (
                  <label key={os}>
                    {t(os === 'szer' ? 'kreator.szerokosc' : 'kreator.wysokosc')}
                    <input
                      type="number"
                      min={10}
                      max={300}
                      step={0.5}
                      value={wlasny[os]}
                      onChange={(e) =>
                        ustawWlasny((w) => ({ ...w, [os]: e.target.valueAsNumber || 0 }))
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="pole-panelu">
                <span id="ai-orientacja">{t('kartka.orientacja')}</span>
                <div
                  className="przelacznik-segmentowy"
                  role="group"
                  aria-labelledby="ai-orientacja"
                >
                  <button type="button" aria-pressed={!pozioma} onClick={() => ustawPozioma(false)}>
                    {t('kartka.orientacja.pionowa')}
                  </button>
                  <button type="button" aria-pressed={pozioma} onClick={() => ustawPozioma(true)}>
                    {t('kartka.orientacja.pozioma')}
                  </button>
                </div>
              </div>
            )}

            <div className="pole-panelu">
              <span>{t('ai.zdjecieEtykieta')}</span>
              <div className="wiersz-pol">
                <button type="button" onClick={() => plikRef.current?.click()} disabled={trwa}>
                  {t('ai.wybierzZdjecie')}
                </button>
                {zdjecie && <span className="podpis">{zdjecie.nazwa}</span>}
              </div>
              <input
                ref={plikRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                data-testid="plik-zdjecia-ai"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void wybierzPlik(f);
                }}
              />
              <label className="pole-checkbox">
                <input
                  type="checkbox"
                  checked={dolaczPodklad}
                  onChange={(e) => ustawDolaczPodklad(e.target.checked)}
                />
                <span>{t('ai.dolaczPodklad')}</span>
              </label>
            </div>

            {status && (
              <p role="status" aria-live="polite" className="podpis">
                {status}
              </p>
            )}
            {blad && (
              <p role="alert" className="uwaga">
                {blad}
              </p>
            )}
          </form>
        </div>

        <div className="start-menu" role="group" aria-labelledby={`${idFormularza}-akcje`}>
          <p id={`${idFormularza}-akcje`} className="etykieta-sekcji">
            {t('kreator.akcje')}
          </p>
          <button
            type="submit"
            form={idFormularza}
            className="pasek-menu pasek-wlasne-4"
            disabled={trwa || !wymiaryPoprawne}
          >
            <b>{trwa ? t('ai.analizuje') : t('ai.rozpoznaj')}</b>
          </button>
          {trwa && (
            <button
              type="button"
              className="pasek-menu pasek-neutralny"
              onClick={() => {
                kontrolerRef.current?.abort();
                kontrolerRef.current = null;
                ustawTrwa(false);
              }}
            >
              <b>{t('ai.anulujAnalize')}</b>
            </button>
          )}
          <a href="#/wlasne" className="pasek-menu pasek-neutralny">
            <b>{t('kreator.anuluj')}</b>
          </a>
        </div>

        <aside className="kreator-podglad kreator-ai-podglad">
          {zdjecie && (
            <figure className="ai-miniatura-zdjecia">
              <img src={zdjecie.podgladUrl} alt={zdjecie.nazwa} />
            </figure>
          )}
          {rozpoznany && (
            <div className="ai-wynik">
              <h2>{tn('ai.podgladTytul', rozpoznany.korzen.dzieci.length)}</h2>
              <p className="podpis">{t('ai.podgladOpis')}</p>
              {podgladSvg && podgladSvg.id === rozpoznany.id && (
                <div
                  className="ai-podglad-svg"
                  data-testid="podglad-szablonu-ai"
                  dangerouslySetInnerHTML={{ __html: podgladSvg.svg }}
                />
              )}
              <button
                type="button"
                className="glowny"
                disabled={tworze}
                onClick={() => void otworzWEdytorze()}
              >
                {t('ai.otworzEdytor')}
              </button>
            </div>
          )}
        </aside>
      </section>
    </>
  );
}
