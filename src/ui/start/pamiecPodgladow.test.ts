import { beforeEach, describe, expect, it } from 'vitest';
import type { KrokPodgladu } from './podglady';
import {
  uruchomLiczenie,
  wyczyscPamiecPodgladow,
  wynikZPamieci,
  type PrzygotujKroki,
} from './pamiecPodgladow';

beforeEach(wyczyscPamiecPodgladow);

const kroki =
  (znak: string): PrzygotujKroki =>
  async () => [
    {
      id: 'a',
      licz: () => ({
        id: 'a',
        strony: [{ svg: znak, szerokosc: 1, wysokosc: 1 }],
        ostrzezenia: [],
      }),
    } satisfies KrokPodgladu,
  ];

const svg = (zrodlo: string) => {
  const w = wynikZPamieci(zrodlo, 'pl', 'a');
  return w && 'podglad' in w ? w.podglad.strony[0]!.svg : undefined;
};

describe('pamięć podglądów', () => {
  it('źródła o różnych id nie kolidują (pakiet o id „przyklady” obok własnych kart)', async () => {
    await Promise.all([
      uruchomLiczenie('przyklady', 'pl', kroki('wlasne')),
      uruchomLiczenie('mausritter', 'pl', kroki('pakiet')),
      uruchomLiczenie('przyklady-2', 'pl', kroki('inny')),
    ]);
    expect(svg('przyklady')).toBe('wlasne');
    expect(svg('mausritter')).toBe('pakiet');
    expect(svg('przyklady-2')).toBe('inny');
  });

  it('ten sam klucz liczy się raz; przerwane przygotowanie (undefined) nie zostawia wyniku', async () => {
    let wywolania = 0;
    const licznik: PrzygotujKroki = async () => {
      wywolania++;
      return kroki('x')();
    };
    await Promise.all([uruchomLiczenie('z', 'pl', licznik), uruchomLiczenie('z', 'pl', licznik)]);
    expect(wywolania).toBe(1);
    await uruchomLiczenie('p', 'pl', async () => undefined);
    expect(svg('p')).toBeUndefined();
    // Po przerwaniu następna próba liczy od nowa.
    await uruchomLiczenie('p', 'pl', kroki('po'));
    expect(svg('p')).toBe('po');
  });
});
