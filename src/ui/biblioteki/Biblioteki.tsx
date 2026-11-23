import { useEffect, useMemo, useRef, useState } from 'react';
import { ROZSZERZENIE_OZDOBNIKA } from '../../dane/archiwum';
import { elementZWpisu, type WpisBiblioteki } from '../../dane/bibliotekaUzytkownika';
import { t } from '../../i18n';
import { ELEMENTY_WBUDOWANE, importujSvg } from '../../ozdobniki';
import { opisBleduImportu } from '../start/importSzablonu';
import { elementZImportu, ImportSvg, type Wczytany } from './ImportSvg';
import { baza, zapiszOzdobnikWBibliotece } from '../bazaUI';
import { KOLOR_PODGLADU } from '../biblioteka/podgladElementu';
import { KatalogGoogleFonts } from '../kartka/KatalogGoogleFonts';
import { nazwaPliku, zapiszPlik } from '../pliki';
import { MiniaturaOzdobnika } from '../szablon/MiniaturaOzdobnika';
import { nazwaElementu } from '../szablon/PanelWygladu';
import { useBiblioteka } from '../useBiblioteka';
import {
  powiadomZmianeCzcionekGlobalnych,
  wgrajCzcionkiGlobalnie,
  wgrajObrazyGlobalnie,
} from '../zasobyGlobalne';
import { adresPowrotu } from './adresy';
import { EdytorOzdobnika } from './EdytorOzdobnika';
import { bezRozszerzenia, opisBleduSvg, paczkaOzdobnikaZPliku } from './plikiOzdobnikow';
import { StronaBiblioteki, ZAKLADKI_BIBLIOTEK, type ZakladkaBiblioteki } from './StronaBiblioteki';
import { useZasobyBiblioteki } from './zasobyBiblioteki';

/** Bajty wpisu biblioteki (do podglądu); `null` – nie udało się odczytać. */
function useBajtyWpisu(id: string): Uint8Array | null | undefined {
  const [bajty, ustawBajty] = useState<Uint8Array | null>();
  useEffect(() => {
    let aktywny = true;
    baza()
      .bajtyBiblioteki(id)
      .then(
        (b) => aktywny && ustawBajty(b ?? null),
        () => aktywny && ustawBajty(null),
      );
    return () => {
      aktywny = false;
    };
  }, [id]);
  return bajty;
}

/** Adres `blob:` z bajtów; zwalniany przy zmianie i odmontowaniu. */
function useAdresBlob(bajty: Uint8Array | null | undefined): string | undefined {
  const adres = useMemo(
    () => (bajty ? URL.createObjectURL(new Blob([bajty as Uint8Array<ArrayBuffer>])) : undefined),
    [bajty],
  );
  useEffect(() => () => void (adres && URL.revokeObjectURL(adres)), [adres]);
  return adres;
}

const Blad = () => (
  <span className="podpis" role="img" aria-label={t('biblioteki.brakPodgladu')}>
    ?
  </span>
);

function PodgladObrazu({ wpis }: { wpis: WpisBiblioteki }) {
  const bajty = useBajtyWpisu(wpis.id);
  const adres = useAdresBlob(bajty);
  if (bajty === null) return <Blad />;
  return adres ? <img src={adres} alt="" loading="lazy" decoding="async" /> : null;
}

/** Próbka tekstu krojem z biblioteki (FontFace o nazwie unikalnej dla wpisu). */
function PodgladCzcionki({ wpis }: { wpis: WpisBiblioteki }) {
  const bajty = useBajtyWpisu(wpis.id);
  const [rodzina, ustawRodzine] = useState<string>();
  const [blad, ustawBlad] = useState(false);
  const opis =
    wpis.opis?.rodzaj === 'czcionka'
      ? `${wpis.opis.rodzina} · ${t(`wariant.${wpis.opis.wariant}`)}`
      : '';
  useEffect(() => {
    if (!bajty) return;
    const nazwa = `karty-bib-${wpis.id}`;
    const kroj = new FontFace(nazwa, bajty.slice().buffer);
    let aktywny = true;
    kroj.load().then(
      () => {
        if (!aktywny) return;
        document.fonts.add(kroj);
        ustawRodzine(nazwa);
      },
      () => aktywny && ustawBlad(true),
    );
    return () => {
      aktywny = false;
      document.fonts.delete(kroj);
    };
  }, [bajty, wpis.id]);
  if (bajty === null || blad) return <Blad />;
  return (
    <span className="probka-czcionki">
      <span
        className="probka-tekst"
        data-testid="probka-czcionki"
        style={rodzina ? { fontFamily: `"${rodzina}"` } : { visibility: 'hidden' }}
      >
        {t('biblioteki.probka')}
      </span>
      {opis && <span className="podpis">{opis}</span>}
    </span>
  );
}

function PodgladOzdobnika({ wpis, adres }: { wpis: WpisBiblioteki; adres?: string | undefined }) {
  const element = elementZWpisu(wpis);
  if (!element) return <Blad />;
  return (
    <span className="podglad-ozdobnika" style={{ color: KOLOR_PODGLADU }}>
      <MiniaturaOzdobnika element={element} {...(adres ? { adres } : {})} />
    </span>
  );
}

const lista = (nazwy: readonly string[]) => nazwy.join(', ');

/** Nazwa pobieranego pliku obrazu lub czcionki: nazwa wpisu z rozszerzeniem formatu. */
function nazwaPobieranego(w: WpisBiblioteki): string {
  const format = w.opis?.format ?? 'bin';
  return /\.[a-z0-9]+$/i.test(w.nazwa) ? w.nazwa : `${w.nazwa}.${format}`;
}

async function pobierzPlik(w: WpisBiblioteki): Promise<void> {
  const bajty = await baza().odczytajZBiblioteki(w.id);
  if (w.rodzaj === 'ozdobnik')
    zapiszPlik(bajty, 'application/zip', nazwaPliku(w.nazwa, ROZSZERZENIE_OZDOBNIKA));
  else if (w.opis?.rodzaj === 'obraz')
    zapiszPlik(bajty, w.opis.format === 'png' ? 'image/png' : 'image/jpeg', nazwaPobieranego(w));
  else zapiszPlik(bajty, 'application/octet-stream', nazwaPobieranego(w));
}

/** Systemowe ozdobniki (wbudowane) – tylko do odczytu, nad siatką „Moja biblioteka”. */
function Systemowe() {
  const grupy = ['motyw', 'naroznik', 'zakonczenie', 'srodek'] as const;
  return (
    <details className="ozdobniki-systemowe">
      <summary>{t('biblioteka.systemowe')}</summary>
      <ul className="lista-biblioteki wbudowane">
        {grupy.map((g) => {
          const elementy = ELEMENTY_WBUDOWANE.filter((e) => e.rodzaj === g);
          return (
            <li key={g}>
              <span className="podpis">
                {t(`biblioteka.grupa.${g}`)} ({elementy.length})
              </span>
              <span className="miniatury" style={{ color: KOLOR_PODGLADU }}>
                {elementy.map((e) => (
                  <span key={e.id} title={nazwaElementu(e)}>
                    <MiniaturaOzdobnika element={e} />
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** Zakładka „Ozdobniki”: siatka z panelem szczegółów, import SVG i ramki z PNG. */
function Ozdobniki({ powrot }: { powrot: string | undefined }) {
  const wpisy = useBiblioteka('ozdobnik');
  const czcionki = useBiblioteka('czcionka');
  const [wybrany, ustawWybrany] = useState<string>();
  const [wczytany, ustawWczytany] = useState<Wczytany>();
  const [bladImportu, ustawBladImportu] = useState<string>();
  const plikSvg = useRef<HTMLInputElement>(null);
  const elementy = useMemo(
    () => (wpisy ?? []).flatMap((w) => (w.element ? [elementZWpisu(w)!] : [])),
    [wpisy],
  );
  const zasoby = useZasobyBiblioteki(elementy, czcionki);
  const adres = (w: WpisBiblioteki) => {
    const z = w.element?.ramka9?.zrodlo;
    return z?.typ === 'obraz' ? zasoby?.obrazy.get(z.zasob)?.adres : undefined;
  };

  /** „Importuj SVG…”: sanityzacja i raport przed dodaniem (rodzaj, kolorowanie, nazwa). */
  const importujSvgZPliku = async (f: File) => {
    ustawBladImportu(undefined);
    ustawWybrany(undefined);
    try {
      const wynik = importujSvg(new Uint8Array(await f.arrayBuffer()));
      ustawWczytany({
        plik: f.name,
        wynik,
        rodzaj: wynik.element.rodzaj,
        kolorowanie: wynik.element.kolorowanie ?? 'jednolity',
        nazwa: bezRozszerzenia(f.name),
      });
    } catch (e) {
      ustawWczytany(undefined);
      ustawBladImportu(t('biblioteka.import.blad', { plik: f.name, powod: opisBleduSvg(e) }));
    }
  };
  const dodajZaimportowany = async () => {
    if (!wczytany) return;
    try {
      const id = await baza().dodajElementDoBibliotekiUzytkownika(
        elementZImportu(wczytany, elementy),
      );
      ustawWczytany(undefined);
      ustawWybrany(id);
    } catch (e) {
      ustawBladImportu(opisBleduImportu(e));
    }
  };

  /** Dodaje pliki (SVG, PNG, paczki) i zaznacza ostatni dodany – od razu do ustawienia rodzaju. */
  const dodajPliki = async (pliki: File[]) => {
    const nazwy: string[] = [];
    let ostatni: string | undefined;
    for (const f of pliki) {
      // Paczka sprawdzona jak przy imporcie (obraz ramki dekodowany w przeglądarce).
      const { id, nazwa } = await zapiszOzdobnikWBibliotece(await paczkaOzdobnikaZPliku(f));
      ostatni = id;
      nazwy.push(nazwa);
    }
    if (ostatni) {
      ustawWczytany(undefined);
      ustawBladImportu(undefined);
      ustawWybrany(ostatni);
    }
    return t('biblioteki.dodano', { lista: lista(nazwy) });
  };

  return (
    <StronaBiblioteki
      zakladka="ozdobniki"
      opis={t('biblioteki.opis.ozdobniki')}
      powrot={powrot}
      dodaj={{
        accept: `.svg,image/svg+xml,.png,image/png,${ROZSZERZENIE_OZDOBNIKA},.zip`,
        testId: 'plik-ozdobnika-globalny',
        wykonaj: dodajPliki,
      }}
      narzedzia={
        <>
          <button type="button" onClick={() => plikSvg.current?.click()}>
            {t('biblioteka.importuj')}
          </button>
          <input
            ref={plikSvg}
            type="file"
            hidden
            accept=".svg,image/svg+xml"
            data-testid="plik-svg"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void importujSvgZPliku(f);
            }}
          />
        </>
      }
      dodatkoweDodaj={[
        { tekst: t('biblioteka.importujPng'), accept: '.png,image/png', testId: 'plik-png' },
      ]}
      panel={
        wczytany ? (
          <ImportSvg
            wczytany={wczytany}
            zmien={ustawWczytany}
            dodaj={() => void dodajZaimportowany()}
            anuluj={() => ustawWczytany(undefined)}
            zasoby={zasoby}
          />
        ) : bladImportu ? (
          <p role="alert" className="uwaga" data-testid="blad-importu">
            {bladImportu}
          </p>
        ) : undefined
      }
      dodatki={() => <Systemowe />}
      podglad={(w) => <PodgladOzdobnika wpis={w} adres={adres(w)} />}
      pobierz={pobierzPlik}
      wybrany={wybrany}
      wybierz={(w) => {
        ustawWczytany(undefined);
        ustawBladImportu(undefined);
        ustawWybrany(w?.id);
      }}
      szczegoly={(w) =>
        w.element ? <EdytorOzdobnika key={w.id} wpis={w} zasoby={zasoby} /> : null
      }
    />
  );
}

/**
 * Ekran „Biblioteki” (`#/biblioteki/<zakladka>`, N7, N8): jedna biblioteka użytkownika – obrazy,
 * czcionki i ozdobniki wspólne dla wszystkich projektów. `?powrot=` – przycisk „Gotowe” wraca
 * do miejsca, z którego otwarto bibliotekę (np. edytora szablonu).
 */
export function Biblioteki({ zakladka, zapytanie }: { zakladka: string; zapytanie?: string }) {
  const z: ZakladkaBiblioteki = (ZAKLADKI_BIBLIOTEK as readonly string[]).includes(zakladka)
    ? (zakladka as ZakladkaBiblioteki)
    : 'obrazy';
  const powrot = adresPowrotu(zapytanie);
  if (z === 'obrazy')
    return (
      <StronaBiblioteki
        key={z}
        zakladka={z}
        opis={t('biblioteki.opis.obrazy')}
        powrot={powrot}
        dodaj={{
          accept: 'image/png,image/jpeg',
          testId: 'plik-obrazu-globalny',
          wykonaj: async (pliki) =>
            t('zasobyOkno.obrazyWgrano', { lista: lista(await wgrajObrazyGlobalnie(pliki)) }),
        }}
        podglad={(w) => <PodgladObrazu wpis={w} />}
        pobierz={pobierzPlik}
      />
    );
  if (z === 'czcionki')
    return (
      <StronaBiblioteki
        key={z}
        zakladka={z}
        opis={t('biblioteki.opis.czcionki')}
        powrot={powrot}
        dodaj={{
          accept: '.ttf,.otf,.woff,.woff2',
          testId: 'plik-czcionki-globalny',
          wykonaj: async (pliki) =>
            t('czcionki.wgrano', { lista: lista(await wgrajCzcionkiGlobalnie(pliki)) }),
        }}
        podglad={(w) => <PodgladCzcionki wpis={w} />}
        pobierz={pobierzPlik}
        poZmianie={powiadomZmianeCzcionekGlobalnych}
        dodatki={({ status, blad }) => (
          <div className="katalog-biblioteki">
            <KatalogGoogleFonts onStatus={status} onBlad={blad} />
          </div>
        )}
      />
    );
  return <Ozdobniki key={z} powrot={powrot} />;
}
