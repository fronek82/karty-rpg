import { useEffect, useState } from 'react';
import { ustawUstawieniaArkusza } from '../../dane/edycja';
import type { WynikArkusza } from '../../druk/arkusz';
import { t } from '../../i18n';
import {
  wymiaryStrony,
  wymiaryUkladu,
  type Arkusz,
  type PresetUkladu,
  type UkladArkusza,
} from '../../model/arkusz';
import type { Projekt } from '../../model/projekt';
import { baza } from '../baza';
import { MAKS_PRZESUNIECIA, odczytajKalibracje, zapiszKalibracje } from '../kalibracja';
import { PoleLiczby } from './PoleLiczby';

const zaokr = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');
const nowyId = () => `uklad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Układ arkusza kartki: automatyczny (karty stykają się) albo własny – stała siatka z marginesem
 * górnym i lewym, odstępami i rozmiarem karty (gotowe arkusze z perforacją). Podgląd na żywo to
 * sama kartka obok. „Moje układy” w tej przeglądarce (IndexedDB), kalibracja drukarki
 * (localStorage) i wydruk testowy.
 */
export function PanelUkladu({
  arkusz,
  wynik,
  zmienUklad,
  wydrukTestowy,
}: {
  arkusz: Arkusz;
  /** Ostatnio zbudowana kartka – siatka startowa przy przejściu na własny układ. */
  wynik?: WynikArkusza;
  zmienUklad: (f: (p: Projekt) => Projekt, klucz?: string) => boolean;
  wydrukTestowy: () => void;
}) {
  const u = arkusz.ustawienia;
  const A = arkusz.id;
  const uklad = u.uklad;
  const slot = u.slot ?? wynik?.slot ?? { szerokosc: 63, wysokosc: 88 };
  const [moje, ustawMoje] = useState<PresetUkladu[]>();
  const [nazwa, ustawNazwe] = useState('');
  const [status, ustawStatus] = useState('');
  const [kalibracja, ustawKalibracje] = useState(odczytajKalibracje);

  useEffect(() => {
    let aktywny = true;
    void baza()
      .uklady()
      .then((l) => aktywny && ustawMoje(l))
      .catch(() => aktywny && ustawMoje([]));
    return () => {
      aktywny = false;
    };
  }, []);
  const odswiez = async () => ustawMoje(await baza().uklady());

  const zmienSiatke = (z: Partial<UkladArkusza>, klucz: string) =>
    uklad && zmienUklad((p) => ustawUstawieniaArkusza(p, A, { uklad: { ...uklad, ...z } }), klucz);

  const wlaczWlasny = () => {
    const w = wynik;
    const start: UkladArkusza = {
      kolumny: Math.max(1, w?.siatka.kolumny ?? 1),
      rzedy: Math.max(1, w?.siatka.rzedy ?? 1),
      gora: Math.round((w?.poczatekSiatki.y ?? u.marginesy.gora) * 10) / 10,
      lewo: Math.round((w?.poczatekSiatki.x ?? u.marginesy.lewo) * 10) / 10,
      odstepPoziomy: 0,
      odstepPionowy: 0,
      linieCiecia: true,
    };
    zmienUklad((p) => ustawUstawieniaArkusza(p, A, { uklad: start, slot }));
  };
  const wylaczWlasny = () =>
    zmienUklad((p) => ({
      ...p,
      arkusze: p.arkusze.map((a) => {
        if (a.id !== A) return a;
        const ustawienia = { ...a.ustawienia };
        delete ustawienia.uklad;
        return { ...a, ustawienia };
      }),
    }));

  const zapisz = async () => {
    if (!uklad || !nazwa.trim()) return;
    const preset: PresetUkladu = {
      id: nowyId(),
      nazwa: nazwa.trim(),
      papier: u.papier,
      ...(u.wymiaryPapieru ? { wymiaryPapieru: u.wymiaryPapieru } : {}),
      orientacja: u.orientacja,
      slot,
      uklad,
    };
    await baza().zapiszUklad(preset);
    ustawNazwe('');
    ustawStatus(t('uklad.zapisano', { nazwa: preset.nazwa }));
    await odswiez();
  };
  const uzyj = (p: PresetUkladu) =>
    zmienUklad((pr) =>
      ustawUstawieniaArkusza(pr, A, {
        papier: p.papier,
        ...(p.wymiaryPapieru ? { wymiaryPapieru: p.wymiaryPapieru } : {}),
        orientacja: p.orientacja,
        slot: p.slot,
        uklad: p.uklad,
      }),
    );

  const zmienKalibracje = (z: Partial<typeof kalibracja>) => {
    const k = { ...kalibracja, ...z };
    ustawKalibracje(k);
    zapiszKalibracje(k);
  };

  const wymiary = uklad && wymiaryUkladu(uklad, slot, wymiaryStrony(u));
  const poza = wymiary && (wymiary.prawo < -1e-6 || wymiary.dol < -1e-6);

  return (
    <fieldset className="sekcja-ukladu">
      <legend>{t('uklad.tytul')}</legend>
      <div className="pole-panelu">
        <span id={`tryb-ukladu-${A}`}>{t('uklad.tryb')}</span>
        <div className="przelacznik-segmentowy" role="group" aria-labelledby={`tryb-ukladu-${A}`}>
          <button type="button" aria-pressed={!uklad} onClick={() => uklad && wylaczWlasny()}>
            {t('uklad.automatyczny')}
          </button>
          <button type="button" aria-pressed={!!uklad} onClick={() => !uklad && wlaczWlasny()}>
            {t('uklad.wlasny')}
          </button>
        </div>
        <p className="podpis">{t('uklad.opis')}</p>
      </div>
      {uklad && (
        <>
          <div className="pole-panelu dwa-pola">
            <PoleLiczby
              id="uklad-lewo"
              etykieta={t('uklad.lewo')}
              wartosc={uklad.lewo}
              min={0}
              max={500}
              krok={0.5}
              zmien={(v) => zmienSiatke({ lewo: v }, 'lewo')}
            />
            <PoleLiczby
              id="uklad-gora"
              etykieta={t('uklad.gora')}
              wartosc={uklad.gora}
              min={0}
              max={500}
              krok={0.5}
              zmien={(v) => zmienSiatke({ gora: v }, 'gora')}
            />
          </div>
          <div className="pole-panelu dwa-pola">
            <PoleLiczby
              id="uklad-kolumny"
              etykieta={t('uklad.kolumny')}
              wartosc={uklad.kolumny}
              min={1}
              max={50}
              zmien={(v) => Number.isInteger(v) && zmienSiatke({ kolumny: v }, 'kolumny')}
            />
            <PoleLiczby
              id="uklad-rzedy"
              etykieta={t('uklad.rzedy')}
              wartosc={uklad.rzedy}
              min={1}
              max={50}
              zmien={(v) => Number.isInteger(v) && zmienSiatke({ rzedy: v }, 'rzedy')}
            />
          </div>
          <div className="pole-panelu dwa-pola">
            {(['szerokosc', 'wysokosc'] as const).map((os) => (
              <PoleLiczby
                key={os}
                id={`uklad-${os}`}
                etykieta={t(os === 'szerokosc' ? 'uklad.szerokoscKarty' : 'uklad.wysokoscKarty')}
                wartosc={slot[os]}
                min={10}
                max={500}
                krok={0.5}
                zmien={(v) =>
                  zmienUklad(
                    (p) => ustawUstawieniaArkusza(p, A, { slot: { ...slot, [os]: v } }),
                    `slot-${os}`,
                  )
                }
              />
            ))}
          </div>
          <div className="pole-panelu dwa-pola">
            <PoleLiczby
              id="uklad-odstep-x"
              etykieta={t('uklad.odstepPoziomy')}
              wartosc={uklad.odstepPoziomy}
              min={0}
              max={100}
              krok={0.5}
              zmien={(v) => zmienSiatke({ odstepPoziomy: v }, 'odstep-x')}
            />
            <PoleLiczby
              id="uklad-odstep-y"
              etykieta={t('uklad.odstepPionowy')}
              wartosc={uklad.odstepPionowy}
              min={0}
              max={100}
              krok={0.5}
              zmien={(v) => zmienSiatke({ odstepPionowy: v }, 'odstep-y')}
            />
          </div>
          <label className="pole-panelu wybor">
            <input
              type="checkbox"
              checked={uklad.linieCiecia}
              onChange={(e) => zmienSiatke({ linieCiecia: e.target.checked }, 'linie')}
            />
            {t('uklad.linieCiecia')}
          </label>
          {wymiary && (
            <p className={poza ? 'blad-pola' : 'podpis'} role={poza ? 'alert' : 'status'}>
              {poza
                ? t('uklad.pozaPapierem', { prawo: zaokr(wymiary.prawo), dol: zaokr(wymiary.dol) })
                : t('uklad.wynik', {
                    liczba: uklad.kolumny * uklad.rzedy,
                    prawo: zaokr(wymiary.prawo),
                    dol: zaokr(wymiary.dol),
                  })}
            </p>
          )}
          <div className="pole-panelu zapis-ukladu">
            <label htmlFor="nazwa-ukladu">{t('uklad.nazwa')}</label>
            <input
              id="nazwa-ukladu"
              type="text"
              value={nazwa}
              onChange={(e) => ustawNazwe(e.target.value)}
            />
            <button type="button" disabled={!nazwa.trim()} onClick={() => void zapisz()}>
              {t('uklad.zapisz')}
            </button>
          </div>
        </>
      )}
      <ListaUkladow moje={moje} uzyj={uzyj} odswiez={odswiez} />
      <p role="status" aria-live="polite" className="podpis">
        {status}
      </p>
      <fieldset className="kalibracja">
        <legend>{t('uklad.kalibracja')}</legend>
        <p className="podpis">{t('uklad.kalibracjaOpis')}</p>
        <div className="pole-panelu dwa-pola">
          <PoleLiczby
            id="kalibracja-x"
            etykieta={t('uklad.przesuniecieX')}
            wartosc={kalibracja.x}
            min={-MAKS_PRZESUNIECIA}
            max={MAKS_PRZESUNIECIA}
            krok={0.1}
            zmien={(v) => zmienKalibracje({ x: v })}
          />
          <PoleLiczby
            id="kalibracja-y"
            etykieta={t('uklad.przesuniecieY')}
            wartosc={kalibracja.y}
            min={-MAKS_PRZESUNIECIA}
            max={MAKS_PRZESUNIECIA}
            krok={0.1}
            zmien={(v) => zmienKalibracje({ y: v })}
          />
        </div>
        <button type="button" onClick={wydrukTestowy}>
          {t('uklad.wydrukTestowy')}
        </button>
        <p className="podpis">{t('uklad.wydrukTestowyOpis')}</p>
      </fieldset>
    </fieldset>
  );
}

/** „Moje układy”: Użyj / Zmień nazwę / Usuń. */
function ListaUkladow({
  moje,
  uzyj,
  odswiez,
}: {
  moje: PresetUkladu[] | undefined;
  uzyj: (p: PresetUkladu) => void;
  odswiez: () => Promise<void>;
}) {
  const [zmieniany, ustawZmieniany] = useState<{ id: string; nazwa: string }>();
  if (!moje) return null;
  return (
    <div className="moje-uklady">
      <h3>{t('uklad.moje')}</h3>
      <p className="podpis">{t('uklad.mojeOpis')}</p>
      {moje.length === 0 ? (
        <p className="podpis">{t('uklad.brakMoich')}</p>
      ) : (
        <ul>
          {moje.map((p) => (
            <li key={p.id}>
              {zmieniany?.id === p.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = zmieniany.nazwa.trim();
                    if (!n) return;
                    void baza()
                      .zapiszUklad({ ...p, nazwa: n })
                      .then(odswiez)
                      .then(() => ustawZmieniany(undefined));
                  }}
                >
                  <input
                    type="text"
                    aria-label={t('uklad.nowaNazwa', { nazwa: p.nazwa })}
                    value={zmieniany.nazwa}
                    autoFocus
                    onChange={(e) => ustawZmieniany({ id: p.id, nazwa: e.target.value })}
                    onKeyDown={(e) => e.key === 'Escape' && ustawZmieniany(undefined)}
                  />
                  <button type="submit">OK</button>
                </form>
              ) : (
                <>
                  <span className="nazwa-ukladu">
                    <b>{p.nazwa}</b>
                    <span className="podpis">
                      {t('uklad.opisPresetu', {
                        papier: t(`papier.${p.papier}`),
                        szer: zaokr(p.slot.szerokosc),
                        wys: zaokr(p.slot.wysokosc),
                        kolumny: p.uklad.kolumny,
                        rzedy: p.uklad.rzedy,
                      })}
                    </span>
                  </span>
                  <span className="przyciski-ukladu">
                    <button
                      type="button"
                      className="maly"
                      aria-label={t('uklad.uzyjEtykieta', { nazwa: p.nazwa })}
                      onClick={() => uzyj(p)}
                    >
                      {t('uklad.uzyj')}
                    </button>
                    <button
                      type="button"
                      className="maly"
                      aria-label={t('uklad.zmienNazweEtykieta', { nazwa: p.nazwa })}
                      onClick={() => ustawZmieniany({ id: p.id, nazwa: p.nazwa })}
                    >
                      {t('uklad.zmienNazwe')}
                    </button>
                    <button
                      type="button"
                      className="maly"
                      aria-label={t('uklad.usunEtykieta', { nazwa: p.nazwa })}
                      onClick={() => void baza().usunUklad(p.id).then(odswiez)}
                    >
                      {t('uklad.usun')}
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
