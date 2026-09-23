import { describe, expect, it } from 'vitest';
import { resolveBuilding } from '../src/resolve.js';
import { RuleError } from '../src/types.js';
import { buy, essence, expectRule, find, makeGame, pass, passAll } from './helpers.js';

function market(g: ReturnType<typeof makeGame>, ids: string[]) {
  g.market = ids;
  return g;
}

describe('Строительство', () => {
  it('покупка списывает эссенцию выбранных цветов', () => {
    const g = market(makeGame(2, { phase: 'building' }), ['apprentice', 'spring', 'chronicle', 'reservoir', 'compass', 'gatherer']);
    g.players.forEach((p) => { p.essence = essence({ red: 3, blue: 3 }); });
    const actions = passAll(g);
    actions['p0'] = buy('p0', 'apprentice', { red: 2, blue: 1 });  // цена 3
    const { next } = resolveBuilding(g, actions);
    const p = find(next, 'p0');
    expect(p.charms).toEqual(['apprentice']);
    expect(p.essence.red).toBe(1);
    expect(p.essence.blue).toBe(2);
  });

  it('плата обязана точно равняться цене с надбавкой', () => {
    const g = market(makeGame(2, { phase: 'building' }), ['apprentice', 'spring', 'chronicle', 'reservoir', 'compass', 'gatherer']);
    g.players.forEach((p) => { p.essence = essence({ red: 5 }); });
    const actions = passAll(g);
    actions['p0'] = buy('p0', 'apprentice', { red: 2 });
    expect(() => resolveBuilding(g, actions)).toThrow(RuleError);
  });

  it('эссенции не хватает — заявка отвергается', () => {
    const g = market(makeGame(2, { phase: 'building' }), ['crown', 'spring', 'chronicle', 'reservoir', 'compass', 'gatherer']);
    g.players.forEach((p) => { p.essence = essence({ red: 2 }); });
    const actions = passAll(g);
    actions['p0'] = buy('p0', 'crown', { red: 14 });
    expectRule(() => resolveBuilding(g, actions), 'not-enough-essence');
  });

  it('конфликт решает большая суммарная плата', () => {
    const g = market(makeGame(2, { phase: 'building' }), ['apprentice', 'spring', 'chronicle', 'reservoir', 'compass', 'gatherer']);
    g.players.forEach((p) => { p.essence = essence({ red: 9 }); });
    const actions = {
      p0: buy('p0', 'apprentice', { red: 3 }, 0),
      p1: buy('p1', 'apprentice', { red: 5 }, 2),
    };
    const { next, events } = resolveBuilding(g, actions);
    expect(find(next, 'p1').charms).toContain('apprentice');
    expect(find(next, 'p0').charms).toHaveLength(0);
    expect(events.some((e) => e.t === 'CharmContested')).toBe(true);
  });

  it('при равной плате решает меньшая Скверна', () => {
    const g = market(makeGame(2, { phase: 'building' }), ['apprentice', 'spring', 'chronicle', 'reservoir', 'compass', 'gatherer']);
    g.players.forEach((p) => { p.essence = essence({ red: 9 }); });
    find(g, 'p0').corruption = 3;
    find(g, 'p1').corruption = 1;
    const { next } = resolveBuilding(g, {
      p0: buy('p0', 'apprentice', { red: 3 }),
      p1: buy('p1', 'apprentice', { red: 3 }),
    });
    expect(find(next, 'p1').charms).toContain('apprentice');
  });

  it('проигравший в конфликте ничего не платит и получает эссенцию в утешение', () => {
    const g = market(makeGame(2, { phase: 'building' }), ['apprentice', 'spring', 'chronicle', 'reservoir', 'compass', 'gatherer']);
    g.players.forEach((p) => { p.essence = essence({ red: 9 }); });
    const { next } = resolveBuilding(g, {
      p0: buy('p0', 'apprentice', { red: 3 }, 0, 'blue'),
      p1: buy('p1', 'apprentice', { red: 5 }, 2, 'red'),
    });
    const loser = find(next, 'p0');
    expect(loser.essence.red).toBe(9);   // не списано ни одной
    expect(loser.essence.blue).toBe(1);  // утешительная выбранного цвета
  });

  it('купленная карта немедленно заменяется новой из колоды эпохи', () => {
    const g = market(makeGame(2, { phase: 'building' }), ['apprentice', 'spring', 'chronicle', 'reservoir', 'compass', 'gatherer']);
    g.charmDecks[1] = ['manaduct'];
    g.players.forEach((p) => { p.essence = essence({ red: 9 }); });
    const actions = passAll(g);
    actions['p0'] = buy('p0', 'apprentice', { red: 3 });
    const { next } = resolveBuilding(g, actions);
    expect(next.market).toHaveLength(6);
    expect(next.market[0]).toBe('manaduct');
    expect(next.market).not.toContain('apprentice');
  });

  it('пас не трогает ни эссенцию, ни рынок', () => {
    const g = market(makeGame(2, { phase: 'building' }), ['apprentice', 'spring', 'chronicle', 'reservoir', 'compass', 'gatherer']);
    g.players.forEach((p) => { p.essence = essence({ red: 4 }); });
    const { next } = resolveBuilding(g, { p0: pass('p0'), p1: pass('p1') });
    expect(next.market).toEqual(g.market);
    expect(find(next, 'p0').essence.red).toBe(4);
  });

  it('нельзя купить карту, которой нет на рынке', () => {
    const g = market(makeGame(2, { phase: 'building' }), ['apprentice', 'spring', 'chronicle', 'reservoir', 'compass', 'gatherer']);
    g.players.forEach((p) => { p.essence = essence({ red: 9 }); });
    const actions = passAll(g);
    actions['p0'] = buy('p0', 'crown', { red: 14 });
    expect(() => resolveBuilding(g, actions)).toThrow(RuleError);
  });
});
