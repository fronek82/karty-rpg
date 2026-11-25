import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { kolumnySzablonu } from '../../dane/edycja';
import {
  otworzTabele,
  sprawdzImport,
  type MapowanieImportu,
  type PlikTabeli,
  type TabelaImportu,
  type WartosciImportu,
} from '../../dane/importTabeli';
import { t } from '../../i18n';
import type { OpisZasobu } from '../../model/projekt';
import type { Rewers, Szablon } from '../../model/szablon';
import { wspolneKluczeRewersu } from '../../silnik/karta';
import { normalizujNazwe } from '../../model/nazwy';
import { KLUCZ_IMPORTU_Z_PDF } from '../../wspolne/ustawienia';

function odczytajTekstZPdf(): boolean {
  try {
    return localStorage.getItem(KLUCZ_IMPORTU_Z_PDF) === '1';
  } catch {
    return false;
  }
}

function domyslneMapowanie(
  tabela: TabelaImportu,
  pola: ReturnType<typeof kolumnySzablonu>,
): MapowanieImportu {
  const naglowki = tabela.naglowki.map(normalizujNazwe);
  const znajdz = (nazwy: string[]) => {
    const pasujace = naglowki.flatMap((n, i) => (nazwy.includes(n) ? [i] : []));
    return pasujace.length === 1 ? pasujace[0] : undefined;
  };
  const ilosc = znajdz(['ilosc', 'quantity']);
  const wynik = new Map<string, number>();
  for (const p of pola) {
    const i = znajdz([normalizujNazwe(p.nazwa), normalizujNazwe(p.klucz)]);
    if (i !== undefined) wynik.set(p.klucz, i);
  }
  return { pola: wynik, ...(ilosc !== undefined ? { ilosc } : {}) };
}

export function ImportDanych({
  nazwaKartki,
  szablony,
  rewersDlaSzablonu,
  zasoby,
  zapisz,
  zamknij,
}: {
  nazwaKartki: string;
  szablony: Szablon[];
  rewersDlaSzablonu?: (szablon: Szablon) => Rewers | undefined;
  zasoby: readonly OpisZasobu[];
  zapisz: (szablonId: string, wiersze: WartosciImportu[]) => boolean;
  zamknij: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const tytul = useId();
  const operacja = useRef(0);
  const [szablonId, ustawSzablon] = useState(szablony[0]?.id ?? '');
  const [plik, ustawPlik] = useState<PlikTabeli>();
  const [tabela, ustawTabele] = useState<TabelaImportu>();
  const [arkusz, ustawArkusz] = useState(0);
  const [mapowanie, ustawMapowanie] = useState<MapowanieImportu>({ pola: new Map() });
  const [blad, ustawBlad] = useState('');
  const [trwa, ustawTrwa] = useState(false);
  const [tekstZPdf, ustawTekstZPdfStan] = useState(odczytajTekstZPdf);
  const ustawTekstZPdf = (v: boolean) => {
    ustawTekstZPdfStan(v);
    try {
      if (v) localStorage.setItem(KLUCZ_IMPORTU_Z_PDF, '1');
      else localStorage.removeItem(KLUCZ_IMPORTU_Z_PDF);
    } catch {
      // Zablokowane localStorage – wybór działa do zamknięcia strony.
    }
  };
  const szablon = szablony.find((s) => s.id === szablonId);
  const pola = useMemo(() => (szablon ? kolumnySzablonu(szablon) : []), [szablon]);
  const rewers = szablon ? rewersDlaSzablonu?.(szablon) : undefined;
  const wspolneZRewersem = useMemo(
    () => (szablon && rewers ? wspolneKluczeRewersu(szablon, rewers) : new Set<string>()),
    [szablon, rewers],
  );
  const wynik = useMemo(
    () => (tabela ? sprawdzImport(tabela, mapowanie, pola, zasoby, { tekstZPdf }) : undefined),
    [mapowanie, pola, tabela, zasoby, tekstZPdf],
  );
  const bledy = wynik?.bledy ?? [];
  const ileMap = mapowanie.pola.size + (mapowanie.ilosc !== undefined ? 1 : 0);

  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    return () => d.close();
  }, []);

  const zamknijOkno = () => {
    operacja.current++;
    dialog.current?.close();
    zamknij();
  };

  const zastosuj = (zrodlo: PlikTabeli, i: number) => {
    ustawArkusz(i);
    ustawTabele(undefined);
    ustawMapowanie({ pola: new Map() });
    ustawBlad('');
    try {
      const tab = zrodlo.odczytaj(i);
      ustawTabele(tab);
      ustawMapowanie(domyslneMapowanie(tab, pola));
    } catch (e) {
      ustawBlad(e instanceof Error ? e.message : t('tabelaImport.format'));
    }
  };
  const wczytaj = async (f: File | undefined) => {
    const token = ++operacja.current;
    ustawPlik(undefined);
    ustawTabele(undefined);
    ustawBlad('');
    if (!f) {
      ustawTrwa(false);
      return;
    }
    ustawTrwa(true);
    try {
      const p = await otworzTabele(f);
      if (token !== operacja.current) return;
      ustawPlik(p);
      zastosuj(p, 0);
    } catch (e) {
      if (token === operacja.current)
        ustawBlad(e instanceof Error ? e.message : t('tabelaImport.format'));
    } finally {
      if (token === operacja.current) ustawTrwa(false);
    }
  };
  const wybierzSzablon = (id: string) => {
    ustawSzablon(id);
    ustawBlad('');
    const s = szablony.find((s) => s.id === id);
    if (s && tabela) ustawMapowanie(domyslneMapowanie(tabela, kolumnySzablonu(s)));
  };
  const kolumny =
    tabela?.naglowki.map((nazwa, i) =>
      t('tabelaImport.kolumna', { numer: i + 1, nazwa: nazwa || t('tabelaImport.bezNaglowka') }),
    ) ?? [];
  const opcje = kolumny.map((nazwa, i) => (
    <option key={i} value={i}>
      {nazwa}
    </option>
  ));
  const pomin = <option value="">{t('tabelaImport.pomin')}</option>;
  const widocznePola = pola.filter((p) => mapowanie.pola.has(p.klucz));
  const pierwsze = tabela?.wiersze.slice(0, 5) ?? [];
  const moznaZapisac = !!(szablon && wynik?.wiersze.length && !bledy.length && ileMap && !trwa);

  return (
    <dialog
      ref={dialog}
      className="dialog-importu-tabeli"
      aria-labelledby={tytul}
      onKeyDown={(e) => e.stopPropagation()}
      onCancel={(e) => {
        e.preventDefault();
        zamknijOkno();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!moznaZapisac || !wynik) return;
          if (zapisz(szablonId, wynik.wiersze)) zamknijOkno();
          else ustawBlad(t('kartka.zmianaNieMiesci'));
        }}
      >
        <h2 id={tytul}>{t('tabelaImport.akcja')}</h2>
        <p>{t('tabelaImport.cel', { kartka: nazwaKartki })}</p>
        <label className="pole-panelu">
          {t('tabelaImport.szablon')}
          <select
            value={szablonId}
            onChange={(e) => wybierzSzablon(e.target.value)}
            disabled={trwa}
          >
            {szablony.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nazwa}
              </option>
            ))}
          </select>
        </label>
        <label className="pole-panelu">
          {t('tabelaImport.plik')}
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => void wczytaj(e.target.files?.[0])}
          />
        </label>
        {trwa && <p role="status">{t('projekty.trwa')}</p>}
        {!!plik?.arkusze.length && (
          <label className="pole-panelu">
            {t('tabelaImport.arkusz')}
            <select value={arkusz} onChange={(e) => zastosuj(plik, Number(e.target.value))}>
              {plik.arkusze.map((a, i) => (
                <option key={i} value={i}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        )}
        {tabela && (
          <fieldset>
            <legend>{t('tabelaImport.mapowanie')}</legend>
            {pola.map((p) => (
              <label className="pole-panelu" key={p.klucz}>
                {wspolneZRewersem.has(p.klucz)
                  ? `${p.nazwa} (${t('tabelaImport.awersIRewers')})`
                  : p.nazwa}
                <select
                  value={mapowanie.pola.get(p.klucz) ?? ''}
                  onChange={(e) => {
                    const nowe = new Map(mapowanie.pola);
                    if (e.target.value === '') nowe.delete(p.klucz);
                    else nowe.set(p.klucz, Number(e.target.value));
                    ustawMapowanie({ ...mapowanie, pola: nowe });
                    ustawBlad('');
                  }}
                >
                  {pomin}
                  {opcje}
                </select>
              </label>
            ))}
            <label className="pole-panelu">
              {t('tabelaImport.ilosc')}
              <select
                value={mapowanie.ilosc ?? ''}
                onChange={(e) => {
                  ustawMapowanie({
                    pola: mapowanie.pola,
                    ...(e.target.value !== '' ? { ilosc: Number(e.target.value) } : {}),
                  });
                  ustawBlad('');
                }}
              >
                {pomin}
                {opcje}
              </select>
            </label>
          </fieldset>
        )}
        <label className="pole-wyboru">
          <input
            type="checkbox"
            checked={tekstZPdf}
            onChange={(e) => ustawTekstZPdf(e.target.checked)}
          />
          <span>{t('tabelaImport.tekstZPdf')}</span>
        </label>
        <p className="podpis">{t('tabelaImport.tekstZPdfOpis')}</p>
        {tabela && !tabela.wiersze.length && <p role="status">{t('tabelaImport.brakWierszy')}</p>}
        {tabela && !!tabela.wiersze.length && !ileMap && <p>{t('tabelaImport.wybierz')}</p>}
        {wynik && !!pierwsze.length && !!ileMap && (
          <div className="tabela-podgladu-importu">
            <table>
              <caption>{t('tabelaImport.podglad')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('tabelaImport.wiersz')}</th>
                  {widocznePola.map((p) => (
                    <th key={p.klucz} scope="col">
                      {p.nazwa}
                    </th>
                  ))}
                  <th scope="col">{t('tabelaImport.ilosc')}</th>
                </tr>
              </thead>
              <tbody>
                {pierwsze.map((r, i) => (
                  <tr key={r.numer}>
                    <th scope="row">{r.numer}</th>
                    {widocznePola.map((p) => (
                      <td key={p.klucz}>{r.komorki[mapowanie.pola.get(p.klucz)!]}</td>
                    ))}
                    <td>
                      {Number.isFinite(wynik.wiersze[i]!.ilosc) ? wynik.wiersze[i]!.ilosc : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(blad || !!bledy.length) && (
          <div role="alert" className="uwaga">
            {blad && <p>{blad}</p>}
            {!!bledy.length && (
              <ul>
                {bledy.slice(0, 10).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {bledy.length > 10 && (
              <p>{t('tabelaImport.wiecejBledow', { liczba: bledy.length - 10 })}</p>
            )}
          </div>
        )}
        {moznaZapisac && wynik && (
          <p role="status">
            {t('tabelaImport.podsumowanie', {
              wiersze: wynik.wiersze.length,
              sztuki: wynik.sztuki,
            })}
          </p>
        )}
        <div className="wiersz-przyciskow">
          <button type="button" onClick={zamknijOkno}>
            {t('projekty.anuluj')}
          </button>
          <button type="submit" className="glowny" disabled={!moznaZapisac}>
            {t('tabelaImport.dodaj')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
