import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Legge API_PORT da .env (senza prefisso VITE_: resta solo nella config, mai nel client).
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const apiPort = env.API_PORT || 8787;

  return {
    root: 'client',
    // Percorsi relativi: la build funziona anche dentro una sottocartella del portfolio.
    base: './',
    server: {
      port: 5174, // 5173 è di Glitch Cam
      strictPort: true,
      // Solo su richiesta (npm run dev:lan): raggiungibile dal telefono sulla stessa rete Wi-Fi.
      host: env.LAN === '1',
      proxy: { '/api': `http://127.0.0.1:${apiPort}` },
    },
    build: {
      target: 'es2022',
      // Per ora la build resta qui: il server gira solo in locale, quindi non va
      // pubblicata in ../../laboratory/ finché non c'è un server pubblico.
      outDir: '../dist',
      emptyOutDir: true,
    },
  };
});
