import { describe, expect, it } from 'vitest';
import { wymiaryKarty, type Szablon } from '../../model/szablon';
import { renderujKarte } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import { rejestrTestowy } from '../../silnik/__testy__/pomoc';
import { pakietMausritter } from './index';
import { SLOT } from './szablony';
import { OBRAZ_ZASTEPCZY, taliaBroni, taliaStanow, taliaWyposazenia } from './talie';

const czcionki = rejestrTestowy();
const ctx = {
  czcionki,
  obraz: (z: string) => (z === OBRAZ_ZASTEPCZY ? { szerokosc: 512, wysokosc: 512 } : undefined),
};
const szablony = new Map<string, Szablon>(pakietMausritter.szablony.map((s) => [s.id, s]));

const slotyTalii = (talia: typeof taliaBroni) =>
  talia.karty.reduce((suma, k) => {
    const { szer, wys } = wymiaryKarty(szablony.get(k.szablonId)!, k);
    return suma + k.ilosc * Math.round(szer / SLOT) * Math.round(wys / SLOT);
  }, 0);

describe('pakiet Mausritter', () => {
  it('ma 7 szablonów z unikalnymi identyfikatorami', () => {
    expect(szablony.size).toBe(7);
  });

  it('karty odwołują się do istniejących szablonów, identyfikatory kart są unikalne', () => {
    const id = pakietMausritter.talie.flatMap((t) => t.karty.map((k) => k.id));
    expect(new Set(id).size).toBe(id.length);
    for (const t of pakietMausritter.talie)
      for (const k of t.karty) expect(szablony.has(k.szablonId)).toBe(true);
  });

  it('talie wypełniają arkusze referencyjne: 70, 70 i 60 slotów', () => {
    expect(slotyTalii(taliaBroni)).toBe(70);
    expect(slotyTalii(taliaWyposazenia)).toBe(70);
    expect(slotyTalii(taliaStanow)).toBe(60);
  });

  it('grupy stanów obejmują każdą kartę stanu dokładnie raz', () => {
    const wGrupach = taliaStanow.grupy!.flatMap((g) => g.karty);
    expect(wGrupach.sort()).toEqual(taliaStanow.karty.map((k) => k.id).sort());
  });

  it('każda karta renderuje się bez ostrzeżeń (tekst mieści się, są wszystkie znaki)', () => {
    for (const t of pakietMausritter.talie) {
      for (const k of t.karty) {
        const { ostrzezenia } = renderujKarte(szablony.get(k.szablonId)!, k, ctx);
        expect(ostrzezenia, `${t.nazwa}: ${k.id} ${k.dane.nazwa ?? ''}`).toEqual([]);
      }
    }
  });

  const wzorce: [string, (typeof taliaBroni.karty)[number]][] = [
    ['bron', taliaBroni.karty.find((k) => k.dane.nazwa === 'Kiścień')!],
    ['bron-ciezka-1x2', taliaBroni.karty.find((k) => k.dane.nazwa === 'Młot bojowy')!],
    ['amunicja', taliaBroni.karty.find((k) => k.dane.nazwa === 'Strzały')!],
    ['zbroja-2x1', taliaBroni.karty.find((k) => k.dane.nazwa === 'Lekka zbroja')!],
    ['przedmiot-6-uzyc', taliaWyposazenia.karty.find((k) => k.dane.uzycia === '6')!],
    ['sakiewka', taliaWyposazenia.karty.find((k) => k.szablonId === 'mausritter-sakiewka')!],
    ['zaklecie', taliaWyposazenia.karty.find((k) => k.szablonId === 'mausritter-zaklecie')!],
    ['pusta', taliaWyposazenia.karty.find((k) => k.szablonId === 'mausritter-pusta')!],
    ['stan', taliaStanow.karty.find((k) => k.dane.nazwa === 'Ranna')!],
    ['stan-wlasny', taliaStanow.karty.find((k) => !k.dane.nazwa)!],
  ];
  for (const [nazwa, k] of wzorce) {
    it(`wzorzec SVG: ${nazwa}`, async () => {
      const { scena } = renderujKarte(szablony.get(k.szablonId)!, k, ctx);
      await expect(scenaDoSvg(scena, { adresObrazu: () => 'zastepczy.png' })).toMatchFileSnapshot(
        `./__snapshots__/${nazwa}.svg`,
      );
    });
  }
});
