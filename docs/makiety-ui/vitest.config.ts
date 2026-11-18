import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Osobna konfiguracja: uruchamia wyłącznie skrypt renderujący podglądy silnikiem.
export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: {
    include: ['docs/makiety-ui/renderuj-podglady.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
});
