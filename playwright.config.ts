import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: './testy',
  // Pliki *.test.ts w testy/ to testy jednostkowe (Vitest).
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Lokalnie „line” – tylko postęp w jednej linii, nieudane testy i podsumowanie.
  reporter: process.env.CI ? 'github' : 'line',
  use: {
    baseURL: `http://localhost:${port}/karty-rpg/`,
    trace: 'off',
    // Domyślny język przeglądarki w testach – polski (interfejs wybiera język z navigator.language).
    locale: 'pl-PL',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}/karty-rpg/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
