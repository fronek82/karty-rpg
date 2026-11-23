import { useEffect, useState } from 'react';
import { ROZSZERZENIE_OZDOBNIKA } from '../../dane/archiwum';
import type { WpisBibliotekiGlobalnej } from '../../dane/baza';
import { t } from '../../i18n';
import type { ElementOzdobny } from '../../ozdobniki';
import { baza, zapiszOzdobnikWBibliotece } from '../bazaUI';
import { KOLOR_PODGLADU } from '../biblioteka/podgladElementu';
import { KatalogGoogleFonts } from '../kartka/KatalogGoogleFonts';
import { nazwaPliku, zapiszPlik } from '../pliki';
import { MiniaturaOzdobnika } from '../szablon/MiniaturaOzdobnika';
import {
  metaWpisuCzcionki,
  powiadomZmianeCzcionekGlobalnych,
  wgrajCzcionkiGlobalnie,
  wgrajObrazyGlobalnie,
} from '../zasobyGlobalne';
import { paczkaOzdobnikaZPliku } from './plikiOzdobnikow';
import { StronaBiblioteki, ZAKLADKI_BIBLIOTEK, type ZakladkaBiblioteki } from './StronaBiblioteki';

/** Bajty wpisu biblioteki (do podglądu); `null` – nie udało się odczytać. */
function useBajtyWpisu(id: string): Uint8Array | null | undefined {
  const [bajty, ustawBajty] = useState<Uint8Array | null>();
  useEffect(() => {
    let aktywny = true;
    baza()
      .odczytajZBiblioteki(id)
      .then(
        (b) => aktywny && ustawBajty(b),
        () => aktywny && ustawBajty(null),
      );
    return () => {
      aktywny = false;
    };
  }, [id]);
  return bajty;
}

/** Adres `blob:` z bajtów (tworzony w wywołaniu zwrotnym efektu, zwalniany przy sprzątaniu). */
const adresBlob = (bajty: Uint8Array) =>
  URL.createObjectURL(new Blob([bajty as Uint8Array<ArrayBuffer>]));

const Blad = () => (
  <span className="podpis" role="img" aria-label={t('biblioteki.brakPodgladu')}>
    ?
  </span>
);

function PodgladObrazu({ wpis }: { wpis: WpisBibliotekiGlobalnej }) {
  const [adres, ustawAdres] = useState<string | null>();
  useEffect(() => {
    let aktywny = true;
    let utworzony: string | undefined;
    baza()
      .odczytajZBiblioteki(wpis.id)
      .then(
        (b) => {
          if (!aktywny) return;
          utworzony = adresBlob(b);
          ustawAdres(utworzony);
        },
        () => aktywny && ustawAdres(null),
      );
    return () => {
      aktywny = false;
      if (utworzony) URL.revokeObjectURL(utworzony);
    };
  }, [wpis.id]);
  if (adres === null) return <Blad />;
  return adres ? <img src={adres} alt="" /> : null;
}

/** Próbka tekstu krojem z biblioteki (FontFace o nazwie unikalnej dla wpisu). */
function PodgladCzcionki({ wpis }: { wpis: WpisBibliotekiGlobalnej }) {
  const bajty = useBajtyWpisu(wpis.id);
  const [rodzina, ustawRodzine] = useState<string>();
  const [opis, ustawOpis] = useState('');
  const [blad, ustawBlad] = useState(false);
  useEffect(() => {
    let aktywny = true;
    void metaWpisuCzcionki(wpis).then((m) => {
      if (aktywny && m) ustawOpis(`${m.rodzina} · ${t(`wariant.${m.wariant}`)}`);
    });
    return () => {
      aktywny = false;
    };
  }, [wpis]);
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

function PodgladOzdobnika({ wpis }: { wpis: WpisBibliotekiGlobalnej }) {
  const bajty = useBajtyWpisu(wpis.id);
  const [paczka, ustawPaczke] = useState<{ element: ElementOzdobny; adres?: string } | null>();
  useEffect(() => {
    if (!bajty) return;
    let aktywny = true;
    let utworzony: string | undefined;
    import('../../dane/archiwum')
      .then(({ importujOzdobnik }) => {
        if (!aktywny) return;
        const { element, zasoby, dane } = importujOzdobnik(bajty);
        const obraz = zasoby[0] && dane.get(zasoby[0].id);
        if (obraz) utworzony = adresBlob(obraz);
        ustawPaczke({ element, ...(utworzony ? { adres: utworzony } : {}) });
      })
      .catch(() => aktywny && ustawPaczke(null));
    return () => {
      aktywny = false;
      if (utworzony) URL.revokeObjectURL(utworzony);
    };
  }, [bajty]);
  if (bajty === null || paczka === null) return <Blad />;
  if (!paczka) return null;
  return (
    <span className="podglad-ozdobnika" style={{ color: KOLOR_PODGLADU }}>
      <MiniaturaOzdobnika
        element={paczka.element}
        {...(paczka.adres ? { adres: paczka.adres } : {})}
      />
    </span>
  );
}

const lista = (nazwy: readonly string[]) => nazwy.join(', ');

/**
 * Ekran „Biblioteki” (`#/biblioteki/<zakladka>`, N7): obrazy, czcionki i ozdobniki zapisane
 * w tej przeglądarce – wspólne dla wszystkich projektów. Jeden komponent strony dla trzech zakładek.
 */
export function Biblioteki({ zakladka }: { zakladka: string }) {
  const z: ZakladkaBiblioteki = (ZAKLADKI_BIBLIOTEK as readonly string[]).includes(zakladka)
    ? (zakladka as ZakladkaBiblioteki)
    : 'obrazy';
  if (z === 'obrazy')
    return (
      <StronaBiblioteki
        key={z}
        zakladka={z}
        opis={t('biblioteki.opis.obrazy')}
        dodaj={{
          accept: 'image/png,image/jpeg',
          testId: 'plik-obrazu-globalny',
          wykonaj: async (pliki) =>
            t('zasobyOkno.obrazyWgrano', { lista: lista(await wgrajObrazyGlobalnie(pliki)) }),
        }}
        podglad={(w) => <PodgladObrazu wpis={w} />}
      />
    );
  if (z === 'czcionki')
    return (
      <StronaBiblioteki
        key={z}
        zakladka={z}
        opis={t('biblioteki.opis.czcionki')}
        dodaj={{
          accept: '.ttf,.otf,.woff,.woff2',
          testId: 'plik-czcionki-globalny',
          wykonaj: async (pliki) =>
            t('czcionki.wgrano', { lista: lista(await wgrajCzcionkiGlobalnie(pliki)) }),
        }}
        podglad={(w) => <PodgladCzcionki wpis={w} />}
        poUsunieciu={powiadomZmianeCzcionekGlobalnych}
        dodatki={({ status, blad }) => (
          <div className="katalog-biblioteki">
            <KatalogGoogleFonts onStatus={status} onBlad={blad} />
          </div>
        )}
      />
    );
  return (
    <StronaBiblioteki
      key={z}
      zakladka={z}
      opis={t('biblioteki.opis.ozdobniki')}
      dodaj={{
        accept: `.svg,image/svg+xml,.png,image/png,${ROZSZERZENIE_OZDOBNIKA},.zip`,
        testId: 'plik-ozdobnika-globalny',
        wykonaj: async (pliki) => {
          const nazwy: string[] = [];
          for (const f of pliki)
            nazwy.push(await zapiszOzdobnikWBibliotece(await paczkaOzdobnikaZPliku(f)));
          return t('biblioteki.dodano', { lista: lista(nazwy) });
        },
      }}
      podglad={(w) => <PodgladOzdobnika wpis={w} />}
      akcje={(w) => [
        {
          tekst: t('szablony.eksportuj'),
          etykieta: t('globalna.eksportujEtykieta', { nazwa: w.nazwa }),
          wykonaj: async () => {
            zapiszPlik(
              await baza().odczytajZBiblioteki(w.id),
              'application/zip',
              nazwaPliku(w.nazwa, ROZSZERZENIE_OZDOBNIKA),
            );
            return '';
          },
        },
      ]}
    />
  );
}
