import { t } from '../i18n';
import type { Przyklad } from './typy';

/** Pusta karta 63×88 mm bez pól: biała, zaokrąglone rogi, pusty kontener w kolumnie. */
export function przyklad(): Przyklad {
  return {
    szablon: {
      id: 'pusta',
      nazwa: t('przyklad.pusta.nazwa'),
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      promienRogow: 3,
      tlo: '#ffffff',
      korzen: {
        id: 'karta',
        nazwa: t('wezel.karta'),
        typ: 'kolumna',
        padding: 3,
        odstep: 1.5,
        dzieci: [],
      },
    },
    dane: {},
  };
}
