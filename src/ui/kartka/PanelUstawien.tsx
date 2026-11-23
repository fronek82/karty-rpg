import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  roleProjektu,
  ustawRole,
  ustawTytulArkusza,
  ustawUstawieniaArkusza,
} from '../../dane/edycja';
import { BladDanych } from '../../dane/schemat';
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
import type { WynikArkusza } from '../../druk/arkusz';
import { osOdwracania } from '../../druk/dwustronny';
import { czyDwustronnyWlaczony, przypiszRewers } from '../../dane/rewers';
import { MAKS_PRZESUNIECIA, type Kalibracja } from '../kalibracja';
import { PodgladRewersu } from '../rewers/PodgladRewersu';
import { RewersyProjektu } from '../rewers/RewersyProjektu';
import {
  dolaczRewersGlobalnyDoProjektu,
  PRZEDROSTEK_OPCJI_GLOBALNEJ,
  useRewersyGlobalne,
} from '../rewersyGlobalne';
import {
  dolaczRodzineGlobalnaDoProjektu,
  useCzcionkiGlobalne,
  wgrajCzcionkiGlobalnie,
} from '../zasobyGlobalne';
import { KatalogGoogleFonts } from './KatalogGoogleFonts';
import { PanelUkladu } from './PanelUkladu';
import { PoleLiczby } from './PoleLiczby';
import { SzablonyProjektu } from './SzablonyProjektu';
import type { Projekt } from '../../model/projekt';
import type { ProjektWEdycji } from '../useProjekt';

/** Granice własnego papieru (mm) – jak w schemacie zapisu. */
const MIN_PAPIER = 20;
const MAX_PAPIER = 1000;

const zaokr = (x: number) => formatujLiczbe(x, 1);

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
 * Ustawienia kartki (wszystkich jej stron) i projektu: tytuł, kolor / czarno-biały, papier,
 * czcionki ról (z wgrywaniem własnych). `zmienUklad` odrzuca zmianę, po której karty nie
 * zmieściłyby się w siatce.
 */
export function PanelUstawien({
  edycja,
  arkusz,
  zmienUklad,
  nowaKartka,
  kartkaDlaSzablonu,
  zamknij,
  staly = false,
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
  bezRewersow = false,
}: {
  /** Gra z kartami jednostronnymi – bez rewersu talii i listy rewersów projektu. */
  bezRewersow?: boolean;
  przelaczRozmiary?: (tryb: 'jeden' | 'mieszane') => void;
  naKartce?: ComponentProps<typeof PanelUkladu>['naKartce'];
  kalibracja: ComponentProps<typeof PanelUkladu>['kalibracja'];
  zmienKalibracje: ComponentProps<typeof PanelUkladu>['zmienKalibracje'];
  kalibracjaRewersu: Kalibracja;
  zmienKalibracjeRewersu: (k: Kalibracja) => void;
  warstwaTekstowaPdf: boolean;
  zmienWarstweTekstowaPdf: (wlaczona: boolean) => void;
  /** Ostatnio zbudowana kartka (siatka startowa własnego układu). */
  wynik?: WynikArkusza;
  wydrukTestowy: () => void;
  wydrukTestowyDwustronny: () => void;
  /** Własne karty: nowa kartka dopasowana do rozmiaru szablonu. */
  kartkaDlaSzablonu?: (szablonId: string) => void;
  edycja: ProjektWEdycji;
  arkusz: Arkusz;
  zmienUklad: (f: (p: Projekt) => Projekt, klucz?: string) => boolean;
  nowaKartka?: () => void;
  zamknij?: () => void;
  /** Stały panel po prawej w widoku „Drukuj karty” – bez przycisku zamykania i bez przejmowania fokusu. */
  staly?: boolean;
  arkusze?: { id: string; nazwa: string }[];
  wybierzArkusz?: (id: string) => void;
  blad?: string;
}) {
  const { projekt, zmien } = edycja;
  const { rewersyGlobalne } = useRewersyGlobalne(projekt);
  const { rodzinyGlobalne } = useCzcionkiGlobalne(projekt);
  const u = arkusz.ustawienia;
  const [bladCzcionki, ustawBladCzcionki] = useState<string>();
  const [status, ustawStatus] = useState('');
  const plik = useRef<HTMLInputElement>(null);
  const naglowek = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!staly) naglowek.current?.focus();
  }, [staly]);
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
  // Tekst tytułu w polu (także przy „bez tytułu” – pamiętany do przywrócenia).
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

  const tytulPanelu = staly ? t('kartka.opcjeDruku') : t('kartka.ustawienia');

  return (
    <aside className="panel-edytora" aria-label={tytulPanelu}>
      <div className="naglowek-panelu">
        <h2 ref={naglowek} tabIndex={staly ? undefined : -1}>
          {tytulPanelu}
        </h2>
        {!staly && zamknij && (
          <button
            type="button"
            className="zamknij"
            aria-label={t('kartka.zamknijUstawienia')}
            onClick={zamknij}
          >
            ✕
          </button>
        )}
      </div>
      {arkusze && arkusze.length > 1 && wybierzArkusz && (
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
      )}
      <p className="podpis">{t('kartka.ustawieniaOpis', { kartka: arkusz.nazwa })}</p>
      {blad && (
        <p role="alert" className="blad-pola">
          {blad}
        </p>
      )}
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
                    x === 'brak' ? '' : u.tytul!.tekst.trim() || tekstTytulu.trim() || arkusz.nazwa,
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
      <div className="pole-panelu">
        <label htmlFor="papier">{t('kartka.papier')}</label>
        <select
          id="papier"
          value={u.papier}
          onChange={(e) => {
            const papier = e.target.value as Papier;
            zmienUklad((p) => ustawUstawieniaArkusza(p, A, zmianaPapieru(u, papier)));
          }}
        >
          {[...(Object.keys(PAPIERY) as Papier[]), 'wlasny' as const].map((x) => (
            <option key={x} value={x}>
              {t(`papier.${x}`)}
            </option>
          ))}
        </select>
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
        <p className="podpis">
          {(() => {
            const s = wymiaryStrony(u);
            return t('kartka.wymiaryPapieru', { szer: zaokr(s.szer), wys: zaokr(s.wys) });
          })()}
        </p>
      </div>
      <div className="pole-panelu">
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
        <p className="podpis">{t('kartka.marginesBezpieczenstwaOpis')}</p>
      </div>
      <PanelUkladu
        kalibracja={kalibracja}
        zmienKalibracje={zmienKalibracje}
        arkusz={arkusz}
        {...(wynik ? { wynik } : {})}
        zmienUklad={zmienUklad}
        wydrukTestowy={wydrukTestowy}
        {...(przelaczRozmiary ? { przelaczRozmiary } : {})}
        {...(naKartce ? { naKartce } : {})}
      />
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
            <fieldset className="sekcja-dwustronny">
              <legend>{t('dwustronny.tytul')}</legend>
              <label className="wybor">
                <input
                  type="checkbox"
                  checked={dwu.wlaczony}
                  onChange={(e) => zmienDwu({ wlaczony: e.target.checked })}
                />
                <span>{t('dwustronny.wlacz')}</span>
              </label>
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
                  <p className="podpis">{t('dwustronny.korektaOpis')}</p>
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
                  <button type="button" onClick={wydrukTestowyDwustronny}>
                    {t('dwustronny.wydrukProbny')}
                  </button>
                  <p className="podpis">{t('dwustronny.wydrukProbnyOpis')}</p>
                </>
              )}
            </fieldset>
          );
        })()}
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
          <fieldset className="sekcja-drukarni">
            <legend>{t('drukarnia.tytul')}</legend>
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
                  <p className="podpis">
                    {t(
                      druk.uklad === 'pojedyncza'
                        ? 'drukarnia.opisPojedyncza'
                        : 'drukarnia.opisSiatka',
                    )}
                  </p>
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
          </fieldset>
        );
      })()}
      <fieldset className="sekcja-pdf">
        <legend>{t('pdf.tytul')}</legend>
        <label className="wybor">
          <input
            type="checkbox"
            checked={warstwaTekstowaPdf}
            onChange={(e) => zmienWarstweTekstowaPdf(e.target.checked)}
          />
          <span>{t('pdf.warstwaTekstowa')}</span>
        </label>
        <p className="podpis">{t('pdf.warstwaTekstowaOpis')}</p>
      </fieldset>
      <fieldset className="sekcja-czcionek">
        <legend>{t('czcionki.tytul')}</legend>
        {roleProjektu(projekt).map((rola) => (
          <label key={rola} className="rola">
            <span>{tJesliJest(`rola.${rola}`) ?? rola}</span>
            <select
              aria-label={t('czcionki.rolaEtykieta', { rola: tJesliJest(`rola.${rola}`) ?? rola })}
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
        <button type="button" onClick={() => plik.current?.click()}>
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
        <KatalogGoogleFonts edycja={edycja} onStatus={ustawStatus} onBlad={ustawBladCzcionki} />
        <p role="status" aria-live="polite" className="podpis">
          {status}
        </p>
        {bladCzcionki && (
          <p role="alert" className="blad-pola">
            {bladCzcionki}
          </p>
        )}
      </fieldset>
      {talia && !bezRewersow && (
        <fieldset className="sekcja-szablonow">
          <legend>{t('rewers.przypisanieTalia')}</legend>
          <div className="pole-panelu">
            <select
              aria-label={t('rewers.przypisanieTalia')}
              value={typeof talia.rewersId === 'string' ? talia.rewersId : ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith(PRZEDROSTEK_OPCJI_GLOBALNEJ)) {
                  const klucz = v.slice(PRZEDROSTEK_OPCJI_GLOBALNEJ.length);
                  const wpis = rewersyGlobalne.find((w) => w.klucz === klucz);
                  if (wpis) {
                    void dolaczRewersGlobalnyDoProjektu(wpis, edycja, (p, rid) =>
                      przypiszRewers(p, { rodzaj: 'talia', id: talia.id }, rid),
                    ).catch(() => undefined);
                  }
                  return;
                }
                zmien((p) => przypiszRewers(p, { rodzaj: 'talia', id: talia.id }, v || undefined));
              }}
            >
              <option value="">{t('rewers.brakPrzypisania')}</option>
              {(projekt.rewersy ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nazwa}
                </option>
              ))}
              {rewersyGlobalne.length > 0 && (
                <optgroup label={t('rewersy.globalneGrupa')}>
                  {rewersyGlobalne.map((w) => (
                    <option key={w.klucz} value={`${PRZEDROSTEK_OPCJI_GLOBALNEJ}${w.klucz}`}>
                      {w.nazwa}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <PodgladRewersu
            rewers={rewersTalii}
            zasoby={edycja.zasoby.zasoby}
            komunikatBraku={t('rewers.rozstrzygnietyBrak')}
            etykieta={t('rewers.podgladEtykieta')}
          />
        </fieldset>
      )}
      {kartkaDlaSzablonu && (
        <SzablonyProjektu edycja={edycja} kartkaDlaSzablonu={kartkaDlaSzablonu} />
      )}
      {!bezRewersow && <RewersyProjektu edycja={edycja} />}
      {nowaKartka && (
        <p>
          <button type="button" onClick={nowaKartka}>
            {t('kartka.nowaKartka')}
          </button>
        </p>
      )}
    </aside>
  );
}
