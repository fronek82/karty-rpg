import { useEffect, useId, useRef, useState } from 'react';
import { unikalneId } from '../../dane/czcionki';
import { dodajZasoby } from '../../dane/edycja';
import {
  KATALOG_GOOGLE_FONTS,
  adresyPodgladuGoogleFonts,
  czyRodzinaDodana,
  pobierzRodzineGoogle,
  zapasowaRodzinaKategorii,
  type KategoriaGoogleFonts,
  type PozycjaKataloguGoogle,
} from '../../dane/googleFonts';
import { BladDanych, MAKS_DLUGOSC_ID_ZASOBU } from '../../dane/schemat';
import { t, tn } from '../../i18n';
import type { ProjektWEdycji } from '../useProjekt';

type FiltrKategorii = 'wszystkie' | KategoriaGoogleFonts;

const KATEGORIE: readonly FiltrKategorii[] = [
  'wszystkie',
  'ozdobna',
  'szeryfowa',
  'bezszeryfowa',
  'pisana',
  'maszynowa',
];

const komunikat = (e: unknown) =>
  e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e);

/**
 * Kuratorowany katalog Google Fonts w panelu ustawień projektu.
 * Po rozwinięciu ładuje lekkie podzbiory CSS2 (`&text=...`) wyłącznie do podglądu próbki,
 * a pełne statyczne warianty TTF pobiera dopiero po kliknięciu użytkownika i zapisuje lokalnie
 * w zasobach projektu (`zrodlo: 'google'`), dzięki czemu po zapisie projekt działa bez sieci.
 */
export function KatalogGoogleFonts({
  edycja,
  onStatus,
  onBlad,
}: {
  edycja: ProjektWEdycji;
  onStatus: (tekst: string) => void;
  onBlad: (tekst: string | undefined) => void;
}) {
  const [otwarty, ustawOtwarty] = useState(false);
  const [filtr, ustawFiltr] = useState<FiltrKategorii>('wszystkie');
  const [szukaj, ustawSzukaj] = useState('');
  const [pobieranaId, ustawPobieranaId] = useState<string>();
  const kontrolerRef = useRef<AbortController | null>(null);
  const idKategorii = useId();

  useEffect(
    () => () => {
      kontrolerRef.current?.abort();
      kontrolerRef.current = null;
    },
    [],
  );

  const probka = t('googleFonts.probka');

  // Leniwie dołącza arkusze CSS2 z parametrem `text=` dopiero po rozwinięciu katalogu (bez duplikatów).
  useEffect(() => {
    if (!otwarty || typeof document === 'undefined') return;
    const adresy = adresyPodgladuGoogleFonts(
      KATALOG_GOOGLE_FONTS.map((p) => p.rodzina),
      probka,
    );
    const oczekiwane = new Set(adresy);
    const istniejace = new Set<string>();
    for (const el of document.head.querySelectorAll('link[data-google-fonts-podglad]')) {
      const klucz = el.getAttribute('data-google-fonts-podglad');
      if (!klucz || !oczekiwane.has(klucz)) {
        el.remove();
      } else {
        istniejace.add(klucz);
      }
    }
    for (const href of adresy) {
      if (istniejace.has(href)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-google-fonts-podglad', href);
      document.head.appendChild(link);
    }
  }, [otwarty, probka]);

  const fraza = szukaj.trim().toLowerCase();
  const widoczne = KATALOG_GOOGLE_FONTS.filter((p) => {
    if (filtr !== 'wszystkie' && p.kategoria !== filtr) return false;
    if (!fraza) return true;
    return p.rodzina.toLowerCase().includes(fraza) || p.autor.toLowerCase().includes(fraza);
  });

  const pobierz = async (pozycja: PozycjaKataloguGoogle) => {
    if (kontrolerRef.current) return;
    const kontroler = new AbortController();
    kontrolerRef.current = kontroler;
    ustawPobieranaId(pozycja.id);
    onStatus('');
    onBlad(undefined);
    try {
      const wgrane = await pobierzRodzineGoogle(pozycja, {
        zasoby: edycja.projekt.zasoby,
        signal: kontroler.signal,
      });
      if (kontroler.signal.aborted) return;
      if (wgrane.length > 0) {
        let dodanych = 0;
        await edycja.zmienZZasobami((p, d) => {
          const obecneWarianty = new Set(
            p.zasoby.flatMap((z) =>
              z.rodzaj === 'czcionka' && z.rodzina === pozycja.rodzina ? [z.wariant] : [],
            ),
          );
          const zajete = new Set([...p.zasoby.map((z) => z.id), ...d.keys()]);
          const nowe = wgrane
            .filter((w) => !obecneWarianty.has(w.opis.wariant))
            .map((w) => {
              const id = unikalneId(w.opis.id, zajete, MAKS_DLUGOSC_ID_ZASOBU);
              zajete.add(id);
              return { opis: { ...w.opis, id }, dane: w.dane };
            });
          dodanych = nowe.length;
          return dodanych > 0 ? dodajZasoby(p, d, nowe) : { projekt: p, dane: d };
        });
        if (!kontroler.signal.aborted && dodanych > 0) {
          onStatus(tn('googleFonts.pobrano', dodanych, { rodzina: pozycja.rodzina }));
        }
      }
    } catch (e) {
      if (!kontroler.signal.aborted) onBlad(komunikat(e));
    } finally {
      if (kontrolerRef.current === kontroler) {
        kontrolerRef.current = null;
        if (!kontroler.signal.aborted) ustawPobieranaId(undefined);
      }
    }
  };

  return (
    <details className="katalog-google-fonts" onToggle={(e) => ustawOtwarty(e.currentTarget.open)}>
      <summary>{t('googleFonts.otworz')}</summary>
      <p className="podpis">{t('googleFonts.opis')}</p>
      <div className="pole-panelu">
        <input
          type="search"
          aria-label={t('googleFonts.szukaj')}
          placeholder={t('googleFonts.szukaj')}
          value={szukaj}
          onChange={(e) => ustawSzukaj(e.target.value)}
        />
      </div>
      <div className="pole-panelu katalog-google-kategorie">
        <label htmlFor={idKategorii}>{t('googleFonts.kategorie')}</label>
        <select
          id={idKategorii}
          value={filtr}
          onChange={(e) => ustawFiltr(e.target.value as FiltrKategorii)}
        >
          {KATEGORIE.map((k) => (
            <option key={k} value={k}>
              {t(`googleFonts.kategoria.${k}`)}
            </option>
          ))}
        </select>
      </div>
      <p className="podpis katalog-google-liczba">
        {t('googleFonts.liczba', {
          widoczne: widoczne.length,
          wszystkie: KATALOG_GOOGLE_FONTS.length,
        })}
      </p>
      {widoczne.length === 0 ? (
        <p className="podpis">{t('googleFonts.brakWynikow')}</p>
      ) : (
        <ul className="lista-google-fonts">
          {widoczne.map((p) => {
            const dodana = czyRodzinaDodana(p, edycja.projekt.zasoby);
            const trwa = pobieranaId === p.id;
            const listaWariantow = p.warianty.map((w) => t(`wariant.${w.wariant}`)).join(', ');
            return (
              <li key={p.id} className="pozycja-google-font">
                <div className="pozycja-google-info">
                  <strong>{p.rodzina}</strong>
                  <span
                    className="podglad-google-font"
                    style={{
                      fontFamily: `"${p.rodzina}", ${zapasowaRodzinaKategorii(p.kategoria)}`,
                    }}
                  >
                    {probka}
                  </span>
                  <span className="podpis">
                    {t('googleFonts.meta', {
                      kategoria: t(`googleFonts.kategoria.${p.kategoria}`),
                      warianty: listaWariantow,
                      licencja: p.licencja,
                      autor: p.autor,
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={dodana || pobieranaId !== undefined}
                  aria-label={
                    dodana
                      ? t('googleFonts.dodanoEtykieta', { rodzina: p.rodzina })
                      : t('googleFonts.pobierzEtykieta', { rodzina: p.rodzina })
                  }
                  onClick={() => void pobierz(p)}
                >
                  {dodana
                    ? t('googleFonts.dodano')
                    : trwa
                      ? t('googleFonts.pobieram')
                      : t('googleFonts.pobierz')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
