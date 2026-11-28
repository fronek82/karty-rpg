import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { dodajKopieRewersuDoProjektu } from '../../dane/aktualizacjaSzablonu';
import type { WpisSzablonu } from '../../dane/bibliotekaSzablonow';
import { ustawTytulArkusza, ustawUstawieniaArkusza } from '../../dane/edycja';
import { czyDwustronnyWlaczony, przypiszRewers } from '../../dane/rewers';
import type { WynikArkusza } from '../../druk/arkusz';
import { osOdwracania } from '../../druk/dwustronny';
import { formatujLiczbe, t } from '../../i18n';
import {
  czyFormatZdjeciowy,
  DRUKARNIA_DOMYSLNA,
  DWUSTRONNY_DOMYSLNY,
  MARGINES_BEZPIECZENSTWA_FOTO,
  PAPIERY,
  SLOT_DOMYSLNY,
  SPAD_MAKS,
  wymiaryStrony,
  type Arkusz,
  type KrawedzOdwracania,
  type Papier,
  type UkladDrukarni,
  type UstawieniaArkusza,
} from '../../model/arkusz';
import type { Projekt } from '../../model/projekt';
import { baza } from '../bazaUI';
import { MAKS_PRZESUNIECIA, type Kalibracja } from '../kalibracja';
import { PodgladRewersu } from '../rewers/PodgladRewersu';
import { dolaczRewersGlobalnyDoProjektu, useRewersyGlobalne } from '../rewersyGlobalne';
import { PanelSekcji, SekcjaPanelu } from '../ui2/PanelSekcji';
import type { ProjektWEdycji } from '../useProjekt';
import { niezgodnosciDruku, przodyDoPrzypisania, useZgodnoscTylu } from '../zgodnoscTylu';
import { OpcjeRewersowGlobalnych, wybranaOpcja } from '../zrodloOpcji';
import type { CoPobrac } from './MenuPobierz';
import { PanelUkladu, SekcjaKalibracji, SekcjaKartyWSlocie } from './PanelUkladu';
import { PoleLiczby } from './PoleLiczby';
import { SekcjaLiniiCiecia } from './SekcjaLiniiCiecia';

/** Granice własnego papieru (mm) – jak w schemacie zapisu. */
const MIN_PAPIER = 20;
const MAX_PAPIER = 1000;

const zaokr = (x: number) => formatujLiczbe(x, 1);

/** Krótkie etykiety papierów do kafelków w sekcji „Papier” (wzór: Druk.dc.html). */
const ETYKIETY_PAPIERU: Record<Exclude<Papier, 'wlasny'>, string> = {
  A4: 'A4',
  Letter: 'Letter',
  A5: 'A5',
  'foto-10x15': '10×15',
  'foto-13x18': '13×18',
  'foto-15x21': '15×21',
};

/**
 * Zmiana papieru. Format zdjęciowy: strefa bezpieczeństwa 3 mm i marginesy równe strefie (mały
 * papier – liczy się każdy milimetr). Powrót na zwykły papier wyłącza strefę. Własny – startuje
 * od wymiarów obecnego papieru.
 */
export function zmianaPapieru(u: UstawieniaArkusza, papier: Papier): Partial<UstawieniaArkusza> {
  const zmiana: Partial<UstawieniaArkusza> = { papier };
  if (papier === 'wlasny' && !u.wymiaryPapieru) {
    const s = wymiaryStrony({ ...u, orientacja: 'pionowa' });
    zmiana.wymiaryPapieru = { szer: s.szer, wys: s.wys };
  }
  if (czyFormatZdjeciowy(papier) && !czyFormatZdjeciowy(u.papier)) {
    const m = MARGINES_BEZPIECZENSTWA_FOTO;
    zmiana.marginesBezpieczenstwa = m;
    zmiana.marginesy = { gora: m, prawo: m, dol: m, lewo: m };
  } else if (!czyFormatZdjeciowy(papier) && czyFormatZdjeciowy(u.papier)) {
    zmiana.marginesBezpieczenstwa = 0;
  }
  return zmiana;
}

/**
 * Prawy panel „Ustawienia druku” (UI2 R12, wzór: docs/makiety-ui2/Druk.dc.html, plan 5.6 i 14.1).
 * Zbudowany ze wspólnych komponentów `PanelSekcji` i `SekcjaPanelu`.
 * Bez „Nowy tył” i bez „Katalog Google Fonts” (decyzja D21).
 */
export function PanelUstawien({
  edycja,
  arkusz,
  zmienUklad,
  arkusze,
  wybierzArkusz,
  blad,
  wynik,
  wydrukTestowy,
  wydrukTestowyDwustronny,
  przelaczRozmiary,
  naKartce,
  kalibracja,
  zmienKalibracje,
  kalibracjaRewersu,
  zmienKalibracjeRewersu,
  warstwaTekstowaPdf,
  zmienWarstweTekstowaPdf,
  pobierz,
  pobieranieWylaczone = false,
  bezRewersow = false,
}: {
  /** Gra z kartami jednostronnymi – bez rewersu talii i druku dwustronnego. */
  bezRewersow?: boolean;
  przelaczRozmiary?: (tryb: 'jeden' | 'mieszane') => void;
  naKartce?: ComponentProps<typeof PanelUkladu>['naKartce'];
  kalibracja: Kalibracja;
  zmienKalibracje: (k: Kalibracja) => void;
  kalibracjaRewersu: Kalibracja;
  zmienKalibracjeRewersu: (k: Kalibracja) => void;
  warstwaTekstowaPdf: boolean;
  zmienWarstweTekstowaPdf: (wlaczona: boolean) => void;
  /** Pobieranie PDF / obrazów ze sekcji „Pobierz”. */
  pobierz?: (co: CoPobrac) => void;
  pobieranieWylaczone?: boolean;
  /** Ostatnio zbudowana kartka (siatka startowa własnego układu). */
  wynik?: WynikArkusza;
  wydrukTestowy: () => void;
  wydrukTestowyDwustronny: () => void;
  edycja: ProjektWEdycji;
  arkusz: Arkusz;
  zmienUklad: (f: (p: Projekt) => Projekt, klucz?: string) => boolean;
  arkusze?: { id: string; nazwa: string }[];
  wybierzArkusz?: (id: string) => void;
  blad?: string;
}) {
  const { projekt, zmien } = edycja;
  const { rewersyGlobalne } = useRewersyGlobalne(projekt);
  const { okno: oknoZgodnosci, potwierdz: potwierdzZgodnosc } = useZgodnoscTylu();
  const [wpisyBiblioteki, ustawWpisyBiblioteki] = useState<WpisSzablonu[]>([]);
  const u = arkusz.ustawienia;
  const A = arkusz.id;
  const talia = projekt.talie.find((x) => x.id === arkusz.taliaId);
  const rewersTalii =
    typeof talia?.rewersId === 'string'
      ? projekt.rewersy?.find((r) => r.id === talia.rewersId)
      : undefined;
  const polozenie = !u.tytul || !u.tytul.tekst.trim() ? 'brak' : u.tytul.polozenie;
  // Tekst tytułu w polu (także przy „bez tytułu” – pamiętany do przywrócenia).
  const [tekstTytulu, ustawTekstTytulu] = useState(u.tytul?.tekst || arkusz.nazwa);

  useEffect(() => {
    if (bezRewersow) return;
    let aktywny = true;
    void baza()
      .szablonyBiblioteki()
      .then((lista) => {
        if (aktywny) ustawWpisyBiblioteki(lista);
      })
      .catch(() => undefined);
    return () => {
      aktywny = false;
    };
  }, [bezRewersow]);

  const zrodlaRewersowWProjekcie = useMemo(
    () => new Set((projekt.rewersy ?? []).map((r) => r.zrodlo?.id).filter((x): x is string => !!x)),
    [projekt.rewersy],
  );
  const rewersyZMoichSzablonow = useMemo(
    () =>
      wpisyBiblioteki.filter((w) => w.rodzaj === 'rewers' && !zrodlaRewersowWProjekcie.has(w.id)),
    [wpisyBiblioteki, zrodlaRewersowWProjekcie],
  );

  const papieryKafelki: readonly Papier[] = [
    ...(Object.keys(PAPIERY) as Exclude<Papier, 'wlasny'>[]),
    'wlasny',
  ];

  return (
    <PanelSekcji tytul={t('druk.ustawienia')} etykietaAria={t('druk.ustawienia')}>
      {oknoZgodnosci}

      {arkusze && arkusze.length > 1 && wybierzArkusz && (
        <div className="druk-ui2-wybor-arkusza">
          <label htmlFor="wybor-arkusza-druku">{t('kartka.wybierzKartke')}</label>
          <select
            id="wybor-arkusza-druku"
            value={arkusz.id}
            onChange={(e) => wybierzArkusz(e.target.value)}
          >
            {arkusze.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nazwa}
              </option>
            ))}
          </select>
        </div>
      )}

      {blad && (
        <p role="alert" className="blad-pola druk-ui2-blad">
          {blad}
        </p>
      )}

      {/* 1. Papier (otwarta) */}
      <SekcjaPanelu tytul={t('druk.sekcja.papier')} domyslnieOtwarta>
        <div
          className="druk-ui2-papiery"
          role="group"
          aria-label={t('kartka.papier')}
          data-testid="siatka-papierow"
        >
          {papieryKafelki.map((id) => {
            const wybrany = u.papier === id;
            const wym = id === 'wlasny' ? { szer: 200, wys: 280 } : PAPIERY[id];
            const skala = 30 / Math.max(wym.szer, wym.wys);
            const iw = Math.max(10, Math.round(wym.szer * skala));
            const ih = Math.max(10, Math.round(wym.wys * skala));
            return (
              <button
                key={id}
                type="button"
                className="druk-ui2-papier-kafelek"
                aria-pressed={wybrany}
                aria-label={t(`papier.${id}`)}
                onClick={() =>
                  zmienUklad((p) => ustawUstawieniaArkusza(p, A, zmianaPapieru(u, id)))
                }
              >
                <span
                  className="druk-ui2-papier-zarys"
                  style={{ width: iw, height: ih }}
                  aria-hidden="true"
                />
                <span className="druk-ui2-papier-nazwa">
                  {id === 'wlasny' ? t('druk.papierWlasnySkrot') : ETYKIETY_PAPIERU[id]}
                </span>
                <span className="druk-ui2-papier-mm">
                  {id === 'wlasny' ? '… mm' : `${wym.szer}×${wym.wys}`}
                </span>
              </button>
            );
          })}
        </div>

        {u.papier === 'wlasny' && (
          <div className="pole-panelu dwa-pola">
            {(['szer', 'wys'] as const).map((os) => (
              <PoleLiczby
                key={os}
                id={`papier-${os}`}
                etykieta={t(os === 'szer' ? 'kartka.szerokoscPapieru' : 'kartka.wysokoscPapieru')}
                wartosc={(u.wymiaryPapieru ?? PAPIERY.A4)[os]}
                min={MIN_PAPIER}
                max={MAX_PAPIER}
                zmien={(v) => {
                  const w = { ...(u.wymiaryPapieru ?? PAPIERY.A4), [os]: v };
                  zmienUklad((p) => ustawUstawieniaArkusza(p, A, { wymiaryPapieru: w }), 'papier');
                }}
              />
            ))}
          </div>
        )}

        <div className="druk-ui2-wiersz-2">
          <div className="pole-panelu">
            <span id="orientacja">{t('kartka.orientacja')}</span>
            <div className="przelacznik-segmentowy" role="group" aria-labelledby="orientacja">
              {(['pionowa', 'pozioma'] as const).map((x) => (
                <button
                  key={x}
                  type="button"
                  aria-pressed={u.orientacja === x}
                  onClick={() => zmienUklad((p) => ustawUstawieniaArkusza(p, A, { orientacja: x }))}
                >
                  {t(`kartka.orientacja.${x}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="pole-panelu">
            <span id="druk-kolor">{t('kartka.druk')}</span>
            <div className="przelacznik-segmentowy" role="group" aria-labelledby="druk-kolor">
              <button
                type="button"
                aria-pressed={!u.czarnoBialy}
                onClick={() => zmien((p) => ustawUstawieniaArkusza(p, A, { czarnoBialy: false }))}
              >
                {t('kartka.kolor')}
              </button>
              <button
                type="button"
                aria-pressed={!!u.czarnoBialy}
                onClick={() => zmien((p) => ustawUstawieniaArkusza(p, A, { czarnoBialy: true }))}
              >
                {t('kartka.czarnoBialy')}
              </button>
            </div>
          </div>
        </div>

        <p className="podpis">
          {(() => {
            const s = wymiaryStrony(u);
            return t('kartka.wymiaryPapieru', { szer: zaokr(s.szer), wys: zaokr(s.wys) });
          })()}
        </p>

        <PoleLiczby
          id="strefa"
          etykieta={t('kartka.marginesBezpieczenstwa')}
          wartosc={u.marginesBezpieczenstwa ?? 0}
          min={0}
          max={20}
          krok={0.5}
          zmien={(v) =>
            zmien((p) => ustawUstawieniaArkusza(p, A, { marginesBezpieczenstwa: v }), {
              klucz: `strefa:${A}`,
            })
          }
        />
      </SekcjaPanelu>

      {/* 2. Układ kart na arkuszu (otwarta) */}
      <PanelUkladu
        arkusz={arkusz}
        {...(wynik ? { wynik } : {})}
        zmienUklad={zmienUklad}
        {...(przelaczRozmiary ? { przelaczRozmiary } : {})}
        {...(naKartce ? { naKartce } : {})}
      />

      {/* 3. Linie cięcia (otwarta) */}
      <SekcjaLiniiCiecia arkusz={arkusz} zmien={zmien} />

      {/* 4. Druk dwustronny */}
      {!bezRewersow &&
        (() => {
          const rewersyMapa = new Map((projekt.rewersy ?? []).map((r) => [r.id, r] as const));
          const szablonyMapa = new Map(projekt.szablony.map((s) => [s.id, s] as const));
          const dwu = u.dwustronny ?? {
            ...DWUSTRONNY_DOMYSLNY,
            wlaczony: czyDwustronnyWlaczony(arkusz, talia, szablonyMapa, rewersyMapa),
          };
          const os = osOdwracania(wymiaryStrony(u), dwu.krawedz);
          const zmienDwu = (z: Partial<typeof dwu>, klucz?: string) =>
            zmien(
              (p) => ustawUstawieniaArkusza(p, A, { dwustronny: { ...dwu, ...z } }),
              klucz ? { klucz: `dwustronny:${A}:${klucz}` } : {},
            );
          return (
            <SekcjaPanelu tytul={t('dwustronny.tytul')} domyslnieOtwarta={dwu.wlaczony}>
              <label className="wybor">
                <input
                  type="checkbox"
                  checked={dwu.wlaczony}
                  onChange={(e) => zmienDwu({ wlaczony: e.target.checked })}
                />
                <span>{t('dwustronny.wlacz')}</span>
              </label>
              {dwu.wlaczony &&
                (() => {
                  const niezgodne = niezgodnosciDruku(projekt, arkusz.taliaId);
                  return niezgodne.length > 0 ? (
                    <div role="alert" className="uwaga" data-testid="niezgodne-rozmiary-druku">
                      <p>{t('zgodnosc.druk')}</p>
                      <ul>
                        {niezgodne.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null;
                })()}
              {dwu.wlaczony && (
                <>
                  <div className="pole-panelu">
                    <span id={`krawedz-${A}`}>{t('dwustronny.krawedz')}</span>
                    <div
                      className="przelacznik-segmentowy"
                      role="group"
                      aria-labelledby={`krawedz-${A}`}
                    >
                      {(['dluga', 'krotka'] as const).map((k: KrawedzOdwracania) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={dwu.krawedz === k}
                          onClick={() => zmienDwu({ krawedz: k }, 'krawedz')}
                        >
                          {t(`dwustronny.${k}`)}
                        </button>
                      ))}
                    </div>
                    <p className="podpis">
                      {os === 'pionowa' ? t('dwustronny.osPionowa') : t('dwustronny.osPozioma')}
                    </p>
                  </div>
                  <div className="pole-panelu dwa-pola">
                    <PoleLiczby
                      id="kalibracja-rewers-x"
                      etykieta={t('dwustronny.korektaX')}
                      wartosc={kalibracjaRewersu.x}
                      min={-MAKS_PRZESUNIECIA}
                      max={MAKS_PRZESUNIECIA}
                      krok={0.1}
                      zmien={(v) => zmienKalibracjeRewersu({ ...kalibracjaRewersu, x: v })}
                    />
                    <PoleLiczby
                      id="kalibracja-rewers-y"
                      etykieta={t('dwustronny.korektaY')}
                      wartosc={kalibracjaRewersu.y}
                      min={-MAKS_PRZESUNIECIA}
                      max={MAKS_PRZESUNIECIA}
                      krok={0.1}
                      zmien={(v) => zmienKalibracjeRewersu({ ...kalibracjaRewersu, y: v })}
                    />
                  </div>
                  <button
                    type="button"
                    className="druk-ui2-przycisk-pelny"
                    onClick={wydrukTestowyDwustronny}
                  >
                    {t('dwustronny.wydrukProbny')}
                  </button>
                </>
              )}
            </SekcjaPanelu>
          );
        })()}

      {/* 5. Karta w slocie */}
      <SekcjaKartyWSlocie arkusz={arkusz} zmienUklad={zmienUklad} />

      {/* 6. Tryb drukarni (spad) */}
      {(() => {
        const druk = u.drukarnia ?? DRUKARNIA_DOMYSLNA;
        const zmienDruk = (z: Partial<typeof druk>, klucz?: string) =>
          zmien(
            (p) => ustawUstawieniaArkusza(p, A, { drukarnia: { ...druk, ...z } }),
            klucz ? { klucz: `drukarnia:${A}:${klucz}` } : {},
          );
        const kartaWymiar = wynik?.slot ?? u.slot ?? SLOT_DOMYSLNY;
        const ostrzezeniaDpi = (wynik?.ostrzezenia ?? []).filter(
          (o) =>
            o.komunikat.startsWith('niska-rozdzielczosc-obrazu:') ||
            o.komunikat.startsWith('niska-rozdzielczosc-ramki:'),
        );
        return (
          <SekcjaPanelu tytul={t('drukarnia.tytul')} domyslnieOtwarta={druk.wlaczony}>
            <label className="wybor">
              <input
                type="checkbox"
                checked={druk.wlaczony}
                onChange={(e) => zmienDruk({ wlaczony: e.target.checked })}
              />
              <span>{t('drukarnia.wlacz')}</span>
            </label>
            {druk.wlaczony && (
              <>
                <div className="pole-panelu">
                  <PoleLiczby
                    id={`spad-${A}`}
                    etykieta={t('drukarnia.spad')}
                    wartosc={druk.spad}
                    min={0}
                    max={SPAD_MAKS}
                    krok={0.5}
                    zmien={(v) => zmienDruk({ spad: v }, 'spad')}
                  />
                </div>
                <label className="wybor">
                  <input
                    type="checkbox"
                    checked={druk.znacznikiCiecia}
                    onChange={(e) => zmienDruk({ znacznikiCiecia: e.target.checked }, 'znaczniki')}
                  />
                  <span>{t('drukarnia.znaczniki')}</span>
                </label>
                <div className="pole-panelu">
                  <label htmlFor={`uklad-drukarni-${A}`}>{t('drukarnia.uklad')}</label>
                  <select
                    id={`uklad-drukarni-${A}`}
                    value={druk.uklad}
                    onChange={(e) => zmienDruk({ uklad: e.target.value as UkladDrukarni }, 'uklad')}
                  >
                    {(['siatka', 'pojedyncza'] as const).map((uk: UkladDrukarni) => (
                      <option key={uk} value={uk}>
                        {t(`drukarnia.${uk}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="podpis">
                  {t('drukarnia.wymiary', {
                    nettoSzer: zaokr(kartaWymiar.szerokosc),
                    nettoWys: zaokr(kartaWymiar.wysokosc),
                    bruttoSzer: zaokr(kartaWymiar.szerokosc + 2 * druk.spad),
                    bruttoWys: zaokr(kartaWymiar.wysokosc + 2 * druk.spad),
                  })}
                </p>
                {ostrzezeniaDpi.length > 0 && (
                  <p role="status" className="uwaga">
                    {t('drukarnia.ostrzezenieDpi', { liczba: ostrzezeniaDpi.length })}
                  </p>
                )}
              </>
            )}
          </SekcjaPanelu>
        );
      })()}

      {/* 7. Tytuł arkusza */}
      <SekcjaPanelu tytul={t('druk.sekcja.tytulArkusza')} domyslnieOtwarta={false}>
        <div className="pole-panelu">
          <label htmlFor="tytul-kartki">{t('kartka.tytulKartki')}</label>
          <input
            id="tytul-kartki"
            type="text"
            value={tekstTytulu}
            disabled={polozenie === 'brak'}
            onChange={(e) => {
              ustawTekstTytulu(e.target.value);
              // Pusty tekst nie wyłącza tytułu (do tego jest „bez tytułu”) – czekamy na wpis.
              if (e.target.value.trim())
                zmienUklad((p) => ustawTytulArkusza(p, A, e.target.value), 'tytul');
            }}
          />
        </div>
        <div className="pole-panelu">
          <label htmlFor="polozenie-tytulu">{t('kartka.polozenieTytulu')}</label>
          <select
            id="polozenie-tytulu"
            value={polozenie}
            disabled={!u.tytul}
            onChange={(e) => {
              const x = e.target.value as 'lewo' | 'gora' | 'brak';
              if (!u.tytul) return;
              zmienUklad((p) =>
                ustawUstawieniaArkusza(p, A, {
                  tytul: {
                    ...u.tytul!,
                    tekst:
                      x === 'brak'
                        ? ''
                        : u.tytul!.tekst.trim() || tekstTytulu.trim() || arkusz.nazwa,
                    ...(x === 'brak' ? {} : { polozenie: x }),
                  },
                }),
              );
            }}
          >
            {(['lewo', 'gora', 'brak'] as const).map((x) => (
              <option key={x} value={x}>
                {t(`kartka.tytul.${x}`)}
              </option>
            ))}
          </select>
        </div>
      </SekcjaPanelu>

      {/* 8. Kalibracja drukarki */}
      <SekcjaKalibracji
        kalibracja={kalibracja}
        zmienKalibracje={zmienKalibracje}
        wydrukTestowy={wydrukTestowy}
      />

      {/* 9. Pobierz / Opcje PDF (otwarta) */}
      <SekcjaPanelu tytul={t('druk.sekcja.pobierz')} domyslnieOtwarta>
        {pobierz && (
          <>
            <button
              type="button"
              className="ui2-przycisk-glowny druk-ui2-przycisk-pelny"
              disabled={pobieranieWylaczone}
              onClick={() => pobierz({ rodzaj: 'pdf' })}
            >
              {t('druk.pobierzPdfPrzycisk')}
            </button>
            <div className="druk-ui2-pobierz-siatka">
              <button
                type="button"
                className="druk-ui2-przycisk-drugi"
                disabled={pobieranieWylaczone}
                onClick={() => pobierz({ rodzaj: 'strony', format: 'jpg' })}
              >
                {t('druk.pobierzStronyJpg')}
              </button>
              <button
                type="button"
                className="druk-ui2-przycisk-drugi"
                disabled={pobieranieWylaczone}
                onClick={() => pobierz({ rodzaj: 'strony', format: 'png' })}
              >
                {t('druk.pobierzStronyPng')}
              </button>
              <button
                type="button"
                className="druk-ui2-przycisk-drugi"
                disabled={pobieranieWylaczone}
                onClick={() => pobierz({ rodzaj: 'karty', format: 'jpg' })}
              >
                {t('druk.pobierzKartyJpg')}
              </button>
              <button
                type="button"
                className="druk-ui2-przycisk-drugi"
                disabled={pobieranieWylaczone}
                onClick={() => pobierz({ rodzaj: 'karty', format: 'png' })}
              >
                {t('druk.pobierzKartyPng')}
              </button>
            </div>
          </>
        )}
        <label className="wybor">
          <input
            type="checkbox"
            checked={warstwaTekstowaPdf}
            onChange={(e) => zmienWarstweTekstowaPdf(e.target.checked)}
          />
          <span>{t('pdf.warstwaTekstowa')}</span>
        </label>
      </SekcjaPanelu>

      {/* 10. Tyły talii (wybór z tyłów projektu i z Moich szablonów, bez „Nowy tył”) */}
      {talia && !bezRewersow && (
        <SekcjaPanelu tytul={t('rewers.przypisanieTalia')} domyslnieOtwarta={false}>
          <div className="pole-panelu">
            <select
              aria-label={t('rewers.przypisanieTalia')}
              value={typeof talia.rewersId === 'string' ? talia.rewersId : ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw.startsWith('bib:')) {
                  const wpis = rewersyZMoichSzablonow.find((w) => w.id === raw.slice(4));
                  if (!wpis || wpis.rodzaj !== 'rewers' || !wpis.rewers) return;
                  const przody = przodyDoPrzypisania(projekt, talia.id);
                  void potwierdzZgodnosc(przody, wpis.rewers).then((tak) => {
                    if (!tak) return;
                    zmien((p) => {
                      const dodany = dodajKopieRewersuDoProjektu(p, wpis);
                      return przypiszRewers(
                        dodany.projekt,
                        { rodzaj: 'talia', id: talia.id },
                        dodany.rewersId,
                      );
                    });
                  });
                  return;
                }
                const { id: v, zrodlo } = wybranaOpcja(e);
                const przody = przodyDoPrzypisania(projekt, talia.id);
                if (zrodlo === 'globalny') {
                  const wpis = rewersyGlobalne.find((w) => w.klucz === v);
                  if (wpis) {
                    void dolaczRewersGlobalnyDoProjektu(
                      wpis,
                      edycja,
                      (p, rid) => przypiszRewers(p, { rodzaj: 'talia', id: talia.id }, rid),
                      (r) => potwierdzZgodnosc(przody, r),
                    ).catch(() => undefined);
                  }
                  return;
                }
                const r = projekt.rewersy?.find((x) => x.id === v);
                void (r ? potwierdzZgodnosc(przody, r) : Promise.resolve(true)).then(
                  (tak) =>
                    tak &&
                    zmien((p) =>
                      przypiszRewers(p, { rodzaj: 'talia', id: talia.id }, v || undefined),
                    ),
                );
              }}
            >
              <option value="">{t('rewers.brakPrzypisania')}</option>
              {(projekt.rewersy ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nazwa}
                </option>
              ))}
              {rewersyZMoichSzablonow.length > 0 && (
                <optgroup label={t('karty.grupaZMoichSzablonow')}>
                  {rewersyZMoichSzablonow.map((r) => (
                    <option key={r.id} value={`bib:${r.id}`}>
                      {r.nazwa}
                    </option>
                  ))}
                </optgroup>
              )}
              <OpcjeRewersowGlobalnych lista={rewersyGlobalne} />
            </select>
          </div>
          <PodgladRewersu
            rewers={rewersTalii}
            zasoby={edycja.zasoby.zasoby}
            komunikatBraku={t('rewers.rozstrzygnietyBrak')}
            etykieta={t('rewers.podgladEtykieta')}
          />
        </SekcjaPanelu>
      )}
    </PanelSekcji>
  );
}
