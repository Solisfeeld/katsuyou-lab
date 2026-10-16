import { defineConfig } from 'vite';

/* Ao contrário do Bunpou Lab, aqui o app é modular de verdade: o Vite
   empacota src/main.js e todo o grafo de módulos (dados, motor de
   conjugação, prática, progresso e UI). */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020'
  },
  server: {
    port: 5174,      // 5173 fica livre para o Bunpou Lab rodar em paralelo
    open: false
  }
});
