import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  test: {
    // Include edge-function tests so `pnpm test` covers both the Vue app
    // (if tests are added later under src/**) and the Supabase functions.
    include: [
      'src/**/*.{test,spec}.ts',
      'supabase/functions/**/*.{test,spec}.ts',
    ],
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
