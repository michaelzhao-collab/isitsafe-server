import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  // 缓存放到项目根，避免 node_modules/.vite 在 Railway 构建时被锁定导致 EBUSY
  cacheDir: '.vite',
});
