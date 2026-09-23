import { describe, expect, it } from 'vitest';
import { resolveBuilding, resolvePulse, resolveWeaving } from '../src/resolve.js';
import {
  advanceEpoch, finalScores, finishGame, gameOverReason, isEpochEnd, nextRound, resolveConvergence,
} from '../src/score.js';
import { createGame, totalRounds, ABYSS_MANA } from '../src/setup.js';
import { createRng, nextInt } from '../src/rng.js';
import { COLOR_ORDER, type GameState, type NodeId, type RngState, type WeavingAction } from '../src/types.js';
import { passAll } from './helpers.js';

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
      const [amount, r2] = nextInt(r, Math.min(budget, 5) + 1);
      r = r2;
      if (amount > 0) { stacks[node] = amount; budget -= amount; }
    }
    actions[p.id] = { kind: 'weaving', playerId: p.id, stacks, corruptionTaken: c, standingOrders: [], exchanges: [], targeted: [] };
  }
  return [actions, r];
}

/** Партия целиком: Пульс → Плетение → Строительство → Схождение → смена эпохи. */
function playGame(playerCount: number, seed: number) {
  let state = createGame('room', { roundsPerEpoch: 6, playerCount }, 
    Array.from({ length: playerCount }, (_, i) => `p${i}`), seed);
  state.players.forEach((p) => { p.archmage = 'keeper'; });
  state.phase = 'pulse';

  let rng = createRng(seed + 1);
  const versions: number[] = [state.version];
  let guard = 0;

  while (gameOverReason(state) === null && guard++ < 100) {
    state = resolvePulse(state).next;
    const [weaving, r] = randomWeaving(state, rng);
    rng = r;
    state = resolveWeaving(state, weaving).next;
    state = resolveBuilding(state, passAll(state)).next;
    versions.push(state.version);

    if (gameOverReason(state) !== null) break;
    if (isEpochEnd(state)) {
      state = resolveConvergence(state).next;
      if (state.epoch === 3) break;
      state = advanceEpoch(state).next;
    } else {
      state = nextRound(state);
    }
  }
  state = finishGame(state).next;
  return { state, versions };
}

describe('партия целиком', () => {
  it('доходит до конца и завершается', () => {
    const { state } = playGame(6, 7);
    expect(state.phase).toBe('finished');
    expect(state.history.length).toBeGreaterThan(0);
  });

  it('version строго возрастает на всём протяжении', () => {
    const { versions } = playGame(4, 3);
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]!).toBeGreaterThan(versions[i - 1]!);
    }
  });

  it('ни мана, ни эссенция, ни Скверна не уходят в минус', () => {
    for (const seed of [1, 2, 3, 11, 42]) {
      const { state } = playGame(6, seed);
      for (const p of state.players) {
        expect(p.mana).toBeGreaterThanOrEqual(0);
        expect(p.mana).toBeLessThanOrEqual(p.manaCap);
        expect(p.corruption).toBeGreaterThanOrEqual(0);
        for (const c of COLOR_ORDER) expect(p.essence[c]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('партия на шестерых успевает добраться до Эпохи III', () => {
    const { state } = playGame(6, 5);
    expect(state.epoch).toBe(3);
  });

  it('итоговая таблица отсортирована по убыванию очков', () => {
    const { state } = playGame(6, 9);
    const scores = finalScores(state);
    expect(scores).toHaveLength(6);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]!.total).toBeGreaterThanOrEqual(scores[i]!.total);
    }
  });

  it('одинаковый посев даёт побайтово одинаковую партию', () => {
    const a = playGame(5, 2024).state;
    const b = playGame(5, 2024).state;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('в Эпохе III узлы действительно выгорают', () => {
    let burned = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { state } = playGame(6, seed);
      burned += state.nodes.filter((n) => !n.active).length;
    }
    expect(burned).toBeGreaterThan(0);
  });

  it('раундов не больше, чем задано режимом', () => {
    const { state } = playGame(4, 13);
    expect(state.round).toBeLessThanOrEqual(totalRounds(state.config));
  });
});
