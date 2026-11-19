import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { formatujLiczbe, t } from '../i18n';
import type { DaneZasobow, OpisZasobu, Projekt } from '../model/projekt';
import { czyKontener, stylePola, type Rewers, type Szablon, type Wezel } from '../model/szablon';
import type { ElementOzdobny } from '../ozdobniki/typy';
import { BladKolekcjiCzcionek, wczytajCzcionke } from '../silnik/czcionki';
import { MAKS_BAJTOW_CZCIONKI, formatObrazu, unikalneId } from './czcionki';
import {
  MAKS_BAJTOW_OBRAZU,
  MAKS_PIKSELI,
  orientacjaExif,
  wymiaryJpeg,
  wymiaryPoObrocie,
} from './obrazy';
import { czyWbudowany, znajdzElement } from '../ozdobniki/katalog';
import {
  dolaczElementy,
  elementyProjektu,
  elementyUzyteWSzablonie,
  zasobyObrazowSzablonu,
  zasobyElementow,
  odwolaniaDoElementow,
  przepiszOdwolania,
} from './biblioteka';
import {
  BladDanych,
  MAKS_DLUGOSC_ID_ZASOBU,
  migruj,
  przygotujProjekt,
  schematPaczkiOzdobnika,
  schematPlikuSzablonu,
  teksturySzablonu,
  zasobySzablonu,
  sprawdz,
} from './schemat';

/** Rozszerzenie pliku projektu i szablonu (ZIP z JSON-em i zasobami). */
export const ROZSZERZENIE_PROJEKTU = '.kartyrpg';
export const ROZSZERZENIE_SZABLONU = '.kartyrpg-szablon';
export const ROZSZERZENIE_OZDOBNIKA = '.kartyrpg-ozdobnik';

export const PLIK_PROJEKTU = 'projekt.json';
export const PLIK_SZABLONU = 'szablon.json';
const KATALOG_ZASOBOW = 'zasoby/';
const MB = 1024 * 1024;
/** Limity rozpakowania (ochrona przed „bombą ZIP”): wpis, suma, liczba wpisów. */
export const LIMITY_ARCHIWUM = { plik: 100 * MB, suma: 500 * MB, wpisy: 5000 };

function nazwaPlikuZasobu(opis: OpisZasobu): string {
  return `${KATALOG_ZASOBOW}${encodeURIComponent(opis.id)}.${opis.format}`;
}

function spakuj(json: unknown, plikJson: string, zasoby: [OpisZasobu, Uint8Array][]): Uint8Array {
  const pliki: Record<string, Uint8Array> = { [plikJson]: strToU8(JSON.stringify(json, null, 2)) };
  // Obrazy i czcionki są już skompresowane – bez ponownej kompresji (poziom 0).
  for (const [opis, dane] of zasoby) pliki[nazwaPlikuZasobu(opis)] = dane;
  return zipSync(pliki, { level: 0 });
}

/**
 * Rozpakowuje tylko oczekiwane wpisy (plik JSON i płaski katalog `zasoby/`) z limitami rozmiaru;
 * każdy inny wpis to błąd – sprawdzany przed dekompresją.
 */
function rozpakuj(bajty: Uint8Array, plikJson: string): Record<string, Uint8Array> {
  let suma = 0;
  let wpisy = 0;
  const mb = (n: number) => formatujLiczbe(n / MB, 0);
  try {
    return unzipSync(bajty, {
      filter: (plik) => {
        if (plik.name === KATALOG_ZASOBOW) return false;
        if (plik.name !== plikJson && !/^zasoby\/[^/]+$/.test(plik.name)) {
          throw new BladDanych(t('dane.nadmiarowyPlik', { plik: plik.name }));
        }
        if (++wpisy > LIMITY_ARCHIWUM.wpisy) {
          throw new BladDanych(t('dane.zbytWieleWpisow', { liczba: wpisy }));
        }
        if (plik.originalSize > LIMITY_ARCHIWUM.plik) {
          throw new BladDanych(t('dane.zaDuzy', { plik: plik.name, mb: mb(plik.originalSize) }));
        }
        suma += plik.originalSize;
        if (suma > LIMITY_ARCHIWUM.suma)
          throw new BladDanych(t('dane.zaDuzeArchiwum', { mb: mb(suma) }));
        return true;
      },
    });
  } catch (e) {
    if (e instanceof BladDanych) throw e;
    throw new BladDanych(t('dane.nieArchiwum'));
  }
}

function odczytajJson(pliki: Record<string, Uint8Array>, plik: string): unknown {
  const bajty = pliki[plik];
  if (!bajty) throw new BladDanych(t('dane.brakProjektu', { plik }));
  try {
    return JSON.parse(strFromU8(bajty));
  } catch {
    throw new BladDanych(t('dane.zlyJson', { plik }));
  }
}

/** Sprawdza, że bajty zasobu to rzeczywiście czytelna czcionka / obraz PNG lub JPG. */
export function sprawdzZasob(opis: OpisZasobu, dane: Uint8Array): void {
  if (opis.rodzaj === 'obraz') {
    if (!formatObrazu(dane)) throw new BladDanych(t('dane.zlyZasobObrazu', { id: opis.id }));
    return;
  }
  if (dane.length > MAKS_BAJTOW_CZCIONKI) {
    throw new BladDanych(
      t('dane.zaDuzy', { plik: opis.nazwa, mb: formatujLiczbe(dane.length / MB, 1) }),
    );
  }
  try {
    wczytajCzcionke(opis.id, dane);
  } catch (e) {
    const powod =
      e instanceof BladKolekcjiCzcionek
        ? t('dane.czcionkaKolekcja', { plik: opis.nazwa })
        : String(e instanceof Error ? e.message : e);
    throw new BladDanych(t('dane.zlyZasobCzcionki', { id: opis.id, powod }));
  }
}

/** Zbiera i sprawdza bajty opisanych zasobów; nadmiarowe wpisy w archiwum to błąd. */
function zbierzZasoby(
  pliki: Record<string, Uint8Array>,
  plikJson: string,
  opisy: OpisZasobu[],
): DaneZasobow {
  const wynik: DaneZasobow = new Map();
  const uzyte = new Set<string>([plikJson]);
  for (const opis of opisy) {
    const nazwa = nazwaPlikuZasobu(opis);
    const bajty = pliki[nazwa];
    if (!bajty) throw new BladDanych(t('dane.brakZasobu', { id: opis.id }));
    sprawdzZasob(opis, bajty);
    wynik.set(opis.id, bajty);
    uzyte.add(nazwa);
  }
  for (const nazwa of Object.keys(pliki)) {
    if (!uzyte.has(nazwa)) throw new BladDanych(t('dane.nadmiarowyPlik', { plik: nazwa }));
  }
  return wynik;
}

function bajtyZasobu(zasoby: DaneZasobow, id: string): Uint8Array {
  const dane = zasoby.get(id);
  if (!dane) throw new BladDanych(t('dane.brakZasobu', { id }));
  return dane;
}

/** Eksport całego projektu do jednego pliku `.kartyrpg`. */
export function eksportujProjekt(projekt: Projekt, zasoby: DaneZasobow): Uint8Array {
  return spakuj(
    projekt,
    PLIK_PROJEKTU,
    projekt.zasoby.map((o) => [o, bajtyZasobu(zasoby, o.id)]),
  );
}

/**
 * Import projektu z pliku: rozpakowanie, migracja, walidacja kształtu, spójności i zasobów.
 * Projekt zachowuje id z pliku – przed zapisem sprawdź `BazaProjektow.istnieje` i w razie
 * kolizji zapytaj użytkownika (zastąpić / zapisać jako kopię przez `jakoKopia`).
 */
export function importujProjekt(bajty: Uint8Array): { projekt: Projekt; zasoby: DaneZasobow } {
  const pliki = rozpakuj(bajty, PLIK_PROJEKTU);
  const projekt = przygotujProjekt(odczytajJson(pliki, PLIK_PROJEKTU));
  return { projekt, zasoby: zbierzZasoby(pliki, PLIK_PROJEKTU, projekt.zasoby) };
}

/** Kopia projektu z nowym id (np. import pliku, którego id jest już w bazie). */
export function jakoKopia(
  projekt: Projekt,
  nazwa = projekt.nazwa,
  id: string = crypto.randomUUID(),
): Projekt {
  const teraz = new Date().toISOString();
  return { ...projekt, id, nazwa, utworzono: teraz, zmieniono: teraz };
}

// ---------------------------------------------------------------------------------------------
// Pojedynczy szablon

function* wezly(w: Wezel): Generator<Wezel> {
  yield w;
  if ('dzieci' in w) for (const d of w.dzieci) yield* wezly(d);
}

function wszystkieWezly(s: Szablon): Wezel[] {
  return [s.korzen, ...(s.warianty ?? []).map((w) => w.korzen)].flatMap((k) => [...wezly(k)]);
}

/** Nazwy czcionek (role lub rodziny) użyte w stylach szablonu. */
function czcionkiSzablonu(s: Szablon): string[] {
  const nazwy = new Set((s.grupyStylow ?? []).map((g) => g.styl.czcionka));
  for (const w of wszystkieWezly(s)) {
    for (const st of stylePola(w)) if (st.czcionka) nazwy.add(st.czcionka);
  }
  return [...nazwy];
}

export interface PaczkaSzablonu {
  szablon: Szablon;
  rewers?: Rewers;
  role: Record<string, string>;
  zasoby: OpisZasobu[];
  dane: DaneZasobow;
  /** Własne elementy biblioteki ozdobników użyte przez szablon. */
  biblioteka?: ElementOzdobny[];
}

export interface WynikEksportuSzablonu {
  bajty: Uint8Array;
  /** Ostrzeżenia dla użytkownika (np. licencje czcionek spoza Google Fonts). */
  ostrzezenia: string[];
}

function sprawdzTeksturyPaczki(szablon: Szablon, opisy: OpisZasobu[]) {
  const obrazy = new Set(opisy.flatMap((o) => (o.rodzaj === 'obraz' ? [o.id] : [])));
  for (const id of teksturySzablonu(szablon))
    if (!obrazy.has(id)) throw new BladDanych(t('dane.teksturaBezObrazu', { id }));
}

function sprawdzRewersPaczki(
  p: Pick<PaczkaSzablonu, 'szablon' | 'rewers' | 'zasoby' | 'biblioteka'>,
) {
  const id = p.szablon.rewersId;
  if (p.rewers?.id !== (typeof id === 'string' ? id : undefined))
    throw new BladDanych(t('dane.nieznanyRewers', { id: id ?? p.rewers?.id ?? '' }));
  if (!p.rewers) return;
  const gdzie = t('dane.gdzie.rewers', { id: p.rewers.id });
  const widziane = new Set<string>();
  for (const w of wszystkieWezly(p.rewers)) {
    if (widziane.has(w.id)) throw new BladDanych(t('dane.powtorzonyId', { id: w.id, gdzie }));
    widziane.add(w.id);
  }
  const obraz = new Set(p.zasoby.filter((o) => o.rodzaj === 'obraz').map((o) => o.id));
  for (const id of zasobySzablonu(p.rewers))
    if (!obraz.has(id)) throw new BladDanych(t('dane.nieznanyZasob', { gdzie, id }));
  for (const id of odwolaniaDoElementow(p.rewers)) {
    const element = znajdzElement(id, p.biblioteka);
    if (!element) throw new BladDanych(t('dane.nieznanyElement', { gdzie, id }));
    const z = element.ramka9?.zrodlo;
    if (z?.typ === 'obraz' && !obraz.has(z.zasob))
      throw new BladDanych(t('dane.ramka9BezObrazu', { id, zasob: z.zasob }));
  }
}

/** Eksport szablonu z użytymi czcionkami i obrazami; ostrzega o czcionkach z własnych plików. */
export function eksportujSzablon(
  projekt: Projekt,
  zasoby: DaneZasobow,
  szablonId: string,
): WynikEksportuSzablonu {
  const szablon = projekt.szablony.find((s) => s.id === szablonId);
  if (!szablon) throw new BladDanych(t('dane.brakSzablonu', { id: szablonId }));
  const rewers = projekt.rewersy?.find((r) => r.id === szablon.rewersId);
  const strony = rewers ? [szablon, rewers] : [szablon];
  const role: Record<string, string> = {};
  const rodziny = new Set<string>();
  for (const nazwa of new Set(strony.flatMap(czcionkiSzablonu))) {
    const rodzina = projekt.role[nazwa];
    if (rodzina !== undefined) role[nazwa] = rodzina;
    rodziny.add(rodzina ?? nazwa);
  }
  const obrazy = new Set(
    strony.flatMap((s) => zasobyObrazowSzablonu(s, elementyProjektu(projekt))),
  );
  const uzyte = projekt.zasoby.filter((o) =>
    o.rodzaj === 'czcionka' ? rodziny.has(o.rodzina) : obrazy.has(o.id),
  );
  const ostrzezenia = [
    ...new Set(
      uzyte.flatMap((o) =>
        o.rodzaj === 'czcionka' && o.zrodlo === 'wlasna'
          ? [t('dane.licencjaCzcionki', { rodzina: o.rodzina })]
          : [],
      ),
    ),
  ];
  sprawdzTeksturyPaczki(szablon, uzyte);
  const biblioteka = [
    ...new Map(
      strony.flatMap((s) => elementyUzyteWSzablonie(projekt, s)).map((o) => [o.id, o]),
    ).values(),
  ];
  sprawdzRewersPaczki({ szablon, zasoby: uzyte, biblioteka, ...(rewers ? { rewers } : {}) });
  // Podkład ze wzoru zostaje w projekcie: bywa duży i dotyczy pracy nad wzorem, nie samego szablonu.
  const { podklad: _podklad, ...szablonBezPodkladu } = szablon;
  void _podklad;
  const plik = {
    wersja: projekt.wersja,
    szablon: szablonBezPodkladu,
    ...(rewers ? { rewers } : {}),
    role,
    zasoby: uzyte,
    ...(biblioteka.length > 0 ? { biblioteka } : {}),
  };
  return {
    bajty: spakuj(
      plik,
      PLIK_SZABLONU,
      uzyte.map((o) => [o, bajtyZasobu(zasoby, o.id)]),
    ),
    ostrzezenia,
  };
}

export function importujSzablon(bajty: Uint8Array): PaczkaSzablonu {
  const pliki = rozpakuj(bajty, PLIK_SZABLONU);
  const zmigrowane = migruj(odczytajJson(pliki, PLIK_SZABLONU), 'szablon');
  const plik = sprawdz(schematPlikuSzablonu, zmigrowane) as Omit<PaczkaSzablonu, 'dane'>;
  // Plik szablonu nie niesie podkładu (obcy plik mógłby wskazywać cudzy zasób) – szablon bez podkładu.
  if (plik.szablon.podklad) {
    const { podklad: _podklad, ...reszta } = plik.szablon;
    void _podklad;
    plik.szablon = reszta;
  }
  const ids = (plik.biblioteka ?? []).map((e) => e.id);
  const powtorzony = ids.find((id, i) => ids.indexOf(id) !== i);
  if (powtorzony !== undefined)
    throw new BladDanych(
      t('dane.powtorzonyId', { id: powtorzony, gdzie: t('dane.gdzie.biblioteka') }),
    );
  sprawdzTeksturyPaczki(plik.szablon, plik.zasoby);
  sprawdzRewersPaczki(plik);
  // Ramka 9-slice z PNG musi mieć obraz w paczce (inaczej szablon wskazywałby cudzy zasób).
  for (const e of plik.biblioteka ?? []) {
    const z = e.ramka9?.zrodlo;
    if (z?.typ === 'obraz' && !plik.zasoby.some((o) => o.id === z.zasob))
      throw new BladDanych(t('dane.ramka9BezObrazu', { id: e.id, zasob: z.zasob }));
  }
  return { ...plik, dane: zbierzZasoby(pliki, PLIK_SZABLONU, plik.zasoby) };
}

const takieSame = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

function dolaczZasobyPaczki(
  projekt: Projekt,
  zasoby: DaneZasobow,
  przenoszone: Pick<PaczkaSzablonu, 'zasoby' | 'dane'>,
) {
  const ostrzezenia: string[] = [];
  const noweZasoby: DaneZasobow = new Map(zasoby);
  const opisy = [...projekt.zasoby];
  // Bajty usuniętych opisów mogą być jeszcze potrzebne historii edycji.
  const zajete = new Set([...opisy.map((o) => o.id), ...zasoby.keys()]);
  const przemianowane = new Map<string, string>();
  for (const opis of przenoszone.zasoby) {
    const dane = bajtyZasobu(przenoszone.dane, opis.id);
    const istniejacy = opisy.find((o) => o.id === opis.id);
    if (
      istniejacy &&
      JSON.stringify(istniejacy) === JSON.stringify(opis) &&
      takieSame(bajtyZasobu(zasoby, opis.id), dane)
    ) {
      continue;
    }
    if (opis.rodzaj === 'czcionka') {
      const ta = opisy.find(
        (o) => o.rodzaj === 'czcionka' && o.rodzina === opis.rodzina && o.wariant === opis.wariant,
      );
      if (ta) {
        if (!takieSame(bajtyZasobu(zasoby, ta.id), dane)) {
          ostrzezenia.push(
            t('dane.powtorzonaCzcionka', { rodzina: opis.rodzina, wariant: opis.wariant }),
          );
        }
        continue;
      }
    }
    const id = unikalneId(opis.id, zajete, MAKS_DLUGOSC_ID_ZASOBU);
    zajete.add(id);
    if (id !== opis.id) przemianowane.set(opis.id, id);
    opisy.push({ ...opis, id });
    noweZasoby.set(id, dane);
  }
  return { ostrzezenia, noweZasoby, opisy, przemianowane };
}

function przepiszObrazRamki(e: ElementOzdobny, mapa: ReadonlyMap<string, string>): ElementOzdobny {
  const z = e.ramka9?.zrodlo;
  if (!e.ramka9 || z?.typ !== 'obraz') return e;
  const zasob = mapa.get(z.zasob);
  return zasob ? { ...e, ramka9: { ...e.ramka9, zrodlo: { ...z, zasob } } } : e;
}

const PLIK_OZDOBNIKA = 'ozdobnik.json';

/** Samodzielny zapis do lokalnej biblioteki, wraz z obrazem ramki 9-slice. */
export function eksportujOzdobnik(projekt: Projekt, dane: DaneZasobow, id: string): Uint8Array {
  const element = elementyProjektu(projekt).find((e) => e.id === id);
  if (!element) throw new BladDanych(t('globalna.brakWpisu'));
  const zasoby = zasobyElementow([element]).map((id) => {
    const z = projekt.zasoby.find((x) => x.id === id && x.rodzaj === 'obraz');
    if (!z) throw new BladDanych(t('globalna.brakObrazu', { id: element.id, zasob: id }));
    return z;
  });
  return spakuj(
    { wersja: 1, element, zasoby },
    PLIK_OZDOBNIKA,
    zasoby.map((z) => [z, bajtyZasobu(dane, z.id)]),
  );
}

export function importujOzdobnik(bajty: Uint8Array) {
  const pliki = rozpakuj(bajty, PLIK_OZDOBNIKA);
  const { element, zasoby } = sprawdz(schematPaczkiOzdobnika, odczytajJson(pliki, PLIK_OZDOBNIKA));
  const obraz = zasobyElementow([element])[0];
  if (obraz === undefined && zasoby.length) throw new BladDanych(t('dane.nieArchiwum'));
  const opis = zasoby[0];
  if (obraz !== undefined && (opis?.rodzaj !== 'obraz' || opis.id !== obraz))
    throw new BladDanych(t('globalna.brakObrazu', { id: element.id, zasob: obraz }));
  const dane = zbierzZasoby(pliki, PLIK_OZDOBNIKA, zasoby);
  if (opis?.rodzaj === 'obraz') {
    const plik = bajtyZasobu(dane, opis.id);
    if (
      plik.length > MAKS_BAJTOW_OBRAZU ||
      opis.szerokosc * opis.wysokosc > MAKS_PIKSELI ||
      formatObrazu(plik) !== opis.format
    )
      throw new BladDanych(t('globalna.zlyObraz', { id: opis.id }));
    const v = new DataView(plik.buffer, plik.byteOffset, plik.byteLength);
    const wymiarySurowe = opis.format === 'jpg' ? wymiaryJpeg(plik) : undefined;
    const wymiary =
      opis.format === 'png' && v.byteLength >= 33 && v.getUint32(12) === 0x49484452
        ? { szerokosc: v.getUint32(16), wysokosc: v.getUint32(20) }
        : wymiarySurowe &&
          wymiaryPoObrocie(
            orientacjaExif(plik) ?? 1,
            wymiarySurowe.szerokosc,
            wymiarySurowe.wysokosc,
          );
    if (
      wymiary?.szerokosc !== opis.szerokosc ||
      wymiary.wysokosc !== opis.wysokosc ||
      element.szer !== opis.szerokosc ||
      element.wys !== opis.wysokosc
    )
      throw new BladDanych(t('globalna.zlyObraz', { id: opis.id }));
  }
  return { element, zasoby, dane };
}

export function dodajOzdobnikZPaczki(projekt: Projekt, dane: DaneZasobow, bajty: Uint8Array) {
  const paczka = importujOzdobnik(bajty);
  const { element } = paczka;
  const { noweZasoby, opisy, przemianowane } = dolaczZasobyPaczki(projekt, dane, paczka);
  const elementy = dolaczElementy(projekt, [przepiszObrazRamki(element, przemianowane)]);
  // Ten sam ozdobnik z tymi samymi zasobami może już być w projekcie.
  const wynik =
    elementy.lista.length === elementyProjektu(projekt).length
      ? projekt
      : przygotujProjekt({
          ...projekt,
          zasoby: opisy,
          biblioteka: { ...projekt.biblioteka, ozdobniki: elementy.lista },
          zmieniono: new Date().toISOString(),
        });
  return {
    projekt: wynik,
    dane: wynik === projekt ? dane : noweZasoby,
    id: elementy.mapa.get(element.id) ?? element.id,
  };
}

/**
 * Dodaje zaimportowany szablon do projektu (zwraca nowy projekt) bez zmiany wyglądu
 * istniejących kart:
 * - zasób identyczny (opis i bajty) jest współdzielony; o zajętym id – dostaje nowe id,
 *   a odwołania szablonu do obrazu są przepisane;
 * - czcionka o rodzinie i wariancie, które projekt już ma, nie jest dodawana (ostrzeżenie);
 * - rola istniejąca w projekcie zostaje (ostrzeżenie, gdy wskazuje inną rodzinę);
 * - szablon o zajętym id dostaje nowe id.
 */
export function dodajSzablon(
  projekt: Projekt,
  zasoby: DaneZasobow,
  paczka: PaczkaSzablonu,
): { projekt: Projekt; zasoby: DaneZasobow; szablonId: string; ostrzezenia: string[] } {
  sprawdzRewersPaczki(paczka);
  const { ostrzezenia, noweZasoby, opisy, przemianowane } = dolaczZasobyPaczki(
    projekt,
    zasoby,
    paczka,
  );
  const szablon = structuredClone(paczka.szablon);
  const rewers = paczka.rewers && structuredClone(paczka.rewers);
  const strony = rewers ? [szablon, rewers] : [szablon];
  for (const s of strony) {
    if (s.teksturaTla) s.teksturaTla = przemianowane.get(s.teksturaTla) ?? s.teksturaTla;
    for (const w of wszystkieWezly(s)) {
      if (czyKontener(w) && w.teksturaTla)
        w.teksturaTla = przemianowane.get(w.teksturaTla) ?? w.teksturaTla;
      if (w.typ === 'obraz' && w.zasob) w.zasob = przemianowane.get(w.zasob) ?? w.zasob;
    }
  }
  // Własne elementy ozdobne szablonu: identyczne współdzielone, inne o zajętym id – nowe id.
  const uzyte = new Set(strony.flatMap(odwolaniaDoElementow).filter((id) => !czyWbudowany(id)));
  const wPaczce = new Set((paczka.biblioteka ?? []).map((e) => e.id));
  for (const id of uzyte)
    if (!wPaczce.has(id) && elementyProjektu(projekt).some((e) => e.id === id))
      ostrzezenia.push(t('dane.elementZProjektu', { id }));
  // Obrazy ramek 9-slice, którym nadano nowe id, wskazują nowe id także w elementach z paczki.
  const bibliotekaPaczki = (paczka.biblioteka ?? []).map((e) =>
    przepiszObrazRamki(e, przemianowane),
  );
  const elementy = dolaczElementy(projekt, bibliotekaPaczki, uzyte);
  for (const s of strony) przepiszOdwolania(s, elementy.mapa);
  const role = { ...projekt.role };
  for (const [rola, rodzina] of Object.entries(paczka.role)) {
    const obecna = role[rola];
    if (obecna === undefined) role[rola] = rodzina;
    else if (obecna !== rodzina)
      ostrzezenia.push(t('dane.konfliktRoli', { rola, projekt: obecna, szablon: rodzina }));
  }
  szablon.id = unikalneId(szablon.id, new Set(projekt.szablony.map((s) => s.id)));
  if (rewers) {
    rewers.id = unikalneId(rewers.id, new Set((projekt.rewersy ?? []).map((r) => r.id)));
    szablon.rewersId = rewers.id;
  }
  const wynik: Projekt = {
    ...projekt,
    ...(rewers ? { rewersy: [...(projekt.rewersy ?? []), rewers] } : {}),
    role,
    zasoby: opisy,
    ...(elementy.lista.length > 0 ? { biblioteka: { ozdobniki: elementy.lista } } : {}),
    szablony: [...projekt.szablony, szablon],
    zmieniono: new Date().toISOString(),
  };
  return {
    projekt: przygotujProjekt(wynik),
    zasoby: noweZasoby,
    szablonId: szablon.id,
    ostrzezenia,
  };
}
