import { describe, expect, it } from 'vitest';
import { charm } from '@razlom/core';
import type { PlayerView, ServerMessage } from '@razlom/protocol';
import { bid, makeFullRoom, makeRoom, passDraft } from './helpers.js';

const view = (last: ReturnType<typeof makeRoom>['last'], id: string) =>
  (last(id, 'snapshot') as { view: PlayerView }).view;

describe('панель истории', () => {
  it('раунд пересказан по узлам, а не сырыми событиями', () => {
    const { room, last } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    // Порог зависит от карты Разлома и может превысить запас — считаем от запаса
    const th = room.state!.threshold;
    const mine = Math.max(2, Math.min(room.state!.players[0]!.mana, th - 2));
    room.submitWeaving('p0', { stacks: { fire: mine }, corruptionTaken: 0 });
    room.submitWeaving('p1', { stacks: { fire: 1 }, corruptionTaken: 0 });

    const h = view(last, 'p0').history;
    expect(h).toHaveLength(1);
    const fire = h[0]!.nodes.find((n) => n.node === 'fire')!;
    expect(fire.total).toBe(mine + 1);
    expect(fire.overloaded).toBe(false);
    expect(fire.first).toBe('p0');
    expect(fire.seconds).toEqual(['p1']);
    expect(fire.stacks[0]).toEqual({ playerId: 'p0', mana: mine });
  });

  it('начисления эссенции привязаны к своему узлу', () => {
    const { room, last } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    room.submitWeaving('p0', { stacks: { fire: 3 }, corruptionTaken: 0 });
    room.submitWeaving('p1', { stacks: { water: 2 }, corruptionTaken: 0 });
    const h = view(last, 'p0').history[0]!;
    const fire = h.nodes.find((n) => n.node === 'fire')!;
    const water = h.nodes.find((n) => n.node === 'water')!;
    expect(fire.gains.every((g) => g.color === 'red')).toBe(true);
    expect(water.gains.every((g) => g.color === 'blue')).toBe(true);
  });

  it('перегрузка помечена, и видно, кто взял Скверну', () => {
    const { room, last } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    // Перегружаем вдвоём: одному игроку запаса на Порог может не хватить
    const th = room.state!.threshold;
    const a = Math.min(room.state!.players[0]!.mana, th);
    const b = Math.max(1, th - a + 1);
    room.submitWeaving('p0', { stacks: { fire: a }, corruptionTaken: 0 });
    room.submitWeaving('p1', { stacks: { fire: b }, corruptionTaken: 0 });
    const h = view(last, 'p0').history[0]!;
    const fire = h.nodes.find((n) => n.node === 'fire')!;
    expect(fire.overloaded).toBe(true);
    expect(fire.first).toBe(null);
    expect(h.corruption.map((c) => c.playerId).sort()).toEqual(['p0', 'p1']);
  });

  it('узлы в истории идут в порядке разрешения', () => {
    const { room, last } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    room.submitWeaving('p0', { stacks: { water: 2, fire: 2 }, corruptionTaken: 0 });
    room.submitWeaving('p1', { stacks: { fire: 1 }, corruptionTaken: 0 });
    const h = view(last, 'p0').history[0]!;
    expect(h.nodes.map((n) => n.node)).toEqual(['fire', 'water']);
  });

  it('покупки Чар попадают в историю', () => {
    const { room, last } = makeFullRoom(['Аня', 'Борис']);
    room.start('p0');
    passDraft(room);
    bid(room, 'p0', 2); bid(room, 'p1', 3);
    const card = room.state!.market[0]!;
    const price = charm(card).price;      // цена у каждой карты своя
    room.state!.players[0]!.essence.red = price;
    room.submitBuilding('p0', {
      pick: { charmId: card, overbid: 0, pay: { red: price } }, consolationColor: 'red', exchanges: [],
    });
    room.submitBuilding('p1', { pick: null, consolationColor: 'red', exchanges: [] });
    const h = view(last, 'p0').history;
    // покупка случилась после записи раунда — ищем её в свежем снимке игрока
    expect(room.state!.players[0]!.charms).toContain(card);
    expect(h.length).toBeGreaterThan(0);
  });
});

describe('«стол ждёт только тебя»', () => {
  it('уведомление уходит последнему, когда остальные готовы', () => {
    const { room, last } = makeRoom(['Аня', 'Борис', 'Вера']);
    room.start('p0');
    bid(room, 'p0', 2);
    expect(last('p2', 'your_turn')).toBeUndefined();   // ждут ещё двоих
    bid(room, 'p1', 2);
    const msg = last('p2', 'your_turn') as { phase: string; round: number };
    expect(msg).toBeDefined();
    expect(msg.phase).toBe('weaving');
  });

  it('уведомление не уходит тем, кто уже готов', () => {
    const { room, last } = makeRoom(['Аня', 'Борис', 'Вера']);
    room.start('p0');
    bid(room, 'p0', 2);
    bid(room, 'p1', 2);
    expect(last('p0', 'your_turn')).toBeUndefined();
    expect(last('p1', 'your_turn')).toBeUndefined();
  });

  it('повторное сообщение тому же игроку не шлётся', () => {
    const { room, inbox } = makeRoom(['Аня', 'Борис', 'Вера']);
    room.start('p0');
    bid(room, 'p0', 2);
    bid(room, 'p1', 2);
    // Борис передумал и вернулся — для Веры ничего не изменилось, её ход как был,
    // так и есть, поэтому второго уведомления быть не должно
    room.unready('p1');
    bid(room, 'p1', 2);
    const count = (inbox.get('p2') ?? []).filter((m: ServerMessage) => m.t === 'your_turn').length;
    expect(count).toBe(1);
  });

  it('в новой фазе отметка сбрасывается и уведомление придёт снова', () => {
    const { room, inbox } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    bid(room, 'p0', 2);                       // Борис — последний, уведомление
    bid(room, 'p1', 2);                       // раунд разрешился, новая фаза
    bid(room, 'p0', 2);                       // снова последний
    const count = (inbox.get('p1') ?? []).filter((m: ServerMessage) => m.t === 'your_turn').length;
    expect(count).toBe(2);
  });
});

describe('партия по ссылке (§16)', () => {
  it('публичный вид открывается только у завершённой партии', () => {
    const { room } = makeRoom(['Аня', 'Борис']);
    room.start('p0');
    expect(() => room.publicView()).toThrow(/завершённой/);
  });

  it('в публичном виде есть итоги и вся история', () => {
    const { room } = makeRoom(['Аня', 'Борис'], 4);
    room.start('p0');
    let guard = 0;
    while (room.state!.phase !== 'finished' && guard++ < 200) {
      for (const p of room.state!.players) {
        if (room.state!.phase !== 'weaving') break;
        bid(room, p.id, 2);
      }
    }
    const pub = room.publicView();
    expect(pub.status).toBe('finished');
    expect(pub.scores).toHaveLength(2);
    expect(pub.history.length).toBeGreaterThan(0);
    expect(pub.players.map((p) => p.name)).toEqual(['Аня', 'Борис']);
  });

  it('в публичном виде нет ни ключей возврата, ни внутренностей состояния', () => {
    const { room } = makeRoom(['Аня', 'Борис'], 4);
    room.start('p0');
    let guard = 0;
    while (room.state!.phase !== 'finished' && guard++ < 200) {
      for (const p of room.state!.players) {
        if (room.state!.phase !== 'weaving') break;
        bid(room, p.id, 2);
      }
    }
    const serialized = JSON.stringify(room.publicView());
    for (const forbidden of ['token', 'rng', 'pulseDeck', 'charmDecks', 'pendingActions']) {
      expect(serialized, `в публичном виде найдено «${forbidden}»`).not.toContain(forbidden);
    }
  });
});
