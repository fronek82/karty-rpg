/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Ścieżka bazowa jak na GitHub Pages (https://<użytkownik>.github.io/karty-rpg/),
// ta sama w dev, podglądzie i testach – żeby lokalnie działało dokładnie jak po wdrożeniu.
// Wersja (commit) w meta strony i stopce; lokalnie „dev”, w CI – SHA commita.
process.env.VITE_WERSJA ??= 'dev';

export default defineConfig({
  base: '/karty-rpg/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'testy/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/i18n/ustawieniaTestow.ts'],
    // „dot” – tylko podsumowanie i nieudane testy (pełna lista: --reporter=default).
    reporters: ['dot'],
  },
});
