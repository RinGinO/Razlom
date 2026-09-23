/**
 * Точка входа. Запускать только на сервере:
 *   PORT=8787 RAZLOM_DB=/var/lib/razlom/razlom.db pnpm --filter @razlom/server start
 */
import { SqliteStore } from './store.js';
import { createServer } from './server.js';
import { ARCHIVE_AFTER_MS } from './rooms.js';

const port = Number(process.env['PORT'] ?? 8787);
const dbPath = process.env['RAZLOM_DB'] ?? './razlom.db';

const store = new SqliteStore(dbPath);
const server = createServer(port, store);

/** Фоновая уборка: комнаты без движения дольше тридцати суток уходят в архив. */
const SWEEP_EVERY_MS = 60 * 60 * 1000;
const sweep = setInterval(() => {
  const archived = server.rooms.sweep();
  if (archived > 0) console.log(`уборка: в архив ушло комнат — ${archived}`);
}, SWEEP_EVERY_MS);
sweep.unref();

const shutdown = async (signal: string) => {
  console.log(`${signal}: закрываю сервер`);
  clearInterval(sweep);
  await server.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log(
  `Разлом · сервер слушает ws://localhost:${port}\n` +
  `база: ${dbPath} · срок архивации: ${ARCHIVE_AFTER_MS / 86400000} суток`,
);
