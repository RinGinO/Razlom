import { describe, expect, it } from 'vitest';
import { RuleError } from '@razlom/core';
import type { PlayerView } from '@razlom/protocol';
import { bid, makeRoom } from './helpers.js';

describe('лобби', () => {
  it('начать партию может только создавший комнату', () => {
    const { room } = makeRoom(['Аня', 'Борис']);
    expect(() => room.start('p1')).toThrow(RuleError);
    expect(() => room.start('p0')).not.toThrow();
  });

  it('в одиночку партия не начинается', () => {
    const { room } = makeRoom(['Аня']);
    expect(() => room.start('p0')).toThrow(/минимум двое/);
  });

  it('в идущую партию не войти', () => {
    const { room } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    expect(() => room.join('Вера')).toThrow(/уже идёт/);
  });

  it('девятому места нет', () => {
    const { room } = makeRoom(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(() => room.join('9')).toThrow(/восемь/);
  });
});

describe('готовность', () => {
  it('раунд не разрешается, пока готовы не все', () => {
    const { room } = makeRoom(['Аня', 'Борис', 'Вера']);
    room.start('p0');
    const v0 = room.state!.version;
    bid(room, 'p0', 3);
    bid(room, 'p1', 3);
    expect(room.state!.version).toBe(v0);      // третий ещё не готов
    bid(room, 'p2', 3);
    expect(room.state!.version).toBeGreaterThan(v0);
  });

  it('готовность отменяема, пока готовы не все', () => {
    const { room, last } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    bid(room, 'p0', 3);
    room.unready('p0');
    const map = last('p0', 'ready_map') as { ready: string[] };
    expect(map.ready).toEqual([]);
  });

  it('повторная отмена игнорируется, а не падает', () => {
    const { room } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    expect(() => { room.unready('p0'); room.unready('p0'); }).not.toThrow();
  });

  it('после общей готовности раунд уже не отменить', () => {
    const { room } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    bid(room, 'p0', 3);
    bid(room, 'p1', 3);   // раунд разрешился, фаза снова Плетение
    // отменять нечего: новая фаза, готовых нет
    expect(() => room.unready('p0')).not.toThrow();
  });

  it('невалидная ставка отвергается ядром и не отмечает готовность', () => {
    const { room } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    expect(() => room.submitWeaving('p0', { stacks: { fire: 99 }, corruptionTaken: 0 }))
      .toThrow(RuleError);
    expect(room.state!.version).toBeGreaterThan(0);
    const v = room.state!.version;
    bid(room, 'p1', 2);
    expect(room.state!.version).toBe(v);       // Аня не готова — раунд стоит
  });
});

describe('симметричная игра', () => {
  it('фазы Строительства нет: после Резонанса сразу новое Плетение', () => {
    const { room } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    const round = room.state!.round;
    bid(room, 'p0', 2);
    bid(room, 'p1', 3);
    expect(room.state!.phase).toBe('weaving');
    expect(room.state!.round).toBe(round + 1);
  });

  it('рынок пуст и Архимагов нет', () => {
    const { room } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    expect(room.state!.market).toEqual([]);
    expect(room.state!.players.every((p) => p.archmage === null)).toBe(true);
  });

  it('партия доигрывается до конца', () => {
    const { room, last } = makeRoom(['Аня', 'Борис', 'Вера'], 4);
    room.start('p0');
    let guard = 0;
    while (room.state!.phase !== 'finished' && guard++ < 200) {
      for (const p of room.state!.players) {
        if (room.state!.phase !== 'weaving') break;
        bid(room, p.id, 2);
      }
    }
    expect(room.state!.phase).toBe('finished');
    const view = (last('p0', 'snapshot') as { view: PlayerView }).view;
    expect(view.history.length).toBeGreaterThan(0);
    expect(room.finalTable()).toHaveLength(3);
  });
});

describe('присутствие', () => {
  it('стол ждёт отключившегося: раунд не разрешается без его ставки', () => {
    const { room } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    room.setConnected('p1', false);
    const v = room.state!.version;
    bid(room, 'p0', 3);
    expect(room.state!.version).toBe(v);       // ждём Бориса сколько угодно
  });

  it('о разрыве и возвращении сообщается всем', () => {
    const { room, last } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    room.setConnected('p1', false);
    expect(last('p0', 'presence')).toMatchObject({ playerId: 'p1', connected: false });
    room.setConnected('p1', true);
    expect(last('p0', 'presence')).toMatchObject({ playerId: 'p1', connected: true });
  });

  it('вернувшийся по ключу получает своё место', () => {
    const inbox = makeRoom(['Аня', 'Борис']);
    const token = [...inbox.room.members.values()][1]!.token;
    inbox.room.setConnected('p1', false);
    expect(inbox.room.rejoinByToken(token)).toBe('p1');
    expect(inbox.room.rejoinByToken('чужой-ключ')).toBe(null);
  });
});
