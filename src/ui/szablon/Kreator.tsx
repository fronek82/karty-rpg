import { useState } from 'react';
import { FORMATY_KART, UKLADY_STARTOWE, type UkladStartowy } from '../../dane/szablon';
import { formatujLiczbe, t } from '../../i18n';
import type { Mm } from '../../model/jednostki';

export interface UstawieniaNowegoSzablonu {
  nazwa: string;
  szer: Mm;
  wys: Mm;
  promien: Mm;
  tlo: string;
  uklad: UkladStartowy;
}

const zaokr = (x: number) => formatujLiczbe(x, 1);

/**
 * Kreator nowego szablonu – krok 1: nazwa, rozmiar (gotowy format albo własny w mm), orientacja,
 * zaokrąglenie rogów, kolor karty i neutralny układ startowy. Układ pól – w edytorze szablonu.
 */
export function Kreator({
  utworz,
  anuluj,
}: {
  utworz: (u: UstawieniaNowegoSzablonu) => Promise<void> | void;
  anuluj: () => void;
}) {
  const [nazwa, ustawNazwe] = useState(t('kreator.nazwaDomyslna'));
  const [format, ustawFormat] = useState<string>('poker');
  const [wlasny, ustawWlasny] = useState({ szer: 63, wys: 88 });
  const [pozioma, ustawPozioma] = useState(false);
  const [promien, ustawPromien] = useState(3);
  const [tlo, ustawTlo] = useState('#ffffff');
  const [uklad, ustawUklad] = useState<UkladStartowy>('swobodny');
  const [tworze, ustawTworze] = useState(false);
  const [blad, ustawBlad] = useState<string>();

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
  // Podgląd w skali: dłuższy bok 220 px.
  const skala = 220 / Math.max(wymiar.szer, wymiar.wys);

  return (
    <section className="kreator">
      <div className="kreator-formularz">
        <h1>{t('kreator.tytul')}</h1>
        <p className="podpis">{t('kreator.opis')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!poprawny || tworze) return;
            ustawTworze(true);
            ustawBlad(undefined);
            Promise.resolve(utworz({ nazwa: nazwa.trim(), ...wymiar, promien, tlo, uklad })).catch(
              (err: unknown) => {
                ustawTworze(false);
                ustawBlad(err instanceof Error ? err.message : String(err));
              },
            );
          }}
        >
          <div className="pole-panelu">
            <label htmlFor="kreator-nazwa">{t('kreator.nazwa')}</label>
            <input id="kreator-nazwa" value={nazwa} onChange={(e) => ustawNazwe(e.target.value)} />
          </div>
          <fieldset className="formaty">
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
          {blad && (
            <p role="alert" className="uwaga">
              {blad}
            </p>
          )}
          <p className="akcje-kreatora">
            <button type="button" onClick={anuluj}>
              {t('kreator.anuluj')}
            </button>
            <button type="submit" className="glowny" disabled={!poprawny || tworze}>
              {tworze ? t('start.tworze') : t('kreator.dalej')}
            </button>
          </p>
        </form>
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
