import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { dodajKopieRewersuDoProjektu } from '../../dane/aktualizacjaSzablonu';
import type { WpisSzablonu } from '../../dane/bibliotekaSzablonow';
import {
  roleProjektu,
  ustawRole,
  ustawTytulArkusza,
  ustawUstawieniaArkusza,
} from '../../dane/edycja';
import { czyDwustronnyWlaczony, przypiszRewers } from '../../dane/rewers';
import { BladDanych } from '../../dane/schemat';
import type { WynikArkusza } from '../../druk/arkusz';
import { osOdwracania } from '../../druk/dwustronny';
import { formatujLiczbe, t, tJesliJest } from '../../i18n';
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
import {
  dolaczRodzineGlobalnaDoProjektu,
  useCzcionkiGlobalne,
  wgrajCzcionkiGlobalnie,
} from '../zasobyGlobalne';
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

const KAFELKI_PAPIEROW: readonly {
  id: Papier;
  nazwa?: string;
  wymiary?: string;
  szer: number;
  wys: number;
}[] = [
  { id: 'A4', nazwa: 'A4', wymiary: '210×297', szer: 210, wys: 297 },
  { id: 'Letter', nazwa: 'Letter', wymiary: '216×279', szer: 216, wys: 279 },
  { id: 'A5', nazwa: 'A5', wymiary: '148×210', szer: 148, wys: 210 },
  { id: 'foto-10x15', nazwa: '10×15', wymiary: '102×152', szer: 102, wys: 152 },
  { id: 'foto-13x18', nazwa: '13×18', wymiary: '127×178', szer: 127, wys: 178 },
  { id: 'foto-15x21', nazwa: '15×21', wymiary: '152×210', szer: 152, wys: 210 },
  { id: 'wlasny', szer: 200, wys: 280 },
];

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

const komunikat = (e: unknown) =>
  e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e);

/**
 * Prawy panel „Ustawienia druku” w stylu UI2 (R12, wzór: docs/makiety-ui2/Druk.dc.html, sekcja 5.6 i 14.1).
 * Korzysta ze wspólnego komponentu `PanelSekcji` z sekcjami zwijanymi `SekcjaPanelu`.
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
  pobierzWylaczone = false,
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
  pobierz?: (co: CoPobrac) => void;
  pobierzWylaczone?: boolean;
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
  const { rodzinyGlobalne } = useCzcionkiGlobalne(projekt);
  const [wpisySzablonow, ustawWpisySzablonow] = useState<WpisSzablonu[]>([]);
  const u = arkusz.ustawienia;
  const mieszane = u.rozmiary === 'mieszane';
  const [bladCzcionki, ustawBladCzcionki] = useState<string>();
  const [status, ustawStatus] = useState('');
  const plik = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let aktywny = true;
    void baza()
      .szablonyBiblioteki()
      .then((lista) => {
        if (aktywny) ustawWpisySzablonow(lista);
      })
      .catch(() => undefined);
    return () => {
      aktywny = false;
    };
  }, []);

  const zrodlaRewersowWProjekcie = useMemo(
    () => new Set((projekt.rewersy ?? []).map((r) => r.zrodlo?.id).filter((x): x is string => !!x)),
    [projekt.rewersy],
  );
  const rewersyZBiblioteki = useMemo(
    () =>
      wpisySzablonow.filter((w) => w.rodzaj === 'rewers' && !zrodlaRewersowWProjekcie.has(w.id)),
    [wpisySzablonow, zrodlaRewersowWProjekcie],
  );

  const rodziny = [
    ...new Set(projekt.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [z.rodzina] : []))),
  ];
  const A = arkusz.id;
  const talia = projekt.talie.find((x) => x.id === arkusz.taliaId);
  const rewersTalii =
    typeof talia?.rewersId === 'string'
      ? projekt.rewersy?.find((r) => r.id === talia.rewersId)
      : undefined;
  const polozenie = !u.tytul || !u.tytul.tekst.trim() ? 'brak' : u.tytul.polozenie;
  const [tekstTytulu, ustawTekstTytulu] = useState(u.tytul?.tekst || arkusz.nazwa);

  const wgraj = async (pliki: File[]) => {
    ustawBladCzcionki(undefined);
    try {
      const opisy = await wgrajCzcionkiGlobalnie(pliki, edycja);
      ustawStatus(t('czcionki.wgrano', { lista: opisy.join(', ') }));
    } catch (e) {
      ustawBladCzcionki(komunikat(e));
    }
  };

  const rewersyMapa = useMemo(
    () => new Map((projekt.rewersy ?? []).map((r) => [r.id, r] as const)),
    [projekt.rewersy],
  );
  const szablonyMapa = useMemo(
    () => new Map(projekt.szablony.map((s) => [s.id, s] as const)),
    [projekt.szablony],
  );
  const dwu = u.dwustronny ?? {
    ...DWUSTRONNY_DOMYSLNY,
    wlaczony: !bezRewersow && czyDwustronnyWlaczony(arkusz, talia, szablonyMapa, rewersyMapa),
  };
  const os = osOdwracania(wymiaryStrony(u), dwu.krawedz);
  const zmienDwu = (z: Partial<typeof dwu>, klucz?: string) =>
    zmien(
      (p) => ustawUstawieniaArkusza(p, A, { dwustronny: { ...dwu, ...z } }),
      klucz ? { klucz: `dwustronny:${A}:${klucz}` } : {},
    );

  const drukarnia = u.drukarnia ?? DRUKARNIA_DOMYSLNA;
  const zmienDrukarnie = (z: Partial<typeof drukarnia>, klucz?: string) =>
    zmien(
      (p) => ustawUstawieniaArkusza(p, A, { drukarnia: { ...drukarnia, ...z } }),
      klucz ? { klucz: `drukarnia:${A}:${klucz}` } : {},
    );
  const kartaWymiar = wynik?.slot ?? u.slot ?? SLOT_DOMYSLNY;
  const ostrzezeniaDpi = (wynik?.ostrzezenia ?? []).filter(
    (o) =>
      o.komunikat.startsWith('niska-rozdzielczosc-obrazu:') ||
      o.komunikat.startsWith('niska-rozdzielczosc-ramki:'),
  );
  const wymStrony = wymiaryStrony(u);

  return (
    <PanelSekcji tytul={t('druk.ustawieniaDruku')} etykietaAria={t('kartka.opcjeDruku')}>
      {oknoZgodnosci}
      {arkusze && arkusze.length > 1 && wybierzArkusz && (
        <div className="druk-ui2-wybor-arkusza">
          <div className="pole-panelu">
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
        </div>
      )}
      {blad && (
        <p role="alert" className="blad-pola druk-ui2-blad-panelu">
          {blad}
        </p>
      )}

      <SekcjaPanelu tytul={t('druk.sekcja.papier')} domyslnieOtwarta={true}>
        <div className="druk-ui2-sekcja-tresc">
          <div className="druk-ui2-papiery" role="group" aria-label={t('kartka.papier')}>
            {KAFELKI_PAPIEROW.map((p) => {
              const aktywny = u.papier === p.id;
              const f = 26 / Math.max(p.szer, p.wys);
              const iw = Math.round(p.szer * f);
              const ih = Math.round(p.wys * f);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="druk-ui2-papier-kafelek"
                  data-papier={p.id}
                  aria-pressed={aktywny}
                  aria-label={t(`papier.${p.id}`)}
                  onClick={() =>
                    zmienUklad((pr) => ustawUstawieniaArkusza(pr, A, zmianaPapieru(u, p.id)))
                  }
                >
                  <span
                    className="druk-ui2-papier-ikona"
                    style={{ width: iw, height: ih }}
                    aria-hidden="true"
                  />
                  <span className="druk-ui2-papier-nazwa">
                    {p.nazwa ?? t('druk.papierWlasnySkrot')}
                  </span>
                  <span className="druk-ui2-papier-mm">{p.wymiary ?? '… mm'}</span>
                </button>
              );
            })}
          </div>

          {u.papier === 'wlasny' && (
            <div className="pole-panelu dwa-pola">
              {(['szer', 'wys'] as const).map((osPapieru) => (
                <PoleLiczby
                  key={osPapieru}
                  id={`papier-${osPapieru}`}
                  etykieta={t(
                    osPapieru === 'szer' ? 'kartka.szerokoscPapieru' : 'kartka.wysokoscPapieru',
                  )}
                  wartosc={(u.wymiaryPapieru ?? PAPIERY.A4)[osPapieru]}
                  min={MIN_PAPIER}
                  max={MAX_PAPIER}
                  zmien={(v) => {
                    const w = { ...(u.wymiaryPapieru ?? PAPIERY.A4), [osPapieru]: v };
                    zmienUklad(
                      (p) => ustawUstawieniaArkusza(p, A, { wymiaryPapieru: w }),
                      'papier',
                    );
                  }}
                />
              ))}
            </div>
          )}

          <div className="pole-panelu dwa-pola">
            <div className="pole-panelu">
              <span id="orientacja">{t('kartka.orientacja')}</span>
              <div className="przelacznik-segmentowy" role="group" aria-labelledby="orientacja">
                {(['pionowa', 'pozioma'] as const).map((x) => (
                  <button
                    key={x}
                    type="button"
                    aria-pressed={u.orientacja === x}
                    onClick={() =>
                      zmienUklad((p) => ustawUstawieniaArkusza(p, A, { orientacja: x }))
                    }
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
            {t('kartka.wymiaryPapieru', { szer: zaokr(wymStrony.szer), wys: zaokr(wymStrony.wys) })}
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
        </div>
      </SekcjaPanelu>

      <SekcjaPanelu tytul={t('druk.sekcja.uklad')} domyslnieOtwarta={true}>
        <PanelUkladu
          arkusz={arkusz}
          {...(wynik ? { wynik } : {})}
          zmienUklad={zmienUklad}
          {...(przelaczRozmiary ? { przelaczRozmiary } : {})}
          {...(naKartce ? { naKartce } : {})}
        />
      </SekcjaPanelu>

      <SekcjaLiniiCiecia arkusz={arkusz} zmien={zmien} />

      {!bezRewersow && (
        <SekcjaPanelu tytul={t('dwustronny.tytul')} domyslnieOtwarta={dwu.wlaczony}>
          <div className="sekcja-dwustronny druk-ui2-sekcja-tresc">
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
                  className="druk-ui2-przycisk-kontur"
                  onClick={wydrukTestowyDwustronny}
                >
                  {t('dwustronny.wydrukProbny')}
                </button>
              </>
            )}
          </div>
        </SekcjaPanelu>
      )}

      {!mieszane && (
        <SekcjaPanelu tytul={t('dopasowanie.tytul')} domyslnieOtwarta={false}>
          <SekcjaKartyWSlocie arkusz={arkusz} zmienUklad={zmienUklad} />
        </SekcjaPanelu>
      )}

      <SekcjaPanelu tytul={t('drukarnia.tytul')} domyslnieOtwarta={drukarnia.wlaczony}>
        <div className="sekcja-drukarni druk-ui2-sekcja-tresc">
          <label className="wybor">
            <input
              type="checkbox"
              checked={drukarnia.wlaczony}
              onChange={(e) => zmienDrukarnie({ wlaczony: e.target.checked })}
            />
            <span>{t('drukarnia.wlacz')}</span>
          </label>
          {drukarnia.wlaczony && (
            <>
              <div className="pole-panelu">
                <PoleLiczby
                  id={`spad-${A}`}
                  etykieta={t('drukarnia.spad')}
                  wartosc={drukarnia.spad}
                  min={0}
                  max={SPAD_MAKS}
                  krok={0.5}
                  zmien={(v) => zmienDrukarnie({ spad: v }, 'spad')}
                />
              </div>
              <label className="wybor">
                <input
                  type="checkbox"
                  checked={drukarnia.znacznikiCiecia}
                  onChange={(e) =>
                    zmienDrukarnie({ znacznikiCiecia: e.target.checked }, 'znaczniki')
                  }
                />
                <span>{t('drukarnia.znaczniki')}</span>
              </label>
              <div className="pole-panelu">
                <label htmlFor={`uklad-drukarni-${A}`}>{t('drukarnia.uklad')}</label>
                <select
                  id={`uklad-drukarni-${A}`}
                  value={drukarnia.uklad}
                  onChange={(e) =>
                    zmienDrukarnie({ uklad: e.target.value as UkladDrukarni }, 'uklad')
                  }
                >
                  {(['siatka', 'pojedyncza'] as const).map((uk: UkladDrukarni) => (
                    <option key={uk} value={uk}>
                      {t(`drukarnia.${uk}`)}
                    </option>
                  ))}
                </select>
                <p className="podpis">
                  {t(
                    drukarnia.uklad === 'pojedyncza'
                      ? 'drukarnia.opisPojedyncza'
                      : 'drukarnia.opisSiatka',
                  )}
                </p>
              </div>
              <p className="podpis">
                {t('drukarnia.wymiary', {
                  nettoSzer: zaokr(kartaWymiar.szerokosc),
                  nettoWys: zaokr(kartaWymiar.wysokosc),
                  bruttoSzer: zaokr(kartaWymiar.szerokosc + 2 * drukarnia.spad),
                  bruttoWys: zaokr(kartaWymiar.wysokosc + 2 * drukarnia.spad),
                })}
              </p>
              {ostrzezeniaDpi.length > 0 && (
                <p role="status" className="uwaga">
                  {t('drukarnia.ostrzezenieDpi', { liczba: ostrzezeniaDpi.length })}
                </p>
              )}
            </>
          )}
        </div>
      </SekcjaPanelu>

      <SekcjaPanelu tytul={t('druk.sekcja.tytulArkusza')} domyslnieOtwarta={false}>
        <div className="druk-ui2-sekcja-tresc">
          <div className="pole-panelu">
            <label htmlFor="tytul-kartki">{t('kartka.tytulKartki')}</label>
            <input
              id="tytul-kartki"
              type="text"
              value={tekstTytulu}
              disabled={polozenie === 'brak'}
              onChange={(e) => {
                ustawTekstTytulu(e.target.value);
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
        </div>
      </SekcjaPanelu>

      <SekcjaPanelu tytul={t('uklad.kalibracja')} domyslnieOtwarta={false}>
        <SekcjaKalibracji
          kalibracja={kalibracja}
          zmienKalibracje={zmienKalibracje}
          wydrukTestowy={wydrukTestowy}
        />
      </SekcjaPanelu>

      <SekcjaPanelu tytul={t('druk.sekcja.pobierz')} domyslnieOtwarta={true}>
        <div className="sekcja-pdf druk-ui2-sekcja-tresc">
          {pobierz && (
            <>
              <button
                type="button"
                className="druk-ui2-pobierz-glowny"
                disabled={pobierzWylaczone}
                onClick={() => pobierz({ rodzaj: 'pdf' })}
              >
                {t('druk.pdfDoDruku')}
              </button>
              <div className="druk-ui2-pobierz-para">
                <button
                  type="button"
                  className="druk-ui2-przycisk-kontur"
                  disabled={pobierzWylaczone}
                  onClick={() => pobierz({ rodzaj: 'strony', format: 'png' })}
                >
                  {t('druk.stronyObrazy')}
                </button>
                <button
                  type="button"
                  className="druk-ui2-przycisk-kontur"
                  disabled={pobierzWylaczone}
                  onClick={() => pobierz({ rodzaj: 'karty', format: 'png' })}
                >
                  {t('druk.kartyZip')}
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
        </div>
      </SekcjaPanelu>

      {talia && !bezRewersow && (
        <SekcjaPanelu tytul={t('druk.sekcja.tylyTalii')} domyslnieOtwarta={false}>
          <div className="sekcja-szablonow druk-ui2-sekcja-tresc">
            <div className="pole-panelu">
              <label htmlFor="domyslny-tyl-talii">{t('rewers.przypisanieTalia')}</label>
              <select
                id="domyslny-tyl-talii"
                aria-label={t('rewers.przypisanieTalia')}
                value={typeof talia.rewersId === 'string' ? talia.rewersId : ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const przody = przodyDoPrzypisania(projekt, talia.id);
                  if (raw.startsWith('bib:')) {
                    const idBib = raw.slice(4);
                    const wpis = rewersyZBiblioteki.find((w) => w.id === idBib);
                    if (!wpis || !wpis.rewers) return;
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
                {(projekt.rewersy ?? []).length > 0 && (
                  <optgroup label={t('karty.grupaWProjekcie')}>
                    {(projekt.rewersy ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nazwa}
                      </option>
                    ))}
                  </optgroup>
                )}
                {rewersyZBiblioteki.length > 0 && (
                  <optgroup label={t('karty.grupaZMoichSzablonow')}>
                    {rewersyZBiblioteki.map((r) => (
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
          </div>
        </SekcjaPanelu>
      )}

      {roleProjektu(projekt).length > 0 && (
        <SekcjaPanelu tytul={t('czcionki.tytul')} domyslnieOtwarta={false}>
          <div className="sekcja-czcionek druk-ui2-sekcja-tresc">
            {roleProjektu(projekt).map((rola) => (
              <label key={rola} className="rola">
                <span>{tJesliJest(`rola.${rola}`) ?? rola}</span>
                <select
                  aria-label={t('czcionki.rolaEtykieta', {
                    rola: tJesliJest(`rola.${rola}`) ?? rola,
                  })}
                  value={projekt.role[rola] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v && rodzinyGlobalne.includes(v)) {
                      void dolaczRodzineGlobalnaDoProjektu(v, edycja, (p) =>
                        ustawRole(p, rola, v),
                      ).catch(() => undefined);
                      return;
                    }
                    zmienUklad((p) => ustawRole(p, rola, v));
                  }}
                >
                  <option value="">{t('czcionki.brakRodziny')}</option>
                  {rodziny.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  {rodzinyGlobalne.length > 0 && (
                    <optgroup label={t('czcionki.globalneGrupa')}>
                      {rodzinyGlobalne.map((r) => (
                        <option key={`g:${r}`} value={r}>
                          {r}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
            ))}
            <button
              type="button"
              className="druk-ui2-przycisk-kontur"
              onClick={() => plik.current?.click()}
            >
              {t('kartka.wgrajCzcionke')}
            </button>
            <input
              ref={plik}
              type="file"
              multiple
              accept=".ttf,.otf,.woff,.woff2"
              hidden
              data-testid="plik-czcionki"
              onChange={(e) => {
                const f = [...(e.target.files ?? [])];
                e.target.value = '';
                if (f.length) void wgraj(f);
              }}
            />
            {status && (
              <p role="status" aria-live="polite" className="podpis">
                {status}
              </p>
            )}
            {bladCzcionki && (
              <p role="alert" className="blad-pola">
                {bladCzcionki}
              </p>
            )}
          </div>
        </SekcjaPanelu>
      )}
    </PanelSekcji>
  );
}
