/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import process from 'process'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

// https://vite.dev/config/
export default defineConfig({
  // Only PUBLIC_ variables can enter browser code. Keep secrets in private variables.
  envPrefix: 'PUBLIC_',
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        // svgr options
      },
    }),
  ],
  base: "/ocr-shopping-list/",
  define: {
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    include: ['tests/**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
    exclude: ['tests/browser/**'],
    css: false,
  },
})
