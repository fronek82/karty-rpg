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
import { czyKartkaZnormalizowana, normalizujKartki, pakietProjektu } from './normalizacja';

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

  it('karta z ilością 0 jest zgłaszana jako pominięta', () => {
    const x = structuredClone(p);
    x.talie[0]!.karty[0]!.ilosc = 0;
    const { pominiete } = normalizujKartki(x, { czcionki, obraz });
    expect(pominiete).toEqual([x.talie[0]!.karty[0]!.id]);
  });

  it('pakiet rozpoznawany po szablonach', () => {
    expect(pakietProjektu({ ...p, pakiet: undefined })).toBe('mausritter');
    expect(pakietProjektu({ ...p, pakiet: undefined, szablony: [] })).toBeUndefined();
  });
});
