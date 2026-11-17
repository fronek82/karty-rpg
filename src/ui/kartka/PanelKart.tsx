import { useState } from 'react';
import { kolumnySzablonu } from '../../dane/edycja';
import { nazwaKarty } from '../../dane/szablon';
import {
  mozliweRozmiary,
  ustawDaneKart,
  zmienRozmiarKarty,
  type KartaNaKartce,
  type KontekstKartki,
} from '../../dane/kartka';
import { t, tJesliJest } from '../../i18n';
import { MAKS_ZNACZNIKOW } from '../../silnik/karta';
import type { Arkusz } from '../../model/arkusz';
import {
  czyKontener,
  type Pole,
  type PoleObraz,
  type PoleZnaczniki,
  type Szablon,
  type Wezel,
} from '../../model/szablon';
import type { Pakiet, TypKarty } from '../../pakiety/typy';
import type { ProjektWEdycji } from '../useProjekt';
import { SekcjaObrazu } from './SekcjaObrazu';

function* pola(w: Wezel): Generator<Pole> {
  if (czyKontener(w)) for (const d of w.dzieci) yield* pola(d);
  else yield w;
}

/** Pola szablonu według klucza (wszystkie warianty układu). */
function polaSzablonu(s: Szablon): Map<string, Pole> {
  const m = new Map<string, Pole>();
  for (const k of [s.korzen, ...(s.warianty ?? []).map((w) => w.korzen)])
    for (const p of pola(k)) if (p.klucz && !m.has(p.klucz)) m.set(p.klucz, p);
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
const opisRozmiaru = (r: TypKarty['rozmiary'][number]) =>
  `${r.kolumny}×${r.rzedy}${r.nazwa ? ` ${r.nazwa}` : ''}`;

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
}: {
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
  const [ile, ustawIle] = useState(2);
  const [bladRozmiaru, ustawBladRozmiaru] = useState<string>();
  const ids = karty.map((k) => k.karta.id);
  const szablonIds = new Set(karty.map((k) => k.karta.szablonId));
  const szablon = szablonIds.size === 1 ? ctx.szablony.get([...szablonIds][0]!) : undefined;
  const jedna = karty.length === 1 ? karty[0] : undefined;
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
    zmien((p) => ustawDaneKart(p, arkusz.id, ids, klucz, v), {
      klucz: `pole:${klucz}:${ids.join(',')}`,
    });

  const rozmiary = typ?.typ.rozmiary ?? [];
  const mozliwe = jedna ? mozliweRozmiary(projekt, arkusz.id, jedna.karta.id, rozmiary, ctx) : [];
  const polozenie = jedna
    ? t('kartka.polozenie', {
        strona: jedna.strona + 1,
        kolumna: jedna.kolumna + 1,
        rzad: jedna.rzad + 1,
      })
    : '';
  const tytul = jedna
    ? nazwaKarty(jedna.karta.dane, ctx.szablony.get(jedna.karta.szablonId)) ||
      typ?.wariant.nazwa ||
      t('karta.bezNazwy')
    : t('kartka.zaznaczono', { liczba: karty.length });

  return (
    <aside className="panel-edytora" aria-label={t('kartka.panelKart')}>
      <div className="naglowek-panelu">
        <h2>{tytul}</h2>
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
        {szablon ? (typ?.wariant.nazwa ?? szablon.nazwa) : t('kartka.rozneTypy')}
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
                <textarea rows={2} {...wspolne} />
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
        <span className="duplikuj-n">
          <input
            type="number"
            min={1}
            max={100}
            value={ile}
            aria-label={t('kartka.ileKopii')}
            onChange={(e) => ustawIle(Math.max(1, Math.min(100, e.target.valueAsNumber || 1)))}
          />
          <button type="button" onClick={() => duplikuj(ile)}>
            {t('kartka.duplikujN', { n: ile })}
          </button>
        </span>
        <button type="button" className="niebezpieczny" onClick={usun}>
          {t('kartka.usun')}
        </button>
      </div>
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
    </aside>
  );
}
