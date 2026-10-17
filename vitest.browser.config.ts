import { defineConfig } from 'vitest/config';

export default defineConfig({
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react-bootstrap'],
  },
  test: {
    include: ['tests/browser/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
