/**
 * Реестр комнат поверх хранилища.
 *
 * В памяти процесса — только кэш активных комнат. Комната, которой нет в
 * кэше, поднимается из базы по требованию: партия может идти сутками и
 * обязана пережить перезапуск сервера.
 */
import { randomUUID } from 'node:crypto';
import { RuleError } from '@razlom/core';
import { Room, type Send } from './room.js';
import type { Store } from './store.js';

/** Без похожих друг на друга знаков: код диктуют голосом. */
const ALPHABET = 'АБВГДЕЖЗИКЛМНПРСТУФХЦЧШЭЮЯ23456789';

export function makeCode(len = 5): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export const ARCHIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;   // §9: тридцать суток без движения

export class Rooms {
  private readonly cache = new Map<string, Room>();

  constructor(private readonly store: Store) {}

  private wire(room: Room): Room {
    room.onChange = () => {
      this.store.saveRoom({
        id: room.id, code: room.code, status: room.status,
        roundsPerEpoch: room.roundsPerEpoch, members: room.persistedMembers(),
        hostId: room.hostId, createdAt: room.createdAt, lastActivity: room.lastActivity,
      }, room.snapshot());
      if (room.status === 'finished') this.store.pruneSnapshots(room.id);
    };
    room.onAction = (playerId, version, payload) =>
      this.store.appendAction(room.id, version, playerId, payload);
    this.cache.set(room.code, room);
    return room;
  }

  create(makeSend: (code: string) => Send): Room {
    let code = makeCode();
    while (this.cache.has(code) || this.store.findByCode(code)) code = makeCode();
    return this.wire(new Room(randomUUID(), code, makeSend(code)));
  }

  /** Комната из кэша либо поднятая из базы. */
  get(code: string, makeSend?: (code: string) => Send): Room {
    const upper = code.toUpperCase();
    const cached = this.cache.get(upper);
    if (cached) return cached;

    const rec = this.store.findByCode(upper);
    if (!rec) throw new RuleError('no-room', `комнаты ${code} нет`);
    if (rec.status === 'archived') throw new RuleError('room-archived', 'комната уже в архиве');
    if (!makeSend) throw new RuleError('no-room', `комната ${code} не в памяти`);

    const room = new Room(rec.id, rec.code, makeSend(rec.code));
    const snap = this.store.latestSnapshot(rec.id);
    room.hydrate(rec.members, rec.hostId, rec.roundsPerEpoch, snap?.state ?? null);
    if (snap) {
      // Ставки текущей, ещё не разрешённой фазы поднимаем из журнала заявок
      const pending = this.store.actionsOf(rec.id).filter((a) => a.version === snap.version);
      room.restorePending(pending);
    }
    room.createdAt = rec.createdAt;
    room.lastActivity = rec.lastActivity;
    return this.wire(room);
  }

  has(code: string): boolean {
    const upper = code.toUpperCase();
    return this.cache.has(upper) || this.store.findByCode(upper) !== null;
  }

  /** Выгрузить из памяти, не трогая базу: комната поднимется снова по обращению. */
  evict(code: string): void {
    this.cache.delete(code.toUpperCase());
  }

  sweep(now = Date.now()): number {
    const archived = this.store.archiveIdle(ARCHIVE_AFTER_MS, now);
    if (archived > 0) {
      for (const [code, room] of this.cache) {
        if (now - room.lastActivity >= ARCHIVE_AFTER_MS) this.cache.delete(code);
      }
    }
    return archived;
  }

  get size(): number {
    return this.cache.size;
  }
}
