import { defineConfig } from 'vite'
import process from 'process'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr' 

// https://vite.dev/config/
export default defineConfig({
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
  server: {
    allowedHosts: [
      '569e-2a00-23c6-7111-2101-588-bcd1-2e7f-319b.ngrok-free.app' // TODO: REMOVE
    ]
  }
})
