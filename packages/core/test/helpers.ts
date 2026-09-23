import { createGame, emptyEssence, nodesAtEpoch } from '../src/setup.js';
import { RuleError } from '../src/types.js';
import { expect } from 'vitest';
import type {
  BuildingAction, Color, Essence, GameState, NodeId, WeavingAction,
} from '../src/types.js';

export function makeGame(playerCount: number, patch: Partial<GameState> = {}): GameState {
  const ids = Array.from({ length: playerCount }, (_, i) => `p${i}`);
  const g = createGame('room', { roundsPerEpoch: 6, playerCount }, ids, 42);
  const merged: GameState = { ...g, phase: 'weaving', ...patch };
  // Подменили эпоху — узлы обязаны соответствовать ей, иначе тест ставит на то,
  // чего на поле ещё нет.
  if (!patch.nodes) {
    merged.nodes = nodesAtEpoch(playerCount, merged.epoch)
      .map((id) => ({ id, active: true, empowered: false }));
  }
  return merged;
}

/** Сверяем код правила, а не текст сообщения — текст меняется, код нет. */
export function expectRule(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(RuleError);
    expect((e as RuleError).code).toBe(code);
    return;
  }
  throw new Error(`ожидалась RuleError(${code}), но исключения не было`);
}

export function weave(
  playerId: string,
  stacks: Partial<Record<NodeId, number>>,
  corruptionTaken = 0,
  extra: Partial<Pick<WeavingAction, 'exchanges' | 'targeted' | 'standingOrders'>> = {},
): WeavingAction {
  return {
    kind: 'weaving', playerId, stacks, corruptionTaken,
    standingOrders: extra.standingOrders ?? [],
    exchanges: extra.exchanges ?? [],
    targeted: extra.targeted ?? [],
  };
}

export function weaveAll(
  state: GameState,
  map: Record<string, Partial<Record<NodeId, number>>>,
): Record<string, WeavingAction> {
  const out: Record<string, WeavingAction> = {};
  for (const p of state.players) out[p.id] = weave(p.id, map[p.id] ?? {});
  return out;
}

export function buy(
  playerId: string,
  charmId: string,
  pay: Partial<Record<Color, number>>,
  overbid = 0,
  consolationColor: Color = 'red',
): BuildingAction {
  return { kind: 'building', playerId, pick: { charmId, overbid, pay }, consolationColor, exchanges: [] };
}

export function pass(playerId: string, consolationColor: Color = 'red'): BuildingAction {
  return { kind: 'building', playerId, pick: null, consolationColor, exchanges: [] };
}

export function passAll(state: GameState): Record<string, BuildingAction> {
  return Object.fromEntries(state.players.map((p) => [p.id, pass(p.id)]));
}

export function essence(e: Partial<Essence>): Essence {
  return { ...emptyEssence(), ...e };
}

export function find(state: GameState, id: string) {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`нет игрока ${id}`);
  return p;
}
