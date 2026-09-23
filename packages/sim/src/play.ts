/** Прогон одной партии и сбор наблюдений. Ядро вызывается напрямую — без сервера. */
import {
  advanceEpoch, createGame, createRng, finalScores, finishGame, gameOverReason,
  isEpochEnd, nextRound, resolveBuilding, resolveConvergence, resolvePulse, resolveWeaving,
  totalRounds,
  type BuildingAction, type CharmId, type Epoch, type GameState,
  type PlayerScore, type RngState, type WeavingAction,
} from '@razlom/core';
import type { Policy } from './policy.js';

export interface GameObservation {
  playerCount: number;
  rounds: number;
  endedByNodesExhausted: boolean;
  scores: PlayerScore[];                       // отсортированы, лучший первым
  rankBySeat: number[];                        // место игрока с этим номером за столом
  convergenceIRankBySeat: number[] | null;     // место после Схождения I
  overloadsByEpoch: [number, number, number];
  contestsByEpoch: [number, number, number];   // сколько узлов вообще разрешалось
  firstBurnRound: number | null;
  corruptionBySeat: number[];
  charmBuys: Record<CharmId, number>;
  manaBurned: number;                          // сколько дохода срезал предел запаса
}

function rankMap(scores: PlayerScore[], state: GameState): number[] {
  const bySeat: number[] = new Array(state.players.length).fill(0);
  scores.forEach((s, i) => {
    const seat = state.players.find((p) => p.id === s.playerId)?.seat ?? 0;
    bySeat[seat] = i + 1;
  });
  return bySeat;
}

export function playGame(
  playerCount: number,
  roundsPerEpoch: 4 | 6 | 8,
  policy: Policy,
  seed: number,
): GameObservation {
  const ids = Array.from({ length: playerCount }, (_, i) => `p${i}`);
  let state = createGame(`sim-${seed}`, { roundsPerEpoch, playerCount }, ids, seed);
  // Архимага не выдаём вовсе. Заглушкой раньше служил Хранитель, но с Этапа 6
  // он стал настоящим и не берёт Скверну при перегрузке — стол из шести
  // Хранителей мерил бы не игру, а одну карту.
  state.players.forEach((p) => { p.archmage = null; });
  state.phase = 'pulse';

  let rng: RngState = createRng(seed ^ 0x5f3759df);
  const overloads: [number, number, number] = [0, 0, 0];
  const contests: [number, number, number] = [0, 0, 0];
  const charmBuys: Record<CharmId, number> = {};
  let firstBurnRound: number | null = null;
  let convergenceIRankBySeat: number[] | null = null;
  let manaBurned = 0;
  let guard = 0;

  while (gameOverReason(state) === null && guard++ < 200) {
    state = resolvePulse(state).next;

    const weaving: Record<string, WeavingAction> = {};
    for (const p of state.players) {
      const [a, r] = policy.weaving(state, p.id, rng);
      rng = r;
      weaving[p.id] = a;
    }
    const w = resolveWeaving(state, weaving);
    state = w.next;

    const e = (state.epoch - 1) as 0 | 1 | 2;
    for (const ev of w.events) {
      if (ev.t === 'NodeOverloaded') { overloads[e] += 1; contests[e] += 1; }
      if (ev.t === 'NodeResolved') contests[e] += 1;
      if (ev.t === 'NodeBurned' && firstBurnRound === null) firstBurnRound = state.round;
      if (ev.t === 'IncomeGained') manaBurned += ev.burned;
    }

    const building: Record<string, BuildingAction> = {};
    for (const p of state.players) {
      const [a, r] = policy.building(state, p.id, rng);
      rng = r;
      building[p.id] = a;
    }
    const b = resolveBuilding(state, building);
    state = b.next;
    for (const ev of b.events) {
      if (ev.t === 'CharmBought') charmBuys[ev.charmId] = (charmBuys[ev.charmId] ?? 0) + 1;
    }

    if (gameOverReason(state) !== null) break;

    if (isEpochEnd(state)) {
      const epochBefore = state.epoch;
      state = resolveConvergence(state).next;
      if (epochBefore === 1) {
        convergenceIRankBySeat = rankMap(finalScores(state), state);
      }
      if (state.epoch === 3) break;
      state = advanceEpoch(state).next;
    } else {
      state = nextRound(state);
    }
  }

  const reason = gameOverReason(state);
  state = finishGame(state).next;
  const scores = finalScores(state);

  return {
    playerCount,
    rounds: Math.min(state.round, totalRounds(state.config)),
    endedByNodesExhausted: reason === 'nodes-exhausted',
    scores,
    rankBySeat: rankMap(scores, state),
    convergenceIRankBySeat,
    overloadsByEpoch: overloads,
    contestsByEpoch: contests,
    firstBurnRound,
    corruptionBySeat: state.players.map((p) => p.corruption),
    charmBuys,
    manaBurned,
  };
}

export type { Epoch };
