import { BazaProjektow } from '../dane/baza';
import { dodajRewersZPaczki } from '../dane/archiwum';
import { BladDanych } from '../dane/schemat';
import { t } from '../i18n';
import type { Pakiet } from '../pakiety/typy';

let instancja: BazaProjektow | undefined;

/** Wspólna baza projektów aplikacji (IndexedDB), tworzona przy pierwszym użyciu. */
export function baza(): BazaProjektow {
  instancja ??= new BazaProjektow();
  return instancja;
}

/** Sprawdza dekodowanie obrazu ramki przed zapisaniem pliku w katalogu globalnym. */
export async function zapiszOzdobnikWBibliotece(bajty: Uint8Array) {
  const { importujOzdobnik } = await import('../dane/archiwum');
  const { element, zasoby, dane } = importujOzdobnik(bajty);
  const opis = zasoby[0];
  if (opis?.rodzaj === 'obraz') {
    const { przygotujObraz } = await import('./obrazyUI');
    const wynik = await przygotujObraz(dane.get(opis.id)!);
    if (wynik.szerokosc !== opis.szerokosc || wynik.wysokosc !== opis.wysokosc)
      throw new BladDanych(t('globalna.zlyObraz', { id: opis.id }));
  }
  const nazwa = element.nazwa ?? element.id;
  const id = await baza().zapiszWBibliotece('ozdobnik', nazwa, bajty);
  return { id, nazwa };
}

async function pobierz(adres: string): Promise<Uint8Array> {
  const odp = await fetch(adres);
  if (!odp.ok) throw new Error(`${adres}: HTTP ${odp.status}`);
  return new Uint8Array(await odp.arrayBuffer());
}

async function zapiszNowyProjekt(
  projekt: import('../model/projekt').Projekt,
  zasoby: import('../model/projekt').DaneZasobow,
  rejestrujSzablony = false,
): Promise<string> {
  const { dolaczZasobyGlobalne } = await import('./zasobyGlobalne');
  const zGlobalnymi = await dolaczZasobyGlobalne(projekt, zasoby);
  await baza().zapisz(zGlobalnymi.projekt, zGlobalnymi.dane, { rejestrujSzablony });
  return zGlobalnymi.projekt.id;
}

/** Nowy projekt gry (pusta kartka albo gotowy układ) – zapisany w bazie; zwraca id. */
export async function nowyProjektZPakietu(
  pakiet: Pakiet,
  uklad?: string,
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  // Silnik (fontkit) potrzebny do ułożenia gotowego układu – ładowany dopiero tutaj.
  const { nowyProjektGry } = await import('../dane/nowyProjekt');
  const { projekt, zasoby } = await nowyProjektGry(
    pakiet,
    (plik) => pobierz(`${bazaUrl}czcionki/${plik}`),
    pobierz,
    uklad ? { uklad } : {},
  );
  return zapiszNowyProjekt(projekt, zasoby);
}

/** Nowy projekt własnych kart z pliku szablonu (`.kartyrpg-szablon`) – zapisany w bazie; zwraca id. */
export async function nowyProjektZSzablonu(
  bajty: Uint8Array,
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  const [{ importujSzablon }, { nowyProjektWlasny }] = await Promise.all([
    import('../dane/archiwum'),
    import('../dane/wlasneKarty'),
  ]);
  const { projekt, zasoby } = await nowyProjektWlasny(importujSzablon(bajty), (plik) =>
    pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  return zapiszNowyProjekt(projekt, zasoby, true);
}

/** Nowy projekt własnych kart z szablonu z kreatora – zapisany w bazie; zwraca id. */
export async function nowyProjektZSzablonuKreatora(
  szablon: import('../model/szablon').Szablon,
  bazaUrl: string = import.meta.env.BASE_URL,
  dodatkowe?: {
    zasoby: import('../model/projekt').OpisZasobu[];
    dane: Map<string, Uint8Array>;
  },
  przypiszTyl?: { projektId: string; rewersId: string },
): Promise<string> {
  const { nowyProjektWlasny } = await import('../dane/wlasneKarty');
  const nowy = await nowyProjektWlasny(
    {
      szablon,
      role: {},
      zasoby: dodatkowe?.zasoby ?? [],
      dane: dodatkowe?.dane ?? new Map(),
    },
    (plik) => pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  // Przód z przypisanym tyłem: kopia tyłu (z zasobami) w projekcie przodu, przypisana do szablonu.
  const { projekt, zasoby } = przypiszTyl
    ? dolaczTyl(nowy.projekt, nowy.zasoby, await paczkaTyluZProjektu(przypiszTyl), (p, rid) => ({
        ...p,
        szablony: p.szablony.map((s, i) => (i === 0 ? { ...s, rewersId: rid } : s)),
      }))
    : nowy;
  const id = await zapiszNowyProjekt(projekt, zasoby);
  const pierwszySzablon = projekt.szablony[0]?.id;
  if (pierwszySzablon) {
    const { zapiszMiniatureSzablonu } = await import('./miniaturaRewersu');
    await zapiszMiniatureSzablonu(projekt, zasoby, pierwszySzablon).catch(() => undefined);
  }
  return id;
}

/** Nowy projekt własnych kart z przykładowego szablonu (z jedną kartą z danymi) – zapisany w bazie; zwraca id. */
export async function zapiszProjektZPrzykladu(
  przyklad: import('../przyklady/typy').Przyklad,
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  const { nowyProjektZPrzykladu } = await import('../dane/wlasneKarty');
  const { projekt, zasoby } = await nowyProjektZPrzykladu(przyklad, (plik) =>
    pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  const id = await zapiszNowyProjekt(projekt, zasoby, true);
  const pierwszySzablon = projekt.szablony[0]?.id;
  if (pierwszySzablon) {
    const { zapiszMiniatureSzablonu } = await import('./miniaturaRewersu');
    await zapiszMiniatureSzablonu(projekt, zasoby, pierwszySzablon).catch(() => undefined);
  }
  return id;
}

/** Paczka tyłu (rewersu) z projektu w bazie – do skopiowania do innego projektu. */
export async function paczkaTyluZProjektu(zrodlo: {
  projektId: string;
  rewersId: string;
}): Promise<import('../dane/archiwum').PaczkaRewersu> {
  const { eksportujRewers, importujRewers } = await import('../dane/archiwum');
  const { projekt, zasoby } = await baza().wczytaj(zrodlo.projektId);
  return importujRewers(eksportujRewers(projekt, zasoby, zrodlo.rewersId));
}

/** Dołącza kopię tyłu z paczki do projektu (z rolami czcionek) i przypisuje ją funkcją `przypisz`. */
export function dolaczTyl(
  p: import('../model/projekt').Projekt,
  d: import('../model/projekt').DaneZasobow,
  paczka: import('../dane/archiwum').PaczkaRewersu,
  przypisz: (
    p: import('../model/projekt').Projekt,
    rewersId: string,
  ) => import('../model/projekt').Projekt,
): { projekt: import('../model/projekt').Projekt; zasoby: import('../model/projekt').DaneZasobow } {
  const w = dodajRewersZPaczki(p, d, paczka);
  return {
    projekt: przypisz({ ...w.projekt, role: { ...paczka.role, ...w.projekt.role } }, w.rewersId),
    zasoby: w.dane,
  };
}

/**
 * Nowy projekt własnych kart z tyłem z kreatora (rozmiar, rogi, kolor, układ startowy), otwierany
 * w edytorze tyłu – zapisany w bazie.
 */
export async function nowyProjektZTylemKreatora(
  u: import('./szablon/Kreator').UstawieniaNowegoTylu,
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<{ id: string; rewersId: string }> {
  const [
    { nowyProjektWlasny },
    { dodajRewers, nowyTyl, przypiszRewers, unikalnaNazwa },
    { DOMYSLNE_TLO_KARTY },
    { szablonZKreatora },
  ] = await Promise.all([
    import('../dane/wlasneKarty'),
    import('../dane/rewers'),
    import('../model/szablon'),
    import('./szablon/nowySzablonUI'),
  ]);
  // Pusty przód projektu samego tyłu – w rozmiarze tyłu.
  const szablon = szablonZKreatora({
    nazwa: t('kreator.nazwaDomyslna'),
    szer: u.szer,
    wys: u.wys,
    promien: u.promien,
    tlo: DOMYSLNE_TLO_KARTY,
    uklad: 'swobodny',
  });
  const { projekt: bazowy, zasoby } = await nowyProjektWlasny(
    { szablon, role: {}, zasoby: [], dane: new Map() },
    (plik) => pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  // Nazwa unikalna wśród tyłów w przeglądarce („Tył”, „Tył 2”…) – rozróżnia je w Moich szablonach.
  const zajete = await Promise.resolve()
    .then(() => baza().rewersyZProjektow())
    .then((l) => l.map((r) => r.nazwa))
    .catch(() => [] as string[]);
  const nazwa = unikalnaNazwa(u.nazwa, zajete);
  const { projekt: zTylem, id: rewersId } = dodajRewers(
    { ...bazowy, nazwa },
    nowyTyl('rewers', { ...u, nazwa }, t('kreator.grafikaTylu')),
  );
  const taliaId = zTylem.talie[0]?.id;
  const projekt = taliaId
    ? przypiszRewers(zTylem, { rodzaj: 'talia', id: taliaId }, rewersId)
    : zTylem;
  const id = await zapiszNowyProjekt(projekt, zasoby);
  const [{ zapiszRewersGlobalnie }, { zapiszMiniatureRewersu }] = await Promise.all([
    import('./rewersyGlobalne'),
    import('./miniaturaRewersu'),
  ]);
  await Promise.all([
    zapiszRewersGlobalnie(projekt, zasoby, rewersId).catch(() => undefined),
    zapiszMiniatureRewersu(projekt, zasoby, rewersId).catch(() => undefined),
  ]);
  return { id, rewersId };
}

/** Nowy projekt własnych kart oparty o istniejący szablon awersu (bez modyfikacji oryginału). */
export async function nowyProjektZAwersuZProjektu(
  projektId: string,
  szablonId: string,
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  const [{ wczytajPaczkeAwersuBezRewersu }, { nowyProjektWlasny }] = await Promise.all([
    import('./awersyZProjektow'),
    import('../dane/wlasneKarty'),
  ]);
  const paczka = await wczytajPaczkeAwersuBezRewersu({ projektId, szablonId });
  const { projekt, zasoby } = await nowyProjektWlasny(paczka, (plik) =>
    pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  const id = await zapiszNowyProjekt(projekt, zasoby);
  const pierwszySzablon = projekt.szablony[0]?.id;
  if (pierwszySzablon) {
    const { zapiszMiniatureSzablonu } = await import('./miniaturaRewersu');
    await zapiszMiniatureSzablonu(projekt, zasoby, pierwszySzablon).catch(() => undefined);
  }
  return id;
}

/** Nowy projekt własnych kart z przypisanym istniejącym rewersem (bez modyfikacji oryginału). */
export async function nowyProjektZRewersuZProjektu(
  projektId: string,
  rewersId: string,
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  const [
    { dodajRewersZPaczki, eksportujRewers, importujRewers },
    { nowyProjektWlasny },
    { przypiszRewers },
    { DOMYSLNE_TLO_KARTY },
    { szablonZKreatora },
  ] = await Promise.all([
    import('../dane/archiwum'),
    import('../dane/wlasneKarty'),
    import('../dane/rewers'),
    import('../model/szablon'),
    import('./szablon/nowySzablonUI'),
  ]);
  const { projekt: zrodlo, zasoby: zrodloZasoby } = await baza().wczytaj(projektId);
  const paczka = importujRewers(eksportujRewers(zrodlo, zrodloZasoby, rewersId));
  const szablon = szablonZKreatora({
    nazwa: t('kreator.nazwaDomyslna'),
    szer: paczka.rewers.rozmiar.szerokosc,
    wys: paczka.rewers.rozmiar.wysokosc,
    promien: 3,
    tlo: DOMYSLNE_TLO_KARTY,
    uklad: 'swobodny',
  });
  const { projekt: bazowy, zasoby } = await nowyProjektWlasny(
    { szablon, role: {}, zasoby: [], dane: new Map() },
    (plik) => pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  const zRewersem = dodajRewersZPaczki({ ...bazowy, nazwa: paczka.rewers.nazwa }, zasoby, paczka);
  const zRolami = {
    ...zRewersem.projekt,
    role: { ...zRewersem.projekt.role, ...paczka.role },
  };
  const taliaId = zRolami.talie[0]?.id;
  const projekt = taliaId
    ? przypiszRewers(zRolami, { rodzaj: 'talia', id: taliaId }, zRewersem.rewersId)
    : zRolami;
  const id = await zapiszNowyProjekt(projekt, zRewersem.dane);
  const { zapiszMiniatureRewersu } = await import('./miniaturaRewersu');
  await zapiszMiniatureRewersu(projekt, zRewersem.dane, zRewersem.rewersId).catch(() => undefined);
  return id;
}

/**
 * Nowy projekt z okna „Nowy projekt → Pusta karta” (UI2 R3):
 * domyślny układ swobodny (D7), wybrane wymiary w mm oraz strony przód i/lub tył (D5).
 * Zwraca docelowy adres hasha (edytor przodu albo edytor tyłu).
 */
export async function nowyProjektPustaKarta(
  opcje: {
    nazwa: string;
    szer: number;
    wys: number;
    przod: boolean;
    tyl: boolean;
  },
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  const [
    { nowyProjektWlasny },
    { dodajRewers, nowyTyl, przypiszRewers },
    { DOMYSLNE_TLO_KARTY },
    { szablonZKreatora },
  ] = await Promise.all([
    import('../dane/wlasneKarty'),
    import('../dane/rewers'),
    import('../model/szablon'),
    import('./szablon/nowySzablonUI'),
  ]);
  const nazwa = opcje.nazwa.trim() || t('nowyProjekt.nazwaDomyslna');
  const szablon = szablonZKreatora({
    nazwa: t('kreator.nazwaDomyslna'),
    szer: opcje.szer,
    wys: opcje.wys,
    promien: 3,
    tlo: DOMYSLNE_TLO_KARTY,
    uklad: 'swobodny',
  });
  const { projekt: bazowy, zasoby } = await nowyProjektWlasny(
    { szablon, role: {}, zasoby: [], dane: new Map() },
    (plik) => pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  let projekt = { ...bazowy, nazwa };
  let rewersId: string | undefined;
  if (opcje.tyl) {
    const zTylem = dodajRewers(
      projekt,
      nowyTyl(
        'rewers',
        {
          nazwa: t('projekty.stronaRewers'),
          szer: opcje.szer,
          wys: opcje.wys,
          promien: 3,
          tlo: DOMYSLNE_TLO_KARTY,
          uklad: 'pusty',
        },
        t('kreator.grafikaTylu'),
      ),
    );
    rewersId = zTylem.id;
    const taliaId = zTylem.projekt.talie[0]?.id;
    projekt = taliaId
      ? przypiszRewers(zTylem.projekt, { rodzaj: 'talia', id: taliaId }, rewersId)
      : zTylem.projekt;
  }
  const id = await zapiszNowyProjekt(projekt, zasoby);
  if (!opcje.przod && rewersId) {
    return `#/projekt/${encodeURIComponent(id)}/rewers/${encodeURIComponent(rewersId)}`;
  }
  const szablonId = projekt.szablony[0]?.id ?? 'szablon-1';
  return `#/projekt/${encodeURIComponent(id)}/szablon/${encodeURIComponent(szablonId)}`;
}

/**
 * Tworzy nowy szablon przodu i/lub tyłu w „Moich szablonach” (Plan S, S3, sekcja 5.2).
 * Domyślny układ swobodny, wybrane wymiary w mm, strony przód / tył.
 */
export async function utworzSzablonWBibliotece(
  opcje: {
    nazwa: string;
    szer: number;
    wys: number;
    przod: boolean;
    tyl: boolean;
  },
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<{ id: string; rodzaj: 'awers' | 'rewers'; nazwa: string; rewersId?: string }> {
  const [
    { nowyTyl },
    { DOMYSLNE_TLO_KARTY },
    { szablonZKreatora },
    { zapiszMiniatureWpisuSzablonu },
  ] = await Promise.all([
    import('../dane/rewers'),
    import('../model/szablon'),
    import('./szablon/nowySzablonUI'),
    import('./miniaturaRewersu'),
  ]);
  const role = { tytul: 'EB Garamond', tresc: 'EB Garamond' };
  const nazwaBazowa =
    opcje.nazwa.trim() ||
    (opcje.przod ? t('nowySzablon.domyslnaNazwa') : t('nowySzablon.domyslnaNazwaTylu'));

  let rewersId: string | undefined;
  let nazwaTylu = nazwaBazowa;
  if (opcje.tyl) {
    const nazwaR = opcje.przod ? `${nazwaBazowa} – ${t('projekty.stronaRewers')}` : nazwaBazowa;
    const rewers = nowyTyl(
      'rewers',
      {
        nazwa: nazwaR,
        szer: opcje.szer,
        wys: opcje.wys,
        promien: 3,
        tlo: DOMYSLNE_TLO_KARTY,
        uklad: 'pusty',
      },
      t('kreator.grafikaTylu'),
    );
    const dodanyR = await baza().dodajRewersDoBiblioteki(rewers, role, { bezDeduplikacji: true });
    rewersId = dodanyR.id;
    const wpisR = await baza().szablonBiblioteki(rewersId);
    if (wpisR) {
      nazwaTylu = wpisR.nazwa;
      await zapiszMiniatureWpisuSzablonu(wpisR, bazaUrl).catch(() => undefined);
    }
  }

  if (opcje.przod) {
    const szablon = szablonZKreatora({
      nazwa: nazwaBazowa,
      szer: opcje.szer,
      wys: opcje.wys,
      promien: 3,
      tlo: DOMYSLNE_TLO_KARTY,
      uklad: 'swobodny',
    });
    const dodanyA = await baza().dodajSzablonDoBiblioteki(szablon, role, {
      ...(rewersId ? { domyslnyRewersId: rewersId } : {}),
      bezDeduplikacji: true,
    });
    const wpisA = await baza().szablonBiblioteki(dodanyA.id);
    if (wpisA) {
      await zapiszMiniatureWpisuSzablonu(wpisA, bazaUrl).catch(() => undefined);
    }
    return {
      id: dodanyA.id,
      rodzaj: 'awers',
      nazwa: wpisA?.nazwa ?? nazwaBazowa,
      ...(rewersId ? { rewersId } : {}),
    };
  }

  return { id: rewersId!, rodzaj: 'rewers', nazwa: nazwaTylu };
}

/**
 * Tworzy nowy projekt własnych kart z wybranych szablonów w „Moich szablonach” (Plan S, S3, sekcja 5.3).
 * Każdy wybrany szablon trafia do projektu jako kopia z `zrodlo: { id, hash }` (wraz z przypiętym tyłem).
 * Można nie wybrać żadnego szablonu (projekt zaczyna pusty). Zwraca id projektu.
 */
export async function nowyProjektZSzablonowBiblioteki(
  opcje: { nazwa: string; szablonIds: readonly string[] },
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  const [
    { dodajKopieRewersuDoProjektu, dodajKopieSzablonuDoProjektu },
    { PAKIET_WLASNY, pakietWlasny },
    { projektZPakietu },
  ] = await Promise.all([
    import('../dane/aktualizacjaSzablonu'),
    import('../dane/wlasneKarty'),
    import('../dane/pakiet'),
  ]);
  const nazwa = opcje.nazwa.trim() || t('nowyProjekt.nazwaDomyslna');
  const pustyPakiet = pakietWlasny([]);
  const bazowy = await projektZPakietu(
    pustyPakiet,
    (plik) => pobierz(`${bazaUrl}czcionki/${plik}`),
    pobierz,
  );
  let projekt: import('../model/projekt').Projekt = {
    ...bazowy.projekt,
    nazwa,
    pakiet: PAKIET_WLASNY,
    szablony: [],
    talie: [{ id: 'talia-1', nazwa, karty: [] }],
    arkusze: [
      {
        id: 'arkusz-1',
        nazwa,
        taliaId: 'talia-1',
        ustawienia: structuredClone(pustyPakiet.nowaKartka.ustawienia),
      },
    ],
  };

  for (const id of opcje.szablonIds) {
    const wpis = await baza().szablonBiblioteki(id);
    if (!wpis) continue;
    if (wpis.rodzaj === 'awers') {
      const domyslnyRewers = wpis.domyslnyRewersId
        ? await baza().szablonBiblioteki(wpis.domyslnyRewersId)
        : undefined;
      projekt = dodajKopieSzablonuDoProjektu(projekt, wpis, {
        ...(domyslnyRewers ? { domyslnyRewers } : {}),
      }).projekt;
    } else if (wpis.rodzaj === 'rewers') {
      projekt = dodajKopieRewersuDoProjektu(projekt, wpis).projekt;
    }
  }

  return zapiszNowyProjekt(projekt, bazowy.zasoby);
}
