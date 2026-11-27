import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ACCEPT_PLIKU_SZABLONU, odczytajPlikSzablonu } from '../../dane/archiwum';
import { t } from '../../i18n';
import { baza, utworzSzablonWBibliotece } from '../bazaUI';
import { zapiszMiniatureWpisuSzablonu } from '../miniaturaRewersu';
import {
  FORMATY_NOWEGO_PROJEKTU,
  ikonaDlaOrientacji,
  MAKS_WYMIAR_MM,
  MIN_WYMIAR_MM,
  przelaczStrone,
  wymiaryDlaOrientacji,
  type IdFormatuKarty,
  type OrientacjaKarty,
  type WyborStron,
} from './nowyProjektLogika';
import './oknoNowyProjekt.css';

interface WczytanyPlikSzablonu {
  nazwaPliku: string;
  bajty: Uint8Array;
  tytul: string;
  opis: string;
}

function etykietaFormatu(id: IdFormatuKarty): string {
  switch (id) {
    case 'poker':
      return t('kreator.format.poker');
    case 'mini-euro':
      return t('kreator.format.mini-euro');
    case 'mini-us':
      return t('kreator.format.mini-american');
    case 'tarot':
      return t('kreator.format.tarot');
    case 'kwadrat':
      return t('nowyProjekt.format.kwadrat');
    case 'wlasny':
      return t('nowyProjekt.format.wlasny');
  }
}

export interface OknoNowySzablonProps {
  zamknij: () => void;
  /** Wywoływane po utworzeniu szablonu w „Moich szablonach”. */
  onUtworzono?: (wynik: { id: string; rodzaj: 'awers' | 'rewers'; nazwa: string }) => void;
}

/**
 * Okno modalne „Nowy szablon” (Plan S, S3, sekcja 5.2):
 * dawna ścieżka „Pusta karta” z okna „Nowy projekt” + import pliku `.kartyrpg-szablon`.
 * Zapisuje szablon w tabeli `szablony` („Moje szablony”).
 */
export function OknoNowySzablon({ zamknij, onUtworzono }: OknoNowySzablonProps) {
  const [tryb, ustawTryb] = useState<'odZera' | 'import'>('odZera');
  const [nazwa, ustawNazwe] = useState('');
  const [format, ustawFormat] = useState<IdFormatuKarty>('poker');
  const [orientacja, ustawOrientacje] = useState<OrientacjaKarty>('pion');
  const [wlasnaSzer, ustawWlasnaSzer] = useState(63);
  const [wlasnaWys, ustawWlasnaWys] = useState(88);
  const [strony, ustawStrony] = useState<WyborStron>({ przod: true, tyl: false });
  const [plik, ustawPlik] = useState<WczytanyPlikSzablonu>();
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

  const biezacyFormat =
    FORMATY_NOWEGO_PROJEKTU.find((f) => f.id === format) ?? FORMATY_NOWEGO_PROJEKTU[0]!;
  const wymiary =
    format === 'wlasny'
      ? { szer: wlasnaSzer, wys: wlasnaWys }
      : wymiaryDlaOrientacji(biezacyFormat.szer, biezacyFormat.wys, orientacja);

  const zmienOrientacje = (nowa: OrientacjaKarty) => {
    ustawOrientacje(nowa);
    if (format === 'wlasny') {
      const po = wymiaryDlaOrientacji(wlasnaSzer, wlasnaWys, nowa);
      ustawWlasnaSzer(po.szer);
      ustawWlasnaWys(po.wys);
    }
  };

  const wczytajPlik = async (f: File) => {
    ustawBlad(undefined);
    try {
      const bajty = new Uint8Array(await f.arrayBuffer());
      const tresc = odczytajPlikSzablonu(bajty);
      if (tresc.szablon) {
        const r = tresc.szablon.rozmiar;
        const mm =
          r.tryb === 'sloty'
            ? `${Math.round(r.slot.szerokosc * r.kolumny)}×${Math.round(r.slot.wysokosc * r.rzedy)} mm`
            : `${Math.round(r.szerokosc)}×${Math.round(r.wysokosc)} mm`;
        ustawPlik({
          nazwaPliku: f.name,
          bajty,
          tytul: tresc.szablon.nazwa,
          opis: `${f.name} · ${mm}`,
        });
      } else if (tresc.rewers) {
        const mm = `${Math.round(tresc.rewers.rozmiar.szerokosc)}×${Math.round(tresc.rewers.rozmiar.wysokosc)} mm`;
        ustawPlik({
          nazwaPliku: f.name,
          bajty,
          tytul: tresc.rewers.nazwa,
          opis: `${f.name} · ${mm} · ${t('projekty.stronaRewers')}`,
        });
      }
    } catch (e) {
      ustawPlik(undefined);
      ustawBlad(
        t('nowyProjekt.bladPliku', { szczegoly: e instanceof Error ? e.message : String(e) }),
      );
    }
  };

  const onDropPliku = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pierwszy = e.dataTransfer.files[0];
    if (pierwszy) void wczytajPlik(pierwszy);
  };

  const wymiaryOk =
    Number.isFinite(wymiary.szer) &&
    Number.isFinite(wymiary.wys) &&
    wymiary.szer >= MIN_WYMIAR_MM &&
    wymiary.szer <= MAKS_WYMIAR_MM &&
    wymiary.wys >= MIN_WYMIAR_MM &&
    wymiary.wys <= MAKS_WYMIAR_MM;

  const moznaUtworzyc =
    !trwa && (tryb === 'odZera' ? (strony.przod || strony.tyl) && wymiaryOk : Boolean(plik));

  const podpowiedzDolna =
    tryb === 'import'
      ? t('nowySzablon.podpowiedzImport')
      : strony.przod && strony.tyl
        ? t('nowySzablon.podpowiedzOba')
        : strony.przod
          ? t('nowySzablon.podpowiedzPrzod')
          : t('nowySzablon.podpowiedzTyl');

  const utworz = async () => {
    if (!moznaUtworzyc) return;
    ustawTrwa(true);
    ustawBlad(undefined);
    try {
      if (tryb === 'odZera') {
        const wynik = await utworzSzablonWBibliotece({
          nazwa,
          szer: wymiary.szer,
          wys: wymiary.wys,
          przod: strony.przod,
          tyl: strony.tyl,
        });
        zamknij();
        onUtworzono?.(wynik);
        return;
      }
      if (plik) {
        const imp = await baza().importujSzablonDoBiblioteki(plik.bajty);
        const wpis = await baza().szablonBiblioteki(imp.id);
        let nazwaKoncowa = wpis?.nazwa ?? plik.tytul;
        if (imp.nowy && wpis && nazwa.trim() && nazwa.trim() !== wpis.nazwa) {
          const zmieniony = await baza().zapiszSzablonWBibliotece({ ...wpis, nazwa: nazwa.trim() });
          nazwaKoncowa = zmieniony.nazwa;
          await zapiszMiniatureWpisuSzablonu(zmieniony).catch(() => undefined);
        } else if (wpis) {
          await zapiszMiniatureWpisuSzablonu(wpis).catch(() => undefined);
        }
        if (imp.rewersId) {
          const wpisR = await baza().szablonBiblioteki(imp.rewersId);
          if (wpisR) await zapiszMiniatureWpisuSzablonu(wpisR).catch(() => undefined);
        }
        zamknij();
        onUtworzono?.({ id: imp.id, rodzaj: imp.rodzaj, nazwa: nazwaKoncowa });
      }
    } catch (e) {
      ustawBlad(e instanceof Error ? e.message : String(e));
      ustawTrwa(false);
    }
  };

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
        aria-label={t('nowySzablon.tytul')}
        data-testid="okno-nowy-szablon"
      >
        <div className="np-naglowek">
          <div className="np-naglowek-lewa">
            <div className="np-logo" aria-hidden="true">
              <span className="np-logo-a" />
              <span className="np-logo-b" />
            </div>
            <div>
              <h2 className="np-tytul">{t('nowySzablon.tytul')}</h2>
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
            <label htmlFor="ns-nazwa" className="np-etykieta">
              {t('nowySzablon.nazwaEtykieta')}
            </label>
            <input
              ref={poleNazwyRef}
              id="ns-nazwa"
              type="text"
              className="np-pole-tekstu"
              value={nazwa}
              onChange={(e) => ustawNazwe(e.target.value)}
              placeholder={t('nowySzablon.nazwaPlaceholder')}
            />
          </div>

          <div className="np-siatka-2">
            <button
              type="button"
              className="np-karta-wyboru"
              aria-pressed={tryb === 'odZera'}
              onClick={() => ustawTryb('odZera')}
            >
              <span className="np-karta-wyboru-tytul">{t('nowySzablon.sciezka.odZera')}</span>
            </button>
            <button
              type="button"
              className="np-karta-wyboru"
              aria-pressed={tryb === 'import'}
              onClick={() => ustawTryb('import')}
            >
              <span className="np-karta-wyboru-tytul">{t('nowySzablon.sciezka.import')}</span>
            </button>
          </div>

          {tryb === 'odZera' && (
            <>
              <div className="np-sekcja">
                <div className="np-wiersz-etykiety">
                  <span className="np-etykieta">{t('nowyProjekt.krok3Rozmiar')}</span>
                  <div
                    className="np-orientacja"
                    role="group"
                    aria-label={t('nowyProjekt.orientacja')}
                  >
                    <button
                      type="button"
                      className="np-orientacja-btn"
                      aria-pressed={orientacja === 'pion'}
                      onClick={() => zmienOrientacje('pion')}
                    >
                      {t('nowyProjekt.pionowo')}
                    </button>
                    <button
                      type="button"
                      className="np-orientacja-btn"
                      aria-pressed={orientacja === 'poziom'}
                      onClick={() => zmienOrientacje('poziom')}
                    >
                      {t('nowyProjekt.poziomo')}
                    </button>
                  </div>
                </div>

                <div className="np-siatka-6">
                  {FORMATY_NOWEGO_PROJEKTU.map((f) => {
                    const aktywny = format === f.id;
                    const wym =
                      f.id === 'wlasny'
                        ? { szer: wlasnaSzer, wys: wlasnaWys }
                        : wymiaryDlaOrientacji(f.szer, f.wys, orientacja);
                    const ikona = ikonaDlaOrientacji(f, orientacja);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className="np-format-btn"
                        aria-pressed={aktywny}
                        onClick={() => ustawFormat(f.id)}
                      >
                        <span
                          className={`np-format-zarys${f.id === 'wlasny' ? ' przerywany' : ''}`}
                          style={{ width: `${ikona.szer}px`, height: `${ikona.wys}px` }}
                          aria-hidden="true"
                        />
                        <span className="np-format-nazwa">{etykietaFormatu(f.id)}</span>
                        <span className="np-format-mm">{`${wym.szer}×${wym.wys} mm`}</span>
                      </button>
                    );
                  })}
                </div>

                {format === 'wlasny' && (
                  <div className="np-wlasny-wiersz">
                    <label className="np-wlasny-pole">
                      <span>{t('nowyProjekt.szerokoscMm')}</span>
                      <input
                        type="number"
                        min={MIN_WYMIAR_MM}
                        max={MAKS_WYMIAR_MM}
                        value={wlasnaSzer}
                        onChange={(e) => ustawWlasnaSzer(Number(e.target.value))}
                      />
                    </label>
                    <label className="np-wlasny-pole">
                      <span>{t('nowyProjekt.wysokoscMm')}</span>
                      <input
                        type="number"
                        min={MIN_WYMIAR_MM}
                        max={MAKS_WYMIAR_MM}
                        value={wlasnaWys}
                        onChange={(e) => ustawWlasnaWys(Number(e.target.value))}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="np-sekcja">
                <span className="np-etykieta">{t('nowyProjekt.krok4Strony')}</span>
                <div className="np-strony">
                  <button
                    type="button"
                    className={`np-strona${strony.przod ? ' aktywna' : ''}`}
                    aria-pressed={strony.przod}
                    onClick={() => ustawStrony((s) => przelaczStrone(s, 'przod'))}
                  >
                    <span className="np-strona-tytul">{t('nowyProjekt.przod')}</span>
                    <span className="np-strona-opis">{t('nowyProjekt.przodOpis')}</span>
                  </button>
                  <button
                    type="button"
                    className={`np-strona${strony.tyl ? ' aktywna' : ''}`}
                    aria-pressed={strony.tyl}
                    onClick={() => ustawStrony((s) => przelaczStrone(s, 'tyl'))}
                  >
                    <span className="np-strona-tytul">{t('nowyProjekt.tyl')}</span>
                    <span className="np-strona-opis">{t('nowyProjekt.tylOpis')}</span>
                  </button>
                </div>
              </div>
            </>
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
                  accept={ACCEPT_PLIKU_SZABLONU}
                  hidden
                  data-testid="ns-plik-szablonu"
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
                  <span>{t('nowyProjekt.strefaPliku')}</span>
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
              {t('nowySzablon.utworz')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
