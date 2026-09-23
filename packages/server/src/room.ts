/**
 * Комната. Вся мутация состояния проходит через последовательную очередь:
 * два «Готово» в одну миллисекунду обрабатываются строго по одному, и
 * условие «все готовы» проверяется после каждого изменения.
 *
 * Этап 4 — симметричная игра: без Архимагов и без Чар. Фаза Строительства
 * пропускается целиком, раунд это Пульс → Плетение → Резонанс → Возврат.
 * Голая механика узлов и Порога должна работать безупречно прежде, чем на
 * неё лягут тридцать карт.
 */
import {
  RuleError, advanceEpoch, createGame, dealArchmages, finalScores, finishGame, gameOverReason,
  isEpochEnd, nextRound, resolveBuilding, resolveConvergence, resolvePulse, resolveWeaving,
  validateBuilding, validateWeaving,
  type ArchmageId, type BuildingAction, type GameEvent, type GameState, type NodeId,
  type WeavingAction,
} from '@razlom/core';
import type { ServerMessage } from '@razlom/protocol';
import { project, projectLobby, projectPublic, type Seat } from './project.js';
import type { PersistedMember, RoomStatus, Snapshot } from './store.js';

export type Send = (playerId: string, msg: ServerMessage) => void;

interface Member extends Seat {
  token: string;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

export class Room {
  readonly members = new Map<string, Member>();
  state: GameState | null = null;
  hostId: string | null = null;
  roundsPerEpoch: 4 | 6 | 8 = 6;
  /** Симметричная игра: без Архимагов и Чар. Ею проверялась голая механика. */
  symmetric = false;
  createdAt = Date.now();
  lastActivity = Date.now();
  /** вызывается после каждого изменения, которое обязано пережить перезапуск */
  onChange?: () => void;
  /** журнал заявок для воспроизведения партии и разбора жалоб */
  onAction?: (playerId: string, version: number, payload: unknown) => void;
  private readonly ready = new Set<string>();
  private readonly pending = new Map<string, WeavingAction>();
  private readonly draftHands = new Map<string, ArchmageId[]>();
  private readonly building = new Map<string, BuildingAction>();
  /** кому уже сказали «ждём только тебя» — чтобы не повторяться */
  private notifiedTurn: string | null = null;
  private lobbyVersion = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(readonly id: string, readonly code: string, private readonly send: Send) {}

  get status(): RoomStatus {
    if (!this.state) return 'lobby';
    return this.state.phase === 'finished' ? 'finished' : 'active';
  }

  snapshot(): Snapshot | undefined {
    return this.state ? { version: this.state.version, state: this.state } : undefined;
  }

  persistedMembers(): PersistedMember[] {
    return [...this.members.values()].map((m) => ({ id: m.id, name: m.name, token: m.token }));
  }

  /** Восстановление после перезапуска: сокетов нет, поэтому все отключены. */
  hydrate(members: PersistedMember[], hostId: string | null, roundsPerEpoch: 4 | 6 | 8, state: GameState | null): void {
    this.members.clear();
    for (const m of members) this.members.set(m.id, { ...m, connected: false });
    this.hostId = hostId;
    this.roundsPerEpoch = roundsPerEpoch;
    this.state = state;
  }

  /**
   * Поднять уже отправленные, но ещё не разрешённые ставки из журнала заявок.
   * Снимок пишется после разрешения фазы, поэтому без журнала перезапуск
   * посреди Плетения заставил бы всех вводить ставку заново.
   * Журнал при этом не пополняем — заявки в нём уже есть.
   */
  restorePending(entries: Array<{ playerId: string; payload: unknown }>): void {
    const state = this.state;
    if (!state || state.phase !== 'weaving') return;
    for (const e of entries) {
      const bid = e.payload as { stacks?: Partial<Record<NodeId, number>>; corruptionTaken?: number };
      if (!bid || typeof bid !== 'object') continue;
      const action: WeavingAction = {
        kind: 'weaving', playerId: e.playerId,
        stacks: bid.stacks ?? {}, corruptionTaken: bid.corruptionTaken ?? 0,
        standingOrders: [], exchanges: [], targeted: [],
      };
      try {
        validateWeaving(state, action);
      } catch {
        continue;   // заявка перестала быть валидной — игрок введёт заново
      }
      this.pending.set(e.playerId, action);
      this.ready.add(e.playerId);
    }
  }

  private touched(): void {
    this.lastActivity = Date.now();
    this.onChange?.();
  }

  /** Все мутации — через очередь. Гонка «двое нажали одновременно» решается здесь. */
  run<T>(fn: () => T): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  get playerIds(): string[] {
    return [...this.members.keys()];
  }

  get started(): boolean {
    return this.state !== null;
  }

  /* ── лобби ── */

  join(name: string, roundsPerEpoch?: 4 | 6 | 8): { id: string; token: string } {
    if (this.state) throw new RuleError('already-started', 'партия уже идёт');
    if (this.members.size >= MAX_PLAYERS) throw new RuleError('room-full', 'в комнате уже восемь игроков');
    const id = `p${this.members.size}`;
    const token = `${this.code}-${id}-${Math.random().toString(36).slice(2, 10)}`;
    this.members.set(id, { id, name, token, connected: true });
    if (!this.hostId) {
      this.hostId = id;
      if (roundsPerEpoch) this.roundsPerEpoch = roundsPerEpoch;
    }
    this.lobbyVersion += 1;
    this.broadcastLobby();
    this.touched();
    return { id, token };
  }

  rejoinByToken(token: string): string | null {
    for (const m of this.members.values()) {
      if (m.token === token) {
        m.connected = true;
        this.broadcastPresence(m.id, true);
        return m.id;
      }
    }
    return null;
  }

  setConnected(playerId: string, connected: boolean): void {
    const m = this.members.get(playerId);
    if (!m || m.connected === connected) return;
    m.connected = connected;
    if (this.state) this.broadcastPresence(playerId, connected);
    else this.broadcastLobby();
    this.touched();
  }

  start(byPlayerId: string): void {
    if (this.state) throw new RuleError('already-started', 'партия уже идёт');
    if (byPlayerId !== this.hostId) throw new RuleError('not-host', 'начать партию может только создавший комнату');
    if (this.members.size < MIN_PLAYERS) throw new RuleError('too-few', 'нужно минимум двое');

    const ids = this.playerIds;
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    let state = createGame(this.code, { roundsPerEpoch: this.roundsPerEpoch, playerCount: ids.length }, ids, seed);

    if (this.symmetric) {
      state.players.forEach((p) => { p.archmage = null; });
      state.market = [];
      state = resolvePulse({ ...state, phase: 'pulse' }).next;
      this.state = state;
    } else {
      const [hands] = dealArchmages(ids.length, state.rng);
      ids.forEach((id, i) => this.draftHands.set(id, hands[i] ?? []));
      state.phase = 'draft';
      this.state = state;
    }
    this.broadcastSnapshot();
    this.touched();
  }

  /** Драфт: три случайные карты, выбор скрыт до конца фазы (§3). */
  submitDraft(playerId: string, archmage: ArchmageId): void {
    const state = this.requireState();
    if (state.phase !== 'draft') throw new RuleError('wrong-phase', 'сейчас не фаза драфта');
    const hand = this.draftHands.get(playerId) ?? [];
    if (!hand.includes(archmage)) throw new RuleError('not-in-hand', 'этой карты вам не раздавали');
    const p = state.players.find((x) => x.id === playerId);
    if (!p) throw new RuleError('unknown-player', 'нет такого игрока');
    if (p.archmage !== null) throw new RuleError('already-picked', 'архимаг уже выбран');
    p.archmage = archmage;
    this.broadcastReady();

    if (state.players.every((x) => x.archmage !== null)) {
      this.state = resolvePulse({ ...state, phase: 'pulse' }).next;
      this.broadcastSnapshot();
    } else {
      this.sendSnapshot(playerId);
    }
    this.touched();
  }

  /** Строительство: покупка Чар, одновременно и втайне (§5, фаза 6). */
  submitBuilding(
    playerId: string,
    action: Omit<BuildingAction, 'playerId' | 'kind' | 'exchanges'> & {
      exchanges?: BuildingAction['exchanges'];
    },
  ): void {
    const state = this.requireState();
    if (state.phase !== 'building') throw new RuleError('wrong-phase', 'сейчас не фаза Строительства');
    if (this.symmetric) throw new RuleError('symmetric-mode', 'в симметричной игре Чар нет');
    const full: BuildingAction = {
      kind: 'building', playerId, ...action, exchanges: action.exchanges ?? [],
    };
    validateBuilding(state, full);
    this.building.set(playerId, full);
    this.ready.add(playerId);
    this.onAction?.(playerId, state.version, action);
    this.broadcastReady();
    this.sendSnapshot(playerId);
    this.tryAdvance();
  }

  /* ── партия ── */

  submitWeaving(
    playerId: string,
    bid: {
      stacks: WeavingAction['stacks'];
      corruptionTaken: number;
      standingOrders?: WeavingAction['standingOrders'];
      exchanges?: WeavingAction['exchanges'];
      targeted?: WeavingAction['targeted'];
    },
  ): void {
    const state = this.requireState();
    if (state.phase !== 'weaving') throw new RuleError('wrong-phase', 'сейчас не фаза Плетения');
    const action: WeavingAction = {
      kind: 'weaving', playerId,
      stacks: bid.stacks, corruptionTaken: bid.corruptionTaken,
      standingOrders: bid.standingOrders ?? [],
      exchanges: bid.exchanges ?? [], targeted: bid.targeted ?? [],
    };
    validateWeaving(state, action);      // ядро — единственный судья
    this.pending.set(playerId, action);
    this.ready.add(playerId);
    this.onAction?.(playerId, state.version, { stacks: bid.stacks, corruptionTaken: bid.corruptionTaken });
    this.broadcastReady();
    this.sendSnapshot(playerId);
    this.tryAdvance();
  }

  unready(playerId: string): void {
    const state = this.requireState();
    if (state.phase !== 'weaving' && state.phase !== 'building') {
      throw new RuleError('wrong-phase', 'сейчас нечего отменять');
    }
    if (this.everyoneReady()) throw new RuleError('too-late', 'все уже готовы, раунд разрешается');
    if (!this.ready.delete(playerId)) return;   // дедупликация: повтор игнорируем
    this.broadcastReady();
    this.sendSnapshot(playerId);
  }

  /** Клиент сам восстанавливается после моргнувшей сети — без перезагрузки страницы. */
  resync(playerId: string, since = -1): void {
    if (!this.state) { this.sendLobby(playerId); return; }
    if (since >= this.state.version) {
      // Клиент уже в курсе: досылаем только то, что снимком не передаётся
      this.send(playerId, { t: 'ready_map', ready: [...this.ready], version: this.state.version });
      return;
    }
    this.sendSnapshot(playerId);
  }

  private everyoneReady(): boolean {
    const state = this.requireState();
    if (state.phase !== 'weaving' && state.phase !== 'building') return false;
    return state.players.every((p) => this.ready.has(p.id));
  }

  private tryAdvance(): void {
    if (!this.everyoneReady()) return;
    const state = this.requireState();
    if (state.phase === 'weaving') this.resolveWeavingPhase();
    else if (state.phase === 'building') this.resolveBuildingPhase();
  }

  private resolveWeavingPhase(): void {
    const before = this.requireState();
    const { next, events } = resolveWeaving(before, Object.fromEntries(this.pending));
    this.ready.clear();
    this.pending.clear();
    this.notifiedTurn = null;
    this.state = next;

    if (this.symmetric) {
      // Строительства нет — сразу к границе раунда
      this.closeRound(events);
      return;
    }
    // Ядро уже перевело фазу в Строительство
    this.broadcast({ t: 'patch', events, version: next.version });
    this.broadcastSnapshot();
    this.touched();
  }

  private resolveBuildingPhase(): void {
    const before = this.requireState();
    const { next, events } = resolveBuilding(before, Object.fromEntries(this.building));
    this.ready.clear();
    this.building.clear();
    this.notifiedTurn = null;
    this.state = next;
    this.closeRound(events);
  }

  /** Граница раунда: Схождение, смена эпохи или новый Пульс. */
  private closeRound(events: GameEvent[]): void {
    let next = this.requireState();
    const all = [...events];

    if (gameOverReason(next) !== null) {
      const fin = finishGame(next);
      next = fin.next;
      all.push(...fin.events);
    } else if (isEpochEnd(next)) {
      const conv = resolveConvergence(next);
      next = conv.next;
      all.push(...conv.events);
      if (next.epoch === 3) {
        const fin = finishGame(next);
        next = fin.next;
        all.push(...fin.events);
      } else {
        const adv = advanceEpoch(next);
        all.push(...adv.events);
        next = resolvePulse(adv.next).next;
      }
    } else {
      next = resolvePulse(nextRound(next)).next;
    }

    this.state = next;
    // Автоматические фазы отдаются одним пакетом: клиент проигрывает их сам
    this.broadcast({ t: 'patch', events: all, version: next.version });
    this.broadcastSnapshot();
    this.touched();
  }

  finalTable() {
    const state = this.requireState();
    return finalScores(state);
  }

  /** Завершённая партия для показа по ссылке (§16). */
  publicView() {
    return projectPublic(this.requireState(), this.code, this.members);
  }

  /* ── рассылка ── */

  private requireState(): GameState {
    if (!this.state) throw new RuleError('not-started', 'партия ещё не началась');
    return this.state;
  }

  private broadcast(msg: ServerMessage): void {
    for (const id of this.members.keys()) this.send(id, msg);
  }

  private broadcastPresence(playerId: string, connected: boolean): void {
    this.broadcast({ t: 'presence', playerId, connected });
  }

  private broadcastReady(): void {
    const state = this.requireState();
    this.broadcast({ t: 'ready_map', ready: [...this.ready], version: state.version });
    this.notifyLastPlayer();
  }

  /**
   * «Стол ждёт только тебя» — повод для заголовка вкладки и push (§11).
   * Таймеров в игре нет, поэтому единственный способ вернуть человека —
   * сказать ему, что дело за ним. Сообщение шлётся один раз на фазу.
   */
  private notifyLastPlayer(): void {
    const state = this.requireState();
    if (state.phase !== 'weaving' && state.phase !== 'building') {
      this.notifiedTurn = null;
      return;
    }
    const waiting = state.players.filter((p) => !this.ready.has(p.id));
    // Отметка живёт до конца фазы. Если кто-то снял готовность и вернул её,
    // для последнего игрока ничего не изменилось — его ход как был, так и есть,
    // и второе уведомление было бы шумом.
    if (waiting.length !== 1) return;
    const target = waiting[0] as { id: string };
    if (this.notifiedTurn === target.id) return;
    this.notifiedTurn = target.id;
    this.send(target.id, {
      t: 'your_turn', phase: state.phase, round: state.round, version: state.version,
    });
  }

  broadcastLobby(): void {
    for (const id of this.members.keys()) this.sendLobby(id);
  }

  broadcastSnapshot(): void {
    for (const id of this.members.keys()) this.sendSnapshot(id);
  }

  private sendLobby(playerId: string): void {
    this.send(playerId, {
      t: 'lobby',
      view: projectLobby(
        this.code, this.hostId ?? '', [...this.members.values()],
        { roundsPerEpoch: this.roundsPerEpoch, playerCount: this.members.size },
        playerId, this.lobbyVersion,
      ),
    });
  }

  sendSnapshot(playerId: string): void {
    const state = this.requireState();
    this.send(playerId, {
      t: 'snapshot',
      view: project({
        state, code: this.code, seats: this.members, ready: this.ready,
        pending: this.pending, draftHands: this.draftHands, viewerId: playerId,
      }),
    });
  }
}
