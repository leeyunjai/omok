import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  // GitHub Pages 배포 시 저장소 이름과 무관하게 동작하도록 상대 경로 사용
  base: mode === 'production' ? './' : '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500,
  },
}));
