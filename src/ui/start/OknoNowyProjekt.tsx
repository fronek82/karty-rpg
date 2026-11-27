import { useEffect, useRef, useState, type DragEvent } from 'react';
import { importujRewers, importujSzablon } from '../../dane/archiwum';
import { t } from '../../i18n';
import {
  baza,
  nowyProjektPustaKarta,
  nowyProjektZAwersuZProjektu,
  nowyProjektZRewersuZProjektu,
} from '../bazaUI';
import { adresProjektu, importujPlikSzablonu } from './importSzablonu';
import { adresMiniatury, pozycjeSzablonow, type PozycjaSzablonu } from './mojeSzablony';
import {
  czyMoznaUtworzyc,
  FORMATY_NOWEGO_PROJEKTU,
  ikonaDlaOrientacji,
  kluczPodpowiedziDolnej,
  MAKS_WYMIAR_MM,
  MIN_WYMIAR_MM,
  przelaczStrone,
  wymiaryDlaOrientacji,
  type IdFormatuKarty,
  type OrientacjaKarty,
  type TrybStartu,
  type WyborStron,
} from './nowyProjektLogika';
import './oknoNowyProjekt.css';

interface WczytanyPlik {
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

/**
 * Okno modalne „Nowy projekt” (UI2 R3, sekcja 5.2 planu, wzór: NowyProjekt.dc.html):
 * 3 ścieżki startu: Pusta karta (format, orientacja Pionowo/Poziomo, Przód/Tył),
 * Z szablonu (kopia szablonu z innego projektu) oraz Import pliku (.kartyrpg-szablon).
 */
export function OknoNowyProjekt({ zamknij }: { zamknij: () => void }) {
  const [nazwa, ustawNazwe] = useState('');
  const [tryb, ustawTryb] = useState<TrybStartu>('pusta');
  const [format, ustawFormat] = useState<IdFormatuKarty>('poker');
  const [orientacja, ustawOrientacje] = useState<OrientacjaKarty>('pion');
  const [wlasnaSzer, ustawWlasnaSzer] = useState(63);
  const [wlasnaWys, ustawWlasnaWys] = useState(88);
  const [strony, ustawStrony] = useState<WyborStron>({ przod: true, tyl: false });

  const [szablony, ustawSzablony] = useState<PozycjaSzablonu[]>([]);
  const [miniatury, ustawMiniatury] = useState<Map<string, string>>(new Map());
  const [wybranySzablon, ustawWybranySzablon] = useState<string>();

  const [plik, ustawPlik] = useState<WczytanyPlik>();
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
    Promise.all([
      baza().szablonyAwersowZProjektow(),
      baza().rewersyZProjektow(),
      baza().miniatury(),
    ])
      .then(([a, r, m]) => {
        if (!aktywny) return;
        const poz = pozycjeSzablonow(a, r);
        ustawSzablony(poz);
        if (poz[0]) ustawWybranySzablon(poz[0].klucz);
        const mapa = new Map<string, string>();
        for (const [k, svg] of m) mapa.set(k, adresMiniatury(svg));
        ustawMiniatury(mapa);
      })
      .catch(() => undefined);
    return () => {
      aktywny = false;
    };
  }, []);

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
      let tytul = f.name;
      let opis = f.name;
      try {
        const p = importujSzablon(bajty);
        const r = p.szablon.rozmiar;
        const mm =
          r.tryb === 'sloty'
            ? `${Math.round(r.slot.szerokosc * r.kolumny)}×${Math.round(r.slot.wysokosc * r.rzedy)} mm`
            : `${Math.round(r.szerokosc)}×${Math.round(r.wysokosc)} mm`;
        tytul = p.szablon.nazwa;
        opis = `${f.name} · ${mm}`;
      } catch {
        const p = importujRewers(bajty);
        const mm = `${Math.round(p.rewers.rozmiar.szerokosc)}×${Math.round(p.rewers.rozmiar.wysokosc)} mm`;
        tytul = p.rewers.nazwa;
        opis = `${f.name} · ${mm} · ${t('projekty.stronaRewers')}`;
      }
      ustawPlik({ nazwaPliku: f.name, bajty, tytul, opis });
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

  const moznaUtworzyc =
    !trwa &&
    czyMoznaUtworzyc({
      tryb,
      strony,
      szer: wymiary.szer,
      wys: wymiary.wys,
      wybranySzablon,
      maPlik: Boolean(plik),
    });

  const utworz = async () => {
    if (!moznaUtworzyc) return;
    ustawTrwa(true);
    ustawBlad(undefined);
    try {
      if (tryb === 'pusta') {
        const hash = await nowyProjektPustaKarta({
          nazwa,
          szer: wymiary.szer,
          wys: wymiary.wys,
          przod: strony.przod,
          tyl: strony.tyl,
        });
        zamknij();
        window.location.hash = hash;
        return;
      }
      if (tryb === 'szablon') {
        const poz = szablony.find((s) => s.klucz === wybranySzablon);
        if (!poz) return;
        const id =
          poz.rodzaj === 'rewers'
            ? await nowyProjektZRewersuZProjektu(poz.rewers.projektId, poz.rewers.rewersId)
            : await nowyProjektZAwersuZProjektu(poz.awers.projektId, poz.awers.szablonId);
        if (nazwa.trim()) {
          const { projekt, zasoby } = await baza().wczytaj(id);
          await baza().zapisz({ ...projekt, nazwa: nazwa.trim() }, zasoby);
        }
        zamknij();
        window.location.hash = adresProjektu(id);
        return;
      }
      if (plik) {
        const wynik = await importujPlikSzablonu(plik.bajty);
        if ('blad' in wynik) {
          ustawBlad(wynik.blad);
          ustawTrwa(false);
          return;
        }
        if (nazwa.trim()) {
          const { projekt, zasoby } = await baza().wczytaj(wynik.id);
          await baza().zapisz({ ...projekt, nazwa: nazwa.trim() }, zasoby);
        }
        zamknij();
        window.location.hash = adresProjektu(wynik.id);
      }
    } catch (e) {
      ustawBlad(e instanceof Error ? e.message : String(e));
      ustawTrwa(false);
    }
  };

  const brakSzablonow = szablony.length === 0;

  return (
    <div
      className="np-zaslona"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) zamknij();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={t('nowyProjekt.tytul')} className="np-okno">
        <div className="np-naglowek">
          <div className="np-naglowek-lewa">
            <div className="np-logo" aria-hidden="true">
              <div className="np-logo-a" />
              <div className="np-logo-b" />
            </div>
            <h1 className="np-tytul">{t('nowyProjekt.tytul')}</h1>
          </div>
          <button
            type="button"
            className="np-zamknij"
            aria-label={t('nowyProjekt.zamknij')}
            onClick={zamknij}
          >
            ✕
          </button>
        </div>

        <div className="np-cialo">
          <label className="np-sekcja">
            <span className="np-etykieta">{t('nowyProjekt.krok1')}</span>
            <input
              ref={poleNazwyRef}
              type="text"
              className="np-pole-tekstu"
              value={nazwa}
              onChange={(e) => ustawNazwe(e.target.value)}
              placeholder={t('nowyProjekt.nazwaPlaceholder')}
            />
          </label>

          <div className="np-sekcja">
            <span className="np-etykieta">{t('nowyProjekt.krok2')}</span>
            <div className="np-siatka-3">
              <button
                type="button"
                className="np-karta-wyboru"
                aria-pressed={tryb === 'pusta'}
                onClick={() => ustawTryb('pusta')}
              >
                <span className="np-karta-wyboru-tytul">{t('nowyProjekt.pusta')}</span>
                <span className="np-karta-wyboru-opis">{t('nowyProjekt.pustaOpis')}</span>
              </button>

              <button
                type="button"
                className="np-karta-wyboru"
                disabled={brakSzablonow}
                aria-pressed={tryb === 'szablon'}
                onClick={() => ustawTryb('szablon')}
              >
                <span className="np-karta-wyboru-tytul">{t('nowyProjekt.zSzablonu')}</span>
                <span className="np-karta-wyboru-opis">
                  {brakSzablonow ? t('nowyProjekt.brakSzablonow') : t('nowyProjekt.zSzablonuOpis')}
                </span>
              </button>

              <button
                type="button"
                className="np-karta-wyboru"
                aria-pressed={tryb === 'import'}
                onClick={() => ustawTryb('import')}
              >
                <span className="np-karta-wyboru-tytul">{t('nowyProjekt.importPliku')}</span>
                <span className="np-karta-wyboru-opis">{t('nowyProjekt.importPlikuOpis')}</span>
              </button>
            </div>
          </div>

          {tryb === 'pusta' && (
            <>
              <div className="np-sekcja">
                <div className="np-sekcja-naglowek">
                  <span className="np-etykieta">{t('nowyProjekt.krok3Rozmiar')}</span>
                  <div
                    role="group"
                    aria-label={t('nowyProjekt.orientacja')}
                    className="np-orientacja"
                  >
                    <button
                      type="button"
                      className="np-orientacja-btn"
                      aria-pressed={orientacja === 'pion'}
                      onClick={() => zmienOrientacje('pion')}
                    >
                      <span
                        className="np-orientacja-ikona"
                        style={{ width: 10, height: 15 }}
                        aria-hidden="true"
                      />
                      {t('nowyProjekt.pionowo')}
                    </button>
                    <button
                      type="button"
                      className="np-orientacja-btn"
                      aria-pressed={orientacja === 'poziom'}
                      onClick={() => zmienOrientacje('poziom')}
                    >
                      <span
                        className="np-orientacja-ikona"
                        style={{ width: 15, height: 10 }}
                        aria-hidden="true"
                      />
                      {t('nowyProjekt.poziomo')}
                    </button>
                  </div>
                </div>

                <div className="np-siatka-6">
                  {FORMATY_NOWEGO_PROJEKTU.map((f) => {
                    const aktywny = format === f.id;
                    const ik = ikonaDlaOrientacji(f, orientacja);
                    const w = wymiaryDlaOrientacji(f.szer, f.wys, orientacja);
                    const mm = f.id === 'wlasny' ? '… mm' : `${w.szer}×${w.wys}`;
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
                          style={{ width: ik.szer, height: ik.wys }}
                          aria-hidden="true"
                        />
                        <span className="np-format-nazwa">{etykietaFormatu(f.id)}</span>
                        <span className="np-format-mm">{mm}</span>
                      </button>
                    );
                  })}
                </div>

                {format === 'wlasny' && (
                  <div className="np-wlasny-wiersz">
                    <label className="np-wlasny-pole">
                      {t('nowyProjekt.szerokoscMm')}
                      <input
                        type="number"
                        min={MIN_WYMIAR_MM}
                        max={MAKS_WYMIAR_MM}
                        value={wlasnaSzer}
                        onChange={(e) => ustawWlasnaSzer(Number(e.target.value))}
                      />
                    </label>
                    <span className="np-wlasny-x" aria-hidden="true">
                      ×
                    </span>
                    <label className="np-wlasny-pole">
                      {t('nowyProjekt.wysokoscMm')}
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
                <div className="np-siatka-2">
                  <button
                    type="button"
                    className="np-strona-btn"
                    aria-pressed={strony.przod}
                    onClick={() => ustawStrony((s) => przelaczStrone(s, 'przod'))}
                  >
                    <span className="np-strona-ikona" aria-hidden="true">
                      A
                    </span>
                    <span className="np-strona-tekst">
                      <span className="np-karta-wyboru-tytul">{t('nowyProjekt.przod')}</span>
                      <span className="np-karta-wyboru-opis">{t('nowyProjekt.przodOpis')}</span>
                    </span>
                    <span className="np-strona-ptaszek" aria-hidden="true">
                      {strony.przod ? '✓' : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="np-strona-btn"
                    aria-pressed={strony.tyl}
                    onClick={() => ustawStrony((s) => przelaczStrone(s, 'tyl'))}
                  >
                    <span className="np-strona-ikona tyl" aria-hidden="true">
                      R
                    </span>
                    <span className="np-strona-tekst">
                      <span className="np-karta-wyboru-tytul">{t('nowyProjekt.tyl')}</span>
                      <span className="np-karta-wyboru-opis">{t('nowyProjekt.tylOpis')}</span>
                    </span>
                    <span className="np-strona-ptaszek" aria-hidden="true">
                      {strony.tyl ? '✓' : ''}
                    </span>
                  </button>
                </div>
                <span className="np-karta-wyboru-opis">{t('nowyProjekt.stronyPodpowiedz')}</span>
              </div>
            </>
          )}

          {tryb === 'szablon' && (
            <div className="np-sekcja">
              <span className="np-etykieta">{t('nowyProjekt.krok3Szablon')}</span>
              <div className="np-siatka-3">
                {szablony.map((poz) => {
                  const sel = wybranySzablon === poz.klucz;
                  const url = miniatury.get(poz.klucz);
                  return (
                    <button
                      key={poz.klucz}
                      type="button"
                      className="np-szablon-btn"
                      aria-pressed={sel}
                      onClick={() => ustawWybranySzablon(poz.klucz)}
                    >
                      <span className="np-szablon-miniatura">
                        {url ? <img alt="" src={url} /> : <span>◆</span>}
                      </span>
                      <span className="np-karta-wyboru-tytul">{poz.nazwa}</span>
                      <span className="np-karta-wyboru-opis">
                        {poz.rodzaj === 'rewers'
                          ? t('projekty.stronaRewers')
                          : t('projekty.stronaAwers')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tryb === 'import' && (
            <div className="np-sekcja">
              <span className="np-etykieta">{t('nowyProjekt.krok3Plik')}</span>
              <input
                ref={plikInputRef}
                type="file"
                accept=".kartyrpg-szablon,.zip"
                data-testid="np-plik-szablonu"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void wczytajPlik(f);
                  e.target.value = '';
                }}
              />
              {!plik ? (
                <div
                  className="np-strefa-pliku"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDropPliku}
                >
                  <strong>{t('nowyProjekt.strefaPliku')}</strong>
                  <button
                    type="button"
                    className="ui2-przycisk-glowny"
                    onClick={() => plikInputRef.current?.click()}
                  >
                    {t('nowyProjekt.wybierzZDysku')}
                  </button>
                </div>
              ) : (
                <div className="np-podglad-pliku">
                  <div style={{ flexGrow: 1 }}>
                    <div className="np-karta-wyboru-tytul">{plik.tytul}</div>
                    <div className="np-karta-wyboru-opis">{plik.opis}</div>
                  </div>
                  <button
                    type="button"
                    className="ui2-przycisk-kontur"
                    onClick={() => ustawPlik(undefined)}
                  >
                    {t('nowyProjekt.zmienPlik')}
                  </button>
                </div>
              )}
            </div>
          )}

          {blad && (
            <p role="alert" className="uwaga" style={{ margin: 0 }}>
              {blad}
            </p>
          )}
        </div>

        <div className="np-stopka">
          <span className="np-podpowiedz">{t(kluczPodpowiedziDolnej(tryb, strony))}</span>
          <div className="np-akcje">
            <button type="button" className="np-btn-anuluj" onClick={zamknij}>
              {t('nowyProjekt.anuluj')}
            </button>
            <button
              type="button"
              className="np-btn-utworz"
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
