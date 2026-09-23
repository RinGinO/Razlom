import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { PlayerView, ServerMessage } from '@razlom/protocol';
import { ARCHIVE_AFTER_MS, Rooms } from '../src/rooms.js';
import { SqliteStore } from '../src/store.js';
import { makeRegistry } from './helpers.js';

/** Ставка на первый активный узел — валидная при любом состоянии поля. */
function bidAll(room: ReturnType<Rooms['create']>, amount = 2) {
  for (const p of room.state!.players) {
    const node = room.state!.nodes.find((n) => n.active)!.id;
    if (room.state!.phase !== 'weaving') return;
    room.submitWeaving(p.id, { stacks: { [node]: amount }, corruptionTaken: 0 });
  }
}

describe('состояние переживает перезапуск', () => {
  it('комната поднимается из базы со всеми игроками и позицией партии', () => {
    const { rooms, store, makeSend } = makeRegistry();
    const room = rooms.create(makeSend);
    room.symmetric = true;
    room.join('Аня', 6); room.join('Борис');
    room.start('p0');
    bidAll(room); bidAll(room);
    const code = room.code;
    const roundBefore = room.state!.round;
    const versionBefore = room.state!.version;

    // «перезапуск»: комната уходит из памяти, реестр собирается заново
    const fresh = new Rooms(store);
    const restored = fresh.get(code, makeSend);

    expect(restored.state!.round).toBe(roundBefore);
    expect(restored.state!.version).toBe(versionBefore);
    expect([...restored.members.keys()]).toEqual(['p0', 'p1']);
    expect(restored.members.get('p0')!.name).toBe('Аня');
  });

  it('после перезапуска все считаются отключёнными, пока не вернутся', () => {
    const { rooms, store, makeSend } = makeRegistry();
    const room = rooms.create(makeSend);
    room.symmetric = true;
    room.join('Аня', 6); room.join('Борис');
    room.start('p0');
    const restored = new Rooms(store).get(room.code, makeSend);
    expect([...restored.members.values()].every((m) => !m.connected)).toBe(true);
  });

  it('ключ возврата переживает перезапуск', () => {
    const { rooms, store, makeSend } = makeRegistry();
    const room = rooms.create(makeSend);
    room.symmetric = true;
    room.join('Аня', 6);
    const { token } = room.join('Борис');
    room.start('p0');
    const restored = new Rooms(store).get(room.code, makeSend);
    expect(restored.rejoinByToken(token)).toBe('p1');
  });

  it('ставки текущей фазы поднимаются из журнала заявок', () => {
    const { rooms, store, makeSend } = makeRegistry();
    const room = rooms.create(makeSend);
    room.symmetric = true;
    room.join('Аня', 6); room.join('Борис'); room.join('Вера');
    room.start('p0');
    const node = room.state!.nodes.find((n) => n.active)!.id;
    room.submitWeaving('p0', { stacks: { [node]: 3 }, corruptionTaken: 0 });
    room.submitWeaving('p1', { stacks: { [node]: 2 }, corruptionTaken: 0 });
    const version = room.state!.version;

    const restored = new Rooms(store).get(room.code, makeSend);
    // Аня и Борис уже готовы; ход стоит за Верой — раунд не должен разрешиться
    expect(restored.state!.version).toBe(version);
    const node2 = restored.state!.nodes.find((n) => n.active)!.id;
    restored.submitWeaving('p2', { stacks: { [node2]: 1 }, corruptionTaken: 0 });
    expect(restored.state!.version).toBeGreaterThan(version);
  });

  it('журнал заявок хранит, кто и что поставил', () => {
    const { rooms, store, makeSend } = makeRegistry();
    const room = rooms.create(makeSend);
    room.symmetric = true;
    room.join('Аня', 6); room.join('Борис');
    room.start('p0');
    const node = room.state!.nodes.find((n) => n.active)!.id;
    room.submitWeaving('p0', { stacks: { [node]: 4 }, corruptionTaken: 1 });
    const log = store.actionsOf(room.id);
    expect(log).toHaveLength(1);
    expect(log[0]!.playerId).toBe('p0');
    expect(log[0]!.payload).toMatchObject({ corruptionTaken: 1 });
  });
});

describe('уборка и архив', () => {
  it('комната без движения дольше срока уходит в архив', () => {
    const { rooms, store, makeSend } = makeRegistry();
    const room = rooms.create(makeSend);
    room.symmetric = true;
    room.join('Аня', 6); room.join('Борис');
    room.start('p0');
    expect(store.activeCount()).toBe(1);
    const later = Date.now() + ARCHIVE_AFTER_MS + 1000;
    expect(rooms.sweep(later)).toBe(1);
    expect(store.activeCount()).toBe(0);
    expect(() => new Rooms(store).get(room.code, makeSend)).toThrow(/архиве/);
  });

  it('свежая комната уборкой не задевается', () => {
    const { rooms, makeSend } = makeRegistry();
    const room = rooms.create(makeSend);
    room.symmetric = true;
    room.join('Аня', 6); room.join('Борис');
    room.start('p0');
    expect(rooms.sweep(Date.now())).toBe(0);
  });

  it('у завершённой партии остаётся только последний снимок', () => {
    const { rooms, store, makeSend } = makeRegistry();
    const room = rooms.create(makeSend);
    room.symmetric = true;
    room.join('Аня', 4); room.join('Борис');
    room.start('p0');
    let guard = 0;
    while (room.state!.phase !== 'finished' && guard++ < 200) bidAll(room);
    expect(room.state!.phase).toBe('finished');
    const snap = store.latestSnapshot(room.id);
    expect(snap!.version).toBe(room.state!.version);
    expect(store.pruneSnapshots(room.id)).toBe(0);   // лишние уже удалены при завершении
  });
});

describe('файл на диске', () => {
  const dir = mkdtempSync(join(tmpdir(), 'razlom-'));
  const file = join(dir, 'razlom.db');
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('партия читается другим экземпляром хранилища', () => {
    const first = new SqliteStore(file);
    const roomsA = new Rooms(first);
    const { makeSend } = makeRegistry(first);
    const room = roomsA.create(makeSend);
    room.join('Аня', 6); room.join('Борис');
    room.start('p0');
    bidAll(room);
    const code = room.code;
    const round = room.state!.round;
    first.close();

    const second = new SqliteStore(file);
    const restored = new Rooms(second).get(code, makeSend);
    expect(restored.state!.round).toBe(round);
    expect(restored.members.size).toBe(2);
    second.close();
  });
});

describe('resync', () => {
  it('клиенту с актуальной версией снимок не пересылается', () => {
    const { rooms, makeSend, inbox } = makeRegistry();
    const room = rooms.create(makeSend);
    room.symmetric = true;
    room.join('Аня', 6); room.join('Борис');
    room.start('p0');
    const key = `${room.code}:p0`;
    inbox.set(key, []);
    room.resync('p0', room.state!.version);
    const kinds = (inbox.get(key) ?? []).map((m: ServerMessage) => m.t);
    expect(kinds).toEqual(['ready_map']);
  });

  it('отставшему клиенту снимок присылается целиком', () => {
    const { rooms, makeSend, inbox } = makeRegistry();
    const room = rooms.create(makeSend);
    room.symmetric = true;
    room.join('Аня', 6); room.join('Борис');
    room.start('p0');
    const key = `${room.code}:p0`;
    inbox.set(key, []);
    room.resync('p0', 0);
    const msgs = inbox.get(key) ?? [];
    const snap = msgs.find((m: ServerMessage) => m.t === 'snapshot') as { view: PlayerView } | undefined;
    expect(snap).toBeDefined();
    expect(snap!.view.you.id).toBe('p0');
  });
});
