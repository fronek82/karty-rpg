import { useEffect, useMemo, useRef, useState } from 'react';
import {
  danePodgladu,
  doPoprzedniegoKontenera,
  duplikujWezel,
  kluczeDanychKart,
  nowyWezel,
  opakuj,
  przesunWezel,
  rodzicWezla,
  skopiujStyl,
  usunWezly,
  wklejStyl,
  zmienTypKontenera,
  zmienTypPola,
  type SkopiowanyStyl,
  wstawWezel,
  wszystkieWezly,
  wyzej,
  zmienSzablon,
  zmienWezel,
  znajdzWezel,
  type RodzajNowego,
} from '../../dane/szablon';
import { kartkaDlaSzablonu, zmienRozmiarSzablonu } from '../../dane/wlasneKarty';
import { wymiaryKarty } from '../../model/szablon';
import { roleProjektu } from '../../dane/edycja';
import { t, tJesliJest } from '../../i18n';
import {
  czyKontener,
  type Kontener,
  type Pole,
  type Szablon,
  type Wezel,
} from '../../model/szablon';
import { renderujKarte } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import { PoleLiczby } from '../kartka/PoleLiczby';
import { tekstOstrzezenia } from '../ostrzezenia';
import { tekstZapisu, type ProjektWEdycji } from '../useProjekt';
import { DrzewoSzablonu, IKONY_WEZLOW, nazwaWezla } from './DrzewoSzablonu';
import { Liczba, Sekcja } from './Kontrolki';
import { PanelWezla } from './PanelWezla';
import { PoleRamki } from './PanelWygladu';

const RODZAJE: RodzajNowego[] = [
  'wiersz',
  'kolumna',
  'warstwy',
  'tekst',
  'etykieta-wartosc',
  'wartosc',
  'obraz',
  'znaczniki',
  'wpis',
  'ikona',
  'separator',
  'tabela',
];

const wPolu = (e: Element | null) =>
  !!e &&
  (e.matches('input, textarea, select, [contenteditable="true"]') || !!e.closest('[role="menu"]'));

/**
 * Edytor szablonu karty od zera: drzewo wierszy, kolumn i pól (lewa kolumna), podgląd karty
 * z danymi przykładowymi i zaznaczaniem klikiem (środek), właściwości zaznaczonego elementu
 * (prawa kolumna). Zmiany zapisują się w projekcie z historią „Cofnij”.
 */
export function EdytorSzablonu({
  edycja,
  szablonId,
}: {
  edycja: ProjektWEdycji;
  szablonId: string;
}) {
  const { projekt, zmien } = edycja;
  const szablon = projekt.szablony.find((s) => s.id === szablonId);
  const [zazn, ustawZazn] = useState<string[]>([]);
  const [menuDodaj, ustawMenuDodaj] = useState(false);
  const [schowek, ustawSchowek] = useState<SkopiowanyStyl>();
  const drzewo = useRef<HTMLDivElement>(null);
  const idProjektu = encodeURIComponent(projekt.id);

  // Zaznaczenie bez usuniętych węzłów (np. po „Cofnij”).
  const aktywne = szablon ? zazn.filter((id) => znajdzWezel(szablon, id)) : [];
  const jeden = szablon && aktywne.length === 1 ? znajdzWezel(szablon, aktywne[0]!) : undefined;

  const zmienSz = (f: (s: Szablon) => Szablon, klucz?: string) =>
    zmien((p) => zmienSzablon(p, szablonId, f), klucz ? { klucz: `szablon:${klucz}` } : {});

  const wybierz = (id: string, dodajDo: boolean) =>
    ustawZazn((z) => (dodajDo ? (z.includes(id) ? z.filter((x) => x !== id) : [...z, id]) : [id]));
  const fokusWDrzewie = (id: string) =>
    requestAnimationFrame(() =>
      drzewo.current?.querySelector<HTMLElement>(`[data-wezel="${CSS.escape(id)}"]`)?.focus(),
    );
  const zamknijMenu = () => {
    ustawMenuDodaj(false);
  };

  // Podgląd: karta z danymi przykładowymi (silnik jak na kartce i w PDF). Zależy tylko od
  // tego, co widać na karcie – zmiana nazwy szablonu nie rysuje karty od nowa.
  const zasoby = edycja.zasoby.zasoby;
  const doRysunku = szablon && { ...szablon, nazwa: '' };
  const kluczRysunku = doRysunku ? JSON.stringify(doRysunku) : '';
  const podglad = useMemo(() => {
    if (!kluczRysunku) return undefined;
    const sz = JSON.parse(kluczRysunku) as Szablon;
    try {
      const w = renderujKarte(
        sz,
        { dane: danePodgladu(sz) },
        { czcionki: zasoby.czcionki, obraz: (id) => zasoby.obrazy.get(id)?.info },
      );
      return {
        ...w,
        svg: scenaDoSvg(w.scena, {
          adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
          przedrostekId: 'sz-',
        }),
      };
    } catch (e) {
      return { blad: e instanceof Error ? e.message : String(e) };
    }
  }, [kluczRysunku, zasoby.czcionki, zasoby.obrazy]);
  const wezlyPoId = useMemo(
    () => new Map(szablon ? wszystkieWezly(szablon).map((w) => [w.id, w] as const) : []),
    [szablon],
  );

  // Operacje liczone w aktualizatorze (na najnowszym szablonie); nowe id przekazywane przez zmienną.
  const zajeteKlucze = () => kluczeDanychKart(projekt, szablonId);
  const cel = jeden ?? szablon?.korzen;
  const dodaj = (r: RodzajNowego) => {
    if (!cel) return;
    let noweId = '';
    zmienSz((s) => {
      const c = znajdzWezel(s, cel.id) ?? s.korzen;
      const rodzic = czyKontener(c) ? c : rodzicWezla(s, c.id)?.rodzic;
      const w = nowyWezel(s, r, t(`wezel.${r}`), {
        wWierszu: rodzic?.typ === 'wiersz',
        zajete: zajeteKlucze(),
      });
      noweId = w.id;
      return wstawWezel(s, c.id, w);
    });
    if (noweId) ustawZazn([noweId]);
    zamknijMenu();
  };
  const usun = () => {
    if (!szablon) return;
    const ids = aktywne.filter((id) => id !== szablon.korzen.id);
    if (ids.length === 0) return;
    // Fokus po usunięciu: sąsiad albo rodzic pierwszego usuwanego.
    const r = rodzicWezla(szablon, ids[0]!);
    const nastepny =
      r?.rodzic.dzieci.find((d, i) => i > r.indeks && !ids.includes(d.id)) ??
      [...(r?.rodzic.dzieci ?? [])]
        .reverse()
        .find((d, i, t) => t.length - 1 - i < r!.indeks && !ids.includes(d.id)) ??
      r?.rodzic;
    zmienSz((s) => usunWezly(s, ids));
    ustawZazn(nastepny ? [nastepny.id] : []);
    if (nastepny) fokusWDrzewie(nastepny.id);
  };
  const duplikuj = () => {
    if (!szablon || !jeden || jeden.id === szablon.korzen.id) return;
    let noweId = '';
    zmienSz((s) => {
      const d = duplikujWezel(s, jeden.id, t('szablon.kopia'), zajeteKlucze());
      noweId = d.id;
      return d.szablon;
    });
    if (noweId) ustawZazn([noweId]);
  };
  const ruch = (f: (s: Szablon, id: string) => Szablon) => {
    if (!jeden) return;
    zmienSz((s) => f(s, jeden.id));
    fokusWDrzewie(jeden.id);
  };
  const opakujW = (typ: 'wiersz' | 'kolumna') => {
    if (aktywne.length === 0) return;
    let noweId = '';
    zmienSz((s) => {
      const o = opakuj(s, aktywne, typ, t(`wezel.${typ}`));
      noweId = o.id;
      return o.szablon;
    });
    if (noweId) ustawZazn([noweId]);
  };
  const robKarty = () => {
    let arkuszId = '';
    zmien((p) => {
      const w = kartkaDlaSzablonu(p, szablonId);
      arkuszId = w.arkuszId;
      return w.projekt;
    });
    window.location.hash = `#/projekt/${idProjektu}/kartka/${encodeURIComponent(arkuszId)}`;
  };

  // Menu „+ Dodaj”: fokus na pierwszej pozycji, strzałki, Escape wraca na przycisk.
  const przyciskDodaj = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuDodaj) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const poza = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && e.target !== przyciskDodaj.current)
        ustawMenuDodaj(false);
    };
    window.addEventListener('pointerdown', poza);
    return () => window.removeEventListener('pointerdown', poza);
  }, [menuDodaj]);
  const klawiszMenu = (e: React.KeyboardEvent) => {
    const pozycje = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = pozycje.indexOf(document.activeElement as HTMLElement);
    const cel =
      e.key === 'ArrowDown'
        ? pozycje[(i + 1) % pozycje.length]
        : e.key === 'ArrowUp'
          ? pozycje[(i - 1 + pozycje.length) % pozycje.length]
          : e.key === 'Home'
            ? pozycje[0]
            : e.key === 'End'
              ? pozycje.at(-1)
              : undefined;
    if (cel) {
      e.preventDefault();
      cel.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      ustawMenuDodaj(false);
      przyciskDodaj.current?.focus();
    }
  };

  // Skróty: Delete, Ctrl+D, Ctrl+Z / Ctrl+Y, Escape; drzewo: strzałki, Home/End, Shift+strzałka
  // (dokłada do zaznaczenia), ←/→ (rodzic / pierwsze dziecko), Alt+↑/↓ (przesuń).
  const klawisze = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const obsluzKlawisz = (e: KeyboardEvent) => {
    if (wPolu(document.activeElement)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const wDrzewie = !!drzewo.current?.contains(document.activeElement);
    if (ctrl && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) edycja.ponow();
      else edycja.cofnij();
    } else if (ctrl && k === 'y') {
      e.preventDefault();
      edycja.ponow();
    } else if (ctrl && k === 'd') {
      e.preventDefault();
      duplikuj();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      usun();
    } else if (e.key === 'Escape') {
      ustawZazn([]);
    } else if (
      wDrzewie &&
      ['ArrowUp', 'ArrowDown', 'Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(e.key)
    ) {
      e.preventDefault();
      const elementy = [...drzewo.current!.querySelectorAll<HTMLElement>('[data-wezel]')];
      const biezacy = document.activeElement as HTMLElement;
      const i = elementy.indexOf(biezacy);
      const id = biezacy.dataset.wezel;
      if (e.altKey && jeden && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        ruch((s, x) => przesunWezel(s, x, e.key === 'ArrowUp' ? -1 : 1));
        return;
      }
      let nast: HTMLElement | undefined;
      if (e.key === 'ArrowUp') nast = elementy[Math.max(0, i - 1)];
      else if (e.key === 'ArrowDown') nast = elementy[Math.min(elementy.length - 1, i + 1)];
      else if (e.key === 'Home') nast = elementy[0];
      else if (e.key === 'End') nast = elementy.at(-1);
      else if (e.key === 'ArrowLeft' && szablon && id) {
        const r = rodzicWezla(szablon, id);
        nast = r ? elementy.find((x) => x.dataset.wezel === r.rodzic.id) : undefined;
      } else if (e.key === 'ArrowRight' && szablon && id) {
        const w = wezlyPoId.get(id);
        const pierwsze = w && czyKontener(w) ? w.dzieci[0] : undefined;
        nast = pierwsze ? elementy.find((x) => x.dataset.wezel === pierwsze.id) : undefined;
      }
      if (nast?.dataset.wezel) {
        const nid = nast.dataset.wezel;
        if (e.shiftKey) ustawZazn((z) => (z.includes(nid) ? z : [...z, nid]));
        else ustawZazn([nid]);
        nast.focus();
      }
    } else if (wDrzewie && (e.key === ' ' || e.key === 'Enter')) {
      // Spacja z Ctrl – dokłada / zdejmuje element z zaznaczenia.
      e.preventDefault();
      const id = (document.activeElement as HTMLElement).dataset.wezel;
      if (id) wybierz(id, ctrl);
    }
  };
  useEffect(() => {
    klawisze.current = obsluzKlawisz;
  });
  useEffect(() => {
    const f = (e: KeyboardEvent) => klawisze.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  if (!szablon) {
    return (
      <section className="tresc">
        <h1>{t('szablon.brak')}</h1>
        <a href={`#/projekt/${idProjektu}`}>{t('szablon.wrocDoKartek')}</a>
      </section>
    );
  }

  const wymiary = (id: string) =>
    podglad && 'wezly' in podglad ? podglad.wezly.find((w) => w.id === id) : undefined;
  const { szer, wys } = wymiaryKarty(szablon);
  // „Opakuj” – tylko elementy jednego rodzica (bez korzenia).
  const rodzice = new Set(aktywne.map((id) => rodzicWezla(szablon, id)?.rodzic.id));
  const moznaOpakowac = aktywne.length > 0 && rodzice.size === 1 && !rodzice.has(undefined);
  const r1 = jeden && !korzen(jeden.id) ? rodzicWezla(szablon, jeden.id) : undefined;
  const moznaWyzej = !!r1 && r1.indeks > 0;
  const moznaNizej = !!r1 && r1.indeks < r1.rodzic.dzieci.length - 1;
  const poprzedni = r1 ? r1.rodzic.dzieci[r1.indeks - 1] : undefined;
  const moznaDoKontenera = !!poprzedni && czyKontener(poprzedni);
  const moznaWyjac = !!r1 && r1.rodzic.id !== szablon.korzen.id;
  const korzenZazn = !jeden || jeden.id === szablon.korzen.id;
  // Element do panelu: jeden zaznaczony albo kilku tego samego typu (bez korzenia).
  const zaznWezly = aktywne.map((id) => wezlyPoId.get(id)).filter((w): w is Wezel => !!w);
  const edytowany =
    zaznWezly.length > 0 &&
    !aktywne.includes(szablon.korzen.id) &&
    zaznWezly.every((w) => w.typ === zaznWezly[0]!.typ)
      ? zaznWezly[0]
      : undefined;
  // Czcionki: role projektu i rodziny z biblioteki; obrazy z biblioteki.
  const rodziny = [
    ...new Set(projekt.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [z.rodzina] : []))),
  ];
  const czcionki = [
    ...roleProjektu(projekt).map((r) => ({
      wartosc: r,
      tekst: t('wlasciwosci.rola', { rola: tJesliJest(`rola.${r}`) ?? r }),
    })),
    ...rodziny.map((r) => ({ wartosc: r, tekst: r })),
  ];
  const obrazy = projekt.zasoby.flatMap((z) =>
    z.rodzaj === 'obraz' ? [{ wartosc: z.id, tekst: z.nazwa }] : [],
  );
  function korzen(id: string) {
    return id === szablon!.korzen.id;
  }

  return (
    <div className="edytor-szablonu">
      <h1 className="tylko-czytnik">{t('szablon.tytulEdytora')}</h1>
      <header className="pasek-gorny">
        <a href="#/" className="logo">
          {t('aplikacja.nazwa')}
        </a>
        <input
          className="nazwa-projektu"
          aria-label={t('szablon.nazwaSzablonu')}
          value={szablon.nazwa}
          onChange={(e) => zmienSz((s) => ({ ...s, nazwa: e.target.value }), 'nazwa')}
        />
        <span className="status-zapisu" role="status">
          {tekstZapisu(edycja.zapis)}
        </span>
        <span className="odstep" />
        <a className="przycisk" href={`#/projekt/${idProjektu}`}>
          {t('szablon.wrocDoKartek')}
        </a>
        <button
          type="button"
          aria-label={t('kartka.cofnij')}
          disabled={!edycja.mozeCofnac}
          onClick={edycja.cofnij}
        >
          ↶
        </button>
        <button
          type="button"
          aria-label={t('kartka.ponow')}
          disabled={!edycja.mozePonowic}
          onClick={edycja.ponow}
        >
          ↷
        </button>
        <button type="button" className="glowny" onClick={robKarty}>
          {t('szablon.robKarty')}
        </button>
      </header>
      <div className="uklad-szablonu">
        <aside className="panel-drzewa" aria-label={t('szablon.struktura')}>
          <h2>{t('szablon.struktura')}</h2>
          <div ref={drzewo}>
            <DrzewoSzablonu korzen={szablon.korzen} zaznaczone={aktywne} wybierz={wybierz} />
          </div>
          <div className="akcje-drzewa">
            <div className="menu-dodaj">
              <button
                ref={przyciskDodaj}
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuDodaj}
                onClick={() => ustawMenuDodaj((x) => !x)}
              >
                {t('szablon.dodaj')}
              </button>
              {menuDodaj && (
                <div
                  ref={menu}
                  className="menu-typu"
                  role="menu"
                  aria-label={t('szablon.dodaj')}
                  onKeyDown={klawiszMenu}
                >
                  {RODZAJE.map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="menuitem"
                      className="menu-pozycja"
                      onClick={() => dodaj(r)}
                    >
                      <span>
                        <span className="ikona" aria-hidden="true">
                          {IKONY_WEZLOW[r === 'etykieta-wartosc' ? 'tekst' : r]}
                        </span>{' '}
                        {t(`wezel.${r}`)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={!moznaWyzej}
              onClick={() => ruch((s, id) => przesunWezel(s, id, -1))}
            >
              {t('szablon.wyzej')}
            </button>
            <button
              type="button"
              disabled={!moznaNizej}
              onClick={() => ruch((s, id) => przesunWezel(s, id, 1))}
            >
              {t('szablon.nizej')}
            </button>
            <button
              type="button"
              disabled={!moznaDoKontenera}
              onClick={() => ruch(doPoprzedniegoKontenera)}
            >
              {t('szablon.doKontenera')}
            </button>
            <button type="button" disabled={!moznaWyjac} onClick={() => ruch(wyzej)}>
              {t('szablon.wyjmij')}
            </button>
            <button type="button" disabled={!moznaOpakowac} onClick={() => opakujW('wiersz')}>
              {t('szablon.opakujWiersz')}
            </button>
            <button type="button" disabled={!moznaOpakowac} onClick={() => opakujW('kolumna')}>
              {t('szablon.opakujKolumne')}
            </button>
            <button type="button" disabled={!jeden || korzenZazn} onClick={duplikuj}>
              {t('kartka.duplikuj')}
            </button>
            <button
              type="button"
              className="niebezpieczny"
              disabled={aktywne.length === 0 || aktywne.includes(szablon.korzen.id)}
              onClick={usun}
            >
              {t('kartka.usun')}
            </button>
          </div>
          <p className="podpis">{t('szablon.pomocDrzewa')}</p>
        </aside>

        <section className="podglad-szablonu" aria-label={t('szablon.podglad')}>
          {podglad && 'blad' in podglad ? (
            <p role="alert" className="uwaga">
              {t('szablon.bladPodgladu', { szczegoly: String(podglad.blad) })}
            </p>
          ) : (
            podglad && (
              <>
                <div
                  className="karta-podgladu"
                  style={{
                    aspectRatio: `${szer} / ${wys}`,
                    width: `min(100%, ${(szer / wys) * 70}vh)`,
                  }}
                  onClick={() => ustawZazn([])}
                >
                  <div
                    className="svg-opakowanie"
                    dangerouslySetInnerHTML={{ __html: podglad.svg }}
                  />
                  {/* Obszary elementów – większe pod spodem, żeby mniejsze dało się kliknąć. */}
                  {[...podglad.wezly]
                    .sort((a, b) => b.szer * b.wys - a.szer * a.wys)
                    .map((w) => {
                      const wezel = wezlyPoId.get(w.id);
                      if (!wezel) return null;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          tabIndex={-1}
                          className={`obszar-wezla${aktywne.includes(w.id) ? ' zaznaczony' : ''}${czyKontener(wezel) ? ' kontener' : ''}`}
                          data-obszar={w.id}
                          aria-label={nazwaWezla(wezel)}
                          style={{
                            left: `${(w.x / szer) * 100}%`,
                            top: `${(w.y / wys) * 100}%`,
                            width: `${(w.szer / szer) * 100}%`,
                            height: `${(w.wys / wys) * 100}%`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            wybierz(w.id, e.shiftKey);
                          }}
                        />
                      );
                    })}
                </div>
                {podglad.ostrzezenia.length > 0 && (
                  <ul className="ostrzezenia-karty">
                    {podglad.ostrzezenia.map((o, i) => {
                      const w = znajdzWezel(szablon, o.pole);
                      return (
                        <li key={i}>
                          {tekstOstrzezenia({ ...o, pole: w ? nazwaWezla(w) : o.pole })}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )
          )}
          <p className="podpis">{t('szablon.pomocPodgladu')}</p>
        </section>

        <aside className="panel-edytora" aria-label={t('szablon.wlasciwosci')}>
          {edytowany ? (
            <>
              <h2>
                {aktywne.length > 1
                  ? t('szablon.zaznaczono', { liczba: aktywne.length })
                  : nazwaWezla(edytowany)}
              </h2>
              <p className="akcje-stylu">
                <button type="button" onClick={() => ustawSchowek(skopiujStyl(edytowany))}>
                  {t('wlasciwosci.kopiujStyl')}
                </button>
                <button
                  type="button"
                  disabled={!schowek}
                  onClick={() =>
                    schowek &&
                    zmienSz((s) =>
                      aktywne.reduce((x, id) => zmienWezel(x, id, (w) => wklejStyl(w, schowek)), s),
                    )
                  }
                >
                  {t('wlasciwosci.wklejStyl')}
                </button>
              </p>
              <PanelWezla
                key={aktywne.join(',')}
                szablon={szablon}
                wezel={edytowany}
                wiele={aktywne.length > 1}
                wymiary={wymiary(edytowany.id)}
                czcionki={czcionki}
                obrazy={obrazy}
                zajeteKlucze={zajeteKlucze}
                // Kilka zaznaczonych (ten sam typ) – zmiana dla każdego z nich.
                zmienWezel={(f, klucz) =>
                  zmienSz(
                    (s) => aktywne.reduce((x, id) => zmienWezel(x, id, f), s),
                    klucz && `${klucz}:${aktywne.join(',')}`,
                  )
                }
                zmienTyp={(typ) =>
                  zmienSz((s) =>
                    aktywne.reduce(
                      (x, id) =>
                        czyKontener(edytowany)
                          ? zmienTypKontenera(x, id, typ as Kontener['typ'])
                          : zmienTypPola(
                              x,
                              id,
                              typ as Pole['typ'],
                              t(`wezel.${typ}`),
                              zajeteKlucze(),
                            ),
                      s,
                    ),
                  )
                }
                zmienPrzyklad={(klucz, v) =>
                  zmienSz(
                    (s) => ({ ...s, przyklad: { ...s.przyklad, [klucz]: v } }),
                    `przyklad:${klucz}`,
                  )
                }
              />
            </>
          ) : aktywne.length > 1 ? (
            <>
              <h2>{t('szablon.zaznaczono', { liczba: aktywne.length })}</h2>
              <p className="podpis">{t('szablon.wieleOpis')}</p>
            </>
          ) : (
            <>
              <PanelKarty
                szablon={szablon}
                zmienSz={zmienSz}
                zmienRozmiar={(s, w) => {
                  // Karta, która nie zmieści się na stronie kartki – odrzucona (komunikat w panelu).
                  if (zmienRozmiarSzablonu(projekt, szablonId, s, w) === projekt) return false;
                  zmien((p) => zmienRozmiarSzablonu(p, szablonId, s, w), {
                    klucz: 'rozmiar-karty',
                  });
                  return true;
                }}
              />
              {/* Kontener całej karty: odstępy, rozłożenie, wygląd (jak każdy kontener). */}
              <Sekcja tytul={t('wlasciwosci.ukladKarty')}>
                <PanelWezla
                  key={szablon.korzen.id}
                  szablon={szablon}
                  wezel={szablon.korzen}
                  wymiary={wymiary(szablon.korzen.id)}
                  czcionki={czcionki}
                  obrazy={obrazy}
                  zajeteKlucze={zajeteKlucze}
                  zmienWezel={(f, klucz) =>
                    zmienSz((s) => zmienWezel(s, s.korzen.id, f), klucz && `korzen:${klucz}`)
                  }
                  zmienTyp={(typ) =>
                    zmienSz((s) => zmienTypKontenera(s, s.korzen.id, typ as Kontener['typ']))
                  }
                  zmienPrzyklad={() => undefined}
                />
              </Sekcja>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Ustawienia całej karty: rozmiar (mm), zaokrąglenie rogów, kolor tła. */
function PanelKarty({
  szablon,
  zmienSz,
  zmienRozmiar,
}: {
  szablon: Szablon;
  zmienSz: (f: (s: Szablon) => Szablon, klucz?: string) => void;
  zmienRozmiar: (szer: number, wys: number) => boolean;
}) {
  const r = szablon.rozmiar;
  const [blad, ustawBlad] = useState(false);
  const { szer, wys } = wymiaryKarty(szablon);
  const rozmiar = (s: number, w: number) => ustawBlad(!zmienRozmiar(s, w));
  return (
    <>
      <h2>{t('szablon.karta')}</h2>
      {blad && (
        <p role="alert" className="blad-pola">
          {t('szablon.rozmiarNieMiesci')}
        </p>
      )}
      <p className="podpis">{t('szablon.kartaOpis')}</p>
      {r.tryb === 'mm' ? (
        <div className="pole-panelu dwa-pola">
          <PoleLiczby
            id="karta-szer"
            etykieta={t('kreator.szerokosc')}
            wartosc={r.szerokosc}
            min={10}
            max={300}
            krok={0.5}
            zmien={(v) => rozmiar(v, r.wysokosc)}
          />
          <PoleLiczby
            id="karta-wys"
            etykieta={t('kreator.wysokosc')}
            wartosc={r.wysokosc}
            min={10}
            max={300}
            krok={0.5}
            zmien={(v) => rozmiar(r.szerokosc, v)}
          />
        </div>
      ) : (
        <p className="podpis">{t('szablon.rozmiarWSlotach')}</p>
      )}
      <div className="pole-panelu dwa-pola">
        <PoleLiczby
          id="karta-promien"
          etykieta={t('kreator.promien')}
          wartosc={szablon.promienRogow ?? 0}
          min={0}
          max={Math.min(szer, wys) / 2}
          krok={0.5}
          zmien={(v) => zmienSz((s) => ({ ...s, promienRogow: v }), 'promien')}
        />
        <label>
          {t('kreator.kolor')}
          <input
            type="color"
            value={szablon.tlo ?? '#ffffff'}
            onChange={(e) => zmienSz((s) => ({ ...s, tlo: e.target.value }), 'tlo')}
          />
        </label>
      </div>
      <Sekcja tytul={t('wlasciwosci.ramkaKarty')} otwarta={!!szablon.ramka}>
        <PoleRamki
          etykieta={t('wlasciwosci.ramkaKarty')}
          krawedzie={false}
          rodzaj
          narozniki={{
            wartosc: szablon.ramka?.narozniki,
            zmien: (n) =>
              zmienSz((s) => {
                if (!s.ramka) return s;
                const { narozniki: _n, ...r } = s.ramka;
                void _n;
                return { ...s, ramka: n ? { ...r, narozniki: n } : r };
              }, 'ramka-narozniki'),
          }}
          ozdoba={{
            wartosc: szablon.ramka?.ozdoba,
            zmien: (o) =>
              zmienSz((s) => {
                if (!s.ramka) return s;
                const { ozdoba: _o, ...r } = s.ramka;
                void _o;
                return { ...s, ramka: o ? { ...r, ozdoba: o } : r };
              }, 'ramka-ozdoba'),
            ramkaZostaje: true,
            promien: (szablon.promienRogow ?? 0) > 0 || szablon.ramka?.promien !== undefined,
          }}
          ramka={szablon.ramka}
          zmien={(f) =>
            zmienSz((s) => {
              const x = { ...s };
              const r = f(s.ramka);
              if (r) x.ramka = r;
              else delete x.ramka;
              return x;
            }, 'ramka')
          }
        />
        {szablon.ramka && (
          <div className="dwa-pola">
            <Liczba
              etykieta={t('wlasciwosci.odsuniecie')}
              wartosc={szablon.ramka.odsuniecie ?? 0}
              max={Math.min(szer, wys) / 2}
              zmien={(v) =>
                zmienSz((s) => ({ ...s, ramka: { ...s.ramka!, odsuniecie: v } }), 'ramka-ods')
              }
            />
            {!szablon.ramka.ozdoba && (
              <Liczba
                etykieta={t('wlasciwosci.promienRamki')}
                wartosc={
                  szablon.ramka.promien ??
                  Math.max(
                    0,
                    (szablon.promienRogow ?? 0) -
                      (szablon.ramka.odsuniecie ?? 0) -
                      szablon.ramka.grubosc / 2,
                  )
                }
                max={Math.min(szer, wys) / 2}
                zmien={(v) =>
                  zmienSz((s) => ({ ...s, ramka: { ...s.ramka!, promien: v } }), 'ramka-prom')
                }
              />
            )}
          </div>
        )}
        {szablon.ramka?.promien !== undefined && !szablon.ramka.ozdoba && (
          <button
            type="button"
            className="maly"
            onClick={() =>
              zmienSz((s) => {
                const { promien: _p, ...r } = s.ramka!;
                void _p;
                return { ...s, ramka: r };
              })
            }
          >
            {t('wlasciwosci.jakRogiKarty')}
          </button>
        )}
      </Sekcja>
      {szablon.warianty?.length ? <p className="podpis">{t('szablon.warianty')}</p> : null}
      {jedenWezelUwaga(szablon.korzen)}
    </>
  );
}

const jedenWezelUwaga = (k: Wezel) =>
  czyKontener(k) && k.dzieci.length === 0 ? (
    <p className="uwaga">{t('szablon.pustaKarta')}</p>
  ) : null;
