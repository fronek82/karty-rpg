import { useEffect, useRef, useState } from 'react';
import { wgrajCzcionke } from '../../dane/czcionki';
import {
  dodajZasoby,
  roleProjektu,
  usunZasob,
  ustawRole,
  ustawWariantCzcionki,
  zmienNazweRodziny,
} from '../../dane/edycja';
import { BladDanych } from '../../dane/schemat';
import { t, tJesliJest } from '../../i18n';
import type { OpisCzcionki } from '../../model/projekt';
import type { WariantCzcionki } from '../../model/szablon';
import type { ProjektWEdycji } from '../useProjekt';

const WARIANTY: WariantCzcionki[] = ['normalny', 'pogrubiony', 'kursywa', 'pogrubiona-kursywa'];
const PROBKA = 'Zażółć gęślą jaźń – Miecz k6/k8';

const komunikat = (e: unknown) =>
  e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e);

export const nazwaRoli = (rola: string) => tJesliJest(`rola.${rola}`) ?? rola;

/** Próbka tekstu w czcionce z biblioteki (FontFace z bajtów pliku). */
function Probka({ opis, dane }: { opis: OpisCzcionki; dane?: Uint8Array }) {
  const [rodzina, ustawRodzine] = useState<string>();
  useEffect(() => {
    if (!dane || typeof FontFace === 'undefined') return;
    const nazwa = `probka-${opis.id.replace(/[^\w-]/g, '_')}`;
    const ff = new FontFace(nazwa, dane.slice().buffer);
    let aktywny = true;
    ff.load().then(
      () => {
        document.fonts.add(ff);
        if (aktywny) ustawRodzine(nazwa);
      },
      () => undefined,
    );
    return () => {
      aktywny = false;
      document.fonts.delete(ff);
    };
  }, [opis.id, dane]);
  return (
    <span className="probka" style={rodzina ? { fontFamily: `"${rodzina}", serif` } : undefined}>
      {PROBKA}
    </span>
  );
}

/** Biblioteka czcionek projektu i przypisanie ról (np. tytuł, treść). */
export function Czcionki({ edycja }: { edycja: ProjektWEdycji }) {
  const { projekt, dane, zmien } = edycja;
  const [blad, ustawBlad] = useState<string>();
  const [status, ustawStatus] = useState('');
  const plik = useRef<HTMLInputElement>(null);
  const czcionki = projekt.zasoby.filter((z): z is OpisCzcionki => z.rodzaj === 'czcionka');
  const rodziny = [...new Set(czcionki.map((c) => c.rodzina))];
  const role = roleProjektu(projekt);

  const wgraj = async (pliki: File[]) => {
    ustawBlad(undefined);
    try {
      const zajete = new Set(projekt.zasoby.map((z) => z.id));
      const nowe = [];
      for (const f of pliki) {
        const w = wgrajCzcionke(f.name, new Uint8Array(await f.arrayBuffer()), { zajete });
        zajete.add(w.opis.id);
        nowe.push({ opis: w.opis, dane: w.dane });
      }
      const wynik = dodajZasoby(projekt, dane, nowe);
      await edycja.zmienZZasobami(wynik.projekt, wynik.dane);
      ustawStatus(
        t('czcionki.wgrano', {
          lista: nowe
            .map((n) => `${n.opis.rodzina} (${t(`wariant.${n.opis.wariant}`)})`)
            .join(', '),
        }),
      );
    } catch (e) {
      ustawBlad(komunikat(e));
    }
  };

  const usun = async (c: OpisCzcionki) => {
    ustawBlad(undefined);
    try {
      const wynik = usunZasob(projekt, dane, c.id);
      await edycja.zmienZZasobami(wynik.projekt, wynik.dane);
      ustawStatus(t('czcionki.usunieto', { nazwa: c.nazwa }));
    } catch (e) {
      ustawBlad(komunikat(e));
    }
  };

  return (
    <section className="czcionki">
      <h1>{t('czcionki.tytul')}</h1>
      <p>{t('czcionki.opis')}</p>

      <h2>{t('czcionki.role')}</h2>
      <table className="tabela-danych">
        <thead>
          <tr>
            <th scope="col">{t('czcionki.rola')}</th>
            <th scope="col">{t('czcionki.rodzina')}</th>
          </tr>
        </thead>
        <tbody>
          {role.map((rola) => (
            <tr key={rola}>
              <th scope="row">{nazwaRoli(rola)}</th>
              <td>
                <select
                  aria-label={t('czcionki.rolaEtykieta', { rola: nazwaRoli(rola) })}
                  value={projekt.role[rola] ?? ''}
                  onChange={(e) => zmien((p) => ustawRole(p, rola, e.target.value))}
                >
                  <option value="">{t('czcionki.brakRodziny')}</option>
                  {rodziny.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  {projekt.role[rola] && !rodziny.includes(projekt.role[rola]) && (
                    <option value={projekt.role[rola]}>
                      {t('czcionki.nieznanaRodzina', { rodzina: projekt.role[rola] })}
                    </option>
                  )}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{t('czcionki.biblioteka')}</h2>
      <div className="pasek-narzedzi">
        <button type="button" onClick={() => plik.current?.click()}>
          {t('czcionki.wgraj')}
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
        <p role="status" aria-live="polite" className="status">
          {status}
        </p>
      </div>
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      {rodziny.length === 0 && <p>{t('czcionki.pusta')}</p>}
      {rodziny.map((rodzina) => (
        <fieldset key={rodzina} className="rodzina">
          <legend>
            <label>
              {t('czcionki.rodzina')}{' '}
              <PoleNazwy
                wartosc={rodzina}
                etykieta={t('czcionki.nazwaRodziny', { rodzina })}
                zatwierdz={(nowa) => zmien((p) => zmienNazweRodziny(p, rodzina, nowa))}
              />
            </label>
          </legend>
          <ul>
            {czcionki
              .filter((c) => c.rodzina === rodzina)
              .map((c) => (
                <li key={c.id}>
                  <select
                    aria-label={t('czcionki.wariantEtykieta', { plik: c.nazwa })}
                    value={c.wariant}
                    onChange={(e) =>
                      zmien((p) => ustawWariantCzcionki(p, c.id, e.target.value as WariantCzcionki))
                    }
                  >
                    {WARIANTY.map((w) => (
                      <option key={w} value={w}>
                        {t(`wariant.${w}`)}
                      </option>
                    ))}
                  </select>
                  <span className="plik">{c.nazwa}</span>
                  <span className="zrodlo">{t(`czcionki.zrodlo.${c.zrodlo}`)}</span>
                  <Probka opis={c} dane={dane.get(c.id)} />
                  <button
                    type="button"
                    aria-label={t('czcionki.usun', { plik: c.nazwa })}
                    onClick={() => void usun(c)}
                  >
                    {t('talia.usunKrotko')}
                  </button>
                </li>
              ))}
          </ul>
        </fieldset>
      ))}
      <p className="podpis">{t('czcionki.licencja')}</p>
    </section>
  );
}

/** Pole tekstowe zatwierdzane po opuszczeniu lub Enter (zmiana nazwy rodziny przenosi role). */
function PoleNazwy({
  wartosc,
  etykieta,
  zatwierdz,
}: {
  wartosc: string;
  etykieta: string;
  zatwierdz: (v: string) => void;
}) {
  const [tekst, ustawTekst] = useState(wartosc);
  const koniec = () => {
    const v = tekst.trim();
    if (v && v !== wartosc) zatwierdz(v);
    else ustawTekst(wartosc);
  };
  return (
    <input
      type="text"
      aria-label={etykieta}
      value={tekst}
      onChange={(e) => ustawTekst(e.target.value)}
      onBlur={koniec}
      onKeyDown={(e) => e.key === 'Enter' && koniec()}
    />
  );
}
