import { defineConfig } from 'vite';

export default defineConfig({
  // Percorsi relativi: la build funziona anche dentro una sottocartella del portfolio
  // (es. www.alessandraannoni.it/lab/glitch-cam/).
  base: './',
  server: { port: 5173 },
  build: {
    target: 'es2022',
    // La build finisce direttamente nel sito del portfolio, nella sezione Laboratory
    // (servita da GitHub Pages su /laboratory/glitch-cam/).
    outDir: '../../laboratory/glitch-cam',
    emptyOutDir: true,
  },
});
