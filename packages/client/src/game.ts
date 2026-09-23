/**
 * Хот-сит: вся партия живёт в памяти вкладки, ядро вызывается напрямую.
 * Никаких сокетов — Этап 3 отвечает на вопрос «а игра вообще интересная».
 *
 * Скрытая одновременная ставка на одном устройстве означает передачу
 * устройства: между игроками встаёт заслонка, иначе следующий видит чужую
 * стопку и весь блеф рассыпается.
 */
import {
  NODE_COLOR, NODE_ORDER, advanceEpoch, createGame, createRng, dealArchmages,
  finalScores, finishGame, gameOverReason, isEpochEnd, nextRound,
  resolveBuilding, resolveConvergence, resolvePulse, resolveWeaving,
  type ArchmageId, type BuildingAction, type Color, type GameEvent, type GameState,
  type NodeId, type PlayerScore, type WeavingAction,
} from '@razlom/core';

export type Stage =
  | { k: 'setup' }
  | { k: 'pass'; seat: number; then: 'draft' | 'weaving' | 'building' }
  | { k: 'draft'; seat: number }
  | { k: 'weaving'; seat: number }
  | { k: 'reveal' }
  | { k: 'resonance'; step: number }
  | { k: 'upkeep' }
  | { k: 'building'; seat: number }
  | { k: 'convergence' }
  | { k: 'final' };

export interface ResonanceStep {
  node: NodeId;
  color: Color;
  total: number;
  threshold: number;
  overloaded: boolean;
  burned: boolean;
  first: string | null;
  seconds: string[];
  gains: Array<{ playerId: string; amount: number; reason: 'first' | 'second' }>;
  corrupted: string[];
  stacks: Array<{ playerId: string; mana: number }>;
}

export interface UpkeepLine {
  playerId: string;
  spent: Array<{ node: NodeId; amount: number }>;
  returned: number;
  income: number;
  burnedIncome: number;
  manaAfter: number;
}

export interface HotSeat {
  state: GameState;
  stage: Stage;
  names: Record<string, string>;
  drafts: ArchmageId[][];
  weaving: Record<string, WeavingAction>;
  building: Record<string, BuildingAction>;
  steps: ResonanceStep[];
  upkeep: UpkeepLine[];
  scores: PlayerScore[] | null;
  convergenceEvents: GameEvent[];
}

export function playerName(hs: HotSeat, id: string): string {
  return hs.names[id] ?? id;
}

export function createHotSeat(names: string[], roundsPerEpoch: 4 | 6 | 8, seed: number): HotSeat {
  const ids = names.map((_, i) => `p${i}`);
  const state = createGame('hotseat', { roundsPerEpoch, playerCount: names.length }, ids, seed);
  const [drafts] = dealArchmages(names.length, createRng(seed ^ 0x9e3779b9));
  return {
    state,
    stage: { k: 'pass', seat: 0, then: 'draft' },
    names: Object.fromEntries(ids.map((id, i) => [id, names[i] as string])),
    drafts,
    weaving: {}, building: {}, steps: [], upkeep: [], scores: null, convergenceEvents: [],
  };
}

/* ── разбор событий ядра в то, что показывают экраны ── */

function buildSteps(after: GameState, before: GameState, events: GameEvent[]): ResonanceStep[] {
  const last = after.history[after.history.length - 1];
  const steps: ResonanceStep[] = [];
  for (const node of NODE_ORDER) {
    const overload = events.find(
      (e): e is Extract<GameEvent, { t: 'NodeOverloaded' }> => e.t === 'NodeOverloaded' && e.node === node);
    const resolved = events.find(
      (e): e is Extract<GameEvent, { t: 'NodeResolved' }> => e.t === 'NodeResolved' && e.node === node);
    if (!overload && !resolved) continue;
    const raw = last?.stacks[node] ?? {};
    steps.push({
      node,
      color: NODE_COLOR[node],
      total: overload?.total ?? resolved?.total ?? 0,
      threshold: before.threshold,
      overloaded: Boolean(overload),
      burned: events.some((e) => e.t === 'NodeBurned' && e.node === node),
      first: resolved?.first ?? null,
      seconds: resolved?.seconds ?? [],
      gains: events
        .filter((e): e is Extract<GameEvent, { t: 'EssenceGained' }> =>
          e.t === 'EssenceGained' && e.color === NODE_COLOR[node])
        .map((e) => ({ playerId: e.playerId, amount: e.amount, reason: e.reason })),
      corrupted: overload?.players ?? [],
      stacks: Object.entries(raw)
        .map(([playerId, mana]) => ({ playerId, mana }))
        .sort((a, b) => b.mana - a.mana),
    });
  }
  return steps;
}

function buildUpkeep(after: GameState, events: GameEvent[]): UpkeepLine[] {
  return after.players.map((p) => {
    const spent = events
      .filter((e): e is Extract<GameEvent, { t: 'ManaSpent' }> =>
        e.t === 'ManaSpent' && e.playerId === p.id)
      .map((e) => ({ node: e.node, amount: e.amount }));
    const returned = events
      .filter((e): e is Extract<GameEvent, { t: 'ManaReturned' }> =>
        e.t === 'ManaReturned' && e.playerId === p.id)
      .reduce((s, e) => s + e.amount, 0);
    const inc = events.find((e): e is Extract<GameEvent, { t: 'IncomeGained' }> =>
      e.t === 'IncomeGained' && e.playerId === p.id);
    return {
      playerId: p.id, spent, returned,
      income: inc?.amount ?? 0, burnedIncome: inc?.burned ?? 0,
      manaAfter: p.mana,
    };
  });
}

/* ── переходы ── */

function seatId(hs: HotSeat, seat: number): string {
  return hs.state.players[seat]?.id ?? 'p0';
}

export function pickArchmage(hs: HotSeat, seat: number, archmage: ArchmageId): HotSeat {
  const state = structuredClone(hs.state);
  const p = state.players[seat];
  if (p) p.archmage = archmage;
  if (seat + 1 < state.players.length) {
    return { ...hs, state, stage: { k: 'pass', seat: seat + 1, then: 'draft' } };
  }
  const pulsed = resolvePulse({ ...state, phase: 'pulse' }).next;
  return { ...hs, state: pulsed, stage: { k: 'pass', seat: 0, then: 'weaving' } };
}

export function submitWeaving(hs: HotSeat, seat: number, action: WeavingAction): HotSeat {
  const weaving = { ...hs.weaving, [seatId(hs, seat)]: action };
  if (seat + 1 < hs.state.players.length) {
    return { ...hs, weaving, stage: { k: 'pass', seat: seat + 1, then: 'weaving' } };
  }
  const before = hs.state;
  const { next, events } = resolveWeaving(before, weaving);
  return {
    ...hs, state: next, weaving,
    steps: buildSteps(next, before, events),
    upkeep: buildUpkeep(next, events),
    stage: { k: 'reveal' },
  };
}

export function submitBuilding(hs: HotSeat, seat: number, action: BuildingAction): HotSeat {
  const building = { ...hs.building, [seatId(hs, seat)]: action };
  if (seat + 1 < hs.state.players.length) {
    return { ...hs, building, stage: { k: 'pass', seat: seat + 1, then: 'building' } };
  }
  let state = resolveBuilding(hs.state, building).next;
  const clear = { building: {}, weaving: {} };

  if (gameOverReason(state) !== null) {
    state = finishGame(state).next;
    return { ...hs, ...clear, state, scores: finalScores(state), stage: { k: 'final' } };
  }
  if (isEpochEnd(state)) {
    const conv = resolveConvergence(state);
    return { ...hs, ...clear, state: conv.next, convergenceEvents: conv.events, stage: { k: 'convergence' } };
  }
  state = resolvePulse(nextRound(state)).next;
  return { ...hs, ...clear, state, stage: { k: 'pass', seat: 0, then: 'weaving' } };
}

function afterConvergence(hs: HotSeat): HotSeat {
  if (hs.state.epoch === 3) {
    const state = finishGame(hs.state).next;
    return { ...hs, state, scores: finalScores(state), stage: { k: 'final' } };
  }
  const state = resolvePulse(advanceEpoch(hs.state).next).next;
  return { ...hs, state, stage: { k: 'pass', seat: 0, then: 'weaving' } };
}

export function advanceStage(hs: HotSeat): HotSeat {
  const s = hs.stage;
  if (s.k === 'pass') {
    if (s.then === 'draft') return { ...hs, stage: { k: 'draft', seat: s.seat } };
    if (s.then === 'weaving') return { ...hs, stage: { k: 'weaving', seat: s.seat } };
    return { ...hs, stage: { k: 'building', seat: s.seat } };
  }
  if (s.k === 'reveal') return { ...hs, stage: { k: 'resonance', step: 0 } };
  if (s.k === 'resonance') {
    return s.step + 1 < hs.steps.length
      ? { ...hs, stage: { k: 'resonance', step: s.step + 1 } }
      : { ...hs, stage: { k: 'upkeep' } };
  }
  if (s.k === 'upkeep') return { ...hs, stage: { k: 'pass', seat: 0, then: 'building' } };
  if (s.k === 'convergence') return afterConvergence(hs);
  return hs;
}

export function skipAnimation(hs: HotSeat): HotSeat {
  return { ...hs, stage: { k: 'upkeep' } };
}
