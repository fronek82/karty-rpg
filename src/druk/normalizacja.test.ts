/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { projektZPakietu, rejestrZProjektu } from '../dane/pakiet';
import { przygotujProjekt } from '../dane/schemat';
import type { Projekt } from '../model/projekt';
import { pakietMausritter } from '../pakiety/mausritter';
import { OBRAZ_ZASTEPCZY } from '../pakiety/mausritter/talie';
import type { RejestrCzcionek } from '../silnik/czcionki';
import { scenaDoSvg } from '../silnik/svg';
import { zbudujArkusz } from './arkusz';
import {
  czyKartkaZnormalizowana,
  kartyOdlozone,
  normalizujKartki,
  pakietProjektu,
  wrocDoSiatki,
} from './normalizacja';

const czytaj = async (plik: string) => new Uint8Array(readFileSync(plik));
let p: Projekt;
let czcionki: RejestrCzcionek;
const obraz = (z: string) =>
  z === OBRAZ_ZASTEPCZY ? { szerokosc: 512, wysokosc: 512 } : undefined;

beforeAll(async () => {
  const w = await projektZPakietu(
    pakietMausritter,
    (f) => czytaj(`public/czcionki/${f}`),
    () => czytaj('src/pakiety/mausritter/obrazy/zastepczy.png'),
    'p',
  );
  p = w.projekt;
  czcionki = rejestrZProjektu(p, w.zasoby).rejestr;
});

/** SVG wszystkich stron każdego arkusza – wydruk projektu. */
function wydruk(x: Projekt): string[][] {
  const szablony = new Map(x.szablony.map((s) => [s.id, s]));
  return x.arkusze.map((a) =>
    zbudujArkusz(
      a,
      x.talie.find((t) => t.id === a.taliaId)!,
      { czcionki, szablony, obraz },
    ).strony.map((s) => scenaDoSvg(s)),
  );
}

describe('normalizacja do modelu kartki', () => {
  it('pakiet: wydruk identyczny, ilość 1, wszystko przypięte, grupy → nagłówki', () => {
    expect(czyKartkaZnormalizowana(p)).toBe(false);
    const { projekt: n, pominiete } = normalizujKartki(p, { czcionki, obraz });
    expect(() => przygotujProjekt(n)).not.toThrow();
    expect(czyKartkaZnormalizowana(n)).toBe(true);
    expect(wydruk(n)).toEqual(wydruk(p));
    const stany = n.arkusze.find((a) => a.id === 'mausritter-arkusz-stany')!;
    expect(stany.naglowki?.length).toBeGreaterThan(3);
    expect(stany.naglowki!.filter((h) => h.odstepPrzed).length).toBeGreaterThan(0);
    expect(n.talie.every((t) => !t.grupy)).toBe(true);
    // Pakiet nie ma kart z ilością 0.
    expect(pominiete).toEqual([]);
    const sztuki = (x: Projekt) =>
      x.talie.reduce((s, t) => s + t.karty.reduce((a, k) => a + k.ilosc, 0), 0);
    expect(sztuki(n)).toBe(sztuki(p));
    expect(n.pakiet).toBe('mausritter');
  });

  it('rozmieszczenie automatyczne zostaje zamrożone bez zmiany wydruku; idempotentna', () => {
    const auto: Projekt = { ...p, arkusze: p.arkusze.map((a) => ({ ...a, przypiete: [] })) };
    const { projekt: n } = normalizujKartki(auto, { czcionki, obraz });
    expect(wydruk(n)).toEqual(wydruk(auto));
    const { projekt: n2 } = normalizujKartki(n, { czcionki, obraz });
    expect(wydruk(n2)).toEqual(wydruk(n));
    expect(n2.arkusze.map((a) => a.przypiete)).toEqual(n.arkusze.map((a) => a.przypiete));
  });

  it('karta z ilością 0 zostaje w talii jako odłożona (nic nie ginie)', () => {
    const x = structuredClone(p);
    x.talie[0]!.karty[0]!.ilosc = 0;
    const id = x.talie[0]!.karty[0]!.id;
    const { projekt: n, pominiete } = normalizujKartki(x, { czcionki, obraz });
    expect(pominiete).toEqual([id]);
    const k = n.talie.flatMap((t) => t.karty).find((y) => y.id === id)!;
    expect(k.ilosc).toBe(0);
    expect(n.arkusze.flatMap((a) => a.przypiete ?? []).some((y) => y.kartaId === id)).toBe(false);
    expect(czyKartkaZnormalizowana(n)).toBe(true);
    expect(kartyOdlozone(n, x.arkusze.find((a) => a.taliaId === x.talie[0]!.id)!.id)).toHaveLength(
      1,
    );
  });

  it('stany z kartą spoza grup: wydruk identyczny (kolumna i odstęp regionu bez grupy)', () => {
    const x = structuredClone(p);
    const stany = x.talie.find((t) => t.grupy?.length)!;
    const g = stany.grupy!.at(-1)!;
    // Ostatnia grupa bez nagłówka – jej karty układają się w regionie bez grupy.
    stany.grupy = stany.grupy!.slice(0, -1);
    void g;
    const { projekt: n } = normalizujKartki(x, { czcionki, obraz });
    expect(wydruk(n)).toEqual(wydruk(x));
    expect(czyKartkaZnormalizowana(n)).toBe(true);
  });

  it('talia bez arkusza dostaje własną kartkę', () => {
    const x = structuredClone(p);
    x.talie.push({
      id: 'luzna',
      nazwa: 'Luźne karty',
      karty: [{ ...x.talie[0]!.karty[0]!, id: 'luzna-1', ilosc: 2 }],
    });
    const { projekt: n } = normalizujKartki(x, { czcionki, obraz });
    const a = n.arkusze.find((y) => y.taliaId === 'luzna')!;
    expect(a.przypiete).toHaveLength(2);
    expect(czyKartkaZnormalizowana(n)).toBe(true);
  });

  it('pakiet rozpoznawany po szablonach', () => {
    expect(pakietProjektu({ ...p, pakiet: undefined })).toBe('mausritter');
    expect(pakietProjektu({ ...p, pakiet: undefined, szablony: [] })).toBeUndefined();
  });
});

describe('mieszane rozmiary a normalizacja', () => {
  it('kartka w trybie mieszanym bez przypięć jest uznana za znormalizowaną i nie jest zmieniana', () => {
    const { projekt: n } = normalizujKartki(p, { czcionki, obraz });
    const A = n.arkusze[0]!.id;
    const m: Projekt = {
      ...n,
      arkusze: n.arkusze.map((a) =>
        a.id === A
          ? { ...a, przypiete: [], ustawienia: { ...a.ustawienia, rozmiary: 'mieszane' as const } }
          : a,
      ),
    };
    expect(czyKartkaZnormalizowana(m)).toBe(true);
    const znowu = normalizujKartki(m, { czcionki, obraz }).projekt;
    expect(znowu.arkusze.find((a) => a.id === A)).toEqual(m.arkusze.find((a) => a.id === A));
  });

  it('powrót do siatki: karty znowu przypięte, nic nie ginie', () => {
    const { projekt: n } = normalizujKartki(p, { czcionki, obraz });
    const A = n.arkusze[0]!.id;
    const m: Projekt = {
      ...n,
      arkusze: n.arkusze.map((a) =>
        a.id === A
          ? { ...a, przypiete: [], ustawienia: { ...a.ustawienia, rozmiary: 'mieszane' as const } }
          : a,
      ),
    };
    const { projekt: wrot, odlozone } = wrocDoSiatki(m, A, { czcionki, obraz });
    expect(odlozone).toBe(0);
    const a = wrot.arkusze.find((x) => x.id === A)!;
    expect(a.ustawienia.rozmiary).toBeUndefined();
    const talia = wrot.talie.find((t) => t.id === a.taliaId)!;
    const wsz = talia.karty.filter((k) => k.ilosc === 1).length;
    expect(a.przypiete).toHaveLength(wsz);
    expect(wsz + kartyOdlozone(wrot, A).length).toBeGreaterThanOrEqual(talia.karty.length);
    expect(() => przygotujProjekt(wrot)).not.toThrow();
  });

  it('powrót do siatki: ilość > 1 rozwinięta w egzemplarze, karta za duża odłożona i policzona, kolejność wyczyszczona', () => {
    const { projekt: n } = normalizujKartki(p, { czcionki, obraz });
    const A = n.arkusze[0]!.id;
    const taliaId = n.arkusze[0]!.taliaId;
    const karty = n.talie.find((t) => t.id === taliaId)!.karty;
    const duza = karty[0]!.id;
    const trzy = karty[1]!.id;
    const m: Projekt = {
      ...n,
      talie: n.talie.map((t) =>
        t.id === taliaId
          ? {
              ...t,
              karty: t.karty.map((k) =>
                k.id === duza
                  ? { ...k, rozmiar: { kolumny: 60, rzedy: 1 } }
                  : k.id === trzy
                    ? { ...k, ilosc: 3 }
                    : k,
              ),
            }
          : t,
      ),
      arkusze: n.arkusze.map((a) =>
        a.id === A
          ? {
              ...a,
              przypiete: [],
              kolejnosc: [trzy, duza],
              ustawienia: { ...a.ustawienia, rozmiary: 'mieszane' as const },
            }
          : a,
      ),
    };
    const { projekt: wrot, odlozone } = wrocDoSiatki(m, A, { czcionki, obraz });
    expect(odlozone).toBe(1);
    const a = wrot.arkusze.find((x) => x.id === A)!;
    expect(a.kolejnosc).toBeUndefined();
    const talia = wrot.talie.find((t) => t.id === taliaId)!;
    expect(talia.karty.find((k) => k.id === duza)!.ilosc).toBe(0);
    expect(talia.karty.filter((k) => k.id === trzy || k.id.startsWith(`${trzy}-`))).toHaveLength(3);
    expect(talia.karty.every((k) => k.ilosc <= 1)).toBe(true);
    expect(() => przygotujProjekt(wrot)).not.toThrow();
  });
});
