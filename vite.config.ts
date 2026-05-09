import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bmc-edit/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
