/** Сырой дамп нескольких раундов: смотреть на числа, а не на сводку. */
import {
  createGame, createRng, resolvePulse, resolveWeaving, resolveBuilding, nextRound,
  NODE_ORDER, type WeavingAction, type BuildingAction,
} from '@razlom/core';
import { heuristicPolicy } from './policy.js';

const players = Number(process.argv[2] ?? 6);
const rounds = Number(process.argv[3] ?? 6);
const policy = heuristicPolicy(0);
let state = createGame('dbg', { roundsPerEpoch: 6, playerCount: players },
  Array.from({ length: players }, (_, i) => `p${i}`), 11);
state.players.forEach((p) => { p.archmage = 'keeper'; });
state.phase = 'pulse';
let rng = createRng(77);

for (let i = 0; i < rounds; i++) {
  state = resolvePulse(state).next;
  const weaving: Record<string, WeavingAction> = {};
  for (const p of state.players) {
    const [a, r] = policy.weaving(state, p.id, rng); rng = r; weaving[p.id] = a;
  }
  const totals = NODE_ORDER.filter((n) => state.nodes.some((x) => x.id === n && x.active))
    .map((n) => {
      const t = state.players.reduce((s, p) => s + (weaving[p.id]?.stacks[n] ?? 0), 0);
      const who = state.players.filter((p) => (weaving[p.id]?.stacks[n] ?? 0) > 0).length;
      return `${n}=${t}${t > state.threshold ? '!' : ''}(${who})`;
    });
  const mana = state.players.map((p) => p.mana).join(',');
  console.log(`р${String(state.round).padStart(2)} эп${state.epoch} порог ${String(state.threshold).padStart(2)} | ${totals.join(' ')} | мана ${mana}`);
  const w = resolveWeaving(state, weaving); state = w.next;
  const building: Record<string, BuildingAction> = {};
  for (const p of state.players) building[p.id] = { kind: 'building', playerId: p.id, pick: null, consolationColor: 'red', exchanges: [] };
  state = resolveBuilding(state, building).next;
  state = nextRound(state);
}
