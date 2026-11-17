import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { zbudujArkusz } from '../druk/arkusz';
import { scenyDoPdf } from '../druk/pdf';
import { WERSJA_SCHEMATU, type DaneZasobow, type OpisObrazu, type Projekt } from '../model/projekt';
import type { Arkusz } from '../model/arkusz';
import type { Szablon, Talia } from '../model/szablon';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import { daneCzaru, szablonCzaru } from '../silnik/__testy__/przyklady';
import { renderujKarte } from '../silnik/karta';
import { scenaDoSvg } from '../silnik/svg';
import { scenyKart } from '../ui/eksportObrazow';
import { eksportujProjekt, eksportujSzablon, importujProjekt, importujSzablon } from './archiwum';
import { ustawieniaKartkiDla } from './wlasneKarty';
import { migruj, ostrzezeniaProjektu, przygotujProjekt } from './schemat';
import { ustawPodklad, usunPodklad } from './podklad';
import { zmienSzablon } from './szablon';

// 1×1 px, PNG (czarny piksel).
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);
const opis = (id: string): OpisObrazu => ({
  rodzaj: 'obraz',
  id,
  nazwa: `${id}.png`,
  format: 'png',
  szerokosc: 1,
  wysokosc: 1,
});
const czcionki = rejestrTestowy();
const PODKLAD = 'wzor-karty';

const projektBazowy = (): Projekt => ({
  wersja: WERSJA_SCHEMATU,
  id: 'p',
  nazwa: 'P',
  utworzono: '2026-01-01T00:00:00.000Z',
  zmieniono: '2026-01-01T00:00:00.000Z',
  role: {},
  zasoby: [],
  szablony: [szablonCzaru],
  talie: [],
  arkusze: [],
});
const zPodkladem = (): { projekt: Projekt; dane: DaneZasobow } =>
  ustawPodklad(projektBazowy(), new Map(), szablonCzaru.id, { opis: opis(PODKLAD), dane: PNG });
const szablonZPodkladem = (): Szablon =>
  zPodkladem().projekt.szablony.find((s) => s.id === szablonCzaru.id)!;

describe('schemat 16: podkład szablonu', () => {
  it('wersja 16, migracja z 15 tożsamościowa (projekt i szablon)', () => {
    expect(WERSJA_SCHEMATU).toBe(16);
    expect(migruj({ wersja: 15, a: 1 }, 'projekt')).toEqual({ wersja: 16, a: 1 });
    expect(migruj({ wersja: 15, a: 1 }, 'szablon')).toEqual({ wersja: 16, a: 1 });
  });

  it('zod: poprawny podkład przechodzi, limity i brakujące pola są odrzucane', () => {
    const ok = zPodkladem().projekt;
    expect(przygotujProjekt(JSON.parse(JSON.stringify(ok))).szablony[0]!.podklad).toEqual({
      zasob: PODKLAD,
      przezroczystosc: 50,
      widoczny: true,
    });
    const z = (podklad: unknown) => {
      const p = JSON.parse(JSON.stringify(ok));
      p.szablony[0].podklad = podklad;
      return () => przygotujProjekt(p);
    };
    expect(z({ zasob: PODKLAD, przezroczystosc: 101, widoczny: true })).toThrow();
    expect(z({ zasob: PODKLAD, przezroczystosc: -1, widoczny: true })).toThrow();
    expect(z({ zasob: PODKLAD, przezroczystosc: 50 })).toThrow();
    expect(z({ zasob: '', przezroczystosc: 50, widoczny: false })).toThrow();
  });

  it('podkład bez obrazu w bibliotece to ostrzeżenie, nie błąd', () => {
    const p = projektBazowy();
    p.szablony = [
      { ...szablonCzaru, podklad: { zasob: 'brak', przezroczystosc: 50, widoczny: true } },
    ];
    expect(ostrzezeniaProjektu(p).some((o) => o.includes('brak'))).toBe(true);
    expect(ostrzezeniaProjektu(zPodkladem().projekt)).toEqual([]);
  });
});

describe('ustawPodklad i usunPodklad', () => {
  it('dokłada obraz do zasobów projektu, domyślnie 50 % i widoczny', () => {
    const { projekt, dane } = zPodkladem();
    expect(projekt.zasoby.map((z) => z.id)).toEqual([PODKLAD]);
    expect(dane.get(PODKLAD)).toEqual(PNG);
    expect(szablonZPodkladem().podklad).toEqual({
      zasob: PODKLAD,
      przezroczystosc: 50,
      widoczny: true,
    });
  });

  it('nowy obraz zastępuje stary (zachowuje przezroczystość); stary znika, gdy nic go nie używa', () => {
    let w = zPodkladem();
    w = {
      ...w,
      projekt: zmienSzablon(w.projekt, szablonCzaru.id, (s) => ({
        ...s,
        podklad: { ...s.podklad!, przezroczystosc: 80, widoczny: false },
      })),
    };
    const n = ustawPodklad(w.projekt, w.dane, szablonCzaru.id, { opis: opis('inny'), dane: PNG });
    expect(n.projekt.zasoby.map((z) => z.id)).toEqual(['inny']);
    expect([...n.dane.keys()]).toEqual(['inny']);
    expect(n.projekt.szablony[0]!.podklad).toEqual({
      zasob: 'inny',
      przezroczystosc: 80,
      widoczny: true,
    });
    const bez = usunPodklad(n.projekt, n.dane, szablonCzaru.id);
    expect(bez.projekt.szablony[0]!.podklad).toBeUndefined();
    expect(bez.projekt.zasoby).toEqual([]);
    expect(bez.dane.size).toBe(0);
  });

  it('obraz używany też gdzie indziej (inny podkład, dane karty) zostaje w bibliotece', () => {
    const w = zPodkladem();
    const inny: Szablon = { ...szablonCzaru, id: 'inny', podklad: w.projekt.szablony[0]!.podklad! };
    const projekt = { ...w.projekt, szablony: [...w.projekt.szablony, inny] };
    const bez = usunPodklad(projekt, w.dane, szablonCzaru.id);
    expect(bez.projekt.zasoby.map((z) => z.id)).toEqual([PODKLAD]);
    const zDanymi: Projekt = {
      ...w.projekt,
      talie: [
        {
          id: 't',
          nazwa: 'T',
          karty: [{ id: 'k', szablonId: szablonCzaru.id, dane: { obraz: PODKLAD }, ilosc: 1 }],
        },
      ],
    };
    expect(usunPodklad(zDanymi, w.dane, szablonCzaru.id).projekt.zasoby).toHaveLength(1);
  });
});

describe('podkład a eksport', () => {
  it('eksport projektu zawiera podkład i obraz (round-trip)', () => {
    const { projekt, dane } = zPodkladem();
    const wynik = importujProjekt(eksportujProjekt(projekt, dane));
    expect(wynik.projekt.szablony[0]!.podklad).toEqual(projekt.szablony[0]!.podklad);
    expect(wynik.zasoby.get(PODKLAD)).toEqual(PNG);
  });

  it('plik szablonu nie niesie podkładu ani jego obrazu; import daje szablon bez podkładu', () => {
    const { projekt, dane } = zPodkladem();
    const bajty = eksportujSzablon(projekt, dane, szablonCzaru.id).bajty;
    const pliki = unzipSync(bajty);
    const tekst = Object.values(pliki)
      .map((b) => strFromU8(b, true))
      .join('\n');
    expect(Object.keys(pliki).some((n) => n.includes(PODKLAD))).toBe(false);
    expect(tekst).not.toContain('podklad');
    expect(tekst).not.toContain(PODKLAD);
    const paczka = importujSzablon(bajty);
    expect(paczka.szablon.podklad).toBeUndefined();
    expect(paczka.zasoby).toEqual([]);
  });
});

describe('podkład nigdy nie jest częścią karty', () => {
  const wywolania: string[] = [];
  const ctx = {
    czcionki,
    obraz: (id: string) => {
      wywolania.push(id);
      return { szerokosc: 1, wysokosc: 1 };
    },
  };

  it('scena i SVG karty są takie same z podkładem i bez niego', () => {
    const z = szablonZPodkladem();
    const a = renderujKarte(szablonCzaru, { dane: daneCzaru }, ctx);
    const b = renderujKarte(z, { dane: daneCzaru }, ctx);
    expect(b.scena).toEqual(a.scena);
    expect(b.ostrzezenia).toEqual(a.ostrzezenia);
    expect(b.wezly).toEqual(a.wezly);
    const svg = scenaDoSvg(b.scena, { przedrostekId: 'x-' });
    expect(svg).toBe(scenaDoSvg(a.scena, { przedrostekId: 'x-' }));
    expect(svg).not.toContain(PODKLAD);
    expect(JSON.stringify(b.scena)).not.toContain(PODKLAD);
    expect(wywolania).not.toContain(PODKLAD);
  });

  it('eksport obrazów kart, kartka i PDF nie zawierają podkładu', async () => {
    const z = szablonZPodkladem();
    const talia: Talia = {
      id: 't',
      nazwa: 'T',
      karty: [{ id: 'k1', szablonId: z.id, dane: daneCzaru, ilosc: 1 }],
    };
    const arkusz: Arkusz = {
      id: 'a',
      nazwa: 'A',
      taliaId: 't',
      ustawienia: ustawieniaKartkiDla(z),
    };
    const obrazy = new Map<string, never>();
    const karty = scenyKart(
      [{ arkusz, talia }],
      { czcionki, szablony: new Map([[z.id, z]]), obrazy },
      'png',
    );
    const bez = scenyKart(
      [{ arkusz, talia }],
      { czcionki, szablony: new Map([[z.id, szablonCzaru]]), obrazy },
      'png',
    );
    expect(karty.map((k) => k.scena)).toEqual(bez.map((k) => k.scena));
    expect(JSON.stringify(karty)).not.toContain(PODKLAD);

    const strony = zbudujArkusz(arkusz, talia, {
      czcionki,
      szablony: new Map([[z.id, z]]),
      obraz: ctx.obraz,
    });
    expect(strony.strony.length).toBeGreaterThan(0);
    expect(JSON.stringify(strony.strony)).not.toContain(PODKLAD);
    const zadania: string[] = [];
    const pdf = await scenyDoPdf(strony.strony, {
      obraz: (id) => {
        zadania.push(id);
        return undefined;
      },
    });
    expect(zadania).not.toContain(PODKLAD);
    expect(pdf.pominieteObrazy).not.toContain(PODKLAD);
    expect(strFromU8(pdf.bajty, true)).not.toContain(PODKLAD);
  });
});
