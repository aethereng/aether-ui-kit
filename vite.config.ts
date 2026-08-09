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
  // GitHub Pages serves a project (non-custom-domain) repo at
  // https://<org>.github.io/<repo>/, so every asset URL needs that prefix — without it
  // the deployed page 404s on its own JS/CSS. Only apply it in CI: `npm run dev` and a
  // local `vite build` both still want root-relative paths.
  base: process.env.GITHUB_ACTIONS ? '/aether-ui-kit/' : '/',
})
