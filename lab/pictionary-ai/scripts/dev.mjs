// Avvia insieme server API e client Vite; Ctrl+C chiude entrambi.
import { spawn } from 'node:child_process';

const procs = [
  ['server', 'npm', ['run', 'dev:server']],
  ['client', 'npm', ['run', 'dev:client']],
].map(([name, cmd, args]) => {
  const p = spawn(cmd, args, { stdio: 'inherit' });
  p.on('exit', (code) => {
    console.log(`[${name}] terminato (${code ?? 'segnale'})`);
    shutdown(code ?? 0);
  });
  return p;
});

let closing = false;
function shutdown(code) {
  if (closing) return;
  closing = true;
  for (const p of procs) if (p.exitCode === null) p.kill('SIGTERM');
  process.exitCode = code;
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
