import type { CSSProperties } from 'react';
import type { WynikArkusza } from '../../druk/arkusz';
import type { UmieszczonaKarta } from '../../druk/rozmieszczanie';
import {
  odepnijKarte,
  odepnijWszystkie,
  przypnijKarte,
  zamrozUklad,
  type Polozenie,
} from '../../dane/edycja';
import { t } from '../../i18n';
import type { Arkusz } from '../../model/arkusz';
import type { ProjektWEdycji } from '../useProjekt';

/** Egzemplarz karty na arkuszu wskazany do przeniesienia. */
export type Zaznaczenie = Polozenie & { numer: number };

export const polozenie = (u: UmieszczonaKarta): Polozenie => ({
  kartaId: u.karta.id,
  strona: u.strona,
  kolumna: u.kolumna,
  rzad: u.rzad,
});

const takieSamo = (a: Polozenie, b: Polozenie) =>
  a.kartaId === b.kartaId && a.strona === b.strona && a.kolumna === b.kolumna && a.rzad === b.rzad;

export function czyPrzypieta(arkusz: Arkusz, p: Polozenie): boolean {
  return (arkusz.przypiete ?? []).some((x) => takieSamo({ ...x, strona: x.strona ?? 0 }, p));
}

function rozmiarKarty(wynik: WynikArkusza) {
  return (kartaId: string) => {
    const u = wynik.rozmieszczenie.karty.find((x) => x.karta.id === kartaId);
    return { kolumny: u?.kolumny ?? 1, rzedy: u?.rzedy ?? 1 };
  };
}

/** Przeniesienie zaznaczonej karty na `cel`; zwraca komunikat błędu albo undefined. */
export function przenies(
  edycja: ProjektWEdycji,
  arkusz: Arkusz,
  wynik: WynikArkusza,
  zaznaczona: Zaznaczenie,
  cel: Omit<Polozenie, 'kartaId'>,
): string | undefined {
  const z = czyPrzypieta(arkusz, zaznaczona) ? zaznaczona : undefined;
  const w = przypnijKarte(
    edycja.projekt,
    arkusz.id,
    z,
    { kartaId: zaznaczona.kartaId, ...cel },
    rozmiarKarty(wynik),
    wynik.siatka,
  );
  if ('blad' in w) return t(w.blad === 'koliduje' ? 'korekta.koliduje' : 'korekta.pozaSiatka');
  edycja.zmien(() => w.projekt);
  return undefined;
}

/**
 * Nakładka na podgląd strony: przyciski kart (zaznacz / cel zamiany) i – gdy karta jest
 * zaznaczona – przyciski slotów docelowych. Pozycje w procentach strony, więc działają w obu
 * skalach podglądu.
 */
export function NakladkaKorekty({
  wynik,
  arkusz,
  strona,
  nazwy,
  zaznaczona,
  zaznacz,
  doCelu,
}: {
  wynik: WynikArkusza;
  arkusz: Arkusz;
  strona: number;
  nazwy: Map<string, string>;
  zaznaczona?: Zaznaczenie;
  zaznacz: (z: Zaznaczenie | undefined) => void;
  doCelu: (cel: Omit<Polozenie, 'kartaId'>) => void;
}) {
  const scena = wynik.strony[strona]!;
  const { slot, poczatekSiatki: p0 } = wynik;
  const styl = (
    x: number,
    kolumna: number,
    rzad: number,
    kolumny: number,
    rzedy: number,
  ): CSSProperties => ({
    left: `${((p0.x + x + kolumna * slot.szerokosc) / scena.szer) * 100}%`,
    top: `${((p0.y + rzad * slot.wysokosc) / scena.wys) * 100}%`,
    width: `${((kolumny * slot.szerokosc) / scena.szer) * 100}%`,
    height: `${((rzedy * slot.wysokosc) / scena.wys) * 100}%`,
  });
  const sloty = [];
  if (zaznaczona) {
    for (let r = 0; r < wynik.siatka.rzedy; r++)
      for (let k = 0; k < wynik.siatka.kolumny; k++)
        sloty.push(
          <button
            key={`s${k}-${r}`}
            type="button"
            className="slot-docelowy"
            style={styl(0, k, r, 1, 1)}
            aria-label={t('korekta.slot', { strona: strona + 1, kolumna: k + 1, rzad: r + 1 })}
            onClick={() => doCelu({ strona, kolumna: k, rzad: r })}
          />,
        );
  }
  return (
    <div className="nakladka-korekty">
      {sloty}
      {wynik.rozmieszczenie.karty
        .filter((u) => u.strona === strona)
        .map((u) => {
          const pol = polozenie(u);
          const przypieta = czyPrzypieta(arkusz, pol);
          const wybrana = !!zaznaczona && takieSamo(zaznaczona, pol);
          const nazwa = nazwy.get(u.karta.id) || u.karta.id;
          return (
            <button
              key={`${u.karta.id}-${u.numer}`}
              type="button"
              className={`karta-korekty${przypieta ? ' przypieta' : ''}${wybrana ? ' zaznaczona' : ''}`}
              style={styl(u.xRegionu, u.kolumna, u.rzad, u.kolumny, u.rzedy)}
              aria-pressed={wybrana}
              aria-label={t(przypieta ? 'korekta.kartaPrzypieta' : 'korekta.karta', {
                nazwa,
                strona: strona + 1,
                kolumna: u.kolumna + 1,
                rzad: u.rzad + 1,
              })}
              onClick={() => {
                if (wybrana) zaznacz(undefined);
                else if (zaznaczona) doCelu({ strona, kolumna: u.kolumna, rzad: u.rzad });
                else zaznacz({ ...pol, numer: u.numer });
              }}
            />
          );
        })}
    </div>
  );
}

/** Pasek narzędzi korekty: odpinanie, zamrożenie układu. */
export function PasekKorekty({
  edycja,
  arkusz,
  wynik,
  zaznaczona,
  zaznacz,
  komunikat,
}: {
  edycja: ProjektWEdycji;
  arkusz: Arkusz;
  wynik: WynikArkusza;
  zaznaczona?: Zaznaczenie;
  zaznacz: (z: Zaznaczenie | undefined) => void;
  komunikat?: string;
}) {
  return (
    <div className="pasek-korekty">
      <p>{zaznaczona ? t('korekta.wskazCel') : t('korekta.instrukcja')}</p>
      <div className="wiersz-pol">
        <button
          type="button"
          disabled={!zaznaczona || !czyPrzypieta(arkusz, zaznaczona)}
          onClick={() => {
            if (!zaznaczona) return;
            edycja.zmien((p) => odepnijKarte(p, arkusz.id, zaznaczona));
            zaznacz(undefined);
          }}
        >
          {t('korekta.odepnij')}
        </button>
        <button
          type="button"
          onClick={() => {
            edycja.zmien((p) =>
              zamrozUklad(p, arkusz.id, wynik.rozmieszczenie.karty.map(polozenie)),
            );
            zaznacz(undefined);
          }}
        >
          {t('korekta.zamroz')}
        </button>
        <button
          type="button"
          disabled={!arkusz.przypiete?.length}
          onClick={() => {
            edycja.zmien((p) => odepnijWszystkie(p, arkusz.id));
            zaznacz(undefined);
          }}
        >
          {t('korekta.odepnijWszystkie')}
        </button>
        {zaznaczona && (
          <button type="button" onClick={() => zaznacz(undefined)}>
            {t('projekty.anuluj')}
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className="status">
        {komunikat ?? ''}
      </p>
    </div>
  );
}
