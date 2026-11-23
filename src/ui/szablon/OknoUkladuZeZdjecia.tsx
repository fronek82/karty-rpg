import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  rozpoznajUkladZeZdjecia,
  usunKluczAi,
  wczytajKluczAi,
  wstawUkladAi,
  zapiszKluczAi,
  type TrybWstawieniaAi,
} from '../../dane/aiUklad';
import { BladDanych } from '../../dane/schemat';
import { t, tn } from '../../i18n';
import { wymiaryKarty, type Szablon } from '../../model/szablon';
import { OknoModalne } from '../OknoModalne';
import { przygotujZdjecieDlaAi, type WgraneZdjecie } from './zdjecieAi';

const komunikat = (e: unknown) =>
  e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e);

/**
 * Okno „Układ ze zdjęcia (AI)” w Edytorze szablonu i rewersu (N7): rozpoznaje elementy karty
 * ze zdjęcia przez Claude API (klucz użytkownika tylko w `localStorage`) i wstawia je na
 * edytowaną stronę. Gdy strona ma już elementy – wybór „Zastąp elementy” / „Dodaj obok”.
 * Rozmiar, tło i ramka strony zostają.
 */
export function OknoUkladuZeZdjecia({
  szablon,
  bezDanych,
  zajeteKlucze,
  podglad,
  wstaw,
  dolaczPodklad,
  zamknij,
}: {
  /** Edytowana strona (rewers – w postaci szablonu). */
  szablon: Szablon;
  /** Rewers: pola stałe, bez kluczy danych. */
  bezDanych: boolean;
  zajeteKlucze: () => Iterable<string>;
  /** SVG podglądu strony (tym samym silnikiem co edytor). */
  podglad: (s: Szablon) => string | undefined;
  wstaw: (f: (s: Szablon) => Szablon) => void;
  /** Tylko awers: zdjęcie jako podkład pod podglądem. */
  dolaczPodklad?: (plik: File) => void;
  zamknij: () => void;
}) {
  const id = useId();
  const [klucz, ustawKlucz] = useState(() => wczytajKluczAi());
  const [zapamietaj, ustawZapamietaj] = useState(() => wczytajKluczAi() !== '');
  const [maZapisanyKlucz, ustawMaZapisanyKlucz] = useState(() => wczytajKluczAi() !== '');
  const [zPodkladem, ustawZPodkladem] = useState(true);
  const [zdjecie, ustawZdjecie] = useState<WgraneZdjecie>();
  const [rozpoznany, ustawRozpoznany] = useState<Szablon>();
  const [trwa, ustawTrwa] = useState(false);
  const [blad, ustawBlad] = useState<string>();
  const [status, ustawStatus] = useState('');
  const plik = useRef<HTMLInputElement>(null);
  const kontroler = useRef<AbortController | null>(null);
  const adresZdjecia = useRef<string | undefined>(undefined);
  const zamontowany = useRef(true);
  const numerWyboru = useRef(0);
  const maElementy = szablon.korzen.dzieci.length > 0;
  const { szer, wys } = wymiaryKarty(szablon);

  useEffect(() => {
    zamontowany.current = true;
    return () => {
      zamontowany.current = false;
      kontroler.current?.abort();
      kontroler.current = null;
      if (adresZdjecia.current) URL.revokeObjectURL(adresZdjecia.current);
      adresZdjecia.current = undefined;
    };
  }, []);

  const opcjeWstawienia = { bezKlucza: bezDanych, zajete: zajeteKlucze() };
  // Podgląd: rozpoznane pola na tej stronie (jak po „Zastąp”).
  const svg = useMemo(
    () => (rozpoznany ? podglad(wstawUkladAi(szablon, rozpoznany, 'zastap', opcjeWstawienia)) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- podgląd tylko dla nowego wyniku
    [rozpoznany],
  );

  const wybierzPlik = async (f: File) => {
    const nr = ++numerWyboru.current;
    ustawBlad(undefined);
    ustawStatus('');
    ustawRozpoznany(undefined);
    try {
      const nowe = await przygotujZdjecieDlaAi(f);
      if (!zamontowany.current || numerWyboru.current !== nr) {
        URL.revokeObjectURL(nowe.podgladUrl);
        return;
      }
      if (adresZdjecia.current) URL.revokeObjectURL(adresZdjecia.current);
      adresZdjecia.current = nowe.podgladUrl;
      ustawZdjecie(nowe);
    } catch (e) {
      if (zamontowany.current && numerWyboru.current === nr) ustawBlad(komunikat(e));
    }
  };

  const rozpoznaj = async () => {
    if (kontroler.current) return;
    ustawBlad(undefined);
    ustawStatus('');
    if (!klucz.trim()) return ustawBlad(t('ai.brakKlucza'));
    if (!zdjecie) return ustawBlad(t('ai.brakObrazu'));
    if (zapamietaj) zapiszKluczAi(klucz);
    else usunKluczAi();
    ustawMaZapisanyKlucz(zapamietaj);
    const k = new AbortController();
    kontroler.current = k;
    ustawTrwa(true);
    try {
      const wynik = await rozpoznajUkladZeZdjecia({
        obrazBase64: zdjecie.base64,
        typMime: zdjecie.typMime,
        kluczApi: klucz,
        szer,
        wys,
        nazwa: szablon.nazwa,
        signal: k.signal,
      });
      if (!k.signal.aborted && zamontowany.current) ustawRozpoznany(wynik);
    } catch (e) {
      if (!k.signal.aborted && zamontowany.current) ustawBlad(komunikat(e));
    } finally {
      if (kontroler.current === k) {
        kontroler.current = null;
        if (zamontowany.current) ustawTrwa(false);
      }
    }
  };

  const wstawUklad = (tryb: TrybWstawieniaAi) => {
    if (!rozpoznany) return;
    // Klucze zajęte liczone w chwili wstawienia (stan mógł się zmienić).
    wstaw((s) =>
      wstawUkladAi(s, rozpoznany, tryb, { bezKlucza: bezDanych, zajete: zajeteKlucze() }),
    );
    if (dolaczPodklad && zdjecie && zPodkladem)
      dolaczPodklad(new File([zdjecie.bajty.slice()], zdjecie.nazwa, { type: zdjecie.typMime }));
    zamknij();
  };

  return (
    <OknoModalne tytul={t('ai.tytul')} zamknij={zamknij}>
      <div className="okno-ai">
        <p className="podpis">{t('ai.opis')}</p>
        <form
          id={`${id}-form`}
          onSubmit={(e) => {
            e.preventDefault();
            if (!trwa) void rozpoznaj();
          }}
        >
          <div className="pole-panelu">
            <label htmlFor={`${id}-klucz`}>{t('ai.kluczEtykieta')}</label>
            <input
              id={`${id}-klucz`}
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
            <span>{t('ai.zdjecieEtykieta')}</span>
            <div className="wiersz-pol">
              <button type="button" disabled={trwa} onClick={() => plik.current?.click()}>
                {t('ai.wybierzZdjecie')}
              </button>
              {zdjecie && <span className="podpis">{zdjecie.nazwa}</span>}
            </div>
            <input
              ref={plik}
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
            {dolaczPodklad && (
              <label className="pole-checkbox">
                <input
                  type="checkbox"
                  checked={zPodkladem}
                  onChange={(e) => ustawZPodkladem(e.target.checked)}
                />
                <span>{t('ai.dolaczPodklad')}</span>
              </label>
            )}
          </div>
          <div className="wiersz-pol">
            <button type="submit" className="glowny" disabled={trwa}>
              {trwa ? t('ai.analizuje') : t('ai.rozpoznaj')}
            </button>
            {trwa && (
              <button
                type="button"
                onClick={() => {
                  kontroler.current?.abort();
                  kontroler.current = null;
                  ustawTrwa(false);
                }}
              >
                {t('ai.anulujAnalize')}
              </button>
            )}
          </div>
        </form>
        {status && (
          <p role="status" className="podpis">
            {status}
          </p>
        )}
        {blad && (
          <p role="alert" className="uwaga">
            {blad}
          </p>
        )}
        {(zdjecie || rozpoznany) && (
          <div className="okno-ai-podglady">
            {zdjecie && (
              <figure className="ai-miniatura-zdjecia">
                <img src={zdjecie.podgladUrl} alt={zdjecie.nazwa} />
              </figure>
            )}
            {rozpoznany && svg && (
              <div
                className="ai-podglad-svg"
                data-testid="podglad-szablonu-ai"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </div>
        )}
        {rozpoznany && (
          <section className="ai-wynik" aria-labelledby={`${id}-wynik`}>
            <h3 id={`${id}-wynik`}>{tn('ai.podgladTytul', rozpoznany.korzen.dzieci.length)}</h3>
            <p className="podpis">{maElementy ? t('ai.maElementy') : t('ai.podgladOpis')}</p>
            <div className="wiersz-pol">
              {maElementy ? (
                <>
                  <button type="button" className="glowny" onClick={() => wstawUklad('zastap')}>
                    {t('ai.zastap')}
                  </button>
                  <button type="button" onClick={() => wstawUklad('dodaj')}>
                    {t('ai.dodajObok')}
                  </button>
                </>
              ) : (
                <button type="button" className="glowny" onClick={() => wstawUklad('zastap')}>
                  {t('ai.wstaw')}
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </OknoModalne>
  );
}
