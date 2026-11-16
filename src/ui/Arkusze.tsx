import { useEffect, useMemo, useState } from 'react';
import { zbudujArkusz, type WynikArkusza } from '../druk/arkusz';
import { t } from '../i18n';
import type { Arkusz } from '../model/arkusz';
import { pakietMausritter } from '../pakiety/mausritter';
import type { Pakiet } from '../pakiety/typy';
import { scenaDoSvg } from '../silnik/svg';
import { wczytajZasobyPakietu, type ZasobyPakietu } from './zasoby';

/**
 * Arkusze do druku z pakietu: podgląd (dopasowany do szerokości albo w skali 1:1)
 * i pobieranie PDF. Kod PDF (pdf-lib) ładowany dopiero przy pierwszym pobraniu.
 */

const pamiecZasobow = new Map<string, Promise<ZasobyPakietu>>();
function zasoby(pakiet: Pakiet): Promise<ZasobyPakietu> {
  let z = pamiecZasobow.get(pakiet.id);
  if (!z) {
    z = wczytajZasobyPakietu(pakiet);
    pamiecZasobow.set(pakiet.id, z);
  }
  return z;
}

function zbuduj(pakiet: Pakiet, arkusz: Arkusz, z: ZasobyPakietu): WynikArkusza {
  const talia = pakiet.talie.find((x) => x.id === arkusz.taliaId);
  if (!talia) throw new Error(`Brak talii ${arkusz.taliaId}`);
  return zbudujArkusz(arkusz, talia, {
    czcionki: z.czcionki,
    szablony: z.szablony,
    obraz: (id) => z.obrazy.get(id)?.info,
  });
}

function zapiszPlik(bajty: Uint8Array, nazwa: string) {
  const url = URL.createObjectURL(
    new Blob([bajty as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = nazwa;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function pobierzPdf(
  sceny: WynikArkusza['strony'],
  z: ZasobyPakietu,
  tytul: string,
  plik: string,
) {
  const { scenyDoPdf } = await import('../druk/pdf');
  const { bajty } = await scenyDoPdf(sceny, {
    tytul,
    obraz: (id) => {
      const o = z.obrazy.get(id);
      return o ? { dane: o.dane, format: o.format } : undefined;
    },
  });
  zapiszPlik(bajty, plik);
}

type Skala = 'dopasuj' | 'rzeczywista';

export function Arkusze({ pakiet = pakietMausritter }: { pakiet?: Pakiet }) {
  const [z, ustawZ] = useState<ZasobyPakietu>();
  const [blad, ustawBlad] = useState<string>();
  const [wybrany, ustawWybrany] = useState(0);
  const [skala, ustawSkala] = useState<Skala>('dopasuj');
  const [trwa, ustawTrwa] = useState(false);

  useEffect(() => {
    let aktywny = true;
    zasoby(pakiet).then(
      (w) => aktywny && ustawZ(w),
      (e: unknown) => aktywny && ustawBlad(String(e)),
    );
    return () => {
      aktywny = false;
    };
  }, [pakiet]);

  const arkusz = pakiet.arkusze[wybrany] ?? pakiet.arkusze[0]!;
  const wynik = useMemo(() => (z ? zbuduj(pakiet, arkusz, z) : undefined), [pakiet, arkusz, z]);
  const svg = useMemo(
    () =>
      wynik && z
        ? wynik.strony.map((s, i) =>
            scenaDoSvg(s, {
              adresObrazu: (id) => z.obrazy.get(id)?.adres,
              przedrostekId: `a${wybrany}s${i}`,
              atrybuty: { role: 'img', 'aria-label': t('arkusze.strona', { numer: i + 1 }) },
            }),
          )
        : [],
    [wynik, z, wybrany],
  );

  const pobierz = async (wszystkie: boolean) => {
    if (!z || !wynik) return;
    ustawTrwa(true);
    try {
      if (wszystkie) {
        const sceny = pakiet.arkusze.flatMap((a) => zbuduj(pakiet, a, z).strony);
        await pobierzPdf(sceny, z, pakiet.nazwa, `${pakiet.id}-arkusze.pdf`);
      } else {
        await pobierzPdf(wynik.strony, z, arkusz.nazwa, `${arkusz.id}.pdf`);
      }
    } catch (e) {
      ustawBlad(String(e));
    } finally {
      ustawTrwa(false);
    }
  };

  return (
    <section className="arkusze">
      <h1>{t('arkusze.tytul')}</h1>
      <p>{t('arkusze.opis', { pakiet: pakiet.nazwa })}</p>
      {blad && (
        <p role="alert" className="uwaga">
          {t('arkusze.blad', { blad })}
        </p>
      )}
      <div className="pasek-narzedzi">
        <label>
          {t('arkusze.wybor')}{' '}
          <select value={wybrany} onChange={(e) => ustawWybrany(Number(e.target.value))}>
            {pakiet.arkusze.map((a, i) => (
              <option key={a.id} value={i}>
                {a.nazwa}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="przelacznik">
          <legend>{t('arkusze.podglad')}</legend>
          {(['dopasuj', 'rzeczywista'] as const).map((s) => (
            <label key={s}>
              <input
                type="radio"
                name="skala"
                checked={skala === s}
                onChange={() => ustawSkala(s)}
              />{' '}
              {t(s === 'dopasuj' ? 'arkusze.skalaDopasuj' : 'arkusze.skalaRzeczywista')}
            </label>
          ))}
        </fieldset>
        <button type="button" disabled={!wynik || trwa} onClick={() => void pobierz(false)}>
          {t('arkusze.pobierzPdf')}
        </button>
        <button type="button" disabled={!wynik || trwa} onClick={() => void pobierz(true)}>
          {t('arkusze.pobierzWszystkie')}
        </button>
        {trwa && <span aria-live="polite">{t('arkusze.generowanie')}</span>}
      </div>
      {!wynik && !blad && <p aria-live="polite">{t('arkusze.wczytywanie')}</p>}
      {wynik && wynik.ostrzezenia.length > 0 && (
        <details className="uwaga">
          <summary>{t('arkusze.ostrzezenia', { liczba: wynik.ostrzezenia.length })}</summary>
          <ul>
            {wynik.ostrzezenia.map((o, i) => (
              <li key={i}>
                {o.kartaId ? `${o.kartaId}: ` : ''}
                <code>{o.komunikat}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
      {wynik && (
        <p className="podpis">
          {t('arkusze.liczbaStron', { liczba: wynik.strony.length })}
          {skala === 'rzeczywista' ? ` ${t('arkusze.uwagaSkali')}` : ''}
        </p>
      )}
      <div className={`podglad-arkusza ${skala === 'dopasuj' ? 'dopasuj' : 'rzeczywista'}`}>
        {svg.map((s, i) => (
          <div key={i} className="strona-arkusza" dangerouslySetInnerHTML={{ __html: s }} />
        ))}
      </div>
    </section>
  );
}
