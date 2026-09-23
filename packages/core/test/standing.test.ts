import { describe, expect, it } from 'vitest';
import { resolveWeaving } from '../src/resolve.js';
import { neighbours, triggerFires } from '../src/standing.js';
import type { StandingOrder } from '../src/types.js';
import { expectRule, find, makeGame, weave, weaveAll } from './helpers.js';

const order = (id: string, trigger: StandingOrder['trigger'], effect: StandingOrder['effect']): StandingOrder =>
  ({ id, trigger, effect });

describe('§8 · предзаявки', () => {
  it('соседний по порядку узел — именно соседний, а не любой', () => {
    expect(neighbours('fire')).toEqual(['water']);
    expect(neighbours('earth')).toEqual(['water', 'air']);
    expect(neighbours('void')).toEqual(['air']);
  });

  it('Иллюзионист переносит стопку на соседний узел', () => {
    const g = makeGame(2, { threshold: 20 });
    find(g, 'p0').archmage = 'illusionist';
    const actions = weaveAll(g, { p1: { water: 1 } });
    actions['p0'] = {
      ...weave('p0', { fire: 5 }),
      standingOrders: [order('a', { type: 'always' }, { type: 'move-stack', from: 'fire', to: 'water' })],
    };
    const { next, events } = resolveWeaving(g, actions);
    // стопка ушла с Огня на Воду, значит Воду выиграл p0
    expect(find(next, 'p0').essence.blue).toBe(2);
    expect(find(next, 'p0').essence.red).toBe(0);
    expect(events.some((e) => e.t === 'StandingOrderFired')).toBe(true);
  });

  it('перенос на несоседний узел не принимается', () => {
    const g = makeGame(4, { threshold: 20 });
    find(g, 'p0').archmage = 'illusionist';
    const actions = weaveAll(g, {});
    actions['p0'] = {
      ...weave('p0', { fire: 3 }),
      standingOrders: [order('a', { type: 'always' }, { type: 'move-stack', from: 'fire', to: 'earth' })],
    };
    expectRule(() => resolveWeaving(g, actions), 'not-adjacent');
  });

  it('Некромант платит Скверной и добавляет ровно две маны', () => {
    const g = makeGame(2, { threshold: 20 });
    find(g, 'p0').archmage = 'necromancer';
    const actions = weaveAll(g, { p1: { fire: 4 } });
    actions['p0'] = {
      ...weave('p0', { fire: 3 }),
      standingOrders: [order('a', { type: 'losing', node: 'fire' },
        { type: 'add-mana', node: 'fire', amount: 2, costCorruption: 1 })],
    };
    const { next } = resolveWeaving(g, actions);
    expect(find(next, 'p0').corruption).toBe(1);
    expect(find(next, 'p0').essence.red).toBe(2);   // 3+2=5 против 4 — первое место
  });

  it('иные суммы Некроманту не позволены', () => {
    const g = makeGame(2, { threshold: 20 });
    find(g, 'p0').archmage = 'necromancer';
    const actions = weaveAll(g, {});
    actions['p0'] = {
      ...weave('p0', { fire: 1 }),
      standingOrders: [order('a', { type: 'always' },
        { type: 'add-mana', node: 'fire', amount: 5, costCorruption: 1 })],
    };
    expectRule(() => resolveWeaving(g, actions), 'bad-order');
  });

  it('Зеркало меняет местами свои стопки', () => {
    const g = makeGame(2, { threshold: 20 });
    find(g, 'p0').charms = ['mirror'];
    const actions = weaveAll(g, { p1: { water: 3 } });
    actions['p0'] = {
      ...weave('p0', { fire: 5, water: 1 }),
      standingOrders: [order('a', { type: 'always' }, { type: 'swap-stacks', a: 'fire', b: 'water' })],
    };
    const { next } = resolveWeaving(g, actions);
    expect(find(next, 'p0').essence.blue).toBe(2);  // после обмена на Воде пятёрка
    expect(find(next, 'p0').essence.red).toBe(2);   // на Огне единица, но он там один
  });

  it('несработавшее условие не тратится и ничего не меняет', () => {
    const g = makeGame(2, { threshold: 20 });
    find(g, 'p0').charms = ['mirror'];
    const actions = weaveAll(g, {});
    actions['p0'] = {
      ...weave('p0', { fire: 4 }),
      standingOrders: [order('a', { type: 'overload', node: 'fire' }, { type: 'swap-stacks', a: 'fire', b: 'water' })],
    };
    const { next, events } = resolveWeaving(g, actions);
    expect(events.some((e) => e.t === 'StandingOrderFired')).toBe(false);
    expect(find(next, 'p0').essence.red).toBe(2);
  });

  it('условие проверяется по вскрытым стопкам, до применения распоряжений', () => {
    const revealed = { p0: { fire: 6 }, p1: { fire: 6 } };
    const o = order('a', { type: 'overload', node: 'fire' }, { type: 'swap-stacks', a: 'fire', b: 'water' });
    expect(triggerFires(o, 'p0', revealed, 10)).toBe(true);
    expect(triggerFires(o, 'p0', revealed, 12)).toBe(false);
  });

  it('условие «проигрываю» верно для того, кто не первый', () => {
    const revealed = { p0: { fire: 2 }, p1: { fire: 5 } };
    const losing = order('a', { type: 'losing', node: 'fire' }, { type: 'swap-stacks', a: 'fire', b: 'water' });
    expect(triggerFires(losing, 'p0', revealed, 20)).toBe(true);
    expect(triggerFires(losing, 'p1', revealed, 20)).toBe(false);
  });

  it('предзаявок не больше трёх', () => {
    const g = makeGame(2, { threshold: 20 });
    find(g, 'p0').charms = ['mirror'];
    const actions = weaveAll(g, {});
    actions['p0'] = {
      ...weave('p0', { fire: 1 }),
      standingOrders: [1, 2, 3, 4].map((i) =>
        order(`o${i}`, { type: 'always' }, { type: 'swap-stacks', a: 'fire', b: 'water' })),
    };
    expectRule(() => resolveWeaving(g, actions), 'too-many-orders');
  });
});
