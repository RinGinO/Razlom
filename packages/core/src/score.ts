/** Схождение, смена эпохи и финальный подсчёт (§6 и §7). */
import { shuffle } from './rng.js';
import {
  CONVERGENCE_BONUS, MARKET_SIZE, colorsInPlay, nodesAddedAtEpoch, totalEssence, totalRounds,
} from './setup.js';
import { charmsOfEpoch } from './cards.js';
import { chronicleBonus, finalCharmVP, pillarBonus, resetUses, wildcardColors } from './effects.js';
import {
  RuleError,
  type Color, type Epoch, type GameEvent, type GameState, type PlayerState,
} from './types.js';

const clone = <T>(x: T): T => structuredClone(x);

/**
 * Схождение: за каждый цвет — тому, у кого его больше всего.
 *
 * Правила не оговаривают цвет, которого нет ни у кого. Буквальное чтение
 * даёт бонус всему столу за ноль; считаем это опиской и требуем максимум > 0.
 */
export function resolveConvergence(state: GameState): { next: GameState; events: GameEvent[] } {
  const next = clone(state);
  const events: GameEvent[] = [];
  const bonus = CONVERGENCE_BONUS[next.epoch];

  const tookMajority = new Set<string>();
  for (const color of colorsInPlay(next.config.playerCount)) {
    const best = Math.max(...next.players.map((p) => p.essence[color]));
    if (best <= 0) continue;
    for (const p of next.players.filter((x) => x.essence[color] === best)) {
      p.scoredVP += bonus + pillarBonus(p, color);   // Столп: +2 по объявленному цвету
      tookMajority.add(p.id);
      events.push({ t: 'ConvergenceScored', playerId: p.id, color, points: bonus });
    }
  }
  // Летопись: +1 ПО за каждое Схождение, где взято хотя бы одно большинство
  for (const p of next.players) {
    const extra = chronicleBonus(p, tookMajority.has(p.id));
    if (extra > 0) {
      p.scoredVP += extra;
      events.push({ t: 'ConvergenceScored', playerId: p.id, color: 'red', points: extra });
    }
  }

  next.phase = 'convergence';
  next.version += 1;
  return { next, events };
}

/** После Схождений I и II: рынок заново, новые узлы, новый коэффициент Порога. */
export function advanceEpoch(state: GameState): { next: GameState; events: GameEvent[] } {
  if (state.epoch === 3) throw new RuleError('no-next-epoch', 'после Эпохи III эпох нет');
  const next = clone(state);
  const events: GameEvent[] = [];
  const epoch = (next.epoch + 1) as Epoch;

  const [deck, rng] = shuffle(charmsOfEpoch(epoch), next.rng);
  next.rng = rng;
  next.charmDecks[epoch] = deck;
  next.market = next.charmDecks[epoch].splice(0, MARKET_SIZE);

  const added = nodesAddedAtEpoch(next.config.playerCount, epoch);
  for (const id of added) {
    if (!next.nodes.some((n) => n.id === id)) next.nodes.push({ id, active: true, empowered: false });
  }

  for (const p of next.players) resetUses(p, 'epoch');
  next.epoch = epoch;
  next.roundInEpoch = 1;
  next.round += 1;
  next.phase = 'pulse';
  next.version += 1;
  events.push({ t: 'EpochAdvanced', epoch, nodesAdded: added });
  return { next, events };
}

/** Конец эпохи — когда сыгран последний раунд эпохи. */
export function isEpochEnd(state: GameState): boolean {
  return state.roundInEpoch >= state.config.roundsPerEpoch;
}

/**
 * Партия окончена: раунды кончились либо в Эпохе III на поле осталось
 * меньше двух узлов — тогда оставшиеся раунды пропускаются (§4).
 */
export function gameOverReason(state: GameState): 'rounds' | 'nodes-exhausted' | null {
  if (state.epoch === 3 && state.nodes.filter((n) => n.active).length < 2) return 'nodes-exhausted';
  if (state.round >= totalRounds(state.config) && isEpochEnd(state)) return 'rounds';
  return null;
}

export function nextRound(state: GameState): GameState {
  const next = clone(state);
  next.round += 1;
  next.roundInEpoch += 1;
  next.phase = 'pulse';
  next.ready = [];
  next.pendingActions = {};
  next.version += 1;
  return next;
}

/** Штраф за Скверну растёт треугольником: n(n+1)/2. */
export function corruptionPenalty(n: number): number {
  return (n * (n + 1)) / 2;
}

/**
 * Полных наборов столько, сколько минимального цвета из бывших в игре.
 *
 * Друид объявляет цвет универсальным: его эссенция закрывает нехватку любых
 * других. §12 разрешает иметь Чару и Архимага одновременно — тогда
 * универсальных цветов два, и запасы складываются.
 */
export function completeSets(p: PlayerState, playerCount: number): number {
  const colors = colorsInPlay(playerCount);
  const wild = wildcardColors(p).filter((c) => colors.includes(c));
  if (wild.length === 0) return Math.min(...colors.map((c) => p.essence[c]));

  const plain = colors.filter((c) => !wild.includes(c));
  const supply = wild.reduce((s, c) => s + p.essence[c], 0);
  const ceiling = Math.max(...colors.map((c) => p.essence[c])) + supply;
  let best = 0;
  for (let k = 1; k <= ceiling; k++) {
    const deficit = plain.reduce((s, c) => s + Math.max(0, k - p.essence[c]), 0);
    if (supply >= k * wild.length + deficit) best = k; else break;
  }
  return best;
}

export interface PlayerScore {
  playerId: string;
  essence: number;
  convergences: number;
  sets: number;
  setPoints: number;
  charmPoints: number;
  penalty: number;
  total: number;
  distinctColors: number;
  corruption: number;
  mana: number;
}

import { setPoints as setPointValue } from './effects.js';

export function scorePlayer(p: PlayerState, playerCount: number): PlayerScore {
  const essence = totalEssence(p.essence);
  const sets = completeSets(p, playerCount);
  const setPoints = sets * setPointValue(p);     // Радуга: 8 вместо 5
  const charmPoints = finalCharmVP(p);           // Венец
  const penalty = corruptionPenalty(p.corruption);
  const colors = colorsInPlay(playerCount);
  return {
    playerId: p.id,
    essence, convergences: p.scoredVP, sets, setPoints, charmPoints, penalty,
    total: essence + p.scoredVP + setPoints + charmPoints - penalty,
    distinctColors: colors.filter((c) => p.essence[c] > 0).length,
    corruption: p.corruption,
    mana: p.mana,
  };
}

/**
 * Итоговая таблица. При равенстве очков: меньше Скверны, затем больше разных
 * цветов эссенции, затем больше остатка маны (§7).
 */
export function finalScores(state: GameState): PlayerScore[] {
  return state.players
    .map((p) => scorePlayer(p, state.config.playerCount))
    .sort((a, b) =>
      b.total - a.total ||
      a.corruption - b.corruption ||
      b.distinctColors - a.distinctColors ||
      b.mana - a.mana);
}

export function finishGame(state: GameState): { next: GameState; events: GameEvent[] } {
  const next = clone(state);
  const reason = gameOverReason(state) ?? 'rounds';
  next.phase = 'finished';
  next.version += 1;
  return { next, events: [{ t: 'GameFinished', reason }] };
}

export type { Color };
