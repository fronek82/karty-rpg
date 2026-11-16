import { useSyncExternalStore } from 'react';

/**
 * Routing oparty na `location.hash` (#/talie/…), bo GitHub Pages nie obsługuje
 * przepisywania adresów dla aplikacji jednostronicowych.
 */
function pobierzTrase(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash === '' ? '/' : hash;
}

function subskrybuj(powiadom: () => void): () => void {
  window.addEventListener('hashchange', powiadom);
  return () => window.removeEventListener('hashchange', powiadom);
}

export function useTrasa(): string {
  return useSyncExternalStore(subskrybuj, pobierzTrase, () => '/');
}
