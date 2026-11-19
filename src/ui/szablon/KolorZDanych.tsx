import { kolumnySzablonu } from '../../dane/edycja';
import { t } from '../../i18n';
import { DOMYSLNE_TLO_KARTY, type KolorZDanych as Regula, type Szablon } from '../../model/szablon';
import { Lista, PoleKoloru, Sekcja } from './Kontrolki';

export function KolorZDanych({
  szablon,
  regula,
  kolor,
  zmien,
}: {
  szablon: Szablon;
  regula?: Regula;
  kolor?: string;
  zmien: (v: Regula | undefined, klucz?: string) => void;
}) {
  const domyslny = kolor && /^#[0-9a-f]{6}$/i.test(kolor) ? kolor : DOMYSLNE_TLO_KARTY;
  const pola = kolumnySzablonu(szablon)
    .filter((p) => p.typPola !== 'obraz')
    .map((p) => ({ wartosc: p.klucz, tekst: p.nazwa }));
  if (regula && !pola.some((p) => p.wartosc === regula.klucz))
    pola.push({ wartosc: regula.klucz, tekst: regula.klucz });

  const wartosci = regula?.mapa.map((w) => w.wartosc.trim()).filter(Boolean) ?? [];
  const konflikt = new Set(wartosci).size !== wartosci.length;

  return (
    <Sekcja tytul={t('koloryZDanych.tytul')}>
      {pola.length ? (
        <Lista
          etykieta={t('koloryZDanych.zrodlo')}
          opcje={[{ wartosc: '', tekst: t('koloryZDanych.staly') }, ...pola]}
          wartosc={regula?.klucz ?? ''}
          zmien={(klucz) =>
            zmien(klucz ? { ...(regula ?? { domyslny, mapa: [] }), klucz } : undefined)
          }
        />
      ) : (
        <p className="podpis">{t('koloryZDanych.brakPol')}</p>
      )}
      {regula && (
        <>
          <PoleKoloru
            etykieta={t('koloryZDanych.domyslny')}
            wartosc={regula.domyslny}
            moznaBrak={false}
            zmien={(v) => v && zmien({ ...regula, domyslny: v }, 'domyslny')}
          />
          {konflikt && <p className="uwaga">{t('koloryZDanych.konflikt')}</p>}
          {regula.mapa.map((w, i) => (
            <fieldset key={i} className="pole-panelu">
              <legend>{t('koloryZDanych.wiersz', { liczba: i + 1 })}</legend>
              <label>
                {t('koloryZDanych.wartosc')}
                <input
                  value={w.wartosc}
                  onChange={(e) =>
                    zmien(
                      {
                        ...regula,
                        mapa: regula.mapa.map((r, j) =>
                          i === j ? { ...r, wartosc: e.target.value } : r,
                        ),
                      },
                      `wartosc:${i}`,
                    )
                  }
                />
              </label>
              <PoleKoloru
                etykieta={t('koloryZDanych.kolor')}
                wartosc={w.kolor}
                moznaBrak={false}
                zmien={(v) =>
                  v &&
                  zmien(
                    {
                      ...regula,
                      mapa: regula.mapa.map((r, j) => (i === j ? { ...r, kolor: v } : r)),
                    },
                    `kolor:${i}`,
                  )
                }
              />
              <button
                type="button"
                className="maly"
                onClick={() => zmien({ ...regula, mapa: regula.mapa.filter((_, j) => i !== j) })}
              >
                {t('koloryZDanych.usun')}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="maly"
            onClick={() =>
              zmien({ ...regula, mapa: [...regula.mapa, { wartosc: '', kolor: regula.domyslny }] })
            }
          >
            {t('koloryZDanych.dodaj')}
          </button>
        </>
      )}
    </Sekcja>
  );
}
