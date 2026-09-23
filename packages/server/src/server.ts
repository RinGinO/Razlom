/**
 * Транспорт: WebSocket поверх комнат. Здесь нет ни одного игрового правила —
 * сервер только разбирает сообщение, находит комнату и зовёт метод.
 */
import { WebSocketServer, type WebSocket } from 'ws';
import { RuleError } from '@razlom/core';
import { parseClientMessage, type ServerMessage } from '@razlom/protocol';
import { Rooms } from './rooms.js';
import { SqliteStore, type Store } from './store.js';
import type { Room } from './room.js';

interface Client {
  socket: WebSocket;
  room?: Room;
  playerId?: string;
}

export function createServer(port: number, store: Store = new SqliteStore(':memory:')) {
  const wss = new WebSocketServer({ port });
  const rooms = new Rooms(store);
  const sockets = new Map<string, WebSocket>();   // `${code}:${playerId}` → сокет

  const send: (code: string) => (playerId: string, msg: ServerMessage) => void =
    (code) => (playerId, msg) => {
      const s = sockets.get(`${code}:${playerId}`);
      if (s && s.readyState === s.OPEN) s.send(JSON.stringify(msg));
    };

  wss.on('connection', (socket: WebSocket) => {
    const client: Client = { socket };

    const fail = (code: string, message: string) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ t: 'error', code, message } satisfies ServerMessage));
      }
    };

    socket.on('message', (raw) => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(String(raw));
      } catch {
        fail('bad-json', 'сообщение не разобрано');
        return;
      }
      const parsed = parseClientMessage(parsedJson);
      if (!parsed.ok) { fail(parsed.code, parsed.message); return; }
      const msg = parsed.msg;

      const attach = (room: Room, playerId: string, token?: string) => {
        client.room = room;
        client.playerId = playerId;
        sockets.set(`${room.code}:${playerId}`, socket);
        if (token) {
          socket.send(JSON.stringify(
            { t: 'joined', roomCode: room.code, playerId, token } satisfies ServerMessage));
        }
      };

      try {
        switch (msg.t) {
          case 'create': {
            const room = rooms.create(send);
            const { id, token } = room.join(msg.name, msg.roundsPerEpoch);
            attach(room, id, token);
            room.broadcastLobby();
            return;
          }
          case 'join': {
            const room = rooms.get(msg.roomCode, send);
            const { id, token } = room.join(msg.name);
            attach(room, id, token);
            room.broadcastLobby();
            return;
          }
          case 'rejoin': {
            const room = rooms.get(msg.roomCode, send);
            const id = room.rejoinByToken(msg.token);
            if (!id) { fail('bad-token', 'место по этому ключу не найдено'); return; }
            attach(room, id);
            room.resync(id);
            return;
          }
          default: break;
        }

        const room = client.room;
        const playerId = client.playerId;
        if (!room || !playerId) { fail('not-in-room', 'сначала войдите в комнату'); return; }

        void room.run(() => {
          try {
            switch (msg.t) {
              case 'start': room.start(playerId); break;
              case 'submit_draft': room.submitDraft(playerId, msg.archmage as never); break;
              case 'submit_weaving':
                room.submitWeaving(playerId, {
                  stacks: msg.action.stacks as never,
                  corruptionTaken: msg.action.corruptionTaken,
                  exchanges: (msg.action.exchanges ?? []) as never,
                  targeted: (msg.action.targeted ?? []) as never,
                });
                break;
              case 'unready': room.unready(playerId); break;
              case 'resync': room.resync(playerId, msg.since); break;
              case 'submit_building':
                room.submitBuilding(playerId, {
                  pick: msg.action.pick as never,
                  consolationColor: msg.action.consolationColor as never,
                  exchanges: (msg.action.exchanges ?? []) as never,
                  ...(msg.action.druidColor ? { druidColor: msg.action.druidColor as never } : {}),
                });
                break;
              default: break;
            }
          } catch (e) {
            if (e instanceof RuleError) fail(e.code, e.message);
            else fail('internal', 'внутренняя ошибка');
          }
        });
      } catch (e) {
        if (e instanceof RuleError) fail(e.code, e.message);
        else fail('internal', 'внутренняя ошибка');
      }
    });

    socket.on('close', () => {
      const { room, playerId } = client;
      if (!room || !playerId) return;
      sockets.delete(`${room.code}:${playerId}`);
      // Игрока не трогаем: стол ждёт возвращения сколько угодно
      void room.run(() => room.setConnected(playerId, false));
    });
  });

  return {
    wss,
    rooms,
    store,
    port,
    close: () => new Promise<void>((res) => wss.close(() => { store.close(); res(); })),
  };
}
