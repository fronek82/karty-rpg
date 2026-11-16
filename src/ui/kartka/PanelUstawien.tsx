import { useRef, useState } from 'react';
import { wgrajCzcionke } from '../../dane/czcionki';
import {
  dodajZasoby,
  roleProjektu,
  ustawRole,
  ustawTytulArkusza,
  ustawUstawieniaArkusza,
} from '../../dane/edycja';
import { BladDanych } from '../../dane/schemat';
import { t, tJesliJest } from '../../i18n';
import { PAPIERY, type Arkusz, type Papier } from '../../model/arkusz';
import type { Projekt } from '../../model/projekt';
import type { ProjektWEdycji } from '../useProjekt';

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
  zamknij,
  blad,
}: {
  edycja: ProjektWEdycji;
  arkusz: Arkusz;
  zmienUklad: (f: (p: Projekt) => Projekt, klucz?: string) => void;
  nowaKartka?: () => void;
  zamknij: () => void;
  blad?: string;
}) {
  const { projekt, zmien } = edycja;
  const u = arkusz.ustawienia;
  const [bladCzcionki, ustawBladCzcionki] = useState<string>();
  const [status, ustawStatus] = useState('');
  const plik = useRef<HTMLInputElement>(null);
  const rodziny = [
    ...new Set(projekt.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [z.rodzina] : []))),
  ];
  const A = arkusz.id;
  const polozenie = !u.tytul || !u.tytul.tekst.trim() ? 'brak' : u.tytul.polozenie;
  // Tekst tytułu w polu (także przy „bez tytułu” – pamiętany do przywrócenia).
  const [tekstTytulu, ustawTekstTytulu] = useState(u.tytul?.tekst || arkusz.nazwa);

  const wgraj = async (pliki: File[]) => {
    ustawBladCzcionki(undefined);
    try {
      const odczytane = await Promise.all(
        pliki.map(async (f) => ({ nazwa: f.name, bajty: new Uint8Array(await f.arrayBuffer()) })),
      );
      let opisy: string[] = [];
      await edycja.zmienZZasobami((p, d) => {
        const zajete = new Set(p.zasoby.map((z) => z.id));
        const nowe = odczytane.map(({ nazwa, bajty }) => {
          const w = wgrajCzcionke(nazwa, bajty, { zajete });
          zajete.add(w.opis.id);
          return { opis: w.opis, dane: w.dane };
        });
        opisy = nowe.map((n) => `${n.opis.rodzina} (${t(`wariant.${n.opis.wariant}`)})`);
        return dodajZasoby(p, d, nowe);
      });
      ustawStatus(t('czcionki.wgrano', { lista: opisy.join(', ') }));
    } catch (e) {
      ustawBladCzcionki(komunikat(e));
    }
  };

  return (
    <aside className="panel-edytora" aria-label={t('kartka.ustawienia')}>
      <div className="naglowek-panelu">
        <h2>{t('kartka.ustawienia')}</h2>
        <button
          type="button"
          className="zamknij"
          aria-label={t('kartka.zamknijUstawienia')}
          onClick={zamknij}
        >
          ✕
        </button>
      </div>
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
        <span id="polozenie-tytulu">{t('kartka.polozenieTytulu')}</span>
        <div className="przelacznik-segmentowy" role="group" aria-labelledby="polozenie-tytulu">
          {(['lewo', 'gora', 'brak'] as const).map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={polozenie === x}
              disabled={!u.tytul}
              onClick={() =>
                u.tytul &&
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
                )
              }
            >
              {t(`kartka.tytul.${x}`)}
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
      <div className="pole-panelu">
        <span id="papier">{t('kartka.papier')}</span>
        <div className="przelacznik-segmentowy" role="group" aria-labelledby="papier">
          {(Object.keys(PAPIERY) as Papier[]).map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={u.papier === x}
              onClick={() => zmienUklad((p) => ustawUstawieniaArkusza(p, A, { papier: x }))}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
      <fieldset className="sekcja-czcionek">
        <legend>{t('czcionki.tytul')}</legend>
        {roleProjektu(projekt).map((rola) => (
          <label key={rola} className="rola">
            <span>{tJesliJest(`rola.${rola}`) ?? rola}</span>
            <select
              aria-label={t('czcionki.rolaEtykieta', { rola: tJesliJest(`rola.${rola}`) ?? rola })}
              value={projekt.role[rola] ?? ''}
              onChange={(e) => zmienUklad((p) => ustawRole(p, rola, e.target.value))}
            >
              <option value="">{t('czcionki.brakRodziny')}</option>
              {rodziny.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
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
        <p role="status" aria-live="polite" className="podpis">
          {status}
        </p>
        {bladCzcionki && (
          <p role="alert" className="blad-pola">
            {bladCzcionki}
          </p>
        )}
      </fieldset>
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
