import { useSyncExternalStore } from 'react';

/**
 * Routing oparty na `location.hash` (#/talie/…), bo GitHub Pages nie obsługuje
 * przepisywania adresów dla aplikacji jednostronicowych.
 */
function pobierzTrase(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash === '' ? '/' : hash;
}

/**
 * Straż trasy: wywoływana przy każdej zmianie adresu (także „Wstecz” / „Dalej” przeglądarki)
 * PRZED zmianą widoku. Zwraca `true`, gdy zatrzymała przejście (np. niezapisane zmiany) – wtedy
 * sama przywraca adres, a widok się nie zmienia. Działa najwyżej jedna (ostatnio ustawiona).
 */
export type StrazTrasy = (e: HashChangeEvent) => boolean;

let straz: StrazTrasy | undefined;
const sluchacze = new Set<() => void>();

/** Jeden słuchacz `hashchange` dla wszystkich `useTrasa` – straż pytana raz, przed nimi. */
function naZmianeAdresu(e: HashChangeEvent) {
  if (straz?.(e)) return;
  for (const powiadom of sluchacze) powiadom();
}

/** Ustawia straż trasy; zwraca funkcję, która ją zdejmuje (jeśli wciąż jest ustawiona). */
export function ustawStrazTrasy(f: StrazTrasy): () => void {
  straz = f;
  return () => {
    if (straz === f) straz = undefined;
  };
}

function subskrybuj(powiadom: () => void): () => void {
  if (sluchacze.size === 0) window.addEventListener('hashchange', naZmianeAdresu);
  sluchacze.add(powiadom);
  return () => {
    sluchacze.delete(powiadom);
    if (sluchacze.size === 0) window.removeEventListener('hashchange', naZmianeAdresu);
  };
}

export function useTrasa(): string {
  return useSyncExternalStore(subskrybuj, pobierzTrase, () => '/');
}
