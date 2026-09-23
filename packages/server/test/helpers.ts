import type { ServerMessage } from '@razlom/protocol';
import { Room } from '../src/room.js';
import { SqliteStore, type Store } from '../src/store.js';
import { Rooms } from '../src/rooms.js';

export interface Collected {
  room: Room;
  inbox: Map<string, ServerMessage[]>;
  last: (playerId: string, t: ServerMessage['t']) => ServerMessage | undefined;
  clear: () => void;
}

export function makeRoom(names: string[], roundsPerEpoch: 4 | 6 | 8 = 6): Collected {
  const inbox = new Map<string, ServerMessage[]>();
  const room = new Room('room-test', 'ТЕСТ1', (playerId: string, msg: ServerMessage) => {
    const list = inbox.get(playerId) ?? [];
    list.push(msg);
    inbox.set(playerId, list);
  });
  room.symmetric = true;   // набор Этапа 4: голая механика узлов и Порога
  names.forEach((n, i) => room.join(n, i === 0 ? roundsPerEpoch : undefined));
  return {
    room, inbox,
    last: (playerId, t) => [...(inbox.get(playerId) ?? [])].reverse().find((m) => m.t === t),
    clear: () => inbox.clear(),
  };
}

/** Все ключи объекта на любой глубине. */
export function deepKeys(value: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(value)) { value.forEach((v) => deepKeys(v, acc)); return acc; }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { acc.add(k); deepKeys(v, acc); }
  }
  return acc;
}

/** Валидная ставка: раскладывает n маны на первый активный узел. */
export function bid(room: Room, playerId: string, amount: number) {
  const state = room.state!;
  const node = state.nodes.find((n) => n.active)!.id;
  room.submitWeaving(playerId, { stacks: { [node]: amount }, corruptionTaken: 0 });
}


/** Реестр с хранилищем в памяти и собиралкой сообщений. */
export function makeRegistry(store?: Store) {
  const inbox = new Map<string, ServerMessage[]>();
  const db = store ?? new SqliteStore(':memory:');
  const rooms = new Rooms(db);
  const makeSend = (code: string) => (playerId: string, msg: ServerMessage) => {
    const key = `${code}:${playerId}`;
    const list = inbox.get(key) ?? [];
    list.push(msg);
    inbox.set(key, list);
  };
  return { rooms, store: db, inbox, makeSend };
}


/** Комната с Архимагами и Чарами — полный режим Этапа 6. */
export function makeFullRoom(names: string[], roundsPerEpoch: 4 | 6 | 8 = 6): Collected {
  const inbox = new Map<string, ServerMessage[]>();
  const room = new Room('ПОЛН1', 'ПОЛН1', (playerId: string, msg: ServerMessage) => {
    const list = inbox.get(playerId) ?? [];
    list.push(msg);
    inbox.set(playerId, list);
  });
  names.forEach((n, i) => room.join(n, i === 0 ? roundsPerEpoch : undefined));
  return {
    room, inbox,
    last: (playerId, t) => [...(inbox.get(playerId) ?? [])].reverse().find((m) => m.t === t),
    clear: () => inbox.clear(),
  };
}

/** Пройти драфт: каждый берёт первую выданную карту. */
export function passDraft(room: Room): void {
  for (const p of room.state!.players) {
    const view = room as unknown as { draftHands: Map<string, string[]> };
    const hand = view.draftHands.get(p.id) ?? [];
    room.submitDraft(p.id, hand[0] as never);
  }
}
