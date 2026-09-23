/**
 * Редактированные проекции.
 *
 * Каждому игроку уходит своя версия состояния, собранная С НУЛЯ. Не «взять
 * GameState и вычистить лишнее» — вычитание однажды забудут, и чужая стопка
 * уедет в браузер соперника вместе со всей партией. Здесь перечислено только
 * то, что показывать МОЖНО; всё остальное просто не попадает в объект.
 */
import { computeThreshold, finalScores, has, totalRounds } from '@razlom/core';
import type { ArchmageId, GameState, NodeId, WeavingAction } from '@razlom/core';
import { buildHistory, type LobbyView, type PlayerView, type PublicGameView } from '@razlom/protocol';

export interface Seat {
  id: string;
  name: string;
  connected: boolean;
}

export function projectLobby(
  code: string, hostId: string, seats: Seat[], config: GameState['config'], viewerId: string, version: number,
): LobbyView {
  return {
    version, roomCode: code, status: 'lobby', hostId, config, you: viewerId,
    players: seats.map((s) => ({ id: s.id, name: s.name, connected: s.connected })),
  };
}

export interface ProjectOptions {
  state: GameState;
  code: string;
  seats: Map<string, Seat>;
  ready: ReadonlySet<string>;
  /** отправленные заявки: нужны для своей ставки и для Ока */
  pending: ReadonlyMap<string, WeavingAction>;
  /** выданные на драфте карты, по игрокам */
  draftHands: ReadonlyMap<string, ArchmageId[]>;
  viewerId: string;
}

export function project(o: ProjectOptions): PlayerView {
  const { state, code, seats, ready, pending, draftHands, viewerId } = o;
  const me = state.players.find((p) => p.id === viewerId);
  if (!me) throw new Error(`нет игрока ${viewerId}`);

  const view: PlayerView = {
    version: state.version,
    roomCode: code,
    phase: state.phase,
    epoch: state.epoch,
    round: state.round,
    roundInEpoch: state.roundInEpoch,
    totalRounds: totalRounds(state.config),
    threshold: state.threshold,
    empowered: state.empowered.slice(),
    nodes: state.nodes.map((n) => ({ id: n.id, active: n.active, empowered: n.empowered })),
    config: state.config,
    market: state.market.slice(),          // шесть открытых карт публичны
    you: { ...structuredClone(me), name: seats.get(viewerId)?.name ?? viewerId },
    opponents: state.players
      .filter((p) => p.id !== viewerId)
      .map((p) => ({
        id: p.id,
        seat: p.seat,
        name: seats.get(p.id)?.name ?? p.id,
        mana: p.mana,                      // публична (§8)
        essence: { ...p.essence },         // цвета публичны — иначе большинства не спланировать
        corruption: p.corruption,          // публична
        charms: p.charms.length,           // сами карты лежат на столе
        ready: ready.has(p.id),            // только факт, без содержимого заявки
        connected: seats.get(p.id)?.connected ?? false,
        // stacks не передаются никогда: прошлые раунды видны через history
      })),
    readyCount: ready.size,
    history: buildHistory(state.history),
  };

  // Своя отправленная ставка возвращается только владельцу и только если есть
  const mine = pending.get(viewerId);
  if (mine) {
    view.submitted = { ...mine.stacks } as Partial<Record<NodeId, number>>;
    view.submittedCorruption = mine.corruptionTaken;
  }

  // Своя рука драфта — только своя
  const hand = draftHands.get(viewerId);
  if (hand && state.phase === 'draft') view.draftHand = hand.slice();

  // Компас и Провидец видят следующий раунд; Провидец ещё и усиленные узлы (§8)
  const ahead = state.pulseDeck[0];
  if (ahead && (has(me, 'compass') || has(me, 'seer'))) {
    view.nextThreshold = computeThreshold(state.config.playerCount, state.epoch, ahead.thresholdModifier);
  }
  if (ahead && has(me, 'seer')) {
    view.nextEmpowered = ahead.empowered.filter(
      (id) => state.nodes.some((n) => n.id === id && n.active));
  }

  // Око: на скольких узлах стоят соперники — без сумм
  if (has(me, 'eye')) {
    const presence: Record<string, number> = {};
    for (const p of state.players) {
      if (p.id === viewerId) continue;
      const a = pending.get(p.id);
      if (!a) continue;
      presence[p.id] = Object.values(a.stacks).filter((v) => (v ?? 0) > 0).length;
    }
    view.rivalPresence = presence;
  }

  return view;
}

/**
 * Завершённая партия для показа по ссылке (§16).
 * Ключей возврата и внутренностей состояния здесь нет — как и во всех проекциях.
 */
export function projectPublic(state: GameState, code: string, seats: Map<string, Seat>): PublicGameView {
  if (state.phase !== 'finished') {
    throw new Error('публичный вид открывается только у завершённой партии');
  }
  return {
    roomCode: code,
    status: 'finished',
    config: state.config,
    players: state.players.map((p) => ({
      id: p.id,
      name: seats.get(p.id)?.name ?? p.id,
      archmage: p.archmage,
      charms: p.charms.slice(),
    })),
    scores: finalScores(state),
    history: buildHistory(state.history),
    rounds: state.round,
  };
}

/**
 * Ключи GameState, которых не должно быть ни в одной проекции.
 * `stacks` сюда не входит: в history они лежат законно — по §8 стопки
 * скрыты до Раскрытия и публичны после. Отсутствие стопок у соперников
 * проверяется отдельно.
 */
export const FORBIDDEN_KEYS = ['rng', 'charmDecks', 'pulseDeck', 'pendingActions'] as const;
