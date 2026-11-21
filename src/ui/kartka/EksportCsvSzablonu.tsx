import { useId, useState } from 'react';
import { szablonCsv } from '../../dane/importTabeli';
import { t } from '../../i18n';
import { useJezyk } from '../../i18n/react';
import type { Szablon } from '../../model/szablon';
import { nazwaPliku, zapiszPlik } from '../pliki';

/**
 * Sekcja u dołu prawego panelu Edytora kart: eksport pustego pliku CSV
 * z nagłówkami pól szablonu gotowego do uzupełnienia i ponownego zaimportowania.
 */
export function EksportCsvSzablonu({
  szablony,
  domyslnySzablonId,
}: {
  szablony: readonly Szablon[];
  domyslnySzablonId?: string;
}) {
  const jezyk = useJezyk();
  const idSelectu = useId();
  const [wybranyId, ustawWybranyId] = useState(domyslnySzablonId ?? szablony[0]?.id ?? '');

  if (szablony.length === 0) return null;

  const aktywnyId =
    (domyslnySzablonId && szablony.some((s) => s.id === domyslnySzablonId)
      ? domyslnySzablonId
      : szablony.some((s) => s.id === wybranyId)
        ? wybranyId
        : szablony[0]!.id) ?? '';
  const wybrany = szablony.find((s) => s.id === aktywnyId) ?? szablony[0]!;

  const pobierz = () => {
    const csv = szablonCsv(wybrany, {
      separator: jezyk === 'pl' ? ';' : ',',
      etykietaIlosci: t('tabelaImport.ilosc'),
    });
    zapiszPlik(
      new TextEncoder().encode(csv),
      'text/csv;charset=utf-8',
      nazwaPliku(`${wybrany.nazwa}-szablon`, '.csv'),
    );
  };

  return (
    <div className="sekcja-eksportu-csv">
      {szablony.length > 1 && !domyslnySzablonId && (
        <div className="pole-panelu">
          <label htmlFor={idSelectu}>{t('csvSzablon.szablon')}</label>
          <select
            id={idSelectu}
            value={wybrany.id}
            onChange={(e) => ustawWybranyId(e.target.value)}
          >
            {szablony.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nazwa}
              </option>
            ))}
          </select>
        </div>
      )}
      <button type="button" onClick={pobierz}>
        {t('csvSzablon.przycisk')}
      </button>
      <p className="podpis">{t('csvSzablon.opis')}</p>
    </div>
  );
}
