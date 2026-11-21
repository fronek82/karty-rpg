import { describe, expect, it } from 'vitest';
import { wymiaryKarty, type Szablon } from '../../model/szablon';
import { renderujKarte } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import { rejestrTestowy } from '../../silnik/__testy__/pomoc';
import { zbudujArkusz } from '../../druk/arkusz';
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
    // Wszystkie użyte warianty czcionek są w pakiecie (bez zastępowania najbliższym).
    expect([...czcionki.brakujaceWarianty.values()]).toEqual([]);
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

  it('zaklęcie obsługuje pole nazwy obok gwiazdki bez ostrzeżeń', () => {
    const zaklecieSzablon = szablony.get('mausritter-zaklecie')!;
    const bezNazwy = renderujKarte(zaklecieSzablon, { dane: { obraz: OBRAZ_ZASTEPCZY } }, ctx);
    const zNazwa = renderujKarte(
      zaklecieSzablon,
      { dane: { nazwa: 'Kula ognia', obraz: OBRAZ_ZASTEPCZY } },
      ctx,
    );
    const zDlugaNazwa = renderujKarte(
      zaklecieSzablon,
      { dane: { nazwa: 'Niewidzialność', obraz: OBRAZ_ZASTEPCZY } },
      ctx,
    );
    expect(zNazwa.ostrzezenia).toEqual([]);
    expect(zDlugaNazwa.ostrzezenia).toEqual([]);
    expect(zNazwa.scena.elementy.length).toBeGreaterThan(bezNazwy.scena.elementy.length);
  });
});

describe('pakiet Mausritter – edytor kartki', () => {
  const szablony = new Map(pakietMausritter.szablony.map((s) => [s.id, s]));

  it('typy kart wskazują istniejące szablony; rozmiar domyślny pierwszy, bez powtórzeń', () => {
    for (const typ of pakietMausritter.typyKart) {
      for (const w of typ.warianty) expect(szablony.has(w.szablonId), w.szablonId).toBe(true);
      const r = typ.rozmiary.map((x) => `${x.kolumny}x${x.rzedy}`);
      expect(new Set(r).size).toBe(r.length);
    }
    expect(pakietMausritter.typyKart.map((t) => t.nazwa)).toEqual([
      'Broń',
      'Zbroja',
      'Ekwipunek',
      'Zaklęcie',
      'Stan',
      'Pusta karta',
    ]);
  });

  it('gotowe układy wskazują arkusze pakietu', () => {
    const arkusze = new Set(pakietMausritter.arkusze.map((a) => a.id));
    for (const u of pakietMausritter.gotoweUklady)
      for (const a of u.arkusze) expect(arkusze.has(a), a).toBe(true);
  });

  it('nowa kartka: jedna pusta strona 10 × 7, bez ostrzeżeń; nagłówek grupy przesuwa siatkę w dół', () => {
    const arkusz = {
      id: 'k',
      nazwa: 'Moje karty',
      taliaId: 't',
      liczbaStron: 1,
      ustawienia: pakietMausritter.nowaKartka.ustawienia,
    };
    const talia = { id: 't', nazwa: 'Moje karty', karty: [] };
    const kontekst = { czcionki: rejestrTestowy(), szablony };
    const w = zbudujArkusz(arkusz, talia, kontekst);
    expect(w.strony).toHaveLength(1);
    expect(w.ostrzezenia).toEqual([]);
    expect(w.siatka).toMatchObject({ kolumny: 10, rzedy: 7 });
    const zNaglowkiem = zbudujArkusz(
      {
        ...arkusz,
        naglowki: [{ id: 'g', strona: 0, kolumna: 0, kolumny: 2, naglowek: 'Ranna', opis: 'Opis' }],
      },
      talia,
      kontekst,
    );
    // Pas nagłówka (~12 mm) mieści się w zapasie strony – siatka zostaje 10 × 7, niżej.
    expect(zNaglowkiem.siatka).toMatchObject({ kolumny: 10, rzedy: 7 });
    expect(zNaglowkiem.poczatekSiatki.y).toBeGreaterThan(w.poczatekSiatki.y + 8);
    expect(zNaglowkiem.ostrzezenia).toEqual([]);
    expect(zNaglowkiem.naglowki).toHaveLength(1);
  });
});
