/**
 * Проекция состояния для одного игрока.
 *
 * Правило, ради которого этот файл существует: если поле нельзя показать
 * сопернику, его не должно быть в объекте — не null, не пустая строка, а
 * отсутствие ключа. Поэтому PlayerView собирается заново, а не «очищается»
 * из GameState: вычитание всегда однажды забудут.
 */
import type {
  ArchmageId, CharmId, Color, Epoch, GameConfig, GameEvent, NodeId, Phase,
  PlayerScore, PlayerState,
} from '@razlom/core';
import type { RoundDigest } from './history.js';

/** Соперник глазами игрока. Стопок здесь нет никогда. */
export interface OpponentView {
  id: string;
  seat: number;
  name: string;
  mana: number;
  essence: Record<Color, number>;
  corruption: number;
  charms: number;
  ready: boolean;
  connected: boolean;
}

export interface NodeView {
  id: NodeId;
  active: boolean;
  empowered: boolean;
}

export interface PlayerView {
  version: number;
  roomCode: string;
  phase: Phase;
  epoch: Epoch;
  round: number;
  roundInEpoch: number;
  totalRounds: number;
  threshold: number;
  empowered: NodeId[];
  nodes: NodeView[];
  config: GameConfig;
  /** своя рука целиком */
  you: PlayerState & { name: string };
  opponents: OpponentView[];
  /** сколько игроков нажало «Готово» — только факт, без содержимого заявок */
  readyCount: number;
  /** публичная история, уже разобранная по узлам: стопки прошлых раундов видны всем */
  history: RoundDigest[];
  /** рынок Чар: шесть открытых карт, публичны */
  market: CharmId[];
  /** своя отправленная ставка, если она уже отправлена */
  submitted?: Partial<Record<NodeId, number>>;
  submittedCorruption?: number;
  /** три карты Архимага на выбор — только в фазе драфта и только свои */
  draftHand?: ArchmageId[];
  /**
   * Порог следующего раунда — только владельцу Компаса или Провидца (§8).
   * У остальных ключа нет вовсе.
   */
  nextThreshold?: number;
  /** усиленные узлы следующего раунда — только Провидцу */
  nextEmpowered?: NodeId[];
  /** на скольких узлах стоят соперники, без сумм — только владельцу Ока */
  rivalPresence?: Record<string, number>;
}

export interface LobbyView {
  version: number;
  roomCode: string;
  status: 'lobby';
  hostId: string;
  players: Array<{ id: string; name: string; connected: boolean }>;
  config: GameConfig;
  you: string;
}

export type { GameEvent };


/**
 * Завершённая партия для показа по ссылке.
 *
 * §16 спрашивал, видна ли история завершённой партии посторонним. Отвечать
 * на это вам, но само представление безопасно по построению: после Раскрытия
 * стопки публичны, эссенция и Скверна публичны всегда, а несработавшие
 * предзаявки в историю не попадают. Скрывать в законченной партии нечего —
 * остаётся только решить, раздавать ли ссылку.
 */
export interface PublicGameView {
  roomCode: string;
  status: 'finished';
  config: GameConfig;
  players: Array<{ id: string; name: string; archmage: ArchmageId | null; charms: CharmId[] }>;
  scores: PlayerScore[];
  history: RoundDigest[];
  rounds: number;
}
