import { t } from '../../i18n';
import { NaglowekProjektu, type DefinicjaKroku } from './NaglowekProjektu';
import { PanelSekcji, SekcjaPanelu } from './PanelSekcji';
import { PasekBoczny, type GrupaPaskaBocznego } from './PasekBoczny';

const KROKI: readonly DefinicjaKroku[] = [
  { id: 'szablony', numer: 1, etykieta: 'Szablony', href: '#/ui2-podglad' },
  { id: 'karty', numer: 2, etykieta: 'Karty', href: '#/ui2-podglad' },
  { id: 'druk', numer: 3, etykieta: 'Druk', href: '#/ui2-podglad' },
];

const GRUPY: readonly GrupaPaskaBocznego[] = [
  {
    id: 'uklad',
    nazwa: 'Układ',
    pozycje: [
      {
        id: 'swobodny',
        nazwa: 'Swobodny',
        podpowiedz: 'dowolne położenie myszką',
        ikona: 'M4 4h7v7H4z M13 13h7v7h-7z M15 4h5v5 M4 15v5h5',
        odznaka: 'DOMYŚLNY',
        przeciagane: true,
      },
      {
        id: 'wiersz',
        nazwa: 'Wiersz',
        podpowiedz: 'elementy obok siebie',
        ikona: 'M3 8h18v8H3z M9 8v8 M15 8v8',
        przeciagane: true,
      },
    ],
  },
  {
    id: 'tresc',
    nazwa: 'Treść',
    pozycje: [
      {
        id: 'tekst',
        nazwa: 'Tekst',
        podpowiedz: 'nazwa, opis',
        ikona: 'M5 6V4h14v2 M12 4v16 M9 20h6',
        przeciagane: true,
      },
    ],
  },
];

/**
 * Ekran podglądu i weryfikacji wspólnych komponentów UI2 (etap R1):
 * NaglowekProjektu, PasekBoczny, PanelSekcji oraz wyrównanie linii poziomych (sekcja 3.3).
 */
export function PodgladUi2() {
  return (
    <div className="ui2-ekran" data-testid="ui2-podglad">
      <NaglowekProjektu
        nazwaProjektu="Podgląd UI2"
        aktywnyKrok="szablony"
        kroki={KROKI}
        mozeCofnac
        mozePonowic={false}
        stanZapisu="zapisano"
        akcjaGlowna={{ etykieta: t('ui2.akcja.doKart'), href: '#/ui2-podglad' }}
      />
      <div className="ui2-tresc">
        <PasekBoczny
          ekranId="podglad-r1"
          tytul="Dodaj element"
          grupy={GRUPY}
          wskazowka="Przeciągnij element na kartę albo kliknij, żeby dodać."
        />
        <main className="ui2-srodek">
          <div className="ui2-pasek-roboczy" data-testid="ui2-pasek-roboczy">
            <span>Podgląd obszaru roboczego</span>
          </div>
          <div className="ui2-obszar-roboczy">
            <span>63 × 88 mm</span>
          </div>
          <div className="ui2-pasek-stanu" data-testid="ui2-pasek-stanu">
            <span>63 × 88 mm · układ swobodny</span>
            <span>100%</span>
          </div>
        </main>
        <PanelSekcji tytul="Właściwości" podtytul="Tekst">
          <SekcjaPanelu tytul="Położenie i rozmiar" domyslnieOtwarta>
            <p style={{ margin: 0 }}>X: 10 mm · Y: 12 mm</p>
          </SekcjaPanelu>
          <SekcjaPanelu tytul="Zaawansowane" domyslnieOtwarta={false}>
            <p style={{ margin: 0 }}>Sekcja domyślnie zwinięta</p>
          </SekcjaPanelu>
        </PanelSekcji>
      </div>
    </div>
  );
}
