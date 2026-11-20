import { useEffect, useRef, useState } from 'react';
import { unikalneId } from '../../dane/czcionki';
import { dodajZasoby } from '../../dane/edycja';
import {
  KATALOG_GOOGLE_FONTS,
  czyRodzinaDodana,
  pobierzRodzineGoogle,
  type KategoriaGoogleFonts,
  type PozycjaKataloguGoogle,
} from '../../dane/googleFonts';
import { BladDanych, MAKS_DLUGOSC_ID_ZASOBU } from '../../dane/schemat';
import { t, tn } from '../../i18n';
import type { ProjektWEdycji } from '../useProjekt';

type FiltrKategorii = 'wszystkie' | KategoriaGoogleFonts;

const KATEGORIE: readonly FiltrKategorii[] = ['wszystkie', 'ozdobna', 'szeryfowa', 'bezszeryfowa'];

const komunikat = (e: unknown) =>
  e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e);

/**
 * Kuratorowany katalog Google Fonts w panelu ustawień projektu (M4-6).
 * Pobiera statyczne warianty TTF dopiero po kliknięciu użytkownika i zapisuje je lokalnie
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
  const [filtr, ustawFiltr] = useState<FiltrKategorii>('wszystkie');
  const [szukaj, ustawSzukaj] = useState('');
  const [pobieranaId, ustawPobieranaId] = useState<string>();
  const kontrolerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      kontrolerRef.current?.abort();
      kontrolerRef.current = null;
    },
    [],
  );

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
    <details className="katalog-google-fonts">
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
      <div
        className="przelacznik-segmentowy katalog-google-kategorie"
        role="group"
        aria-label={t('googleFonts.kategorie')}
      >
        {KATEGORIE.map((k) => (
          <button key={k} type="button" aria-pressed={filtr === k} onClick={() => ustawFiltr(k)}>
            {t(`googleFonts.kategoria.${k}`)}
          </button>
        ))}
      </div>
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
