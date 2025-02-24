import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    coverage: { provider: 'v8' },
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
