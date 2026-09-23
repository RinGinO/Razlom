/**
 * Интеграция через настоящие сокеты: восемь игроков доигрывают партию,
 * двоим рвут соединение, они возвращаются по ключу.
 *
 * Тест поднимает слушающий порт, поэтому по умолчанию НЕ запускается.
 * На целевом сервере включается переменной:
 *
 *     RAZLOM_SOCKET_TESTS=1 pnpm --filter @razlom/server test
 */
import { WebSocket } from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerMessage } from '@razlom/protocol';
import { createServer } from '../src/server.js';

const enabled = process.env['RAZLOM_SOCKET_TESTS'] === '1';
const PORT = 8899;

class Client {
  socket: WebSocket;
  playerId = '';
  token = '';
  roomCode = '';
  view: Extract<ServerMessage, { t: 'snapshot' }>['view'] | null = null;
  errors: string[] = [];

  constructor(private readonly url: string) {
    this.socket = new WebSocket(url);
  }

  open(): Promise<void> {
    return new Promise((res, rej) => {
      this.socket.once('open', () => res());
      this.socket.once('error', rej);
      this.socket.on('message', (raw) => {
        const msg = JSON.parse(String(raw)) as ServerMessage;
        if (msg.t === 'joined') {
          this.playerId = msg.playerId;
          this.token = msg.token;
          this.roomCode = msg.roomCode;
        }
        if (msg.t === 'snapshot') this.view = msg.view;
        if (msg.t === 'error') this.errors.push(msg.code);
      });
    });
  }

  send(msg: unknown) { this.socket.send(JSON.stringify(msg)); }
  close() { this.socket.close(); }
  async reconnect(roomCode: string) {
    this.socket = new WebSocket(this.url);
    await this.open();
    this.send({ t: 'rejoin', roomCode, token: this.token });
  }
}

const settle = () => new Promise((r) => setTimeout(r, 60));

describe.skipIf(!enabled)('партия через настоящие сокеты', () => {
  let server: ReturnType<typeof createServer>;
  const url = `ws://127.0.0.1:${PORT}`;

  beforeAll(() => { server = createServer(PORT); });
  afterAll(async () => { await server.close(); });

  it('восемь игроков доигрывают партию, двое отваливаются и возвращаются', async () => {
    const clients = Array.from({ length: 8 }, () => new Client(url));
    await Promise.all(clients.map((c) => c.open()));

    clients[0]!.send({ t: 'create', name: 'Аня', roundsPerEpoch: 4 });
    await settle();
    const roomCode = clients[0]!.roomCode;      // код приходит в сообщении joined
    expect(roomCode).toMatch(/^[А-Я2-9]{5}$/);

    for (let i = 1; i < 8; i++) {
      clients[i]!.send({ t: 'join', roomCode, name: `Игрок ${i + 1}` });
    }
    await settle();
    clients[0]!.send({ t: 'start' });
    await settle();
    expect(clients[0]!.view).not.toBeNull();

    // рвём соединение двоим
    clients[3]!.close();
    clients[5]!.close();
    await settle();
    await clients[3]!.reconnect(roomCode);
    await clients[5]!.reconnect(roomCode);
    await settle();

    let guard = 0;
    while (clients[0]!.view && clients[0]!.view.phase !== 'finished' && guard++ < 200) {
      for (const c of clients) {
        const node = c.view?.nodes.find((n) => n.active)?.id;
        if (node) c.send({ t: 'submit_weaving', action: { stacks: { [node]: 2 }, corruptionTaken: 0 } });
      }
      await settle();
    }

    expect(clients[0]!.view?.phase).toBe('finished');
    for (const c of clients) expect(c.errors).toEqual([]);
    clients.forEach((c) => c.close());
  }, 60_000);
});
