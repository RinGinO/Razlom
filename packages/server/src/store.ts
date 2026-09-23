/**
 * Постоянство. Партии живут сутками, поэтому держать состояние только в
 * памяти нельзя: деплой убьёт все столы.
 *
 * Весь SQL заперт в этом файле. Переход на Postgres потом переписывает
 * SqliteStore и не трогает ни комнату, ни ядро.
 *
 * Схема — §9 спецификации, переложенная на SQLite:
 *   uuid → TEXT, jsonb → TEXT, timestamptz → INTEGER (мс эпохи).
 * Драйвер встроенный (node:sqlite): у деплоя нет нативных сборок.
 */
import { createRequire } from 'node:module';
import type { GameState } from '@razlom/core';

/**
 * node:sqlite подключается через require, а не статическим импортом.
 * Vite 5 не считает его встроенным (модуль появился в Node недавно и в её
 * builtinModules не попал) и пытается искать на диске пакет «sqlite».
 * Через createRequire специфер не виден сборщику, а типы берутся из Node.
 */
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite') as typeof import('node:sqlite');
type DatabaseSync = InstanceType<typeof DatabaseSync>;

export type RoomStatus = 'lobby' | 'active' | 'finished' | 'archived';

export interface PersistedMember {
  id: string;
  name: string;
  token: string;
}

export interface RoomRecord {
  id: string;
  code: string;
  status: RoomStatus;
  roundsPerEpoch: 4 | 6 | 8;
  members: PersistedMember[];
  hostId: string | null;
  createdAt: number;
  lastActivity: number;
}

export interface Snapshot {
  version: number;
  state: GameState;
}

export interface Store {
  saveRoom(rec: RoomRecord, snapshot?: Snapshot): void;
  appendAction(roomId: string, version: number, playerId: string, payload: unknown): void;
  findByCode(code: string): RoomRecord | null;
  latestSnapshot(roomId: string): Snapshot | null;
  actionsOf(roomId: string): Array<{ version: number; seq: number; playerId: string; payload: unknown }>;
  archiveIdle(olderThanMs: number, now?: number): number;
  pruneSnapshots(roomId: string): number;
  activeCount(): number;
  close(): void;
}

const DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rooms (
  id              TEXT PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL,
  rounds_per_epoch INTEGER NOT NULL,
  members         TEXT NOT NULL,
  host_id         TEXT,
  created_at      INTEGER NOT NULL,
  last_activity   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS room_snapshots (
  room_id    TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  version    INTEGER NOT NULL,
  state      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, version)
);

CREATE TABLE IF NOT EXISTS room_actions (
  room_id    TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  version    INTEGER NOT NULL,
  seq        INTEGER NOT NULL,
  player_id  TEXT NOT NULL,
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, version, seq)
);

CREATE INDEX IF NOT EXISTS rooms_active_idx ON rooms (last_activity) WHERE status = 'active';
`;

export class SqliteStore implements Store {
  private readonly db: DatabaseSync;

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec(DDL);
  }

  /** Комната и снимок пишутся одной транзакцией: полусохранённая партия хуже потерянной. */
  saveRoom(rec: RoomRecord, snapshot?: Snapshot): void {
    this.db.exec('BEGIN');
    try {
      this.db.prepare(`
        INSERT INTO rooms (id, code, status, rounds_per_epoch, members, host_id, created_at, last_activity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          rounds_per_epoch = excluded.rounds_per_epoch,
          members = excluded.members,
          host_id = excluded.host_id,
          last_activity = excluded.last_activity
      `).run(
        rec.id, rec.code, rec.status, rec.roundsPerEpoch,
        JSON.stringify(rec.members), rec.hostId, rec.createdAt, rec.lastActivity,
      );
      if (snapshot) {
        this.db.prepare(`
          INSERT INTO room_snapshots (room_id, version, state, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(room_id, version) DO UPDATE SET state = excluded.state
        `).run(rec.id, snapshot.version, JSON.stringify(snapshot.state), rec.lastActivity);
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  /** Журнал заявок: воспроизведение партии и разбор жалоб «сервер посчитал неправильно». */
  appendAction(roomId: string, version: number, playerId: string, payload: unknown): void {
    const row = this.db.prepare(
      'SELECT COALESCE(MAX(seq), -1) AS s FROM room_actions WHERE room_id = ? AND version = ?',
    ).get(roomId, version) as { s: number } | undefined;
    const seq = (row?.s ?? -1) + 1;
    this.db.prepare(`
      INSERT INTO room_actions (room_id, version, seq, player_id, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(roomId, version, seq, playerId, JSON.stringify(payload), Date.now());
  }

  findByCode(code: string): RoomRecord | null {
    const row = this.db.prepare('SELECT * FROM rooms WHERE code = ?').get(code.toUpperCase()) as
      Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: String(row['id']),
      code: String(row['code']),
      status: String(row['status']) as RoomStatus,
      roundsPerEpoch: Number(row['rounds_per_epoch']) as 4 | 6 | 8,
      members: JSON.parse(String(row['members'])) as PersistedMember[],
      hostId: row['host_id'] === null ? null : String(row['host_id']),
      createdAt: Number(row['created_at']),
      lastActivity: Number(row['last_activity']),
    };
  }

  latestSnapshot(roomId: string): Snapshot | null {
    const row = this.db.prepare(
      'SELECT version, state FROM room_snapshots WHERE room_id = ? ORDER BY version DESC LIMIT 1',
    ).get(roomId) as { version: number; state: string } | undefined;
    if (!row) return null;
    return { version: Number(row.version), state: JSON.parse(row.state) as GameState };
  }

  actionsOf(roomId: string) {
    const rows = this.db.prepare(
      'SELECT version, seq, player_id, payload FROM room_actions WHERE room_id = ? ORDER BY version, seq',
    ).all(roomId) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      version: Number(r['version']),
      seq: Number(r['seq']),
      playerId: String(r['player_id']),
      payload: JSON.parse(String(r['payload'])) as unknown,
    }));
  }

  /** Фоновая уборка: комнаты без движения дольше срока уходят в архив. */
  archiveIdle(olderThanMs: number, now = Date.now()): number {
    const res = this.db.prepare(
      "UPDATE rooms SET status = 'archived' WHERE status IN ('lobby','active','finished') AND last_activity < ?",
    ).run(now - olderThanMs);
    return Number(res.changes);
  }

  /** У завершённой партии хранить сорок снимков незачем — оставляем последний. */
  pruneSnapshots(roomId: string): number {
    const res = this.db.prepare(`
      DELETE FROM room_snapshots
      WHERE room_id = ?
        AND version < (SELECT MAX(version) FROM room_snapshots WHERE room_id = ?)
    `).run(roomId, roomId);
    return Number(res.changes);
  }

  activeCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM rooms WHERE status = 'active'").get() as
      { n: number } | undefined;
    return Number(row?.n ?? 0);
  }

  close(): void {
    this.db.close();
  }
}
