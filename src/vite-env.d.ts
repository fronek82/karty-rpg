/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Wersja aplikacji wyświetlana w stopce (ustawiana w CI). */
  readonly VITE_WERSJA?: string;
}
