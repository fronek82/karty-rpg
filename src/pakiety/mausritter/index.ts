import type { Pakiet } from '../typy';
import zastepczy from './obrazy/zastepczy.png';
import { arkuszeMausrittera } from './arkusze';
import { szablonyMausrittera } from './szablony';
import { OBRAZ_ZASTEPCZY, talieMausrittera } from './talie';

export const pakietMausritter: Pakiet = {
  id: 'mausritter',
  nazwa: 'Mausritter – karty ekwipunku i stanów',
  opis: 'Szablony kart w siatce slotów (broń, zbroja, przedmiot, sakiewka, zaklęcie, stan, pusta karta) i trzy talie do druku na A4.',
  atrybucja:
    'Układ kart według gry Mausritter (Isaac Williams, Losing Games). Pakiet nie zawiera grafik ani tekstów z materiałów do gry.',
  czcionki: [
    {
      rola: 'tytul',
      rodzina: 'Grenze Gotisch',
      warianty: { normalny: 'GrenzeGotisch-Regular.ttf', pogrubiony: 'GrenzeGotisch-Bold.ttf' },
    },
    {
      rola: 'tresc',
      rodzina: 'EB Garamond',
      warianty: {
        normalny: 'EBGaramond-Regular.ttf',
        pogrubiony: 'EBGaramond-Bold.ttf',
        kursywa: 'EBGaramond-Italic.ttf',
        'pogrubiona-kursywa': 'EBGaramond-BoldItalic.ttf',
      },
    },
  ],
  szablony: szablonyMausrittera,
  talie: talieMausrittera,
  arkusze: arkuszeMausrittera,
  zasoby: [{ id: OBRAZ_ZASTEPCZY, plik: zastepczy, szerokosc: 512, wysokosc: 512, format: 'png' }],
};
