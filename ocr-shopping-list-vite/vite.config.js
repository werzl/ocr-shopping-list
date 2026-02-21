import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/ocr-shopping-list/",
  define: {
        '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
  }
})
