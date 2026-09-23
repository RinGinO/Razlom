import { describe, expect, it } from 'vitest';
import { resolvePulse, resolveWeaving } from '../src/resolve.js';
import { computeThreshold } from '../src/setup.js';
import { RuleError } from '../src/types.js';
import { expectRule, find, makeGame, weave, weaveAll } from './helpers.js';

/** Каждый пограничный случай из §12 правил — отдельный тест. */
describe('§12 · пограничные случаи', () => {
  it('игрок не выложил ни одной маны — допустимо, он просто копит', () => {
    const g = makeGame(3, { threshold: 10 });
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 4 }, p1: { fire: 2 } }));
    expect(find(next, 'p2').mana).toBe(8 + 3);
    expect(find(next, 'p2').essence.red).toBe(0);
  });

  it('сумма ровно равна Порогу — перегрузки нет, узел разрешается нормально', () => {
    const g = makeGame(2, { threshold: 7 });
    const { next, events } = resolveWeaving(g, weaveAll(g, { p0: { fire: 4 }, p1: { fire: 3 } }));
    expect(events.some((e) => e.t === 'NodeOverloaded')).toBe(false);
    expect(find(next, 'p0').essence.red).toBe(2);  // первое место, Эпоха I
    expect(find(next, 'p1').essence.red).toBe(1);  // второе место
  });

  it('на единицу выше Порога — уже перегрузка', () => {
    const g = makeGame(2, { threshold: 7 });
    const { next, events } = resolveWeaving(g, weaveAll(g, { p0: { fire: 4 }, p1: { fire: 4 } }));
    expect(events.some((e) => e.t === 'NodeOverloaded')).toBe(true);
    expect(find(next, 'p0').essence.red).toBe(0);
    expect(find(next, 'p0').corruption).toBe(1);
    expect(find(next, 'p1').corruption).toBe(1);
  });

  it('все игроки на узле в ничьей — первое место не присуждается, все получают награду второго', () => {
    const g = makeGame(3, { threshold: 12 });
    const { next, events } = resolveWeaving(g, weaveAll(g, { p0: { fire: 3 }, p1: { fire: 3 }, p2: { fire: 3 } }));
    for (const id of ['p0', 'p1', 'p2']) expect(find(next, id).essence.red).toBe(1);
    const resolved = events.find((e) => e.t === 'NodeResolved');
    expect(resolved && resolved.t === 'NodeResolved' && resolved.first).toBe(null);
  });

  it('при ничьей за первое место мана не тратится ни у кого — победы не было', () => {
    const g = makeGame(2, { threshold: 12 });
    const { next, events } = resolveWeaving(g, weaveAll(g, { p0: { fire: 5 }, p1: { fire: 5 } }));
    expect(events.some((e) => e.t === 'ManaSpent')).toBe(false);
    expect(find(next, 'p0').mana).toBe(8 + 3);   // 8 − 5 + 5 возврата + 3 дохода
  });

  it('перегрузка на усиленном узле — усиление не имеет значения', () => {
    const g = makeGame(2, { threshold: 5, empowered: ['fire'] });
    g.nodes.forEach((n) => { n.empowered = n.id === 'fire'; });
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 4 }, p1: { fire: 4 } }));
    expect(find(next, 'p0').essence.red).toBe(0);
    expect(find(next, 'p1').essence.red).toBe(0);
  });

  it('усиленный узел удваивает награду первого места', () => {
    const g = makeGame(2, { threshold: 12 });
    g.nodes.forEach((n) => { n.empowered = n.id === 'fire'; });
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 5 }, p1: { fire: 2 } }));
    expect(find(next, 'p0').essence.red).toBe(4);  // 2 × 2
    expect(find(next, 'p1').essence.red).toBe(1);  // второе место не удваивается
  });

  it('Скверна взята, но мана не выложена — Скверна остаётся, мана уходит в запас с учётом предела', () => {
    const g = makeGame(2, { threshold: 10 });
    const actions = weaveAll(g, {});
    actions['p0'] = weave('p0', {}, 1);
    const { next } = resolveWeaving(g, actions);
    const p = find(next, 'p0');
    expect(p.corruption).toBe(1);
    expect(p.mana).toBe(Math.min(12, 8 + 2 + 3));  // предел 12 срезал излишек
    expect(p.mana).toBe(12);
  });

  it('если на узле один игрок, второе место не присуждается', () => {
    const g = makeGame(3, { threshold: 10 });
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 3 } }));
    expect(find(next, 'p0').essence.red).toBe(2);
    expect(find(next, 'p1').essence.red).toBe(0);
    expect(find(next, 'p2').essence.red).toBe(0);
  });

  it('в Эпохе III перегруженный узел выгорает и уходит с поля', () => {
    const g = makeGame(6, { epoch: 3, threshold: 5 });
    g.nodes = [
      { id: 'fire', active: true, empowered: false },
      { id: 'water', active: true, empowered: false },
      { id: 'earth', active: true, empowered: false },
    ];
    const { next, events } = resolveWeaving(g, weaveAll(g, { p0: { fire: 4 }, p1: { fire: 4 } }));
    expect(events.some((e) => e.t === 'NodeBurned')).toBe(true);
    expect(next.nodes.find((n) => n.id === 'fire')?.active).toBe(false);
  });

  it('в Эпохах I и II перегрузка узел не выжигает', () => {
    const g = makeGame(4, { epoch: 2, threshold: 5 });
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 4 }, p1: { fire: 4 } }));
    expect(next.nodes.find((n) => n.id === 'fire')?.active).toBe(true);
  });
});

describe('Возврат', () => {
  it('мана расходуется только при победе', () => {
    const g = makeGame(2, { threshold: 20 });
    // p0 берёт Огонь и проигрывает Воду
    const { next } = resolveWeaving(g, weaveAll(g, {
      p0: { fire: 5, water: 1 },
      p1: { fire: 2, water: 4 },
    }));
    // p0: 8 − 6 = 2, возврат 1 (Вода проиграна), +3 → 6. Пятёрка на Огне сгорела.
    expect(find(next, 'p0').mana).toBe(6);
    // p1: 8 − 6 = 2, возврат 2 (Огонь проигран), +3 → 7. Четвёрка на Воде сгорела.
    expect(find(next, 'p1').mana).toBe(7);
  });

  it('мана с перегруженного узла возвращается целиком', () => {
    const g = makeGame(2, { threshold: 5 });
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 4 }, p1: { fire: 4 } }));
    expect(find(next, 'p0').mana).toBe(8 + 3);
    expect(find(next, 'p1').mana).toBe(8 + 3);
  });

  it('предел запаса срезает излишек дохода', () => {
    const g = makeGame(2, { threshold: 20 });
    g.players.forEach((p) => { p.mana = 11; });
    const { next } = resolveWeaving(g, weaveAll(g, {}));
    expect(find(next, 'p0').mana).toBe(12);
  });
});

describe('валидация Плетения', () => {
  it('нельзя выложить больше, чем есть', () => {
    const g = makeGame(2, { threshold: 20 });
    expect(() => resolveWeaving(g, weaveAll(g, { p0: { fire: 9 } })))
      .toThrow(RuleError);
  });

  it('Скверна расширяет лимит ровно на два за жетон', () => {
    const g = makeGame(2, { threshold: 20 });
    const actions = weaveAll(g, {});
    actions['p0'] = weave('p0', { fire: 10 }, 1);
    expect(() => resolveWeaving(g, actions)).not.toThrow();
    actions['p0'] = weave('p0', { fire: 11 }, 1);
    expect(() => resolveWeaving(g, actions)).toThrow(RuleError);
  });

  it('нельзя ставить на неактивный узел', () => {
    const g = makeGame(2, { threshold: 20 });
    expect(() => resolveWeaving(g, weaveAll(g, { p0: { void: 1 } }))).toThrow(RuleError);
  });

  it('предзаявка без соответствующей способности отвергается', () => {
    const g = makeGame(2, { threshold: 20 });
    const actions = weaveAll(g, {});
    actions['p0'] = {
      ...weave('p0', { fire: 1 }),
      standingOrders: [{ id: 'x', trigger: { type: 'always' }, effect: { type: 'swap-stacks', a: 'fire', b: 'water' } }],
    };
    expectRule(() => resolveWeaving(g, actions), 'no-ability');
  });
});

describe('Пульс Разлома', () => {
  it('усиленных узлов всегда меньше, чем узлов на поле', () => {
    for (let seed = 0; seed < 60; seed++) {
      for (const players of [2, 3, 4, 6]) {
        const g = makeGame(players, { phase: 'pulse' });
        g.rng = { s: seed };
        const { next } = resolvePulse(g);
        const active = next.nodes.filter((n) => n.active).length;
        expect(next.empowered.length).toBeGreaterThanOrEqual(1);
        expect(next.empowered.length).toBeLessThan(Math.max(2, active));
      }
    }
  });

  it('усиленный узел помечен и в списке, и в самом узле', () => {
    const g = makeGame(6, { phase: 'pulse' });
    const { next } = resolvePulse(g);
    for (const n of next.nodes) {
      expect(n.empowered).toBe(next.empowered.includes(n.id));
    }
  });
});

describe('карта следующего раунда', () => {
  it('готовится заранее — иначе Компасу и Провидцу нечего показывать', () => {
    const g = makeGame(6, { phase: 'pulse' });
    const { next } = resolvePulse(g);
    expect(next.pulseDeck).toHaveLength(1);
    const ahead = next.pulseDeck[0]!;
    expect(ahead.thresholdModifier).toBeGreaterThanOrEqual(-2);
    expect(ahead.thresholdModifier).toBeLessThanOrEqual(2);
  });

  it('заготовленная карта и разыгрывается следующей', () => {
    const g = makeGame(6, { phase: 'pulse' });
    const first = resolvePulse(g).next;
    const promised = first.pulseDeck[0]!;
    const second = resolvePulse({ ...first, phase: 'pulse' }).next;
    expect(second.threshold).toBe(
      computeThreshold(6, second.epoch, promised.thresholdModifier),
    );
  });
});
