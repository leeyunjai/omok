import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const REPO_NAME = 'omok';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? `/${REPO_NAME}/` : '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500,
  },
}));
