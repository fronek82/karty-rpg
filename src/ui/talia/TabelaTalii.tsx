import { useMemo, useState } from 'react';
import {
  dodajKarte,
  kolumnySzablonu as kolumnyJednego,
  kolumnyTalii,
  kopiujKarte,
  przesunKarte,
  rozmiaryKarty,
  usunKarte,
  ustawDane,
  ustawIlosc,
  ustawNazweTalii,
  ustawRozmiar,
  ustawSzablon,
  type KolumnaDanych,
} from '../../dane/edycja';
import { t, tJesliJest } from '../../i18n';
import type { Karta, Szablon, Talia } from '../../model/szablon';
import type { ProjektWEdycji } from '../useProjekt';

const r = (x: { kolumny: number; rzedy: number }) => `${x.kolumny}×${x.rzedy}`;

/** Czy szablon karty ma daną kolumnę (pole z kluczem albo parametr). */
function maKolumne(
  s: Szablon | undefined,
  k: KolumnaDanych,
  kolumnySzablonu: Map<string, Set<string>>,
) {
  return !!s && !!kolumnySzablonu.get(s.id)?.has(k.klucz);
}

export interface WlasciwosciTabeli {
  edycja: ProjektWEdycji;
  talia: Talia;
  /** Zaznaczona karta (podgląd obok tabeli – E7c). */
  wybrana?: string;
  wybierz?: (kartaId: string) => void;
}

/**
 * Tabela danych talii: wiersz = karta, kolumny = pola i parametry szablonów talii + „Ilość”.
 * Komórka pola, którego szablon karty nie ma, jest nieaktywna.
 */
export function TabelaTalii({ edycja, talia, wybrana, wybierz }: WlasciwosciTabeli) {
  const { projekt, zmien } = edycja;
  const szablony = useMemo(
    () => new Map(projekt.szablony.map((s) => [s.id, s])),
    [projekt.szablony],
  );
  // Nazwy kolumn pól: z i18n (`pole.<klucz>`), gdy jest; inaczej z klucza. Parametry mają nazwę w szablonie.
  const kolumny = useMemo(
    () =>
      kolumnyTalii(talia, szablony).map((k) =>
        k.rodzaj === 'pole' ? { ...k, nazwa: tJesliJest(`pole.${k.klucz}`) ?? k.nazwa } : k,
      ),
    [talia, szablony],
  );
  const kolumnySzablonu = useMemo(
    () =>
      new Map(projekt.szablony.map((s) => [s.id, new Set(kolumnyJednego(s).map((k) => k.klucz))])),
    [projekt.szablony],
  );
  const grupaKarty = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of talia.grupy ?? []) for (const id of g.karty) m.set(id, g.naglowek);
    return m;
  }, [talia.grupy]);
  const [nowySzablon, ustawNowySzablon] = useState(
    () => talia.karty.at(-1)?.szablonId ?? projekt.szablony[0]?.id ?? '',
  );
  const T = talia.id;
  const obrazy = projekt.zasoby.filter((z) => z.rodzaj === 'obraz');
  const sztuk = talia.karty.reduce((s, k) => s + k.ilosc, 0);

  const dodaj = () => {
    if (!nowySzablon) return;
    // Id nowej karty liczone z bieżącego projektu – to samo policzy updater stanu.
    const { kartaId } = dodajKarte(projekt, T, nowySzablon, wybrana);
    zmien((p) => dodajKarte(p, T, nowySzablon, wybrana).projekt);
    wybierz?.(kartaId);
  };

  const wiersz = (k: Karta, i: number) => {
    const s = szablony.get(k.szablonId);
    const rozmiary = s ? rozmiaryKarty(s) : [];
    const n = i + 1;
    const etykieta = (kolumna: string) => t('talia.komorka', { kolumna, numer: n });
    return (
      <tr
        key={k.id}
        aria-selected={wybrana === k.id}
        className={wybrana === k.id ? 'wybrana' : undefined}
        onFocus={() => wybierz?.(k.id)}
        onClick={() => wybierz?.(k.id)}
      >
        <th scope="row">{n}</th>
        {talia.grupy && <td className="grupa">{grupaKarty.get(k.id) ?? '—'}</td>}
        <td>
          <select
            aria-label={etykieta(t('talia.szablon'))}
            value={k.szablonId}
            onChange={(e) => zmien((p) => ustawSzablon(p, T, k.id, e.target.value))}
          >
            {projekt.szablony.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nazwa}
              </option>
            ))}
          </select>
        </td>
        <td>
          {s && rozmiary.length > 0 ? (
            <select
              aria-label={etykieta(t('talia.rozmiar'))}
              value={r(k.rozmiar ?? rozmiary[0]!)}
              onChange={(e) => {
                const wybor = rozmiary.find((x) => r(x) === e.target.value);
                if (wybor) zmien((p) => ustawRozmiar(p, T, k.id, wybor, s));
              }}
            >
              {rozmiary.map((x) => (
                <option key={r(x)} value={r(x)}>
                  {r(x)}
                </option>
              ))}
            </select>
          ) : (
            '—'
          )}
        </td>
        {kolumny.map((kol) =>
          maKolumne(s, kol, kolumnySzablonu) ? (
            <td key={kol.klucz}>
              {kol.typPola === 'obraz' ? (
                <select
                  aria-label={etykieta(kol.nazwa)}
                  value={k.dane[kol.klucz] ?? ''}
                  onChange={(e) => zmien((p) => ustawDane(p, T, k.id, kol.klucz, e.target.value))}
                >
                  <option value="">{t('karta.brakObrazu')}</option>
                  {obrazy.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nazwa}
                    </option>
                  ))}
                  {k.dane[kol.klucz] && !obrazy.some((o) => o.id === k.dane[kol.klucz]) && (
                    <option value={k.dane[kol.klucz]}>
                      {t('karta.nieznanyObraz', { id: k.dane[kol.klucz]! })}
                    </option>
                  )}
                </select>
              ) : (
                <input
                  type="text"
                  aria-label={etykieta(kol.nazwa)}
                  value={k.dane[kol.klucz] ?? ''}
                  placeholder={kol.domyslnie}
                  onChange={(e) => zmien((p) => ustawDane(p, T, k.id, kol.klucz, e.target.value))}
                />
              )}
            </td>
          ) : (
            <td key={kol.klucz} className="nieaktywna" title={t('talia.brakPola')}>
              —
            </td>
          ),
        )}
        <td>
          <input
            type="number"
            min={0}
            max={999}
            className="ilosc"
            aria-label={etykieta(t('talia.ilosc'))}
            value={k.ilosc}
            onChange={(e) => zmien((p) => ustawIlosc(p, T, k.id, e.target.valueAsNumber))}
          />
        </td>
        <td className="akcje">
          <button
            type="button"
            aria-label={t('talia.wyzej', { numer: n })}
            disabled={i === 0}
            onClick={() => zmien((p) => przesunKarte(p, T, k.id, -1))}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={t('talia.nizej', { numer: n })}
            disabled={i === talia.karty.length - 1}
            onClick={() => zmien((p) => przesunKarte(p, T, k.id, 1))}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={t('talia.kopiuj', { numer: n })}
            onClick={() => zmien((p) => kopiujKarte(p, T, k.id).projekt)}
          >
            {t('talia.kopiujKrotko')}
          </button>
          <button
            type="button"
            aria-label={t('talia.usun', { numer: n })}
            onClick={() => zmien((p) => usunKarte(p, T, k.id))}
          >
            {t('talia.usunKrotko')}
          </button>
        </td>
      </tr>
    );
  };

  return (
    <section className="talia">
      <label className="nazwa-talii">
        {t('talia.nazwa')}{' '}
        <input
          type="text"
          value={talia.nazwa}
          onChange={(e) => zmien((p) => ustawNazweTalii(p, T, e.target.value))}
        />
      </label>
      <p className="podpis">
        {t('projekt.liczbaKart', { karty: talia.karty.length, sztuki: sztuk })}
      </p>
      <div className="pasek-narzedzi">
        <label>
          {t('talia.szablonNowej')}{' '}
          <select value={nowySzablon} onChange={(e) => ustawNowySzablon(e.target.value)}>
            {projekt.szablony.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nazwa}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={dodaj}>
          {t('talia.dodaj')}
        </button>
      </div>
      <div className="przewijanie-tabeli">
        <table className="tabela-danych">
          <caption className="ukryte">{t('talia.opisTabeli', { nazwa: talia.nazwa })}</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              {talia.grupy && <th scope="col">{t('talia.grupa')}</th>}
              <th scope="col">{t('talia.szablon')}</th>
              <th scope="col">{t('talia.rozmiar')}</th>
              {kolumny.map((k) => (
                <th scope="col" key={k.klucz}>
                  {k.nazwa}
                </th>
              ))}
              <th scope="col">{t('talia.ilosc')}</th>
              <th scope="col">
                <span className="ukryte">{t('talia.akcje')}</span>
              </th>
            </tr>
          </thead>
          <tbody>{talia.karty.map(wiersz)}</tbody>
        </table>
      </div>
      {talia.karty.length === 0 && <p>{t('talia.pusta')}</p>}
    </section>
  );
}
