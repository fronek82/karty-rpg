import { useId } from 'react';
import {
  dodajOdmiane,
  kluczZNazwy,
  kluczeSzablonu,
  maPolaWPrzelaczniku,
  zawartoscJakoOdmiana,
} from '../../dane/szablon';
import { t } from '../../i18n';
import {
  czyKontener,
  type Kontener,
  type Szablon,
  wartoscOdmiany,
  type Wezel,
} from '../../model/szablon';
import { nazwaWezla } from './DrzewoSzablonu';
import { Lista, Sekcja } from './Kontrolki';

/** Dziecko bez wartości odmiany (pusta = numer pozycji). */
function bezOdmiany(w: Wezel): Wezel {
  const { odmiana: _o, ...x } = w;
  void _o;
  return x as Wezel;
}

/**
 * Sekcja „Odmiany z danych” kontenera (N12): przełącznik pokazuje jedno dziecko – wybrane
 * wartością z danych karty (na tyle – z przełącznika przodu o tej samej nazwie).
 */
export function PanelOdmian({
  szablon,
  kontener,
  zmienWezel,
  zmienSzablon,
  bezDanych,
  zajeteKlucze,
}: {
  szablon: Szablon;
  kontener: Kontener;
  zmienWezel: (f: (w: Wezel) => Wezel, klucz?: string) => void;
  zmienSzablon: (f: (s: Szablon) => Szablon, klucz?: string) => void;
  bezDanych: boolean;
  zajeteKlucze: () => Iterable<string>;
}) {
  const idSekcji = useId();
  const p = kontener.przelacznik;
  const wartosci = kontener.dzieci.map((_, i) => wartoscOdmiany(kontener, i));
  const male = wartosci.map((v) => v.toLocaleLowerCase('pl'));
  const powtorzona = wartosci.find((_, i) => male.indexOf(male[i]!) !== i);

  const przelacz = (wlacz: boolean) =>
    zmienWezel((w) => {
      if (!czyKontener(w)) return w;
      if (!wlacz) {
        const { przelacznik: _p, ...x } = w;
        void _p;
        return { ...x, dzieci: w.dzieci.map(bezOdmiany) };
      }
      const nazwa = w.nazwa || t('odmiany.nazwaDomyslna');
      // Wiersz z polami (np. ikona + tekst): cała zawartość to pierwsza odmiana, nie każde pole.
      if (maPolaWPrzelaczniku(w))
        w = zawartoscJakoOdmiana(szablon, w, t('odmiany.nazwaOdmiany', { n: 1 }));
      return {
        ...w,
        nazwa,
        przelacznik: bezDanych
          ? {}
          : {
              klucz: kluczZNazwy(nazwa, new Set([...kluczeSzablonu(szablon), ...zajeteKlucze()])),
            },
        // Numery jawnie – zmiana kolejności dzieci nie zmienia już kart.
        dzieci: w.dzieci.map((d, i) => ({ ...d, odmiana: wartoscOdmiany(w, i) })),
      };
    });

  const zmienOdmiane = (i: number, v: string) =>
    zmienWezel((w) => {
      if (!czyKontener(w)) return w;
      return {
        ...w,
        dzieci: w.dzieci.map((d, j) =>
          j !== i ? d : v.trim() ? { ...d, odmiana: v } : bezOdmiany(d),
        ),
      };
    }, `odmiana:${kontener.id}:${i}`);

  return (
    <Sekcja tytul={t('odmiany.tytul')} otwarta={!!p}>
      <label className="wiersz-pola">
        <input type="checkbox" checked={!!p} onChange={(e) => przelacz(e.target.checked)} />
        {t('odmiany.wlacz')}
      </label>
      {p && (
        <>
          <p className="podpis">
            {bezDanych
              ? t('odmiany.opisTylu')
              : t('odmiany.opis', { kolumna: kontener.nazwa || p.klucz || '' })}
          </p>
          {!bezDanych && p.klucz && (
            <p className="podpis">{t('szablon.kluczDanych', { klucz: p.klucz })}</p>
          )}
          {kontener.dzieci.length === 0 && <p className="podpis">{t('odmiany.brakDzieci')}</p>}
          {kontener.dzieci.map((d, i) => {
            const id = `${idSekcji}-${i}`;
            return (
              <div key={d.id} className="pole-panelu">
                <label htmlFor={id}>{t('odmiany.wartosc', { nazwa: nazwaWezla(d) })}</label>
                <input
                  id={id}
                  value={d.odmiana ?? ''}
                  placeholder={String(i + 1)}
                  onChange={(e) => zmienOdmiane(i, e.target.value)}
                />
              </div>
            );
          })}
          {powtorzona && (
            <p className="uwaga">{t('odmiany.powtorzenie', { wartosc: powtorzona })}</p>
          )}
          {kontener.dzieci.length > 0 && (
            <Lista
              etykieta={t('odmiany.domyslna')}
              opcje={[
                { wartosc: '', tekst: t('odmiany.pierwsza') },
                // Powtórzona wartość – jedna pozycja (karta i tak pokaże pierwszą odmianę).
                ...kontener.dzieci.flatMap((d, i) =>
                  male.indexOf(male[i]!) === i
                    ? [{ wartosc: wartosci[i]!, tekst: `${wartosci[i]} – ${nazwaWezla(d)}` }]
                    : [],
                ),
              ]}
              wartosc={p.domyslna ?? ''}
              zmien={(v) =>
                zmienWezel((w) => {
                  if (!czyKontener(w) || !w.przelacznik) return w;
                  const { domyslna: _d, ...reszta } = w.przelacznik;
                  void _d;
                  return { ...w, przelacznik: v ? { ...reszta, domyslna: v } : reszta };
                })
              }
            />
          )}
          {maPolaWPrzelaczniku(kontener) && (
            <div className="pole-panelu">
              <p className="uwaga">{t('odmiany.polaOsobno')}</p>
              <button
                type="button"
                className="maly"
                onClick={() =>
                  zmienWezel((w) =>
                    czyKontener(w)
                      ? zawartoscJakoOdmiana(szablon, w, t('odmiany.nazwaOdmiany', { n: 1 }))
                      : w,
                  )
                }
              >
                {t('odmiany.zlozWOdmiane')}
              </button>
            </div>
          )}
          <div className="pole-panelu">
            <button
              type="button"
              className="maly"
              onClick={() =>
                zmienSzablon(
                  (s) =>
                    dodajOdmiane(
                      s,
                      kontener.id,
                      t('odmiany.nazwaOdmiany', { n: kontener.dzieci.length + 1 }),
                      t('szablon.kopia'),
                      zajeteKlucze(),
                    ).szablon,
                )
              }
            >
              {t('odmiany.dodaj')}
            </button>
            <p className="podpis">{t('odmiany.dodajOpis')}</p>
          </div>
          <p className="podpis">{t('odmiany.podglad')}</p>
        </>
      )}
    </Sekcja>
  );
}
