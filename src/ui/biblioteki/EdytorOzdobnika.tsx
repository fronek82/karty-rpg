import { useEffect, useMemo, useRef, useState } from 'react';
import { zmienionyElement, type ZmianaElementu } from '../../dane/biblioteka';
import { elementZWpisu, type WpisBiblioteki } from '../../dane/bibliotekaUzytkownika';
import { t } from '../../i18n';
import { TRESC_DOMYSLNA, type ElementOzdobny, type RodzajElementu } from '../../ozdobniki';
import { baza } from '../bazaUI';
import { EdytorRamki9 } from '../biblioteka/EdytorRamki9';
import { KOLOR_PODGLADU, podgladElementu } from '../biblioteka/podgladElementu';
import { opisBleduImportu } from '../start/importSzablonu';
import { Liczba } from '../szablon/Kontrolki';
import { MiniaturaOzdobnika } from '../szablon/MiniaturaOzdobnika';
import { nazwaElementu } from '../szablon/PanelWygladu';
import type { ZasobyPakietu } from '../zasoby';

/** Rodzaje, w których można użyć własnego elementu z SVG. */
export const RODZAJE_ELEMENTU: RodzajElementu[] = [
  'naroznik',
  'motyw',
  'zakonczenie',
  'srodek',
  'ksztalt',
  'ramka9',
];

export function Przyciski<T extends string>({
  etykieta,
  opcje,
  wartosc,
  zmien,
}: {
  etykieta: string;
  opcje: { wartosc: T; tekst: string }[];
  wartosc: T;
  zmien: (v: T) => void;
}) {
  return (
    <div className="pole-panelu">
      <span className="etykieta-grupy">{etykieta}</span>
      <div className="przelacznik-segmentowy" role="group" aria-label={etykieta}>
        {opcje.map((o) => (
          <button
            key={o.wartosc}
            type="button"
            aria-pressed={wartosc === o.wartosc}
            onClick={() => zmien(o.wartosc)}
          >
            {o.tekst}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Podgląd elementu w użyciu (ten sam silnik co karty); bez podglądu – sama miniatura. */
export function PodgladElementu({
  element,
  zasoby,
  prefiks,
}: {
  element: ElementOzdobny;
  zasoby: ZasobyPakietu | undefined;
  prefiks: string;
}) {
  const p = useMemo(
    () =>
      zasoby
        ? podgladElementu(element, zasoby.czcionki, prefiks, {
            obrazy: zasoby.obrazy,
            ...(zasoby.elementy ? { elementy: zasoby.elementy } : {}),
          })
        : undefined,
    [element, zasoby, prefiks],
  );
  if (!p)
    return (
      <div className="podglad-elementu" style={{ color: KOLOR_PODGLADU }}>
        <MiniaturaOzdobnika element={element} />
      </div>
    );
  return (
    <div
      className="podglad-elementu"
      data-testid="podglad-elementu"
      style={{ aspectRatio: `${p.szer} / ${p.wys}`, width: `min(100%, ${p.szer * 4}px)` }}
      dangerouslySetInnerHTML={{ __html: p.svg }}
    />
  );
}

/**
 * Szczegóły ozdobnika z biblioteki użytkownika (dawniej biblioteka ozdobników projektu): podgląd,
 * rodzaj, kolorowanie, nazwa, prostokąt treści kształtu, edytor ramki 9-slice i lista projektów,
 * które go używają. Każda zmiana trafia od razu do biblioteki.
 */
export function EdytorOzdobnika({
  wpis,
  zasoby,
}: {
  wpis: WpisBiblioteki;
  zasoby: ZasobyPakietu | undefined;
}) {
  // Stan lokalny: zmiany widać od razu (np. seria strzałek przy wcięciach), a zapisy do biblioteki
  // idą po kolei w tle. Panel jest montowany na nowo dla każdego wpisu (`key`).
  // Nazwa zawsze z biblioteki (zmienia się też na kafelku) – stan lokalny trzyma resztę.
  const [lokalny, ustawLokalny] = useState<ElementOzdobny>();
  const element = lokalny ? { ...lokalny, nazwa: wpis.nazwa } : elementZWpisu(wpis)!;
  const kolejka = useRef(Promise.resolve());
  // Nazwa w trakcie edycji (undefined – pokazuje nazwę z biblioteki); `zatwierdzona` – nazwa
  // wysłana do zapisu, pokazywana, dopóki biblioteka nie odda nowej.
  const [edytowana, ustawNazwe] = useState<string>();
  const [zatwierdzona, ustawZatwierdzona] = useState<{ z: string; na: string }>();
  const nazwa =
    edytowana ?? (zatwierdzona && wpis.nazwa === zatwierdzona.z ? zatwierdzona.na : wpis.nazwa);
  const [blad, ustawBlad] = useState<string>();
  const [uzywajace, ustawUzywajace] = useState<{ id: string; nazwa: string }[]>();
  useEffect(() => {
    let aktywny = true;
    void baza()
      .projektyUzywajace(wpis.id)
      .then((l) => aktywny && ustawUzywajace(l));
    return () => {
      aktywny = false;
    };
  }, [wpis.id]);

  const zapisz = (e: ElementOzdobny) => {
    ustawBlad(undefined);
    ustawLokalny(e);
    // Bez nazwy – zapis zachowuje nazwę z biblioteki (mogła się zmienić na kafelku).
    const { nazwa: _n, ...bezNazwy } = e;
    void _n;
    kolejka.current = kolejka.current
      .then(() => baza().zmienElementBibliotekiUzytkownika(bezNazwy as ElementOzdobny))
      .catch((x: unknown) => ustawBlad(opisBleduImportu(x)));
  };
  const zmien = (z: ZmianaElementu) => zapisz(zmienionyElement(element, z));
  const zapiszNazwe = () => {
    const n = nazwa.trim().slice(0, 200);
    ustawNazwe(undefined);
    if (!n || n === wpis.nazwa) return;
    ustawZatwierdzona({ z: wpis.nazwa, na: n });
    // Ta sama kolejka co zmiany elementu – kolejność zapisów zachowana.
    kolejka.current = kolejka.current
      .then(() => baza().zmienNazweWBibliotece(wpis.id, n))
      .catch((x: unknown) => ustawBlad(opisBleduImportu(x)));
  };
  // Ramka z obrazu PNG nie ma konturów: ani rodzaju do wyboru, ani koloru.
  const obrazowa = element.ramka9?.zrodlo.typ === 'obraz';

  return (
    <section
      className="panel-importu panel-ozdobnika edytor-ozdobnika"
      aria-label={nazwaElementu(element)}
    >
      <h2>{nazwaElementu(element)}</h2>
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      {element.rodzaj === 'ramka9' ? (
        zasoby ? (
          <EdytorRamki9 key={element.id} element={element} zmien={zapisz} zasoby={zasoby} />
        ) : null
      ) : (
        <PodgladElementu element={element} zasoby={zasoby} prefiks="be-" />
      )}
      {!obrazowa && (
        <>
          <Przyciski
            etykieta={t('biblioteka.uzyjJako')}
            opcje={RODZAJE_ELEMENTU.map((r) => ({
              wartosc: r,
              tekst: t(`biblioteka.rodzaj.${r}`),
            }))}
            wartosc={element.rodzaj}
            zmien={(r) => zmien({ rodzaj: r })}
          />
          <Przyciski
            etykieta={t('biblioteka.kolor')}
            opcje={(['jednolity', 'oryginal'] as const).map((k) => ({
              wartosc: k,
              tekst: t(`biblioteka.kolor.${k}`),
            }))}
            wartosc={element.kolorowanie ?? 'oryginal'}
            zmien={(k) => zmien({ kolorowanie: k })}
          />
        </>
      )}
      <div className="pole-panelu">
        <label htmlFor={`nazwa-${wpis.id}`}>{t('biblioteka.nazwa')}</label>
        <input
          id={`nazwa-${wpis.id}`}
          value={nazwa}
          onChange={(e) => ustawNazwe(e.target.value)}
          onBlur={zapiszNazwe}
          onKeyDown={(e) => e.key === 'Enter' && zapiszNazwe()}
        />
      </div>
      {element.rodzaj === 'ksztalt' && (
        <fieldset className="tresc-ksztaltu">
          <legend>{t('biblioteka.tresc')}</legend>
          <div className="dwa-pola">
            {(['x', 'y', 'szer', 'wys'] as const).map((k) => (
              <Liczba
                key={k}
                etykieta={t(`biblioteka.tresc.${k}`)}
                wartosc={Math.round((element.tresc ?? TRESC_DOMYSLNA)[k] * 100)}
                min={k === 'szer' || k === 'wys' ? 1 : 0}
                max={100}
                krok={1}
                zmien={(v) =>
                  zmien({ tresc: { ...(element.tresc ?? TRESC_DOMYSLNA), [k]: v / 100 } })
                }
              />
            ))}
          </div>
        </fieldset>
      )}
      {uzywajace && (
        <p className="podpis" data-testid="uzycie-elementu">
          {uzywajace.length > 0
            ? t('biblioteki.uzywanyW', { projekty: uzywajace.map((p) => p.nazwa).join(', ') })
            : t('biblioteki.nieuzywany')}
        </p>
      )}
    </section>
  );
}
