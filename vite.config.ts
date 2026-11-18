/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Ścieżka bazowa jak na GitHub Pages (https://<użytkownik>.github.io/karty-rpg/),
// ta sama w dev, podglądzie i testach – żeby lokalnie działało dokładnie jak po wdrożeniu.
// Wersja (commit) w meta strony i stopce; lokalnie „dev”, w CI – SHA commita.
process.env.VITE_WERSJA ??= 'dev';

export default defineConfig({
  base: '/karty-rpg/',
  plugins: [react()],
  build: {
    rollupOptions: {
      // Dwie strony wejściowe: aplikacja (index.html) i statyczna instrukcja (instrukcja/index.html,
      // bez Reacta i silnika). Pod bazą Pages instrukcja jest pod /karty-rpg/instrukcja/.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        instrukcja: resolve(import.meta.dirname, 'instrukcja/index.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'testy/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/i18n/ustawieniaTestow.ts'],
    // „dot” – tylko podsumowanie i nieudane testy (pełna lista: --reporter=default).
    reporters: ['dot'],
  },
});
