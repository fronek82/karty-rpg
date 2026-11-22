import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { useJezyk } from '../i18n/react';
import {
  czyZmienioneKolory,
  KOLOR_TEKSTU_PRZYCISKU,
  odczytajKoloryMotywu,
  PALETA_PRZYCISKOW,
  przywrocDomyslneKolory,
  subskrybujKoloryPrzyciskow,
  ustawKolorPrzycisku,
  ustawTekstPrzycisku,
  type RolaKoloru,
} from '../wspolne/koloryPrzyciskow';
import { useMotyw } from './motyw';
import { OknoModalne } from './OknoModalne';

const ROLE: readonly {
  klucz: RolaKoloru;
  etykieta:
    'koloryOkno.wlasne' | 'koloryOkno.mausritter' | 'koloryOkno.awers' | 'koloryOkno.rewers';
}[] = [
  { klucz: 'wlasne', etykieta: 'koloryOkno.wlasne' },
  { klucz: 'gra', etykieta: 'koloryOkno.mausritter' },
  { klucz: 'awers', etykieta: 'koloryOkno.awers' },
  { klucz: 'rewers', etykieta: 'koloryOkno.rewers' },
];

/** Okno wyboru kolorów przycisków (Własne karty, Mausritter, Awers, Rewers) w menu Ustawienia. */
export function OknoKolorow({ zamknij }: { zamknij: () => void }) {
  const { motyw, ustaw: ustawMotyw } = useMotyw();
  const jezyk = useJezyk();
  const [, odswiez] = useState(0);

  useEffect(() => subskrybujKoloryPrzyciskow(() => odswiez((n) => n + 1)), []);

  const kolory = odczytajKoloryMotywu(motyw);
  const kolorTekstu = KOLOR_TEKSTU_PRZYCISKU[kolory.tekst];
  const zmienione = czyZmienioneKolory(motyw);

  return (
    <OknoModalne tytul={t('koloryOkno.tytul')} zamknij={zamknij}>
      <p className="podpis">{t('koloryOkno.opis')}</p>

      <div className="okno-kolorow-pasek">
        <div className="okno-kolorow-grupa">
          <span className="menu-ustawien-etykieta">{t('motyw.grupa')}</span>
          <div className="menu-ustawien-seg" role="group" aria-label={t('motyw.grupa')}>
            <button
              type="button"
              aria-pressed={motyw === 'light'}
              onClick={() => ustawMotyw('light')}
            >
              {t('motyw.jasnyKrotki')}
            </button>
            <button
              type="button"
              aria-pressed={motyw === 'dark'}
              onClick={() => ustawMotyw('dark')}
            >
              {t('motyw.ciemnyKrotki')}
            </button>
          </div>
        </div>

        <div className="okno-kolorow-grupa">
          <span className="menu-ustawien-etykieta">{t('koloryOkno.tekst')}</span>
          <div className="menu-ustawien-seg" role="group" aria-label={t('koloryOkno.tekst')}>
            <button
              type="button"
              aria-pressed={kolory.tekst === 'dark'}
              onClick={() => ustawTekstPrzycisku(motyw, 'dark')}
            >
              {t('koloryOkno.tekstCiemny')}
            </button>
            <button
              type="button"
              aria-pressed={kolory.tekst === 'light'}
              onClick={() => ustawTekstPrzycisku(motyw, 'light')}
            >
              {t('koloryOkno.tekstBialy')}
            </button>
          </div>
        </div>
      </div>

      <div className="okno-kolorow-lista">
        {ROLE.map((rola) => {
          const wybrany = kolory[rola.klucz];
          const nazwaRoli = t(rola.etykieta);
          return (
            <section key={rola.klucz} className="okno-kolorow-wiersz">
              <div className="okno-kolorow-naglowek">
                <span
                  className="okno-kolorow-podglad"
                  style={{ background: wybrany, color: kolorTekstu }}
                >
                  {nazwaRoli}
                </span>
                <span className="okno-kolorow-kod">{wybrany}</span>
              </div>
              <div className="okno-kolorow-probki" role="group" aria-label={nazwaRoli}>
                {PALETA_PRZYCISKOW.map((p) => {
                  const nazwaKoloru = jezyk === 'pl' ? p.nazwaPl : p.nazwaEn;
                  const aktywny = wybrany === p.hex;
                  return (
                    <button
                      key={p.hex}
                      type="button"
                      className={`okno-kolorow-probka${aktywny ? ' aktywna' : ''}`}
                      style={{ background: p.hex }}
                      aria-label={`${nazwaRoli}: ${nazwaKoloru} (${p.hex})`}
                      aria-pressed={aktywny}
                      title={`${nazwaKoloru} (${p.hex})`}
                      onClick={() => ustawKolorPrzycisku(motyw, rola.klucz, p.hex)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="okno-kolorow-stopka">
        <button
          type="button"
          className="przycisk"
          disabled={!zmienione}
          onClick={() => przywrocDomyslneKolory(motyw)}
        >
          {t('koloryOkno.przywroc')}
        </button>
      </div>
    </OknoModalne>
  );
}
