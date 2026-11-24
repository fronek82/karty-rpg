import { t, tJesliJest, type KluczTekstu } from '../i18n';
import type { OstrzezenieArkusza } from '../druk/arkusz';
import type { Ostrzezenie } from '../silnik/karta';

/**
 * Teksty ostrzeżeń silnika i arkusza. Silnik zwraca kody (`kod:szczegół:…`), żeby nie zależeć
 * od języka; tu zamieniamy je na zdania. Nieznany kod pokazujemy surowo – lepiej niż nic.
 */
export const KODY: Record<string, KluczTekstu> = {
  'tekst-nie-miesci-sie': 'ostrzezenie.tekstNieMiesciSie',
  'brak-obrazu': 'ostrzezenie.brakObrazu',
  'brak-znakow': 'ostrzezenie.brakZnakow',
  'brak-miejsca-na-obraz': 'ostrzezenie.brakMiejscaNaObraz',
  'nieznane-pole-do-omijania': 'ostrzezenie.nieznanePoleDoOmijania',
  'nieznany-element-ozdobny': 'ostrzezenie.nieznanyElementOzdobny',
  'niska-rozdzielczosc-ramki': 'ostrzezenie.niskaRozdzielczoscRamki',
  'niska-rozdzielczosc-obrazu': 'ostrzezenie.niskaRozdzielczoscObrazu',
  'nieznana-odmiana': 'ostrzezenie.nieznanaOdmiana',
  'brak-szablonu': 'ostrzezenie.brakSzablonu',
  'karta-inny-rozmiar': 'ostrzezenie.kartaInnyRozmiar',
  'brak-slotow-na-stronie': 'ostrzezenie.brakSlotow',
  'papier-za-maly-na-spad': 'ostrzezenie.papierZaMalyNaSpad',
  'karta-w-strefie-przyciecia': 'ostrzezenie.kartaWStrefiePrzyciecia',
  'uklad-poza-papierem': 'ostrzezenie.ukladPozaPapierem',
  'tytul-nie-miesci-sie': 'ostrzezenie.tytulNieMiesciSie',
  'naglowek-grupy-nie-miesci-sie': 'ostrzezenie.naglowekGrupy',
  'nozyczki-poza-siatka': 'ostrzezenie.nozyczki',
  'siatka-za-mala': 'ostrzezenie.siatkaZaMala',
  'karta-wieksza-niz-strona': 'ostrzezenie.kartaZaDuza',
  'przypiecia-ignorowane-przy-grupach': 'ostrzezenie.przypieciaPrzyGrupach',
  'przypiecie-bez-karty': 'ostrzezenie.przypiecieBezKarty',
  'przypiecie-zla-strona': 'ostrzezenie.przypiecieZlaStrona',
  'przypiecie-koliduje': 'ostrzezenie.przypiecieKoliduje',
  'przypiecie-poza-siatka': 'ostrzezenie.przypieciePozaSiatka',
  'karta-w-wielu-grupach': 'ostrzezenie.kartaWWieluGrupach',
};

function zKodu(kod: string, szczegoly: string[]): string {
  const klucz = KODY[kod];
  return klucz
    ? t(klucz, { a: szczegoly[0] ?? '', b: szczegoly.slice(1).join(':') })
    : [kod, ...szczegoly].join(':');
}

/** Ostrzeżenie renderowania karty (pole, kod, szczegóły). */
export function tekstOstrzezenia(o: Ostrzezenie): string {
  return t('ostrzezenie.wPolu', {
    pole: o.pole,
    tekst: zKodu(o.komunikat, o.szczegoly ? [o.szczegoly] : []),
  });
}

/** Ostrzeżenie arkusza: `kod:a:b` (ostrzeżenia kart: `kod:pole:szczegół`). */
export function tekstOstrzezeniaArkusza(o: OstrzezenieArkusza, nazwaKarty?: string): string {
  const [kod = '', ...reszta] = o.komunikat.split(':');
  const czyKarty = [
    'tekst-nie-miesci-sie',
    'brak-obrazu',
    'brak-znakow',
    'brak-miejsca-na-obraz',
    'nieznane-pole-do-omijania',
    'nieznany-element-ozdobny',
    'niska-rozdzielczosc-ramki',
    'niska-rozdzielczosc-obrazu',
    'nieznana-odmiana',
  ].includes(kod);
  const tekst = czyKarty
    ? t('ostrzezenie.wPolu', { pole: reszta[0] ?? '', tekst: zKodu(kod, reszta.slice(1)) })
    : zKodu(kod, reszta);
  return o.kartaId ? t('ostrzezenie.karta', { karta: nazwaKarty || o.kartaId, tekst }) : tekst;
}

/** Komunikaty o brakujących wariantach czcionek (np. pogrubienie) w bieżącym języku. */
export function komunikatyBrakujacychWariantow(
  lista: readonly {
    nazwa: string;
    wariant: 'normalny' | 'pogrubiony' | 'kursywa' | 'pogrubiona-kursywa';
  }[],
): string[] {
  return lista.map((b) =>
    t('czcionki.brakWariantu', {
      nazwa: tJesliJest(`rola.${b.nazwa}`) ?? b.nazwa,
      wariant: t(`wariant.${b.wariant}`),
    }),
  );
}
