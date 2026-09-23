import { describe, expect, it } from 'vitest';
import { RuleError } from '@razlom/core';
import type { PlayerView } from '@razlom/protocol';
import { bid, makeFullRoom, passDraft } from './helpers.js';

const view = (last: ReturnType<typeof makeFullRoom>['last'], id: string) =>
  (last(id, 'snapshot') as { view: PlayerView }).view;

describe('драфт архимагов', () => {
  it('партия начинается с драфта, каждому раздают три карты', () => {
    const { room, last } = makeFullRoom(['Аня', 'Борис', 'Вера']);
    room.start('p0');
    expect(room.state!.phase).toBe('draft');
    const v = view(last, 'p0');
    expect(v.draftHand).toHaveLength(3);
  });

  it('своя рука видна только своему владельцу', () => {
    const { room, last } = makeFullRoom(['Аня', 'Борис']);
    room.start('p0');
    const mine = view(last, 'p0');
    const theirs = view(last, 'p1');
    expect(mine.draftHand).toBeDefined();
    expect(theirs.draftHand).toBeDefined();
    // у каждого своя рука, чужой в проекции нет вовсе
    expect(JSON.stringify(theirs)).not.toContain('"opponents":[{"draftHand"');
  });

  it('нельзя взять карту, которой не раздавали', () => {
    const { room } = makeFullRoom(['Аня', 'Борис']);
    room.start('p0');
    const hand = (room as unknown as { draftHands: Map<string, string[]> }).draftHands.get('p0')!;
    const notMine = (['pyromancer', 'seer', 'keeper', 'druid'] as const)
      .find((a) => !hand.includes(a))!;
    expect(() => room.submitDraft('p0', notMine)).toThrow(RuleError);
  });

  it('после общего выбора начинается Плетение и открывается рынок', () => {
    const { room, last } = makeFullRoom(['Аня', 'Борис']);
    room.start('p0');
    passDraft(room);
    expect(room.state!.phase).toBe('weaving');
    expect(view(last, 'p0').market).toHaveLength(6);
  });
});

describe('строительство по сети', () => {
  it('после Резонанса наступает фаза Строительства, а не новый раунд', () => {
    const { room } = makeFullRoom(['Аня', 'Борис']);
    room.start('p0');
    passDraft(room);
    const round = room.state!.round;
    bid(room, 'p0', 2);
    bid(room, 'p1', 3);
    expect(room.state!.phase).toBe('building');
    expect(room.state!.round).toBe(round);
  });

  it('когда все спасовали, раунд закрывается', () => {
    const { room } = makeFullRoom(['Аня', 'Борис']);
    room.start('p0');
    passDraft(room);
    const round = room.state!.round;
    bid(room, 'p0', 2);
    bid(room, 'p1', 3);
    for (const p of room.state!.players) {
      room.submitBuilding(p.id, { pick: null, consolationColor: 'red', exchanges: [] });
    }
    expect(room.state!.phase).toBe('weaving');
    expect(room.state!.round).toBe(round + 1);
  });

  it('партия целиком доигрывается по сети', () => {
    const { room } = makeFullRoom(['Аня', 'Борис', 'Вера'], 4);
    room.start('p0');
    passDraft(room);
    let guard = 0;
    while (room.state!.phase !== 'finished' && guard++ < 300) {
      const phase = room.state!.phase;
      if (phase === 'weaving') for (const p of room.state!.players) bid(room, p.id, 2);
      else if (phase === 'building') {
        for (const p of room.state!.players) {
          room.submitBuilding(p.id, { pick: null, consolationColor: 'red', exchanges: [] });
        }
      } else break;
    }
    expect(room.state!.phase).toBe('finished');
  });
});

describe('видящие карты в проекции', () => {
  it('Компас показывает Порог следующего раунда только владельцу', () => {
    const { room, last } = makeFullRoom(['Аня', 'Борис']);
    room.start('p0');
    passDraft(room);
    room.state!.players[0]!.charms = ['compass'];
    // Драфт раздаёт случайно: соседу мог достаться Провидец, и тогда он
    // законно видел бы следующий раунд. Условия делаем однозначными.
    room.state!.players[1]!.archmage = null;
    room.state!.players[1]!.charms = [];
    room.sendSnapshot('p0');
    room.sendSnapshot('p1');
    const mine = view(last, 'p0');
    const theirs = view(last, 'p1');
    expect(typeof mine.nextThreshold).toBe('number');
    expect(Object.keys(theirs)).not.toContain('nextThreshold');
  });

  it('Провидец видит ещё и усиленные узлы следующего раунда', () => {
    const { room, last } = makeFullRoom(['Аня', 'Борис']);
    room.start('p0');
    passDraft(room);
    room.state!.players[0]!.archmage = 'seer';
    room.state!.players[1]!.archmage = null;
    room.state!.players[1]!.charms = [];
    room.sendSnapshot('p0');
    room.sendSnapshot('p1');
    expect(view(last, 'p0').nextEmpowered).toBeDefined();
    expect(Object.keys(view(last, 'p1'))).not.toContain('nextEmpowered');
  });

  it('Око показывает, на скольких узлах стоят соперники — и ни одной суммы', () => {
    const { room, last } = makeFullRoom(['Аня', 'Борис']);
    room.start('p0');
    passDraft(room);
    room.state!.players[0]!.charms = ['eye'];
    room.state!.players[1]!.archmage = null;
    room.submitWeaving('p1', { stacks: { fire: 4, water: 3 }, corruptionTaken: 0 });
    room.sendSnapshot('p0');
    const mine = view(last, 'p0');
    expect(mine.rivalPresence).toEqual({ p1: 2 });     // два узла, без сумм
    expect(JSON.stringify(mine.rivalPresence)).not.toContain('4');
  });

  it('без Ока поля присутствия нет вовсе', () => {
    const { room, last } = makeFullRoom(['Аня', 'Борис']);
    room.start('p0');
    passDraft(room);
    room.state!.players[0]!.archmage = null;
    room.state!.players[0]!.charms = [];
    room.submitWeaving('p1', { stacks: { fire: 4 }, corruptionTaken: 0 });
    room.sendSnapshot('p0');
    expect(Object.keys(view(last, 'p0'))).not.toContain('rivalPresence');
  });
});
