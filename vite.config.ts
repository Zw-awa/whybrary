// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

const explicitBase = process.env.WHYBRARY_WEB_BASE;
const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  base: explicitBase ?? (isTauriBuild ? './' : '/'),
  plugins: [react()],
  clearScreen: false,
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',
  },
  preview: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',
  },
});
