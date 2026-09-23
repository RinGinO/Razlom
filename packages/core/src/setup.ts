/**
 * Масштабирование, Порог и стартовое состояние.
 *
 * Таблица K проверена против «Базовых значений» §5: формула
 * округлить(F × 5 × N / K) воспроизводит все 21 значение, причём только
 * при округлении «половина вверх» — пять клеток дают ровно .5.
 */
import { createRng, shuffle } from './rng.js';
import { charmsOfEpoch, ARCHMAGES } from './cards.js';
import {
  NODE_ORDER, NODE_COLOR, COLOR_ORDER, RuleError,
  type ArchmageId, type Color, type Epoch, type Essence,
  type GameConfig, type GameState, type NodeId, type PlayerState, type RngState,
} from './types.js';

export const EPOCH_FACTOR: Record<Epoch, number> = { 1: 1.5, 2: 1.2, 3: 0.9 };
export const MIN_THRESHOLD = 3;
export const INCOME_PER_ROUND = 3;
export const DEFAULT_MANA_CAP = 12;
export const ABYSS_MANA = 2;            // 1 Скверна → +2 маны
export const MARKET_SIZE = 6;
export const DRAFT_HAND = 3;

export const REWARD: Record<Epoch, { first: number; second: number }> = {
  1: { first: 2, second: 1 },
  2: { first: 3, second: 1 },
  3: { first: 5, second: 2 },
};

export const CONVERGENCE_BONUS: Record<Epoch, number> = { 1: 2, 2: 3, 3: 5 };

/** Узлы, добавляемые в начале эпохи (§3). Для 6–8 обе стихии входят разом во II. */
function scalingBand(playerCount: number): Record<Epoch, NodeId[]> {
  if (playerCount <= 3) return { 1: ['fire', 'water'], 2: ['earth'], 3: [] };
  if (playerCount <= 5) return { 1: ['fire', 'water', 'earth'], 2: ['air'], 3: [] };
  return { 1: ['fire', 'water', 'earth'], 2: ['air', 'void'], 3: [] };
}

/** Все узлы, присутствующие к началу эпохи. */
export function nodesAtEpoch(playerCount: number, epoch: Epoch): NodeId[] {
  const band = scalingBand(playerCount);
  const seen: NodeId[] = [];
  for (let e = 1 as Epoch; e <= epoch; e = (e + 1) as Epoch) seen.push(...band[e]);
  return NODE_ORDER.filter((n) => seen.includes(n));
}

export function nodesAddedAtEpoch(playerCount: number, epoch: Epoch): NodeId[] {
  return scalingBand(playerCount)[epoch];
}

/** K из формулы Порога: выгоревшие узлы его не уменьшают, поэтому давка нарастает. */
export function thresholdDivisor(playerCount: number, epoch: Epoch): number {
  return nodesAtEpoch(playerCount, epoch).length;
}

/** Цвета, участвующие в партии: те, чьи узлы вообще появляются. */
export function colorsInPlay(playerCount: number): Color[] {
  const nodes = nodesAtEpoch(playerCount, 3);
  return COLOR_ORDER.filter((c) => nodes.some((n) => NODE_COLOR[n] === c));
}

/** Округление «половина вверх»: банковское ломает 5 значений из 21. */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

export function computeThreshold(playerCount: number, epoch: Epoch, cardModifier = 0): number {
  const k = thresholdDivisor(playerCount, epoch);
  const base = roundHalfUp((EPOCH_FACTOR[epoch] * 5 * playerCount) / k);
  return Math.max(MIN_THRESHOLD, base + cardModifier);
}

export function emptyEssence(): Essence {
  return { red: 0, blue: 0, green: 0, white: 0, purple: 0 };
}

export function totalEssence(e: Essence): number {
  return COLOR_ORDER.reduce((s, c) => s + e[c], 0);
}

export function totalRounds(config: GameConfig): number {
  return config.roundsPerEpoch * 3;
}

/** Три случайных Архимага каждому. Дубликаты между игроками допустимы (§3). */
export function dealArchmages(playerCount: number, rng: RngState): [ArchmageId[][], RngState] {
  const pool = ARCHMAGES.filter((a) => playerCount >= a.minPlayers).map((a) => a.id);
  if (pool.length < DRAFT_HAND) throw new RuleError('draft-pool', 'слишком мало Архимагов для драфта');
  let r = rng;
  const hands: ArchmageId[][] = [];
  for (let i = 0; i < playerCount; i++) {
    const [shuffled, next] = shuffle(pool, r);
    r = next;
    hands.push(shuffled.slice(0, DRAFT_HAND));
  }
  return [hands, r];
}

export function createGame(
  roomId: string,
  config: GameConfig,
  playerIds: readonly string[],
  seed: number,
): GameState {
  if (playerIds.length !== config.playerCount) {
    throw new RuleError('player-count', 'playerCount не совпадает со списком игроков');
  }
  if (config.playerCount < 2 || config.playerCount > 8) {
    throw new RuleError('player-count', 'игроков должно быть от 2 до 8');
  }
  let rng = createRng(seed);
  const decks = {} as Record<Epoch, string[]>;
  for (const e of [1, 2, 3] as Epoch[]) {
    const [deck, next] = shuffle(charmsOfEpoch(e), rng);
    rng = next;
    decks[e] = deck;
  }
  const market = decks[1].splice(0, MARKET_SIZE);

  const players: PlayerState[] = playerIds.map((id, seat) => ({
    id, seat, archmage: null,
    mana: 8, manaCap: DEFAULT_MANA_CAP,
    essence: emptyEssence(), corruption: 0,
    charms: [], charmUses: {}, charmChoices: {}, druidColor: null,
    scoredVP: 0, connected: true,
  }));

  return {
    version: 0, roomId, config,
    epoch: 1, round: 1, roundInEpoch: 1, phase: 'draft',
    players,
    nodes: nodesAtEpoch(config.playerCount, 1).map((id) => ({ id, active: true, empowered: false })),
    threshold: computeThreshold(config.playerCount, 1),
    empowered: [],
    market, charmDecks: decks, pulseDeck: [],
    ready: [], pendingActions: {}, history: [],
    rng,
  };
}
