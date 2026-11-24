import { useEffect, useId, useState } from 'react';
import type { WpisWymiarowSzablonu } from '../../dane/baza';
import { UKLADY_TYLU, type UkladTylu } from '../../dane/rewers';
import { FORMATY_KART, UKLADY_STARTOWE, type UkladStartowy } from '../../dane/szablon';
import { niezgodnosc, opisRozmiaru } from '../../dane/zgodnosc';
import { formatujLiczbe, t } from '../../i18n';
import type { Mm } from '../../model/jednostki';
import { baza } from '../bazaUI';

interface UstawieniaKarty {
  nazwa: string;
  szer: Mm;
  wys: Mm;
  promien: Mm;
  tlo: string;
}

export interface UstawieniaNowegoSzablonu extends UstawieniaKarty {
  uklad: UkladStartowy;
  /** Tył z innego projektu, który nowy przód ma mieć przypisany (kopia w projekcie przodu). */
  przypiszTyl?: { projektId: string; rewersId: string };
}

export interface UstawieniaNowegoTylu extends UstawieniaKarty {
  uklad: UkladTylu;
}

type PropsKreatora = { anuluj: () => void } & (
  | { strona?: 'przod'; utworz: (u: UstawieniaNowegoSzablonu) => Promise<void> | void }
  | { strona: 'tyl'; utworz: (u: UstawieniaNowegoTylu) => Promise<void> | void }
);

/** Szablony do „Rozmiar jak w szablonie” – z bazy przeglądarki (bez bazy: pusta lista). */
function useSzablonyZWymiarami(): WpisWymiarowSzablonu[] {
  const [lista, ustawListe] = useState<WpisWymiarowSzablonu[]>([]);
  useEffect(() => {
    let aktywny = true;
    void Promise.resolve()
      .then(() => baza().wymiarySzablonow())
      .then((l) => aktywny && ustawListe(l))
      .catch(() => undefined);
    return () => {
      aktywny = false;
    };
  }, []);
  return lista;
}

const kluczWpisu = (w: WpisWymiarowSzablonu) => `${w.strona}:${w.projektId}:${w.id}`;

const zaokr = (x: number) => formatujLiczbe(x, 1);

/**
 * Kreator nowego szablonu przodu albo tyłu – krok 1: nazwa, rozmiar (gotowy format, własny w mm
 * albo skopiowany z istniejącego szablonu), orientacja, zaokrąglenie rogów, kolor karty i układ
 * startowy (dla tyłu – własne gotowe układy). Dalsza praca – w edytorze karty.
 */
export function Kreator(props: PropsKreatora) {
  const { anuluj } = props;
  const tyl = props.strona === 'tyl';
  const idFormularza = useId();
  const [nazwa, ustawNazwe] = useState(tyl ? t('wlasne.rewersNazwa') : t('kreator.nazwaDomyslna'));
  const [format, ustawFormat] = useState<string>('poker');
  const [wlasny, ustawWlasny] = useState({ szer: 63, wys: 88 });
  const [pozioma, ustawPozioma] = useState(false);
  const [promien, ustawPromien] = useState(3);
  const [tlo, ustawTlo] = useState('#ffffff');
  const [uklad, ustawUklad] = useState<UkladStartowy>('swobodny');
  const [ukladTylu, ustawUkladTylu] = useState<UkladTylu>('pusty');
  const [tworze, ustawTworze] = useState(false);
  const [blad, ustawBlad] = useState<string>();
  const szablony = useSzablonyZWymiarami();
  // „Rozmiar jak w szablonie”: wybrany szablon; pola zablokowane do „Odblokuj”.
  const [kopiaZ, ustawKopiaZ] = useState<WpisWymiarowSzablonu>();
  const [odblokowane, ustawOdblokowane] = useState(false);
  const [przypiszTyl, ustawPrzypiszTyl] = useState(true);
  const zablokowane = !!kopiaZ && !odblokowane;
  const wybierzKopie = (klucz: string) => {
    const w = szablony.find((x) => kluczWpisu(x) === klucz);
    ustawKopiaZ(w);
    ustawOdblokowane(false);
    ustawPrzypiszTyl(true);
    if (!w) return;
    ustawFormat('wlasny');
    ustawWlasny({ szer: w.szer, wys: w.wys });
    // Tył bez własnych rogów (sprzed schematu 31) – rogi jak przód; kopiujemy 0.
    ustawPromien(w.promien ?? 0);
  };

  const bazowy =
    format === 'wlasny' ? wlasny : (FORMATY_KART.find((f) => f.id === format) ?? FORMATY_KART[0]);
  const krotszy = Math.min(bazowy.szer, bazowy.wys);
  const dluzszy = Math.max(bazowy.szer, bazowy.wys);
  const wymiar =
    format === 'wlasny'
      ? { szer: wlasny.szer, wys: wlasny.wys }
      : pozioma
        ? { szer: dluzszy, wys: krotszy }
        : { szer: krotszy, wys: dluzszy };
  const poprawny =
    nazwa.trim() !== '' &&
    wymiar.szer >= 10 &&
    wymiar.wys >= 10 &&
    wymiar.szer <= 300 &&
    wymiar.wys <= 300;
  const tylDoPrzypisania = !tyl && kopiaZ?.strona === 'tyl' ? kopiaZ : undefined;
  const roznica =
    tylDoPrzypisania && przypiszTyl
      ? niezgodnosc({ ...wymiar, promien }, tylDoPrzypisania)
      : undefined;
  // Podgląd w skali: dłuższy bok 220 px.
  const skala = 220 / Math.max(wymiar.szer, wymiar.wys);

  return (
    <section className="kreator">
      <div className="kreator-formularz">
        <h1>{tyl ? t('kreator.tytulTylu') : t('kreator.tytul')}</h1>
        <p className="podpis">{tyl ? t('kreator.opisTylu') : t('kreator.opis')}</p>
        <form
          id={idFormularza}
          onSubmit={(e) => {
            e.preventDefault();
            if (!poprawny || tworze) return;
            ustawTworze(true);
            ustawBlad(undefined);
            const wspolne = { nazwa: nazwa.trim(), ...wymiar, promien, tlo };
            Promise.resolve(
              props.strona === 'tyl'
                ? props.utworz({ ...wspolne, uklad: ukladTylu })
                : props.utworz({
                    ...wspolne,
                    uklad,
                    ...(tylDoPrzypisania && przypiszTyl
                      ? {
                          przypiszTyl: {
                            projektId: tylDoPrzypisania.projektId,
                            rewersId: tylDoPrzypisania.id,
                          },
                        }
                      : {}),
                  }),
            ).catch((err: unknown) => {
              ustawTworze(false);
              ustawBlad(err instanceof Error ? err.message : String(err));
            });
          }}
        >
          <div className="pole-panelu">
            <label htmlFor="kreator-nazwa">
              {tyl ? t('kreator.nazwaTylu') : t('kreator.nazwa')}
            </label>
            <input id="kreator-nazwa" value={nazwa} onChange={(e) => ustawNazwe(e.target.value)} />
          </div>
          <div className="pole-panelu">
            <label htmlFor="kreator-jak-w-szablonie">{t('kreator.jakWSzablonie')}</label>
            <select
              id="kreator-jak-w-szablonie"
              value={kopiaZ ? kluczWpisu(kopiaZ) : ''}
              onChange={(e) => wybierzKopie(e.target.value)}
            >
              <option value="">{t('kreator.nieKopiuj')}</option>
              {(['przod', 'tyl'] as const).map((strona) => {
                const grupa = szablony.filter((w) => w.strona === strona);
                return grupa.length === 0 ? null : (
                  <optgroup
                    key={strona}
                    label={strona === 'przod' ? t('kreator.grupaPrzody') : t('kreator.grupaTyly')}
                  >
                    {grupa.map((w) => (
                      <option key={kluczWpisu(w)} value={kluczWpisu(w)}>
                        {t('kreator.opcjaSzablonu', { nazwa: w.nazwa, rozmiar: opisRozmiaru(w) })}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
          {zablokowane && (
            <p className="kreator-kopia" role="status">
              <span>{t('kreator.skopiowaneZ', { nazwa: kopiaZ.nazwa })}</span>
              <button type="button" className="maly" onClick={() => ustawOdblokowane(true)}>
                {t('kreator.odblokuj')}
              </button>
            </p>
          )}
          {tylDoPrzypisania && (
            <label className="pole-wyboru">
              <input
                type="checkbox"
                checked={przypiszTyl}
                onChange={(e) => ustawPrzypiszTyl(e.target.checked)}
              />{' '}
              {t('kreator.przypiszTyl')}
            </label>
          )}
          {roznica && (
            <p role="alert" className="uwaga">
              {roznica.rozmiar || roznica.orientacja
                ? t('zgodnosc.rozmiar', {
                    przod: opisRozmiaru(wymiar),
                    tyl: opisRozmiaru(tylDoPrzypisania!),
                  })
                : t('zgodnosc.rogi', {
                    przod: zaokr(promien),
                    tyl: zaokr(tylDoPrzypisania!.promien ?? 0),
                  })}
            </p>
          )}
          <fieldset className="formaty" disabled={zablokowane}>
            <legend>{t('kreator.format')}</legend>
            {[...FORMATY_KART, { id: 'wlasny', szer: 0, wys: 0 }].map((f) => (
              <label key={f.id} className={`format${format === f.id ? ' wybrany' : ''}`}>
                <input
                  type="radio"
                  name="format"
                  value={f.id}
                  checked={format === f.id}
                  onChange={() => ustawFormat(f.id)}
                />
                <span
                  className="format-ksztalt"
                  aria-hidden="true"
                  style={
                    f.id === 'wlasny'
                      ? { width: 30, height: 30, borderStyle: 'dashed' }
                      : { width: f.szer / 2.4, height: f.wys / 2.4 }
                  }
                />
                <span>{t(`kreator.format.${f.id}` as 'kreator.format.poker')}</span>
                {f.id !== 'wlasny' && (
                  <small className="podpis">
                    {t('rozmiar.mm', { szer: zaokr(f.szer), wys: zaokr(f.wys) })}
                  </small>
                )}
              </label>
            ))}
          </fieldset>
          {format === 'wlasny' ? (
            <div className="pole-panelu dwa-pola">
              {(['szer', 'wys'] as const).map((os) => (
                <label key={os}>
                  {t(os === 'szer' ? 'kreator.szerokosc' : 'kreator.wysokosc')}
                  <input
                    type="number"
                    min={10}
                    max={300}
                    step={0.5}
                    disabled={zablokowane}
                    value={wlasny[os]}
                    onChange={(e) =>
                      ustawWlasny((w) => ({ ...w, [os]: e.target.valueAsNumber || 0 }))
                    }
                  />
                </label>
              ))}
            </div>
          ) : (
            <div className="pole-panelu">
              <span id="kreator-orientacja">{t('kartka.orientacja')}</span>
              <div
                className="przelacznik-segmentowy"
                role="group"
                aria-labelledby="kreator-orientacja"
              >
                <button type="button" aria-pressed={!pozioma} onClick={() => ustawPozioma(false)}>
                  {t('kartka.orientacja.pionowa')}
                </button>
                <button type="button" aria-pressed={pozioma} onClick={() => ustawPozioma(true)}>
                  {t('kartka.orientacja.pozioma')}
                </button>
              </div>
            </div>
          )}
          <div className="pole-panelu dwa-pola">
            <label>
              {t('kreator.promien')}
              <input
                type="number"
                min={0}
                max={20}
                step={0.5}
                disabled={zablokowane}
                value={promien}
                onChange={(e) =>
                  ustawPromien(
                    Math.min(
                      Math.max(0, e.target.valueAsNumber || 0),
                      Math.min(wymiar.szer, wymiar.wys) / 2,
                    ),
                  )
                }
              />
            </label>
            <label>
              {t('kreator.kolor')}
              <input type="color" value={tlo} onChange={(e) => ustawTlo(e.target.value)} />
            </label>
          </div>
          {tyl ? (
            <fieldset className="uklady">
              <legend>{t('kreator.uklad')}</legend>
              {UKLADY_TYLU.map((u) => (
                <label key={u} className={`uklad${ukladTylu === u ? ' wybrany' : ''}`}>
                  <input
                    type="radio"
                    name="uklad"
                    value={u}
                    checked={ukladTylu === u}
                    onChange={() => ustawUkladTylu(u)}
                  />
                  <span
                    className={`uklad-miniatura uklad-tylu-${u}`}
                    aria-hidden="true"
                    style={{ background: tlo }}
                  >
                    {u === 'logo' && <i className="m-logo" />}
                    {u === 'ornament' && <i className="m-ramka" />}
                  </span>
                  <span>{t(`kreator.ukladTylu.${u}`)}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <fieldset className="uklady">
              <legend>{t('kreator.uklad')}</legend>
              {UKLADY_STARTOWE.map((u) => (
                <label key={u} className={`uklad${uklad === u ? ' wybrany' : ''}`}>
                  <input
                    type="radio"
                    name="uklad"
                    value={u}
                    checked={uklad === u}
                    onChange={() => ustawUklad(u)}
                  />
                  <span
                    className={`uklad-miniatura uklad-${u}`}
                    aria-hidden="true"
                    style={{ background: tlo }}
                  >
                    {u === 'swobodny' && (
                      <>
                        <i className="m-s1" />
                        <i className="m-s2" />
                        <i className="m-s3" />
                      </>
                    )}
                    {u !== 'pusty' && u !== 'swobodny' && <i className="m-tytul" />}
                    {u === 'tytul-siatka-opis-stopka' && <i className="m-siatka" />}
                    {u !== 'pusty' && u !== 'swobodny' && <i className="m-opis" />}
                    {u === 'tytul-siatka-opis-stopka' && <i className="m-stopka" />}
                  </span>
                  <span>{t(`kreator.uklad.${u}`)}</span>
                </label>
              ))}
            </fieldset>
          )}
          {blad && (
            <p role="alert" className="uwaga">
              {blad}
            </p>
          )}
        </form>
      </div>
      <div className="start-menu" role="group" aria-labelledby={`${idFormularza}-akcje`}>
        <p id={`${idFormularza}-akcje`} className="etykieta-sekcji">
          {t('kreator.akcje')}
        </p>
        <button
          type="submit"
          form={idFormularza}
          className="pasek-menu pasek-wlasne-4"
          disabled={!poprawny || tworze}
        >
          <b>{tworze ? t('start.tworze') : tyl ? t('kreator.dalejTylu') : t('kreator.dalej')}</b>
        </button>
        <button type="button" className="pasek-menu pasek-neutralny" onClick={anuluj}>
          <b>{t('kreator.anuluj')}</b>
        </button>
      </div>
      <aside className="kreator-podglad" aria-label={t('kreator.podglad')}>
        <h2>{t('kreator.podglad')}</h2>
        <div
          className="kreator-karta"
          style={{
            width: wymiar.szer * skala,
            height: wymiar.wys * skala,
            borderRadius: promien * skala,
            background: tlo,
          }}
        />
        <p className="podpis">
          {t('rozmiar.mm', { szer: zaokr(wymiar.szer), wys: zaokr(wymiar.wys) })}
        </p>
      </aside>
    </section>
  );
}
