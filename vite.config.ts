import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Gallery build: produces a static demo site in dist/. CI runs `npm run build`
// and publishes the artifact. Component code lives under src/ (type-checked by
// vue-tsc --build); the gallery app lives under src/gallery/.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
