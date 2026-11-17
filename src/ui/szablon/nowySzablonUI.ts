import { nowySzablon, type NazwyStartowe } from '../../dane/szablon';
import { t } from '../../i18n';
import type { Szablon } from '../../model/szablon';
import type { UstawieniaNowegoSzablonu } from './Kreator';

/** Nazwy elementów neutralnych układów startowych (z i18n). */
export const nazwyStartowe = (): NazwyStartowe => ({
  karta: t('wezel.karta'),
  tytul: t('start.uklad.tytul'),
  opis: t('start.uklad.opis'),
  siatka: t('start.uklad.siatka'),
  wiersz: t('wezel.wiersz'),
  pole: (n) => t('start.uklad.pole', { n }),
  stopka: t('start.uklad.stopka'),
  stopkaLewa: t('start.uklad.stopkaLewa'),
  stopkaPrawa: t('start.uklad.stopkaPrawa'),
});

/** Szablon z ustawień kreatora (id unikalne nadaje dodawanie szablonu do projektu). */
export function szablonZKreatora(u: UstawieniaNowegoSzablonu): Szablon {
  return nowySzablon('szablon', u, nazwyStartowe());
}
