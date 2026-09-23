import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@razlom/protocol';
import { FORBIDDEN_KEYS } from '../src/project.js';
import { bid, deepKeys, makeRoom } from './helpers.js';

/**
 * Тесты проекций — отдельно и обязательно. Это тот баг, который не заметен
 * визуально и стоит всей игры: чужая стопка, уехавшая в браузер соперника.
 */
describe('редактированные проекции', () => {
  it('в проекции нет служебных полей состояния', () => {
    const { room, last } = makeRoom(['Аня', 'Борис', 'Вера']);
    room.start('p0');
    for (const id of ['p0', 'p1', 'p2']) {
      const snap = last(id, 'snapshot');
      const keys = deepKeys(snap);
      for (const forbidden of FORBIDDEN_KEYS) {
        expect(keys.has(forbidden), `${id}: в проекции найдено «${forbidden}»`).toBe(false);
      }
    }
  });

  it('у соперников нет поля со стопками ни в одной фазе', () => {
    const { room, last } = makeRoom(['Аня', 'Борис', 'Вера']);
    room.start('p0');
    bid(room, 'p1', 4);
    bid(room, 'p2', 3);
    const snap = last('p0', 'snapshot') as { view: PlayerView };
    for (const opp of snap.view.opponents) {
      expect(Object.keys(opp)).not.toContain('stacks');
      expect(Object.keys(opp)).not.toContain('submitted');
      expect(Object.keys(opp)).not.toContain('pendingActions');
    }
  });

  it('чужая ставка не утекает до разрешения раунда', () => {
    const { room, last } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    // Борис поставил приметное число; Аня не должна увидеть его нигде
    room.submitWeaving('p1', { stacks: { fire: 7 }, corruptionTaken: 0 });
    const snap = last('p0', 'snapshot') as { view: PlayerView };
    const serialized = JSON.stringify(snap.view.opponents);
    expect(serialized).not.toContain('"fire"');
    expect(snap.view.history).toHaveLength(0);
  });

  it('своя отправленная ставка возвращается только владельцу', () => {
    const { room, last } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    room.submitWeaving('p1', { stacks: { fire: 5 }, corruptionTaken: 1 });
    const mine = (last('p1', 'snapshot') as { view: PlayerView }).view;
    const theirs = (last('p0', 'snapshot') as { view: PlayerView }).view;
    expect(mine.submitted).toEqual({ fire: 5 });
    expect(mine.submittedCorruption).toBe(1);
    expect(theirs.submitted).toBeUndefined();
    expect(Object.keys(theirs)).not.toContain('submitted');
  });

  it('публичное остаётся публичным: мана, эссенция, Скверна соперников видны', () => {
    const { room, last } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    const view = (last('p0', 'snapshot') as { view: PlayerView }).view;
    const opp = view.opponents[0]!;
    expect(typeof opp.mana).toBe('number');
    expect(typeof opp.corruption).toBe('number');
    expect(Object.keys(opp.essence).sort()).toEqual(['blue', 'green', 'purple', 'red', 'white']);
  });

  it('о готовности соперника сообщает ready_map — без содержимого заявки', () => {
    const { room, last } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    room.submitWeaving('p1', { stacks: { fire: 3 }, corruptionTaken: 0 });
    // Снимок соперника не переотправляется: о готовности говорит отдельное сообщение
    const map = last('p0', 'ready_map') as { ready: string[] };
    expect(map.ready).toEqual(['p1']);
    expect(JSON.stringify(map)).not.toContain('fire');
    // А в собственном снимке подавшего готовность видно
    const mine = (last('p1', 'snapshot') as { view: PlayerView }).view;
    expect(mine.readyCount).toBe(1);
  });

  it('после разрешения раунда стопки становятся публичными через историю', () => {
    const { room, last } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    room.submitWeaving('p0', { stacks: { fire: 2 }, corruptionTaken: 0 });
    room.submitWeaving('p1', { stacks: { fire: 3 }, corruptionTaken: 0 });
    const view = (last('p0', 'snapshot') as { view: PlayerView }).view;
    expect(view.history).toHaveLength(1);
    const fire = view.history[0]!.nodes.find((n) => n.node === 'fire')!;
    expect(fire.stacks).toEqual([{ playerId: 'p1', mana: 3 }, { playerId: 'p0', mana: 2 }]);
  });
});
