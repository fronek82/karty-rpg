import { useSyncExternalStore } from 'react';
import { jezyk, subskrybujJezyk, type Jezyk } from './index';

/** Aktualny język; komponent odświeża się przy jego zmianie (bez przeładowania strony). */
export function useJezyk(): Jezyk {
  return useSyncExternalStore(subskrybujJezyk, jezyk, () => 'pl' as Jezyk);
}
