import {
  posortujOdNajwiekszych,
  type KartaDoPasow,
  type OpcjePasow,
  type UmieszczonaWPasie,
  type WynikPasow,
} from './pasy';
import { przecinajaSie, type Prostokat } from '../model/geometria';

const E = 1e-6;
const prawo = (r: Prostokat) => r.x + r.szer;
const dol = (r: Prostokat) => r.y + r.wys;
const porownajPozycje = (a: Prostokat, b: Prostokat) => a.y - b.y || a.x - b.x;
const zawiera = (a: Prostokat, b: Prostokat) =>
  a.x <= b.x + E && a.y <= b.y + E && prawo(a) >= prawo(b) - E && dol(a) >= dol(b) - E;

function wytnij(wolne: Prostokat[], zajety: Prostokat): Prostokat[] {
  const reszta = wolne.flatMap((r) => {
    if (!przecinajaSie(r, zajety)) return [r];
    return [
      { ...r, szer: zajety.x - r.x },
      { ...r, x: prawo(zajety), szer: prawo(r) - prawo(zajety) },
      { ...r, wys: zajety.y - r.y },
      { ...r, y: dol(zajety), wys: dol(r) - dol(zajety) },
    ].filter((p) => p.szer > E && p.wys > E);
  });
  return reszta.filter(
    (r, i) => !reszta.some((p, j) => i !== j && zawiera(p, r) && (j < i || !zawiera(r, p))),
  );
}

function znajdz(
  wolne: Prostokat[],
  karta: KartaDoPasow,
  o: OpcjePasow,
  ostatnia: Prostokat | undefined,
) {
  const ksztalty = [{ szer: karta.szer, wys: karta.wys, obrocona: false }];
  if (o.obracaj && karta.szer !== karta.wys)
    ksztalty.push({ szer: karta.wys, wys: karta.szer, obrocona: true });

  const warianty = wolne.flatMap((r) =>
    ksztalty.flatMap((k) => {
      if (ostatnia && porownajPozycje(r, ostatnia) < 0) return [];
      const ds = r.szer - k.szer - o.odstep;
      const dw = r.wys - k.wys - o.odstep;
      if (ds < -E || dw < -E) return [];
      return [{ ...k, x: r.x, y: r.y, krotki: Math.min(ds, dw), dlugi: Math.max(ds, dw) }];
    }),
  );
  warianty.sort(
    (a, b) =>
      (o.kolejnosc === 'wlasna' ? porownajPozycje(a, b) : 0) ||
      a.krotki - b.krotki ||
      a.dlugi - b.dlugi ||
      porownajPozycje(a, b) ||
      Number(a.obrocona) - Number(b.obrocona),
  );
  return warianty[0];
}

/** Części jednego rekordu mają te same wymiary. Przypisujemy je do jego miejsc w kolejności odczytu. */
function uporzadkujCzesci(karty: UmieszczonaWPasie[]) {
  const wieloczesciowe = new Set(karty.filter((k) => k.czesc).map((k) => k.kartaId));
  const poId = new Map<string, UmieszczonaWPasie[]>();
  for (const k of karty) {
    if (!wieloczesciowe.has(k.kartaId)) continue;
    const grupa = poId.get(k.kartaId) ?? [];
    grupa.push(k);
    poId.set(k.kartaId, grupa);
  }
  for (const miejsca of poId.values()) {
    const czesci = miejsca
      .map(({ klucz, numer, czesc }) => ({ klucz, numer, czesc }))
      .sort((a, b) => a.numer - b.numer);
    miejsca.forEach((m, i) => Object.assign(m, czesci[i]));
  }
}

/** Pakowanie MaxRects. Nagłówki grup rezerwują całą szerokość i rozdzielają obszary pakowania. */
export function ulozMaxRects(wejscie: KartaDoPasow[], o: OpcjePasow): WynikPasow {
  const wynik: WynikPasow = { karty: [], pasy: [], pominiete: [], wolne: [], liczbaStron: 1 };
  const { obszar, odstep } = o;
  const grupy: { id?: string; naglowek: number }[] = [...(o.grupy ?? []), { naglowek: 0 }];
  const idGrup = new Set(grupy.map((g) => g.id));
  const obszarOd = (y: number): Prostokat[] => [
    { x: 0, y, szer: obszar.szer + odstep, wys: obszar.wys + odstep - y },
  ];
  let strona = 0;
  let koniec = 0;
  let ostatnia: UmieszczonaWPasie | undefined;
  let wolne = obszarOd(0);

  const zapiszWolne = () => {
    const pokazane: Prostokat[] = [];
    for (const r of [...wolne].sort((a, b) => b.szer * b.wys - a.szer * a.wys)) {
      const szer = Math.min(r.szer - odstep, obszar.szer - r.x);
      const wys = Math.min(r.wys - odstep, obszar.wys - r.y);
      const miejsce = { x: r.x, y: r.y, szer, wys };
      if (szer < 15 || wys < 15 || pokazane.some((p) => przecinajaSie(p, miejsce))) continue;
      pokazane.push(miejsce);
      const poprzednia = wynik.karty
        .filter((k) => k.strona === strona && porownajPozycje(k, miejsce) < 0)
        .sort(porownajPozycje)
        .at(-1);
      wynik.wolne.push({
        ...miejsce,
        strona,
        ...(poprzednia ? { poKluczu: poprzednia.klucz } : {}),
      });
    }
  };

  for (const g of grupy) {
    const partia = wejscie.filter(
      (k) => k.grupaId === g.id || (g.id === undefined && !idGrup.has(k.grupaId)),
    );
    const karty = o.kolejnosc === 'wlasna' ? partia : posortujOdNajwiekszych(partia);
    let naglowek = g.naglowek;
    let pas: WynikPasow['pasy'][number] | undefined;
    if (!karty.length) continue;

    for (const karta of karty) {
      const poczatek = koniec + (koniec ? odstep : 0);
      const dostepne = pas ? wolne : obszarOd(poczatek + naglowek);
      let miejsce = znajdz(dostepne, karta, o, o.kolejnosc === 'wlasna' ? ostatnia : undefined);
      if (!miejsce) {
        miejsce = znajdz(obszarOd(naglowek), karta, o, undefined);
        if (!miejsce) {
          wynik.pominiete.push(karta.klucz);
          continue;
        }
        zapiszWolne();
        strona++;
        koniec = 0;
        wolne = obszarOd(naglowek);
        pas = undefined;
      } else {
        wolne = dostepne;
      }

      if (!pas) {
        pas = {
          strona,
          y: miejsce.y,
          wys: 0,
          ...(g.id ? { grupaId: g.id } : {}),
          ...(naglowek && g.id
            ? { naglowek: { y: miejsce.y - naglowek, wys: naglowek, grupaId: g.id } }
            : {}),
        };
        wynik.pasy.push(pas);
        naglowek = 0;
      }
      const { x, y, szer, wys, obrocona } = miejsce;
      const { klucz, kartaId, numer, czesc } = karta;
      ostatnia = {
        klucz,
        kartaId,
        numer,
        x,
        y,
        szer,
        wys,
        obrocona,
        strona,
        pas: wynik.pasy.length - 1,
        ...(czesc === undefined ? {} : { czesc }),
        ...(g.id ? { grupaId: g.id } : {}),
      };
      wynik.karty.push(ostatnia);
      koniec = Math.max(koniec, y + wys);
      pas.wys = Math.max(pas.wys, y + wys - pas.y);
      wolne = wytnij(wolne, { x, y, szer: szer + odstep, wys: wys + odstep });
    }
  }
  zapiszWolne();
  wynik.liczbaStron = strona + 1;
  wynik.karty.sort((a, b) => a.strona - b.strona || porownajPozycje(a, b));
  uporzadkujCzesci(wynik.karty);
  return wynik;
}
