import { useEffect, useState } from 'react';
import { ustawUstawieniaArkusza } from '../../dane/edycja';
import { ustawKolejnosc } from '../../dane/kartka';
import { kolejnoscWidoczna, type WynikArkusza } from '../../druk/arkusz';
import { formatujLiczbe, t } from '../../i18n';
import {
  DOPASOWANIE_DOMYSLNE,
  LUZ_MAKS,
  MIESZANE_DOMYSLNE,
  TOLERANCJA_ROZMIARU,
  wymiaryStrony,
  wymiaryUkladu,
  type Arkusz,
  type DopasowanieDoSlotu,
  type LinieCiecia,
  type OpcjeMieszane,
  type PresetUkladu,
  type UkladArkusza,
} from '../../model/arkusz';
import type { Projekt } from '../../model/projekt';
import { baza } from '../bazaUI';
import { MAKS_PRZESUNIECIA, type Kalibracja } from '../kalibracja';
import { kolorSceny } from '../../silnik/scena';
import { PoleKoloru } from '../szablon/Kontrolki';
import { PoleLiczby } from './PoleLiczby';
import { PodgladWymiarowUkladu } from './PodgladWymiarowUkladu';

const zaokr = (x: number) => formatujLiczbe(x, 1);
const nowyId = () => `uklad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Układ arkusza kartki: automatyczny (karty stykają się) albo własny – stała siatka z marginesem
 * górnym i lewym, odstępami i rozmiarem karty (gotowe arkusze z perforacją). Kartka obok i diagram
 * w panelu aktualizują się na żywo. „Moje układy” w tej przeglądarce (IndexedDB), kalibracja drukarki
 * (localStorage) i wydruk testowy.
 */
export function PanelUkladu({
  arkusz,
  wynik,
  zmienUklad,
  wydrukTestowy,
  przelaczRozmiary,
  naKartce = [],
  kalibracja,
  zmienKalibracje,
}: {
  kalibracja: Kalibracja;
  zmienKalibracje: (k: Kalibracja) => void;
  /** Przełączenie „jeden rozmiar (siatka)” ↔ „mieszane” (z przeniesieniem kart). */
  przelaczRozmiary?: (tryb: 'jeden' | 'mieszane') => void;
  /** Karty na kartce pogrupowane wg szablonu (lista „Na kartce” w trybie mieszanym). */
  naKartce?: {
    id: string;
    nazwa: string;
    kolor?: string;
    szer: number;
    wys: number;
    liczba: number;
  }[];
  arkusz: Arkusz;
  /** Ostatnio zbudowana kartka – siatka startowa przy przejściu na własny układ. */
  wynik?: WynikArkusza;
  zmienUklad: (f: (p: Projekt) => Projekt, klucz?: string) => boolean;
  wydrukTestowy: () => void;
}) {
  const u = arkusz.ustawienia;
  const A = arkusz.id;
  const mieszane = u.rozmiary === 'mieszane';
  const opcje: OpcjeMieszane = u.mieszane ?? MIESZANE_DOMYSLNE;
  // Własny układ (stała siatka) działa tylko z jednym rozmiarem – w trybie mieszanym jest wyłączony.
  const uklad = mieszane ? undefined : u.uklad;
  const slot = u.slot ?? wynik?.slot ?? { szerokosc: 63, wysokosc: 88 };
  const [moje, ustawMoje] = useState<PresetUkladu[]>();
  const [nazwa, ustawNazwe] = useState('');
  const [status, ustawStatus] = useState('');
  const [bladBazy, ustawBladBazy] = useState(false);

  useEffect(() => {
    let aktywny = true;
    void baza()
      .uklady()
      .then((l) => aktywny && ustawMoje(l))
      .catch(() => {
        if (!aktywny) return;
        ustawMoje([]);
        ustawBladBazy(true);
      });
    return () => {
      aktywny = false;
    };
  }, []);
  const odswiez = async () => ustawMoje(await baza().uklady());
  /** Operacja na „Moich układach”; niedostępna baza (np. tryb prywatny) – komunikat. */
  const wykonaj = (f: () => Promise<unknown>) =>
    void f().catch(() => {
      ustawBladBazy(true);
      ustawStatus(t('uklad.bladBazy'));
    });

  const zmienSiatke = (z: Partial<UkladArkusza>, klucz: string) =>
    uklad && zmienUklad((p) => ustawUstawieniaArkusza(p, A, { uklad: { ...uklad, ...z } }), klucz);

  // Kartka bez zapisanego dopasowania działa jak przed M2b-1: luz 0,5 mm.
  const dopasowanie: DopasowanieDoSlotu = u.dopasowanie ?? {
    ...DOPASOWANIE_DOMYSLNE,
    luz: TOLERANCJA_ROZMIARU,
  };
  const zmienDopasowanie = (z: Partial<DopasowanieDoSlotu>, klucz: string) =>
    zmienUklad(
      (p) => ustawUstawieniaArkusza(p, A, { dopasowanie: { ...dopasowanie, ...z } }),
      `dopasowanie-${klucz}`,
    );

  // Linie cięcia (też nożyczki i linie prowadzące) – np. jasne na ciemnych kartach.
  // Tryb drukarni rysuje znaczniki cięcia zamiast linii; własny układ może linie wyłączyć.
  const drukarnia = !!u.drukarnia?.wlaczony;
  const rysujLinie = !drukarnia && (!uklad || uklad.linieCiecia);
  const zmienLinie = (z: Partial<LinieCiecia>, klucz: string) =>
    zmienUklad(
      (p) => ustawUstawieniaArkusza(p, A, { linie: { ...u.linie, ...z } }),
      `linie-${A}-${klucz}`,
    );

  const zmienMieszane = (z: Partial<OpcjeMieszane>, klucz: string) =>
    zmienUklad(
      (p) => ustawUstawieniaArkusza(p, A, { mieszane: { ...opcje, ...z } }),
      `mieszane-${klucz}`,
    );
  const wybierzKolejnosc = (k: OpcjeMieszane['kolejnosc']) => {
    if (k === opcje.kolejnosc) return;
    // Własna kolejność startuje od bieżącego układu, żeby karty nie „skakały”.
    if (k === 'wlasna')
      zmienUklad((p) =>
        ustawKolejnosc(
          p,
          A,
          wynik?.mieszane ? kolejnoscWidoczna(wynik.mieszane) : (arkusz.kolejnosc ?? []),
        ),
      );
    else zmienMieszane({ kolejnosc: k }, 'kolejnosc');
  };

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
      ...(u.dopasowanie ? { dopasowanie: u.dopasowanie } : {}),
    };
    await baza().zapiszUklad(preset);
    ustawBladBazy(false);
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
        // Preset sprzed M2b-1 (bez dopasowania) nie zmienia luzu kartki.
        ...(p.dopasowanie ? { dopasowanie: p.dopasowanie } : {}),
      }),
    );

  const papier = wymiaryStrony(u);
  const wymiary = uklad && wymiaryUkladu(uklad, slot, papier);
  const poza = wymiary && (wymiary.prawo < -1e-6 || wymiary.dol < -1e-6);

  return (
    <fieldset className="sekcja-ukladu">
      <legend>{t('uklad.tytul')}</legend>
      {przelaczRozmiary && (
        <div className="pole-panelu">
          <label htmlFor={`rozmiary-${A}`}>{t('mieszane.tytul')}</label>
          <select
            id={`rozmiary-${A}`}
            value={mieszane ? 'mieszane' : 'jeden'}
            onChange={(e) => {
              const v = e.target.value as 'jeden' | 'mieszane';
              if ((v === 'mieszane') !== mieszane) przelaczRozmiary(v);
            }}
          >
            <option value="jeden">{t('mieszane.jeden')}</option>
            <option value="mieszane">{t('mieszane.mieszane')}</option>
          </select>
        </div>
      )}
      {mieszane && (
        <>
          <div className="pole-panelu">
            <label>
              {t('mieszane.pakowanie')}
              <select
                value={opcje.pakowanie ?? 'pasy'}
                onChange={(e) =>
                  zmienMieszane(
                    { pakowanie: e.target.value === 'maxrects' ? 'maxrects' : 'pasy' },
                    'pakowanie',
                  )
                }
              >
                <option value="pasy">{t('mieszane.pasy')}</option>
                <option value="maxrects">{t('mieszane.maxrects')}</option>
              </select>
            </label>
            <p className="podpis">
              {t(opcje.pakowanie === 'maxrects' ? 'mieszane.maxrectsOpis' : 'mieszane.opis')}
            </p>
          </div>
          <div className="pole-panelu">
            <label htmlFor={`kolejnosc-${A}`}>{t('mieszane.kolejnosc')}</label>
            <select
              id={`kolejnosc-${A}`}
              value={opcje.kolejnosc}
              onChange={(e) => wybierzKolejnosc(e.target.value as 'najwieksze' | 'wlasna')}
            >
              {(['najwieksze', 'wlasna'] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`mieszane.${k}`)}
                </option>
              ))}
            </select>
            <p className="podpis">{t('mieszane.kolejnoscOpis')}</p>
          </div>
          <label className="pole-panelu wybor">
            <input
              type="checkbox"
              checked={opcje.obracaj}
              onChange={(e) => zmienMieszane({ obracaj: e.target.checked }, 'obracaj')}
            />
            {t('mieszane.obracaj')}
          </label>
          <label className="pole-panelu wybor">
            <input
              type="checkbox"
              checked={opcje.grupujRozmiary}
              disabled={opcje.kolejnosc === 'wlasna' || opcje.pakowanie === 'maxrects'}
              onChange={(e) => zmienMieszane({ grupujRozmiary: e.target.checked }, 'grupuj')}
            />
            {t('mieszane.grupuj')}
          </label>
          <PoleLiczby
            id="mieszane-odstep"
            etykieta={t('mieszane.odstep')}
            wartosc={opcje.odstep}
            min={0}
            max={20}
            krok={0.5}
            zmien={(v) => zmienMieszane({ odstep: v }, 'odstep')}
          />
          {naKartce.length > 0 && (
            <div className="na-kartce">
              <h3>{t('mieszane.naKartce')}</h3>
              <ul>
                {naKartce.map((n) => (
                  <li key={n.id}>
                    <span
                      className="probka-koloru"
                      aria-hidden="true"
                      style={n.kolor ? { background: n.kolor } : undefined}
                    />
                    {t('mieszane.pozycja', {
                      nazwa: n.nazwa,
                      szer: zaokr(n.szer),
                      wys: zaokr(n.wys),
                      liczba: n.liczba,
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="uwaga" role="note">
            {t('mieszane.wlasnyUklad')}
            {(arkusz.przypiete?.length ?? 0) > 0 && ` ${t('mieszane.przypiecia')}`}
          </p>
        </>
      )}
      <div className="pole-panelu">
        <label htmlFor={`tryb-ukladu-${A}`}>{t('uklad.tryb')}</label>
        <select
          id={`tryb-ukladu-${A}`}
          value={uklad ? 'wlasny' : 'auto'}
          onChange={(e) => {
            if (e.target.value === 'wlasny') {
              if (!uklad && !mieszane) wlaczWlasny();
            } else if (uklad) {
              wylaczWlasny();
            }
          }}
        >
          <option value="auto">{t('uklad.automatyczny')}</option>
          <option value="wlasny" disabled={mieszane}>
            {t('uklad.wlasny')}
          </option>
        </select>
        <p className="podpis">{t('uklad.opis')}</p>
      </div>
      {!mieszane && (
        <fieldset className="karta-w-slocie">
          <legend>{t('dopasowanie.tytul')}</legend>
          <PoleLiczby
            id="dopasowanie-luz"
            etykieta={t('dopasowanie.luz')}
            wartosc={dopasowanie.luz}
            min={0}
            max={LUZ_MAKS}
            krok={0.5}
            zmien={(v) => zmienDopasowanie({ luz: v }, 'luz')}
          />
          <p className="podpis">
            {t('dopasowanie.luzOpis', { tolerancja: zaokr(TOLERANCJA_ROZMIARU) })}
          </p>
          <div className="pole-panelu">
            <span id={`dop-polozenie-${A}`}>{t('dopasowanie.polozenie')}</span>
            <div
              className="przelacznik-segmentowy"
              role="group"
              aria-labelledby={`dop-polozenie-${A}`}
            >
              <button
                type="button"
                aria-pressed={dopasowanie.polozenie === 'srodek'}
                onClick={() => zmienDopasowanie({ polozenie: 'srodek' }, 'polozenie')}
              >
                {t('dopasowanie.srodek')}
              </button>
              <button
                type="button"
                aria-pressed={dopasowanie.polozenie === 'lewy-gorny'}
                onClick={() => zmienDopasowanie({ polozenie: 'lewy-gorny' }, 'polozenie')}
              >
                {t('dopasowanie.lewyGorny')}
              </button>
            </div>
          </div>
          <label className="pole-panelu wybor">
            <input
              type="checkbox"
              checked={dopasowanie.tloDoSlotu}
              onChange={(e) => zmienDopasowanie({ tloDoSlotu: e.target.checked }, 'tlo')}
            />
            {t('dopasowanie.tloDoSlotu')}
          </label>
          <div className="pole-panelu">
            <span id={`dop-linie-${A}`}>{t('dopasowanie.linie')}</span>
            <div className="przelacznik-segmentowy" role="group" aria-labelledby={`dop-linie-${A}`}>
              <button
                type="button"
                aria-pressed={dopasowanie.linie === 'slot'}
                onClick={() => zmienDopasowanie({ linie: 'slot' }, 'linie')}
              >
                {t('dopasowanie.wokolSlotu')}
              </button>
              <button
                type="button"
                aria-pressed={dopasowanie.linie === 'karta'}
                onClick={() => zmienDopasowanie({ linie: 'karta' }, 'linie')}
              >
                {t('dopasowanie.wokolKarty')}
              </button>
            </div>
          </div>
        </fieldset>
      )}
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
          {/* Dwa stałe elementy (alert i status) – zmiana roli w locie bywa źle ogłaszana. */}
          <p className="blad-pola" role="alert">
            {wymiary && poza
              ? t('uklad.pozaPapierem', { prawo: zaokr(wymiary.prawo), dol: zaokr(wymiary.dol) })
              : ''}
          </p>
          <p className="podpis" role="status">
            {wymiary && !poza
              ? t('uklad.wynik', {
                  liczba: uklad.kolumny * uklad.rzedy,
                  prawo: zaokr(wymiary.prawo),
                  dol: zaokr(wymiary.dol),
                })
              : ''}
          </p>
          {wymiary && (
            <PodgladWymiarowUkladu
              uklad={uklad}
              slot={slot}
              papier={papier}
              siatka={wymiary}
              {...(u.papier === 'wlasny'
                ? {
                    polaPapieru:
                      u.orientacja === 'pionowa'
                        ? { szer: 'papier-szer', wys: 'papier-wys' }
                        : { szer: 'papier-wys', wys: 'papier-szer' },
                  }
                : {})}
            />
          )}
          <div className="pole-panelu zapis-ukladu">
            <label htmlFor="nazwa-ukladu">{t('uklad.nazwa')}</label>
            <input
              id="nazwa-ukladu"
              type="text"
              value={nazwa}
              onChange={(e) => ustawNazwe(e.target.value)}
            />
            <button type="button" disabled={!nazwa.trim()} onClick={() => wykonaj(zapisz)}>
              {t('uklad.zapisz')}
            </button>
          </div>
        </>
      )}
      <ListaUkladow
        moje={moje}
        bladBazy={bladBazy}
        uzyj={uzyj}
        odswiez={odswiez}
        wykonaj={wykonaj}
      />
      <p role="status" aria-live="polite" className="podpis">
        {status}
      </p>
      <fieldset className="linie-ciecia" disabled={!rysujLinie}>
        <legend>{t('linie.tytul')}</legend>
        <PoleKoloru
          etykieta={t('linie.kolor')}
          wartosc={kolorSceny(u.linie.kolor)}
          moznaBrak={false}
          zmien={(v) => v && zmienLinie({ kolor: v }, 'kolor')}
        />
        <PoleLiczby
          id="linie-grubosc"
          etykieta={t('linie.grubosc')}
          wartosc={u.linie.grubosc}
          min={0.05}
          max={2}
          krok={0.01}
          zmien={(v) => zmienLinie({ grubosc: v }, 'grubosc')}
        />
        <div className="pole-panelu dwa-pola">
          <PoleLiczby
            id="linie-kreska"
            etykieta={t('linie.kreska')}
            wartosc={u.linie.kreska}
            min={0.5}
            max={20}
            krok={0.5}
            zmien={(v) => zmienLinie({ kreska: v }, 'kreska')}
          />
          <PoleLiczby
            id="linie-przerwa"
            etykieta={t('linie.przerwa')}
            wartosc={u.linie.przerwa}
            min={0}
            max={20}
            krok={0.5}
            zmien={(v) => zmienLinie({ przerwa: v }, 'przerwa')}
          />
        </div>
        <p className="podpis">
          {t(rysujLinie ? 'linie.opis' : drukarnia ? 'linie.drukarnia' : 'linie.wylaczone')}
        </p>
      </fieldset>
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
            zmien={(v) => zmienKalibracje({ ...kalibracja, x: v })}
          />
          <PoleLiczby
            id="kalibracja-y"
            etykieta={t('uklad.przesuniecieY')}
            wartosc={kalibracja.y}
            min={-MAKS_PRZESUNIECIA}
            max={MAKS_PRZESUNIECIA}
            krok={0.1}
            zmien={(v) => zmienKalibracje({ ...kalibracja, y: v })}
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
  bladBazy,
  uzyj,
  odswiez,
  wykonaj,
}: {
  moje: PresetUkladu[] | undefined;
  bladBazy: boolean;
  uzyj: (p: PresetUkladu) => void;
  odswiez: () => Promise<void>;
  wykonaj: (f: () => Promise<unknown>) => void;
}) {
  const [zmieniany, ustawZmieniany] = useState<{ id: string; nazwa: string }>();
  if (!moje) return null;
  return (
    <div className="moje-uklady">
      <h3>{t('uklad.moje')}</h3>
      <p className="podpis">{t('uklad.mojeOpis')}</p>
      {moje.length === 0 ? (
        <p className="podpis">{t(bladBazy ? 'uklad.bladBazy' : 'uklad.brakMoich')}</p>
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
                    wykonaj(() =>
                      baza()
                        .zapiszUklad({ ...p, nazwa: n })
                        .then(odswiez)
                        .then(() => ustawZmieniany(undefined)),
                    );
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
                  <button type="submit">{t('uklad.zatwierdz')}</button>
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
                      onClick={() => wykonaj(() => baza().usunUklad(p.id).then(odswiez))}
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
