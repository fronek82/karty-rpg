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

/** Szablon z ustawień kreatora (id unikalne w projekcie). */
export function szablonZKreatora(u: UstawieniaNowegoSzablonu, zajete: readonly string[]): Szablon {
  let id = 'szablon';
  for (let n = 2; zajete.includes(id); n++) id = `szablon-${n}`;
  return nowySzablon(id, u, nazwyStartowe());
}
