import { useState } from 'react';
import { kolumnySzablonu } from '../../dane/edycja';
import { nazwaKarty } from '../../dane/szablon';
import {
  liczbaEgzemplarzyKarty,
  MAKS_EGZEMPLARZY,
  mozliweRozmiary,
  ustawLiczbeEgzemplarzy,
  ustawDaneKart,
  zmienRozmiarKarty,
  type KartaNaKartce,
  type KontekstKartki,
} from '../../dane/kartka';
import { przypiszRewersKartom, rewersKarty, zrodloRewersuKarty } from '../../dane/rewers';
import { t, tJesliJest } from '../../i18n';
import { MAKS_ZNACZNIKOW } from '../../silnik/karta';
import { nazwaRozmiaru, nazwaWariantu } from '../nazwyPakietu';
import type { Arkusz } from '../../model/arkusz';
import {
  korzenieSzablonu,
  polaDrzewa,
  type Pole,
  type PoleObraz,
  type PoleZnaczniki,
  type Szablon,
  wymiaryKarty,
} from '../../model/szablon';
import type { Pakiet, TypKarty } from '../../pakiety/typy';
import { PodgladRewersu } from '../rewers/PodgladRewersu';
import { dolaczRewersGlobalnyDoProjektu, useRewersyGlobalne } from '../rewersyGlobalne';
import { PoleWielowierszowe } from '../PoleWielowierszowe';
import type { ProjektWEdycji } from '../useProjekt';
import { czyWklejanieWToku, obsluzWklejenieZPdf } from '../wklejaniePdfUI';
import { EksportCsvSzablonu } from './EksportCsvSzablonu';
import { SekcjaObrazu } from './SekcjaObrazu';
import { OpcjeRewersowGlobalnych, wybranaOpcja } from '../zrodloOpcji';

/** Pola szablonu według klucza (wszystkie warianty układu). */
function polaSzablonu(s: Szablon): Map<string, Pole> {
  const m = new Map<string, Pole>();
  for (const k of korzenieSzablonu(s))
    for (const p of polaDrzewa(k)) if (p.klucz && !m.has(p.klucz)) m.set(p.klucz, p);
  return m;
}

/** Typ karty (menu pakietu) dla szablonu – nazwa i rozmiary do wyboru. */
export function typDlaSzablonu(pakiet: Pakiet | undefined, szablonId: string) {
  for (const typ of pakiet?.typyKart ?? []) {
    const w = typ.warianty.find((x) => x.szablonId === szablonId);
    if (w) return { typ, wariant: w };
  }
  return undefined;
}

const nazwaPola = (klucz: string, domyslna: string) => tJesliJest(`pole.${klucz}`) ?? domyslna;
const opisRozmiaru = (r: TypKarty['rozmiary'][number]) => {
  const nazwa = nazwaRozmiaru(r);
  return `${r.kolumny}×${r.rzedy}${nazwa ? ` ${nazwa}` : ''}`;
};

/**
 * Panel zaznaczonych kart. Jedna karta – wszystkie pola, rozmiar i ilustracja z kadrem.
 * Wiele kart tego samego typu – wspólne pola (różne wartości: puste pole z podpowiedzią
 * „różne”; wpisanie ustawia wszystkim). Różne typy – tylko akcje.
 */
export function PanelKart({
  edycja,
  arkusz,
  karty,
  pakiet,
  ctx,
  duplikuj,
  usun,
  dodajNaglowek,
  edytujSzablon,
  zamknij,
  ostrzezenia = [],
  bezRewersu = false,
}: {
  /** Gra z kartami jednostronnymi – bez wyboru rewersu karty. */
  bezRewersu?: boolean;
  /** Ostrzeżenia silnika dla zaznaczonych kart (np. tekst się nie mieści). */
  ostrzezenia?: string[];
  edycja: ProjektWEdycji;
  arkusz: Arkusz;
  karty: KartaNaKartce[];
  pakiet: Pakiet | undefined;
  ctx: KontekstKartki;
  duplikuj: (n: number) => void;
  usun: () => void;
  dodajNaglowek?: () => void;
  /** Adres edytora szablonu zaznaczonych kart (własne karty). */
  edytujSzablon?: string;
  zamknij: () => void;
}) {
  const { projekt, zmien } = edycja;
  const { rewersyGlobalne } = useRewersyGlobalne(projekt);
  const [wpisaneKopie, ustawWpisaneKopie] = useState<string>();
  const [bladRozmiaru, ustawBladRozmiaru] = useState<string>();
  const ids = karty.map((k) => k.karta.id);
  const szablonIds = new Set(karty.map((k) => k.karta.szablonId));
  const szablon = szablonIds.size === 1 ? ctx.szablony.get([...szablonIds][0]!) : undefined;
  const jedna = karty.length === 1 ? karty[0] : undefined;
  const liczbaKopii = jedna ? liczbaEgzemplarzyKarty(projekt, arkusz.id, jedna.karta.id) : 0;
  const zatwierdzKopie = (liczba: number) => {
    ustawWpisaneKopie(undefined);
    if (jedna) zmien((p) => ustawLiczbeEgzemplarzy(p, arkusz.id, jedna.karta.id, liczba, ctx));
  };
  const typ = szablon ? typDlaSzablonu(pakiet, szablon.id) : undefined;
  const polaMapa = szablon ? polaSzablonu(szablon) : new Map<string, Pole>();
  // Kolejność w panelu: tekst i wartości najpierw, znaczniki potem, ilustracja na końcu.
  const waga = (klucz: string) => {
    const typ = polaMapa.get(klucz)?.typ;
    return typ === 'obraz' ? 2 : typ === 'znaczniki' ? 1 : 0;
  };
  const kolumny = szablon
    ? kolumnySzablonu(szablon).sort((a, b) => waga(a.klucz) - waga(b.klucz))
    : [];
  const szablonId = szablon?.id;

  // Podpowiedzi wartości: z innych kart tego szablonu w projekcie i w pakiecie gry.
  const podpowiedzi = (() => {
    const m = new Map<string, Set<string>>();
    const karty = [...projekt.talie, ...(pakiet?.talie ?? [])].flatMap((x) => x.karty);
    for (const k of karty) {
      if (k.szablonId !== szablonId) continue;
      for (const [klucz, v] of Object.entries(k.dane)) {
        if (!v || v.length > 40) continue;
        (m.get(klucz) ?? m.set(klucz, new Set()).get(klucz)!).add(v);
      }
    }
    return m;
  })();

  const wspolna = (klucz: string) => {
    const v = new Set(karty.map((k) => k.karta.dane[klucz] ?? ''));
    return v.size === 1 ? [...v][0]! : undefined;
  };
  const ustaw = (klucz: string, v: string) =>
    zmien(
      (p) => ustawDaneKart(p, arkusz.id, ids, klucz, v),
      czyWklejanieWToku() ? undefined : { klucz: `pole:${klucz}:${ids.join(',')}` },
    );

  // Mieszane rozmiary: bez slotów – nie ma położenia w siatce ani zmiany rozmiaru w slotach.
  const mieszane = arkusz.ustawienia.rozmiary === 'mieszane';
  const rozmiary = mieszane ? [] : (typ?.typ.rozmiary ?? []);
  const mozliwe = jedna ? mozliweRozmiary(projekt, arkusz.id, jedna.karta.id, rozmiary, ctx) : [];
  const polozenie =
    jedna && !mieszane
      ? t('kartka.polozenie', {
          strona: jedna.strona + 1,
          kolumna: jedna.kolumna + 1,
          rzad: jedna.rzad + 1,
        })
      : '';
  const tytul = jedna
    ? nazwaKarty(jedna.karta.dane, ctx.szablony.get(jedna.karta.szablonId)) ||
      (typ ? nazwaWariantu(typ.wariant) : '') ||
      t('karta.bezNazwy')
    : t('kartka.zaznaczono', { liczba: karty.length });

  return (
    <aside className="panel-edytora" aria-label={t('kartka.panelKart')}>
      <div className="naglowek-panelu">
        <h2 title={tytul}>{tytul}</h2>
        <button
          type="button"
          className="zamknij"
          aria-label={t('kartka.odznacz')}
          onClick={zamknij}
        >
          ✕
        </button>
      </div>
      <p className="podpis">
        {szablon ? (typ ? nazwaWariantu(typ.wariant) : szablon.nazwa) : t('kartka.rozneTypy')}
        {polozenie && ` · ${polozenie}`}
      </p>

      {ostrzezenia.length > 0 && (
        <ul className="ostrzezenia-karty">
          {ostrzezenia.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      )}
      {szablon &&
        kolumny.map((kol) => {
          const pole = polaMapa.get(kol.klucz);
          if (pole?.typ === 'obraz') {
            return (
              <SekcjaObrazu
                key={kol.klucz}
                edycja={edycja}
                taliaId={arkusz.taliaId}
                karty={karty.map((k) => k.karta)}
                pole={pole as PoleObraz}
              />
            );
          }
          // Nazwa nadana w edytorze szablonu ma pierwszeństwo przed nazwami pól pakietu gry.
          const nazwa =
            pole?.nazwa || (kol.typPola === 'tabela' ? kol.nazwa : nazwaPola(kol.klucz, kol.nazwa));
          const w = wspolna(kol.klucz);
          const id = `pole-${kol.klucz}`;
          if (pole?.typ === 'znaczniki') {
            const z = pole as PoleZnaczniki;
            const domyslnie = z.kolumny * z.rzedy;
            const n = w === undefined ? undefined : w === '' ? domyslnie : Number(w) || 0;
            return (
              <div key={kol.klucz} className="pole-panelu">
                <span id={id}>{nazwa}</span>
                <div className="licznik" role="group" aria-labelledby={id}>
                  <button
                    type="button"
                    aria-label={t('kartka.mniej', { pole: nazwa })}
                    disabled={n === 0}
                    onClick={() => ustaw(kol.klucz, String(Math.max(0, (n ?? domyslnie) - 1)))}
                  >
                    −
                  </button>
                  <output aria-live="polite">{n ?? t('kartka.rozne')}</output>
                  <button
                    type="button"
                    aria-label={t('kartka.wiecej', { pole: nazwa })}
                    disabled={(n ?? 0) >= MAKS_ZNACZNIKOW}
                    onClick={() =>
                      ustaw(kol.klucz, String(Math.min(MAKS_ZNACZNIKOW, (n ?? domyslnie) + 1)))
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            );
          }
          const dlugi =
            pole?.typ === 'tekst' && pole.wieleWierszy !== false && kol.klucz !== 'nazwa';
          const lista = podpowiedzi.get(kol.klucz);
          const wspolne = {
            id,
            value: w ?? '',
            // Podpowiedź: wartość domyślna pola z szablonu (gdy karta jej nie nadpisuje).
            placeholder:
              w === undefined
                ? t('kartka.rozne')
                : (kol.domyslnie ??
                  (pole &&
                  (pole.typ === 'tekst' || pole.typ === 'wartosc') &&
                  typeof pole.tekst === 'string'
                    ? pole.tekst
                    : undefined)),
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              ustaw(kol.klucz, e.target.value),
          };
          return (
            <div key={kol.klucz} className="pole-panelu">
              <label htmlFor={id}>{nazwa}</label>
              {dlugi ? (
                <PoleWielowierszowe
                  kluczRozmiaru={`kartka:${szablon.id}:${kol.klucz}`}
                  rows={2}
                  {...wspolne}
                  onPaste={(e) =>
                    obsluzWklejenieZPdf(e, (v) =>
                      zmien((p) => ustawDaneKart(p, arkusz.id, ids, kol.klucz, v)),
                    )
                  }
                />
              ) : (
                <input type="text" list={lista ? `${id}-lista` : undefined} {...wspolne} />
              )}
              {lista && !dlugi && (
                <datalist id={`${id}-lista`}>
                  {[...lista].sort().map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              )}
            </div>
          );
        })}

      {jedna && rozmiary.length > 1 && (
        <div className="pole-panelu">
          <span id="rozmiar-karty">{t('talia.rozmiar')}</span>
          <div className="przelacznik-segmentowy" role="group" aria-labelledby="rozmiar-karty">
            {rozmiary.map((r, i) => {
              const aktywny = jedna.kolumny === r.kolumny && jedna.rzedy === r.rzedy;
              return (
                <button
                  key={opisRozmiaru(r)}
                  type="button"
                  aria-pressed={aktywny}
                  disabled={!aktywny && !mozliwe[i]}
                  title={!aktywny && !mozliwe[i] ? t('kartka.nieMiesci') : undefined}
                  onClick={() => {
                    const w = zmienRozmiarKarty(projekt, arkusz.id, jedna.karta.id, r, ctx);
                    if ('blad' in w) ustawBladRozmiaru(t('kartka.nieMiesci'));
                    else {
                      ustawBladRozmiaru(undefined);
                      zmien((p) => {
                        const x = zmienRozmiarKarty(p, arkusz.id, jedna.karta.id, r, ctx);
                        return 'projekt' in x ? x.projekt : p;
                      });
                    }
                  }}
                >
                  {opisRozmiaru(r)}
                </button>
              );
            })}
          </div>
          {bladRozmiaru && <p className="blad-pola">{bladRozmiaru}</p>}
        </div>
      )}

      <div className="akcje-panelu">
        <button type="button" onClick={() => duplikuj(1)}>
          {t('kartka.duplikuj')}
        </button>
        {jedna && (
          <label className="duplikuj-n">
            {t('kartka.ileKopii')}
            <input
              type="number"
              min={1}
              max={Math.max(liczbaKopii, MAKS_EGZEMPLARZY)}
              value={wpisaneKopie ?? liczbaKopii}
              onChange={(e) => {
                if (e.nativeEvent instanceof InputEvent && e.nativeEvent.inputType)
                  ustawWpisaneKopie(e.target.value);
                else zatwierdzKopie(e.target.valueAsNumber);
              }}
              onBlur={(e) => {
                if (wpisaneKopie !== undefined) zatwierdzKopie(e.target.valueAsNumber);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  ustawWpisaneKopie(undefined);
                } else if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const aktualna = e.currentTarget.valueAsNumber;
                  const krok = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
                  zatwierdzKopie(
                    (krok && !Number.isFinite(aktualna) ? liczbaKopii : aktualna) + krok,
                  );
                }
              }}
            />
          </label>
        )}
        <button type="button" className="niebezpieczny" onClick={usun}>
          {t('kartka.usun')}
        </button>
      </div>
      {!bezRewersu &&
        (() => {
          const rewersyLista = projekt.rewersy ?? [];
          const rewersyMapa = new Map(rewersyLista.map((r) => [r.id, r] as const));
          const talia = projekt.talie.find((x) => x.id === arkusz.taliaId);
          const bezposrednie = new Set(karty.map((k) => k.karta.rewersId));
          const wspolnyDirect = bezposrednie.size === 1 ? [...bezposrednie][0] : '__rozne__';
          const wartoscSelect =
            wspolnyDirect === '__rozne__'
              ? '__rozne__'
              : wspolnyDirect === undefined
                ? ''
                : wspolnyDirect === null
                  ? '__brak__'
                  : wspolnyDirect;
          const zrodloDziedziczenia = (() => {
            if (szablon) {
              if (szablon.rewersId === null) return t('rewers.bezRewersu');
              if (typeof szablon.rewersId === 'string') {
                const r = rewersyMapa.get(szablon.rewersId);
                if (r) return t('rewers.zrodloSzablon', { nazwa: r.nazwa });
              }
            }
            if (typeof talia?.rewersId === 'string') {
              const r = rewersyMapa.get(talia.rewersId);
              if (r) return t('rewers.zrodloTalia', { nazwa: r.nazwa });
            }
            return t('rewers.zrodloBrak');
          })();
          const rozstrzygniete = karty.map((k) => {
            const s = ctx.szablony.get(k.karta.szablonId);
            return s ? rewersKarty(rewersyMapa, k.karta, s, talia ?? {}) : undefined;
          });
          const pierwszyRozstrzygniety = rozstrzygniete[0];
          const tenSamRozstrzygniety =
            pierwszyRozstrzygniety &&
            rozstrzygniete.every((r) => r?.id === pierwszyRozstrzygniety.id)
              ? pierwszyRozstrzygniety
              : undefined;
          const jedyneZrodlo =
            jedna && szablon
              ? zrodloRewersuKarty(rewersyMapa, jedna.karta, szablon, talia ?? {})
              : undefined;
          const docelowy =
            jedna && szablon
              ? {
                  ...wymiaryKarty(szablon, jedna.karta),
                  ...(szablon.promienRogow !== undefined
                    ? { promienRogow: szablon.promienRogow }
                    : {}),
                }
              : szablon
                ? {
                    ...wymiaryKarty(szablon),
                    ...(szablon.promienRogow !== undefined
                      ? { promienRogow: szablon.promienRogow }
                      : {}),
                  }
                : undefined;
          return (
            <div className="pole-panelu">
              <label htmlFor="karta-rewers">{t('rewers.przypisanieKarta')}</label>
              <select
                id="karta-rewers"
                aria-label={t('rewers.przypisanieKarta')}
                value={wartoscSelect}
                onChange={(e) => {
                  const { id: v, zrodlo } = wybranaOpcja(e);
                  if (v === '__rozne__') return;
                  if (zrodlo === 'globalny') {
                    const wpis = rewersyGlobalne.find((w) => w.klucz === v);
                    if (wpis) {
                      void dolaczRewersGlobalnyDoProjektu(wpis, edycja, (p, rid) =>
                        przypiszRewersKartom(p, arkusz.taliaId, ids, rid),
                      ).catch(() => undefined);
                    }
                    return;
                  }
                  const nowy = v === '' ? undefined : v === '__brak__' ? null : v;
                  zmien((p) => przypiszRewersKartom(p, arkusz.taliaId, ids, nowy));
                }}
              >
                {wspolnyDirect === '__rozne__' && (
                  <option value="__rozne__" disabled>
                    {t('rewers.roznePrzypisania')}
                  </option>
                )}
                <option value="">{t('rewers.dziedzicz', { zrodlo: zrodloDziedziczenia })}</option>
                <option value="__brak__">{t('rewers.bezRewersu')}</option>
                {rewersyLista.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nazwa}
                  </option>
                ))}
                <OpcjeRewersowGlobalnych lista={rewersyGlobalne} />
              </select>
              {(jedna || tenSamRozstrzygniety) && (
                <PodgladRewersu
                  rewers={tenSamRozstrzygniety}
                  {...(docelowy ? { docelowy } : {})}
                  {...(jedna && szablon ? { awers: { szablon, dane: jedna.karta.dane } } : {})}
                  zasoby={edycja.zasoby.zasoby}
                  komunikatBraku={
                    jedyneZrodlo?.wylaczony
                      ? t('rewers.rozstrzygnietyWylaczony')
                      : t('rewers.rozstrzygnietyBrak')
                  }
                />
              )}
            </div>
          );
        })()}
      {dodajNaglowek && (
        <p>
          <button type="button" onClick={dodajNaglowek}>
            {t('kartka.dodajNaglowek')}
          </button>
        </p>
      )}
      {edytujSzablon && szablon && (
        <p>
          <a className="przycisk" href={edytujSzablon}>
            {t('kartka.edytujSzablon', { nazwa: szablon.nazwa })}
          </a>
        </p>
      )}
      <EksportCsvSzablonu
        szablony={[...ctx.szablony.values()]}
        {...(szablon ? { domyslnySzablonId: szablon.id } : {})}
      />
    </aside>
  );
}
