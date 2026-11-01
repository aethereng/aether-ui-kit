import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**'],
    /* Node 26 has web storage of its own, on by default, and its localStorage reads as undefined with no
       storage file given. vitest leaves a global that is already there, so jsdom's store never reaches a
       test. This turns Node's off in the workers; Node 24 takes the flag and has nothing to turn off.
       src/__tests__/storage-environment.test.ts holds the result. */
    execArgv: ['--no-experimental-webstorage'],
  },
})
