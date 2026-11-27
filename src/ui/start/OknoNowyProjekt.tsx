import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { importujProjekt, jakoKopia, ROZSZERZENIE_PROJEKTU } from '../../dane/archiwum';
import type { WpisSzablonu } from '../../dane/bibliotekaSzablonow';
import { t } from '../../i18n';
import { baza, nowyProjektZSzablonowBiblioteki } from '../bazaUI';
import { kluczMiniaturyBiblioteki } from '../miniaturaRewersu';
import { adresMiniatury } from './mojeSzablony';
import './oknoNowyProjekt.css';

interface WczytanyPlikProjektu {
  nazwaPliku: string;
  bajty: Uint8Array;
  tytul: string;
  opis: string;
}

function wymiaryWpisu(w: WpisSzablonu): string {
  const r = w.szablon?.rozmiar ?? w.rewers?.rozmiar;
  if (!r) return '';
  if (r.tryb === 'sloty') {
    return `${Math.round(r.slot.szerokosc * r.kolumny)}×${Math.round(r.slot.wysokosc * r.rzedy)} mm`;
  }
  return `${Math.round(r.szerokosc)}×${Math.round(r.wysokosc)} mm`;
}

export interface OknoNowyProjektProps {
  zamknij: () => void;
  /** Przełączenie do okna „Nowy szablon”, gdy „Moje szablony” są puste. */
  onOtworzNowySzablon?: () => void;
}

/**
 * Okno modalne „Nowy projekt” (Plan S, S3, sekcja 5.3):
 * nazwa projektu, wielokrotny wybór szablonów z „Moich szablonów” (z wyszukiwarką, opcjonalny)
 * albo import pliku projektu `.kartyrpg`. Przycisk „Utwórz projekt” otwiera krok Karty.
 */
export function OknoNowyProjekt({ zamknij, onOtworzNowySzablon }: OknoNowyProjektProps) {
  const [nazwa, ustawNazwe] = useState('');
  const [tryb, ustawTryb] = useState<'szablony' | 'import'>('szablony');
  const [szablony, ustawSzablony] = useState<WpisSzablonu[]>([]);
  const [miniatury, ustawMiniatury] = useState<Map<string, string>>(new Map());
  const [szukaj, ustawSzukaj] = useState('');
  const [wybrane, ustawWybrane] = useState<ReadonlySet<string>>(new Set());

  const [plik, ustawPlik] = useState<WczytanyPlikProjektu>();
  const [blad, ustawBlad] = useState<string>();
  const [trwa, ustawTrwa] = useState(false);

  const poleNazwyRef = useRef<HTMLInputElement>(null);
  const plikInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    poleNazwyRef.current?.focus();
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        zamknij();
      }
    };
    window.addEventListener('keydown', klawisz);
    return () => window.removeEventListener('keydown', klawisz);
  }, [zamknij]);

  useEffect(() => {
    let aktywny = true;
    Promise.all([baza().szablonyBiblioteki('awers'), baza().miniatury()])
      .then(([lista, m]) => {
        if (!aktywny) return;
        ustawSzablony(lista);
        const mapa = new Map<string, string>();
        for (const [k, svg] of m) mapa.set(k, adresMiniatury(svg));
        ustawMiniatury(mapa);
      })
      .catch(() => undefined);
    return () => {
      aktywny = false;
    };
  }, []);

  const widoczne = useMemo(() => {
    const f = szukaj.trim().toLocaleLowerCase('pl');
    if (!f) return szablony;
    return szablony.filter((s) => s.nazwa.toLocaleLowerCase('pl').includes(f));
  }, [szablony, szukaj]);

  const przelaczWybor = (id: string) => {
    ustawWybrane((pop) => {
      const nowe = new Set(pop);
      if (nowe.has(id)) nowe.delete(id);
      else nowe.add(id);
      return nowe;
    });
  };

  const wczytajPlik = async (f: File) => {
    ustawBlad(undefined);
    try {
      const bajty = new Uint8Array(await f.arrayBuffer());
      const { projekt } = importujProjekt(bajty);
      const liczbaKart = projekt.talie.reduce((s, tl) => s + tl.karty.length, 0);
      ustawPlik({
        nazwaPliku: f.name,
        bajty,
        tytul: projekt.nazwa,
        opis: t('nowyProjekt.opisPlikuProjektu', {
          plik: f.name,
          szablony: projekt.szablony.length,
          karty: liczbaKart,
        }),
      });
    } catch (e) {
      ustawPlik(undefined);
      ustawBlad(
        t('nowyProjekt.bladPlikuProjektu', {
          szczegoly: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  };

  const onDropPliku = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pierwszy = e.dataTransfer.files[0];
    if (pierwszy) void wczytajPlik(pierwszy);
  };

  const moznaUtworzyc = !trwa && (tryb === 'szablony' || Boolean(plik));

  const utworz = async () => {
    if (!moznaUtworzyc) return;
    ustawTrwa(true);
    ustawBlad(undefined);
    try {
      if (tryb === 'szablony') {
        const id = await nowyProjektZSzablonowBiblioteki({
          nazwa,
          szablonIds: [...wybrane],
        });
        zamknij();
        window.location.hash = `#/projekt/${encodeURIComponent(id)}/karty`;
        return;
      }
      if (plik) {
        const { projekt: wczytany, zasoby } = importujProjekt(plik.bajty);
        let projekt = wczytany;
        if (await baza().istnieje(projekt.id)) {
          projekt = jakoKopia(projekt, nazwa.trim() || projekt.nazwa);
        } else if (nazwa.trim()) {
          projekt = { ...projekt, nazwa: nazwa.trim() };
        }
        await baza().zapisz(projekt, zasoby, { rejestrujSzablony: true });
        await baza().usunMiniature(projekt.id);
        zamknij();
        window.location.hash = `#/projekt/${encodeURIComponent(projekt.id)}/karty`;
      }
    } catch (e) {
      ustawBlad(e instanceof Error ? e.message : String(e));
      ustawTrwa(false);
    }
  };

  const podpowiedzDolna =
    tryb === 'import'
      ? t('nowyProjekt.importProjektuOpis')
      : wybrane.size > 0
        ? t('nowyProjekt.wybranoSzablonow', { n: wybrane.size })
        : t('nowyProjekt.bezSzablonowInfo');

  return (
    <div
      className="np-zaslona"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) zamknij();
      }}
    >
      <div
        className="np-okno"
        role="dialog"
        aria-modal="true"
        aria-label={t('nowyProjekt.tytul')}
        data-testid="okno-nowy-projekt"
      >
        <div className="np-naglowek">
          <div className="np-naglowek-lewa">
            <div className="np-logo" aria-hidden="true">
              <span className="np-logo-a" />
              <span className="np-logo-b" />
            </div>
            <div>
              <h2 className="np-tytul">{t('nowyProjekt.tytul')}</h2>
            </div>
          </div>
          <button
            type="button"
            className="np-zamknij"
            aria-label={t('pasek.zamknij')}
            onClick={zamknij}
          >
            ×
          </button>
        </div>

        <div className="np-cialo">
          <div className="np-sekcja">
            <label htmlFor="np-nazwa" className="np-etykieta">
              {t('nowyProjekt.krok1')}
            </label>
            <input
              ref={poleNazwyRef}
              id="np-nazwa"
              type="text"
              className="np-pole-tekstu"
              value={nazwa}
              onChange={(e) => ustawNazwe(e.target.value)}
              placeholder={t('nowyProjekt.nazwaPlaceholder')}
            />
          </div>

          <div className="np-siatka-2">
            <button
              type="button"
              className="np-karta-wyboru"
              aria-pressed={tryb === 'szablony'}
              onClick={() => ustawTryb('szablony')}
            >
              <span className="np-karta-wyboru-tytul">{t('nowyProjekt.sciezka.mojeSzablony')}</span>
            </button>
            <button
              type="button"
              className="np-karta-wyboru"
              aria-pressed={tryb === 'import'}
              onClick={() => ustawTryb('import')}
            >
              <span className="np-karta-wyboru-tytul">
                {t('nowyProjekt.sciezka.importProjektu')}
              </span>
            </button>
          </div>

          {tryb === 'szablony' && (
            <div className="np-sekcja">
              <div className="np-wiersz-etykiety">
                <span className="np-etykieta">{t('nowyProjekt.wybierzSzablony')}</span>
                {szablony.length > 0 && (
                  <input
                    type="search"
                    className="np-pole-tekstu"
                    style={{
                      maxWidth: '220px',
                      height: '34px',
                      padding: '0 8px',
                      fontSize: '12px',
                    }}
                    aria-label={t('nowyProjekt.szukajSzablonow')}
                    placeholder={t('nowyProjekt.szukajSzablonow')}
                    value={szukaj}
                    onChange={(e) => ustawSzukaj(e.target.value)}
                  />
                )}
              </div>

              {szablony.length === 0 ? (
                <div className="np-pusty-stan">
                  <p>{t('nowyProjekt.brakSzablonowPodpowiedz')}</p>
                  {onOtworzNowySzablon && (
                    <button
                      type="button"
                      className="np-btn"
                      onClick={() => {
                        zamknij();
                        onOtworzNowySzablon();
                      }}
                    >
                      {t('nowyProjekt.utworzPierwszySzablon')}
                    </button>
                  )}
                </div>
              ) : widoczne.length === 0 ? (
                <p className="podpis">{t('lista.brakWynikow', { fraza: szukaj.trim() })}</p>
              ) : (
                <div className="np-lista-szablonow" data-testid="np-lista-szablonow">
                  {widoczne.map((w) => {
                    const zaznaczony = wybrane.has(w.id);
                    const url = miniatury.get(kluczMiniaturyBiblioteki(w.id));
                    return (
                      <button
                        key={w.id}
                        type="button"
                        className={`np-kafelek-szablonu${zaznaczony ? ' aktywny' : ''}`}
                        aria-pressed={zaznaczony}
                        data-testid={`wybor-szablonu-${w.id}`}
                        onClick={() => przelaczWybor(w.id)}
                      >
                        <div className="np-kafelek-podglad">
                          {url ? <img src={url} alt="" /> : <span>{wymiaryWpisu(w)}</span>}
                        </div>
                        <span className="np-kafelek-nazwa">{w.nazwa}</span>
                        <span className="np-format-mm">{wymiaryWpisu(w)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tryb === 'import' && (
            <div className="np-sekcja">
              <div
                className="np-strefa-pliku strefa-upuszczania"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropPliku}
                onClick={() => plikInputRef.current?.click()}
              >
                <input
                  ref={plikInputRef}
                  type="file"
                  accept={`${ROZSZERZENIE_PROJEKTU},.zip`}
                  hidden
                  data-testid="np-plik-projektu"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void wczytajPlik(f);
                  }}
                />
                {plik ? (
                  <div>
                    <strong>{plik.tytul}</strong>
                    <div className="np-karta-wyboru-opis">{plik.opis}</div>
                  </div>
                ) : (
                  <span>{t('nowyProjekt.importProjektuOpis')}</span>
                )}
              </div>
            </div>
          )}

          {blad && (
            <div className="np-blad" role="alert">
              {blad}
            </div>
          )}
        </div>

        <div className="np-stopka">
          <span className="np-podpowiedz">{podpowiedzDolna}</span>
          <div className="np-akcje">
            <button type="button" className="np-btn" onClick={zamknij}>
              {t('nowyProjekt.anuluj')}
            </button>
            <button
              type="button"
              className="np-btn glowny"
              disabled={!moznaUtworzyc}
              onClick={() => void utworz()}
            >
              {t('nowyProjekt.utworz')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
