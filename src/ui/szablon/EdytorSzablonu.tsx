import { useEffect, useMemo, useRef, useState } from 'react';
import {
  danePodgladu,
  doPoprzedniegoKontenera,
  duplikujWezel,
  nowyWezel,
  opakuj,
  przesunWezel,
  rodzicWezla,
  usunWezly,
  wstawWezel,
  wyzej,
  zmienSzablon,
  zmienWezel,
  znajdzWezel,
  type RodzajNowego,
} from '../../dane/szablon';
import { kartkaDlaSzablonu, zmienRozmiarSzablonu } from '../../dane/wlasneKarty';
import { t } from '../../i18n';
import { czyKontener, type Szablon, type Wezel } from '../../model/szablon';
import { renderujKarte } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import { PoleLiczby } from '../kartka/PoleLiczby';
import { tekstOstrzezenia } from '../ostrzezenia';
import { tekstZapisu, type ProjektWEdycji } from '../useProjekt';
import { DrzewoSzablonu, IKONY_WEZLOW, nazwaWezla } from './DrzewoSzablonu';
import { PanelWezla } from './PanelWezla';

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
  const drzewo = useRef<HTMLDivElement>(null);
  const idProjektu = encodeURIComponent(projekt.id);

  // Zaznaczenie bez usuniętych węzłów (np. po „Cofnij”).
  const aktywne = szablon ? zazn.filter((id) => znajdzWezel(szablon, id)) : [];
  const jeden = szablon && aktywne.length === 1 ? znajdzWezel(szablon, aktywne[0]!) : undefined;

  const zmienSz = (f: (s: Szablon) => Szablon, klucz?: string) =>
    zmien((p) => zmienSzablon(p, szablonId, f), klucz ? { klucz: `szablon:${klucz}` } : {});

  // Podgląd: karta z danymi przykładowymi (silnik jak na kartce i w PDF).
  const zasoby = edycja.zasoby.zasoby;
  const podglad = useMemo(() => {
    if (!szablon) return undefined;
    try {
      const w = renderujKarte(
        szablon,
        { dane: danePodgladu(szablon) },
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
  }, [szablon, zasoby]);

  const cel = jeden ?? szablon?.korzen;
  const dodaj = (r: RodzajNowego) => {
    if (!szablon || !cel) return;
    const rodzic = czyKontener(cel) ? cel : rodzicWezla(szablon, cel.id)?.rodzic;
    const w = nowyWezel(szablon, r, t(`wezel.${r}`), { wWierszu: rodzic?.typ === 'wiersz' });
    zmienSz((s) => wstawWezel(s, cel.id, w));
    ustawZazn([w.id]);
    ustawMenuDodaj(false);
  };
  const usun = () => {
    if (!szablon || aktywne.length === 0) return;
    zmienSz((s) => usunWezly(s, aktywne));
    ustawZazn([]);
  };
  const duplikuj = () => {
    if (!szablon || !jeden || jeden.id === szablon.korzen.id) return;
    const d = duplikujWezel(szablon, jeden.id, t('szablon.kopia'));
    zmienSz(() => d.szablon);
    ustawZazn([d.id]);
  };
  const ruch = (f: (s: Szablon, id: string) => Szablon) => {
    if (!jeden) return;
    zmienSz((s) => f(s, jeden.id));
  };
  const opakujW = (typ: 'wiersz' | 'kolumna') => {
    if (!szablon || aktywne.length === 0) return;
    const o = opakuj(szablon, aktywne, typ, t(`wezel.${typ}`));
    if (!o.id) return;
    zmienSz(() => o.szablon);
    ustawZazn([o.id]);
  };
  const robKarty = () => {
    const w = kartkaDlaSzablonu(projekt, szablonId);
    if (w.projekt !== projekt) zmien(() => w.projekt);
    window.location.hash = `#/projekt/${idProjektu}`;
  };

  // Skróty: Delete, Ctrl+D, Ctrl+Z / Ctrl+Y, Escape; strzałki w drzewie.
  const klawisze = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const obsluzKlawisz = (e: KeyboardEvent) => {
    if (wPolu(document.activeElement)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
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
      ustawMenuDodaj(false);
    } else if (
      (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
      drzewo.current?.contains(document.activeElement)
    ) {
      e.preventDefault();
      const elementy = [...drzewo.current.querySelectorAll<HTMLElement>('[data-wezel]')];
      const i = elementy.indexOf(document.activeElement as HTMLElement);
      const nast =
        elementy[Math.max(0, Math.min(elementy.length - 1, i + (e.key === 'ArrowUp' ? -1 : 1)))];
      if (nast) {
        if (e.altKey && jeden) ruch((s, id) => przesunWezel(s, id, e.key === 'ArrowUp' ? -1 : 1));
        else {
          ustawZazn([nast.dataset.wezel!]);
          nast.focus();
        }
      }
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

  const wybierz = (id: string, dodajDo: boolean) =>
    ustawZazn((z) => (dodajDo ? (z.includes(id) ? z.filter((x) => x !== id) : [...z, id]) : [id]));
  const wymiary = (id: string) =>
    podglad && 'wezly' in podglad ? podglad.wezly.find((w) => w.id === id) : undefined;
  const r = szablon.rozmiar;
  const szer = r.tryb === 'mm' ? r.szerokosc : r.kolumny * r.slot.szerokosc;
  const wys = r.tryb === 'mm' ? r.wysokosc : r.rzedy * r.slot.wysokosc;
  const korzenZazn = !jeden || jeden.id === szablon.korzen.id;

  return (
    <div className="edytor-szablonu">
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
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuDodaj}
                onClick={() => ustawMenuDodaj((x) => !x)}
              >
                {t('szablon.dodaj')}
              </button>
              {menuDodaj && (
                <div className="menu-typu" role="menu" aria-label={t('szablon.dodaj')}>
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
              disabled={!jeden || korzenZazn}
              onClick={() => ruch((s, id) => przesunWezel(s, id, -1))}
            >
              {t('szablon.wyzej')}
            </button>
            <button
              type="button"
              disabled={!jeden || korzenZazn}
              onClick={() => ruch((s, id) => przesunWezel(s, id, 1))}
            >
              {t('szablon.nizej')}
            </button>
            <button
              type="button"
              disabled={!jeden || korzenZazn}
              onClick={() => ruch(doPoprzedniegoKontenera)}
            >
              {t('szablon.doKontenera')}
            </button>
            <button type="button" disabled={!jeden || korzenZazn} onClick={() => ruch(wyzej)}>
              {t('szablon.wyjmij')}
            </button>
            <button
              type="button"
              disabled={aktywne.length === 0 || aktywne.includes(szablon.korzen.id)}
              onClick={() => opakujW('wiersz')}
            >
              {t('szablon.opakujWiersz')}
            </button>
            <button
              type="button"
              disabled={aktywne.length === 0 || aktywne.includes(szablon.korzen.id)}
              onClick={() => opakujW('kolumna')}
            >
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
                      const wezel = znajdzWezel(szablon, w.id);
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
          {jeden && !korzenZazn ? (
            <>
              <h2>{nazwaWezla(jeden)}</h2>
              <PanelWezla
                key={jeden.id}
                szablon={szablon}
                wezel={jeden}
                wymiary={wymiary(jeden.id)}
                zmienWezel={(f, klucz) => zmienSz((s) => zmienWezel(s, jeden.id, f), klucz)}
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
            <PanelKarty
              szablon={szablon}
              zmienSz={zmienSz}
              zmienRozmiar={(s, w) =>
                zmien((p) => zmienRozmiarSzablonu(p, szablonId, s, w), { klucz: 'rozmiar-karty' })
              }
            />
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
  zmienRozmiar: (szer: number, wys: number) => void;
}) {
  const r = szablon.rozmiar;
  return (
    <>
      <h2>{t('szablon.karta')}</h2>
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
            zmien={(v) => zmienRozmiar(v, r.wysokosc)}
          />
          <PoleLiczby
            id="karta-wys"
            etykieta={t('kreator.wysokosc')}
            wartosc={r.wysokosc}
            min={10}
            max={300}
            krok={0.5}
            zmien={(v) => zmienRozmiar(r.szerokosc, v)}
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
          max={30}
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
      {szablon.warianty?.length ? <p className="podpis">{t('szablon.warianty')}</p> : null}
      {jedenWezelUwaga(szablon.korzen)}
    </>
  );
}

const jedenWezelUwaga = (k: Wezel) =>
  czyKontener(k) && k.dzieci.length === 0 ? (
    <p className="uwaga">{t('szablon.pustaKarta')}</p>
  ) : null;
