import { describe, expect, it } from 'vitest';
import { resolveWeaving } from '../src/resolve.js';
import { createRng, nextInt } from '../src/rng.js';
import { INCOME_PER_ROUND, ABYSS_MANA, totalEssence } from '../src/setup.js';
import { NODE_ORDER, type GameState, type NodeId, type RngState, type WeavingAction } from '../src/types.js';
import { makeGame } from './helpers.js';

/** Случайное, но валидное Плетение: сумма никогда не превышает доступное. */
function randomWeaving(state: GameState, rng: RngState): [Record<string, WeavingAction>, RngState] {
  let r = rng;
  const actions: Record<string, WeavingAction> = {};
  const active = state.nodes.filter((n) => n.active).map((n) => n.id);
  for (const p of state.players) {
    const [c, r1] = nextInt(r, 2);
    r = r1;
    let budget = p.mana + ABYSS_MANA * c;
    const stacks: Partial<Record<NodeId, number>> = {};
    for (const node of active) {
      if (budget <= 0) break;
      const [amount, r2] = nextInt(r, Math.min(budget, 6) + 1);
      r = r2;
      if (amount > 0) { stacks[node] = amount; budget -= amount; }
    }
    actions[p.id] = { kind: 'weaving', playerId: p.id, stacks, corruptionTaken: c, standingOrders: [], exchanges: [], targeted: [] };
  }
  return [actions, r];
}

describe('инварианты, которые обязаны держаться всегда', () => {
  it('мана не появляется и не исчезает: выложено = потрачено + возвращено', () => {
    let rng = createRng(1234);
    for (let seed = 0; seed < 200; seed++) {
      const g = makeGame(4, { threshold: 9, epoch: 2 });
      const [actions, r] = randomWeaving(g, rng);
      rng = r;
      const { next, events } = resolveWeaving(g, actions);

      for (const before of g.players) {
        const after = next.players.find((x) => x.id === before.id)!;
        const a = actions[before.id]!;
        const placed = Object.values(a.stacks).reduce((s, v) => s + (v ?? 0), 0);
        const spent = events
          .filter((e) => e.t === 'ManaSpent' && e.playerId === before.id)
          .reduce((s, e) => s + (e as { amount: number }).amount, 0);
        const returned = events
          .filter((e) => e.t === 'ManaReturned' && e.playerId === before.id)
          .reduce((s, e) => s + (e as { amount: number }).amount, 0);

        expect(spent + returned, 'выложенное разошлось не полностью').toBe(placed);
        const expected = Math.min(
          after.manaCap,
          before.mana + ABYSS_MANA * a.corruptionTaken - placed + returned + INCOME_PER_ROUND,
        );
        expect(after.mana).toBe(expected);
      }
    }
  });

  it('эссенция не появляется из ниоткуда: каждое начисление имеет событие', () => {
    let rng = createRng(99);
    for (let seed = 0; seed < 200; seed++) {
      const g = makeGame(5, { threshold: 8, epoch: 2 });
      const [actions, r] = randomWeaving(g, rng);
      rng = r;
      const { next, events } = resolveWeaving(g, actions);
      for (const before of g.players) {
        const after = next.players.find((x) => x.id === before.id)!;
        const gained = events
          .filter((e) => e.t === 'EssenceGained' && e.playerId === before.id)
          .reduce((s, e) => s + (e as { amount: number }).amount, 0);
        expect(totalEssence(after.essence) - totalEssence(before.essence)).toBe(gained);
      }
    }
  });

  it('Скверна растёт только через событие', () => {
    let rng = createRng(7);
    for (let seed = 0; seed < 150; seed++) {
      const g = makeGame(6, { threshold: 7, epoch: 2 });
      const [actions, r] = randomWeaving(g, rng);
      rng = r;
      const { next, events } = resolveWeaving(g, actions);
      for (const before of g.players) {
        const after = next.players.find((x) => x.id === before.id)!;
        const taken = events
          .filter((e) => e.t === 'CorruptionTaken' && e.playerId === before.id)
          .reduce((s, e) => s + (e as { amount: number }).amount, 0);
        expect(after.corruption - before.corruption).toBe(taken);
      }
    }
  });

  it('version строго возрастает', () => {
    const g = makeGame(3, { threshold: 9 });
    const [actions] = randomWeaving(g, createRng(5));
    const { next } = resolveWeaving(g, actions);
    expect(next.version).toBeGreaterThan(g.version);
  });

  it('разрешение детерминировано: одинаковый вход даёт одинаковый выход', () => {
    const g = makeGame(6, { threshold: 8, epoch: 2 });
    const [actions] = randomWeaving(g, createRng(2024));
    const a = resolveWeaving(g, actions);
    const b = resolveWeaving(g, actions);
    expect(JSON.stringify(a.next)).toBe(JSON.stringify(b.next));
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });

  it('входное состояние не мутируется', () => {
    const g = makeGame(4, { threshold: 9 });
    const snapshot = JSON.stringify(g);
    const [actions] = randomWeaving(g, createRng(11));
    resolveWeaving(g, actions);
    expect(JSON.stringify(g)).toBe(snapshot);
  });

  it('узлы разрешаются строго в порядке NODE_ORDER', () => {
    const g = makeGame(6, { threshold: 30, epoch: 2 });
    const actions: Record<string, WeavingAction> = {};
    for (const p of g.players) {
      actions[p.id] = {
        kind: 'weaving', playerId: p.id, corruptionTaken: 0, standingOrders: [], exchanges: [], targeted: [],
        stacks: { fire: 1, water: 1, earth: 1, air: 1, void: 1 },
      };
    }
    const { events } = resolveWeaving(g, actions);
    const order = events.filter((e) => e.t === 'NodeResolved').map((e) => (e as { node: NodeId }).node);
    expect(order).toEqual(NODE_ORDER.filter((n) => order.includes(n)));
  });
});
