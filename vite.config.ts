/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Ścieżka bazowa jak na GitHub Pages (https://<użytkownik>.github.io/karty-rpg/),
// ta sama w dev, podglądzie i testach – żeby lokalnie działało dokładnie jak po wdrożeniu.
export default defineConfig({
  base: '/karty-rpg/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
