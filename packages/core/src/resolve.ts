/**
 * Разрешение раунда. Чистые функции: ни сети, ни времени, ни Math.random.
 *
 * Порядок внутри фиксирован — любое отклонение ломает воспроизводимость:
 *   1. валидация   2. Скверна и списание маны   3. предзаявки (Этап 6)
 *   4. Резонанс по NODE_ORDER   5. Возврат   6. версия и история
 */
import { charm } from './cards.js';
import {
  BRAND_WEIGHT, CONVERT_COST, EXCHANGE_PHASE, NEEDS_COLOR, SPRING_MANA, TARGETED,
  abyssMana, canUse, chronicleBonus, drainsOnOverload, firstEssenceBonus, firstPlaceManaBonus,
  has, incomeBonus, manaCap, manaWeight, markUsed, overloadSalvage, resetUses, returnBonus,
  secondEssenceBonus, takesOverloadCorruption, tieWinner, tollmanBonus, vaultEssence,
} from './effects.js';
import { applyStandingOrders, validateStandingOrders } from './standing.js';
import { nextInt, shuffle } from './rng.js';
import {
  ABYSS_MANA, DEFAULT_MANA_CAP, INCOME_PER_ROUND, MARKET_SIZE, REWARD,
  computeThreshold, totalEssence,
} from './setup.js';
import {
  COLOR_ORDER, NODE_COLOR, NODE_ORDER, RuleError,
  type BuildingAction, type CharmId, type Color, type Exchange, type GameEvent,
  type GameState, type NodeId, type PlayerState, type PulseCard, type TargetedUse,
  type WeavingAction,
} from './types.js';

const clone = <T>(x: T): T => structuredClone(x);

function player(state: GameState, id: string): PlayerState {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new RuleError('unknown-player', `нет игрока ${id}`);
  return p;
}

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

/* ─────────────────── Фаза 1. Пульс Разлома ─────────────────── */

/**
 * Разыграть карту Разлома. Колода пополняется на карту вперёд: Компасу и
 * Провидцу положено видеть следующий раунд (§8), а значит, эта карта должна
 * существовать заранее, а не рождаться в момент вскрытия.
 */
function drawPulse(state: GameState): [PulseCard, GameState['rng']] {
  const [mod, r1] = nextInt(state.rng, 5);
  const active = state.nodes.filter((n) => n.active).map((n) => n.id);
  // §5 разрешает усиливать «один или два» узла, но не оговаривает случай,
  // когда узлов на поле всего два: усилив оба, мы делаем усиление пустым —
  // относительного преимущества оно уже не даёт. Держим усиленных строго
  // меньше, чем узлов.
  const maxEmpowered = Math.max(1, Math.min(2, active.length - 1));
  const [count, r2] = nextInt(r1, maxEmpowered) as [number, typeof r1];
  const [shuffled, r3] = shuffle(active, r2);
  return [
    { id: `pulse-${state.round}`, thresholdModifier: mod - 2, empowered: shuffled.slice(0, count + 1) },
    r3,
  ];
}

export function resolvePulse(state: GameState): { next: GameState; events: GameEvent[] } {
  const next = clone(state);
  let card: PulseCard | undefined = next.pulseDeck.shift();
  if (!card) {
    const [drawn, rng] = drawPulse(next);
    next.rng = rng;
    card = drawn;
  }
  next.threshold = computeThreshold(next.config.playerCount, next.epoch, card.thresholdModifier);
  next.empowered = card.empowered.filter((id) => next.nodes.some((n) => n.id === id && n.active));
  for (const n of next.nodes) n.empowered = next.empowered.includes(n.id);
  // Готовим карту следующего раунда: без неё Компасу и Провидцу нечего показывать
  if (next.pulseDeck.length === 0) {
    const [ahead, rng] = drawPulse(next);
    next.rng = rng;
    next.pulseDeck.push(ahead);
  }
  for (const p of next.players) resetUses(p, 'round');
  next.phase = 'weaving';
  next.version += 1;
  return { next, events: [] };
}

/* ─────────────────── Фазы 2–5. Плетение → Возврат ─────────────────── */

/**
 * Проверить обмены и вернуть, сколько маны они дадут.
 * Родник превращает эссенцию в ману, Алхимик и Тигель — в эссенцию другого цвета.
 */
export function validateExchanges(
  state: GameState, p: PlayerState, exchanges: readonly Exchange[], phase: 'weaving' | 'building',
): number {
  const spent: Partial<Record<Color, number>> = {};
  const seen = new Set<CharmId>();
  let mana = 0;
  for (const x of exchanges) {
    const where = EXCHANGE_PHASE[x.charmId];
    if (!where) throw new RuleError('not-exchangeable', `${x.charmId} ничего не обменивает`);
    if (where !== phase) {
      throw new RuleError('wrong-phase', `${x.charmId} обменивает в другой фазе`);
    }
    if (!canUse(p, x.charmId)) {
      throw new RuleError('no-uses-left', `${x.charmId} в этом окне уже сработала`);
    }
    if (seen.has(x.charmId)) throw new RuleError('no-uses-left', `${x.charmId} дважды за раз`);
    seen.add(x.charmId);
    if (!COLOR_ORDER.includes(x.from)) throw new RuleError('bad-color', 'неизвестный цвет');

    const cost = x.charmId === 'spring' ? 1 : CONVERT_COST;
    spent[x.from] = (spent[x.from] ?? 0) + cost;
    if ((spent[x.from] ?? 0) > p.essence[x.from]) {
      throw new RuleError('not-enough-essence', `${x.from}: обменивать нечего`);
    }
    if (x.charmId === 'spring') {
      if (x.to !== undefined) throw new RuleError('bad-exchange', 'Родник даёт ману, а не эссенцию');
      mana += SPRING_MANA;
    } else {
      if (!x.to || !COLOR_ORDER.includes(x.to)) {
        throw new RuleError('bad-exchange', `${x.charmId} требует цвет назначения`);
      }
    }
  }
  void state;
  return mana;
}

/** Проверить нацеленные карты: печати требуют узел, Клеймо — нет. */
export function validateTargeted(
  state: GameState, p: PlayerState, targeted: readonly TargetedUse[],
): void {
  const seen = new Set<CharmId>();
  for (const t of targeted) {
    const spec = TARGETED[t.charmId];
    if (!spec) throw new RuleError('not-targetable', `${t.charmId} ни на кого не нацеливается`);
    if (!canUse(p, t.charmId)) {
      throw new RuleError('no-uses-left', `${t.charmId} в этом окне уже сработала`);
    }
    if (seen.has(t.charmId)) throw new RuleError('no-uses-left', `${t.charmId} дважды за раз`);
    seen.add(t.charmId);
    if (t.targetPlayerId === p.id) throw new RuleError('bad-target', 'нельзя целиться в себя');
    if (!state.players.some((x) => x.id === t.targetPlayerId)) {
      throw new RuleError('bad-target', 'такого игрока за столом нет');
    }
    if (spec.needsNode) {
      if (!t.node) throw new RuleError('bad-target', `${t.charmId} требует узел`);
      if (!state.nodes.some((n) => n.id === t.node && n.active)) {
        throw new RuleError('inactive-node', 'узел вне игры');
      }
    } else if (t.node) {
      throw new RuleError('bad-target', `${t.charmId} узел не выбирает`);
    }
  }
}

export function validateWeaving(state: GameState, action: WeavingAction): void {
  const p = player(state, action.playerId);
  if (!isInt(action.corruptionTaken) || action.corruptionTaken < 0) {
    throw new RuleError('bad-corruption', 'взятая Скверна должна быть целой и неотрицательной');
  }
  validateStandingOrders(state, action);
  const gainedMana = validateExchanges(state, p, action.exchanges, 'weaving');
  validateTargeted(state, p, action.targeted);
  let placed = 0;
  for (const [nodeId, amount] of Object.entries(action.stacks) as [NodeId, number][]) {
    if (!isInt(amount) || amount < 0) {
      throw new RuleError('bad-stack', `стопка на ${nodeId} должна быть целой и неотрицательной`);
    }
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node || !node.active) {
      throw new RuleError('inactive-node', `узел ${nodeId} не в игре`);
    }
    placed += amount;
  }
  const available = p.mana + abyssMana(p, ABYSS_MANA) * action.corruptionTaken + gainedMana;
  if (placed > available) {
    throw new RuleError('not-enough-mana', `выложено ${placed}, доступно ${available}`);
  }
}

export function resolveWeaving(
  state: GameState,
  actions: Record<string, WeavingAction>,
): { next: GameState; events: GameEvent[] } {
  for (const p of state.players) {
    const a = actions[p.id];
    if (!a) throw new RuleError('missing-action', `нет заявки от ${p.id}`);
    validateWeaving(state, a);
  }

  const next = clone(state);
  const events: GameEvent[] = [];

  // 2. Обмены до ставки: Родник даёт ману, Алхимик перекладывает эссенцию
  for (const p of next.players) {
    const a = actions[p.id] as WeavingAction;
    for (const x of a.exchanges) {
      const cost = x.charmId === 'spring' ? 1 : CONVERT_COST;
      p.essence[x.from] -= cost;
      let manaGained = 0;
      if (x.charmId === 'spring') { manaGained = SPRING_MANA; p.mana += manaGained; }
      else if (x.to) p.essence[x.to] += 1;
      markUsed(p, x.charmId);
      events.push({
        t: 'EssenceExchanged', playerId: p.id, charmId: x.charmId,
        from: x.from, to: x.to ?? null, manaGained,
      });
    }
  }

  // 3. Скверна из бездны и списание выложенной маны
  for (const p of next.players) {
    const a = actions[p.id] as WeavingAction;
    if (a.corruptionTaken > 0) {
      p.corruption += a.corruptionTaken;
      p.mana += abyssMana(p, ABYSS_MANA) * a.corruptionTaken;
      events.push({ t: 'CorruptionTaken', playerId: p.id, amount: a.corruptionTaken, reason: 'abyss' });
    }
    const placed = Object.values(a.stacks).reduce((s, v) => s + (v ?? 0), 0);
    p.mana -= placed;
  }

  // 4. Предзаявки: три группы, внутри группы — по номеру места за столом
  const orders = applyStandingOrders(next.players, actions, next.threshold);
  const stacks = orders.stacks;
  for (const [playerId, amount] of Object.entries(orders.corruption)) {
    const p = player(next, playerId);
    p.corruption += amount;
    events.push({ t: 'CorruptionTaken', playerId, amount, reason: 'abyss' });
  }
  for (const f of orders.fired) {
    events.push({ t: 'StandingOrderFired', playerId: f.playerId, orderId: f.orderId });
  }
  /** Активации через предзаявку: Громоотвод, Немой узел, Жатва. */
  const activated = orders.activated;
  for (const act of activated) markUsed(player(next, act.playerId), act.charmId);

  // 5. Печати закрывают узел сопернику. Применяются ПОСЛЕ предзаявок:
  // заранее задуманный перенос позволяет уйти из-под печати, и это честно —
  // оба решения принимались вслепую.
  for (const p of next.players) {
    const a = actions[p.id] as WeavingAction;
    for (const t of a.targeted) {
      markUsed(p, t.charmId);
      if (t.charmId === 'brand') {
        events.push({ t: 'Branded', playerId: p.id, targetPlayerId: t.targetPlayerId, bonus: BRAND_WEIGHT });
        continue;
      }
      const node = t.node as NodeId;
      const victim = stacks[t.targetPlayerId];
      const voided = victim?.[node] ?? 0;
      if (victim) victim[node] = 0;
      events.push({
        t: 'NodeSealed', playerId: p.id, targetPlayerId: t.targetPlayerId, node, voided,
      });
    }
  }

  /** Клеймо утяжеляет вклад цели при проверке Порога, но не при подсчёте мест. */
  const brandOn: Record<string, number> = {};
  for (const p of next.players) {
    for (const t of (actions[p.id] as WeavingAction).targeted) {
      if (t.charmId === 'brand') {
        brandOn[t.targetPlayerId] = (brandOn[t.targetPlayerId] ?? 0) + BRAND_WEIGHT;
      }
    }
  }

  const isLastRound = next.round >= next.config.roundsPerEpoch * 3;
  /** Вес маны при подсчёте: Последний вздох удваивает её в последнем раунде. */
  const weigh = (p: PlayerState, raw: number): number => raw * manaWeight(p, isLastRound);

  /** Сколько эссенции игрок получил за этот раунд — нужно Жатве. */
  const roundGains: Record<string, number> = {};
  const addEssence = (p: PlayerState, color: Color, amount: number, reason: 'first' | 'second') => {
    p.essence[color] += amount;
    roundGains[p.id] = (roundGains[p.id] ?? 0) + amount;
    events.push({ t: 'EssenceGained', playerId: p.id, color, amount, reason });
  };

  // 6. Резонанс — строго по NODE_ORDER, только активные узлы
  const winnerByNode: Partial<Record<NodeId, string>> = {};
  const stacksLog: Record<string, Record<string, number>> = {};

  for (const nodeId of NODE_ORDER) {
    const node = next.nodes.find((n) => n.id === nodeId);
    if (!node || !node.active) continue;

    const contributors = next.players
      .map((p) => ({ p, raw: stacks[p.id]?.[nodeId] ?? 0 }))
      .filter((x) => x.raw > 0)
      .map((x) => ({ ...x, mana: weigh(x.p, x.raw) }));

    stacksLog[nodeId] = Object.fromEntries(contributors.map((c) => [c.p.id, c.raw]));
    if (contributors.length === 0) continue;

    // Две разные величины: одна решает перегрузку, другая — места
    const placement = contributors.reduce((s, c) => s + c.mana, 0);
    const forThreshold = contributors.reduce(
      (s, c) => s + c.mana + (brandOn[c.p.id] ?? 0), 0);

    const color = NODE_COLOR[nodeId];
    const reward = REWARD[next.epoch];

    // Ровно равная Порогу сумма — не перегрузка (§12)
    let overloaded = forThreshold > next.threshold;

    // Немой узел отменяет перегрузку целиком: узел разрешается нормально
    if (overloaded) {
      const muter = activated.find(
        (x) => x.charmId === 'mute-node' && x.node === nodeId
          && contributors.some((c) => c.p.id === x.playerId));
      if (muter) {
        overloaded = false;
        events.push({ t: 'OverloadCancelled', node: nodeId, playerId: muter.playerId });
      }
    }

    if (overloaded) {
      events.push({
        t: 'NodeOverloaded', node: nodeId, total: forThreshold, threshold: next.threshold,
        players: contributors.map((c) => c.p.id),
      });
      const largest = Math.max(...contributors.map((c) => c.mana));
      // Громоотвод: владелец игнорирует перегрузку и берёт эссенцию как победитель
      const rods = new Set(activated
        .filter((x: { playerId: string; charmId: string; node?: NodeId }) => x.charmId === 'lightning-rod'
          && contributors.some((c) => c.p.id === x.playerId))
        .map((x) => x.playerId));

      for (const c of contributors) {
        if (rods.has(c.p.id)) {
          addEssence(c.p, color, reward.first * (node.empowered ? 2 : 1), 'first');
          events.push({ t: 'OverloadIgnored', playerId: c.p.id, node: nodeId, charmId: 'lightning-rod' });
          continue;
        }
        if (takesOverloadCorruption(c.p, c.mana === largest)) {
          c.p.corruption += 1;
          events.push({ t: 'CorruptionTaken', playerId: c.p.id, amount: 1, reason: 'overload' });
        }
        const salvage = overloadSalvage(c.p, reward.first);
        if (salvage > 0) addEssence(c.p, color, salvage, 'first');
      }
      // Пожиратель забирает по мане у каждого участника узла
      for (const d of contributors.filter((c) => drainsOnOverload(c.p))) {
        for (const c of contributors) {
          if (c.p.id === d.p.id || c.p.mana <= 0) continue;
          c.p.mana = Math.max(0, c.p.mana - 1);
          d.p.mana += 1;
        }
      }
      // Громоотвод спасает владельца, но не узел: коллапс идёт своим чередом
      if (next.epoch === 3) {
        node.active = false;
        events.push({ t: 'NodeBurned', node: nodeId });
        for (const p of next.players) {
          const vault = vaultEssence(p, nodeId);
          if (vault) addEssence(p, vault.color, vault.amount, 'first');
        }
      }
      continue;
    }

    const best = Math.max(...contributors.map((c) => c.mana));
    const leaders = contributors.filter((c) => c.mana === best);

    let first: string | null = null;
    let seconds: string[] = [];

    // Ничью за первое место может разрешить Сговор или Пиромант на Огне
    const claimed = leaders.length > 1
      ? tieWinner(leaders.map((l) => l.p), nodeId)
      : (leaders[0] as { p: PlayerState }).p;

    if (claimed === null) {
      // Ничья остаётся ничьёй: первое место не присуждается никому
      seconds = leaders.map((c) => c.p.id);
    } else {
      first = claimed.id;
      winnerByNode[nodeId] = claimed.id;
      const base = reward.first * (node.empowered ? 2 : 1);
      addEssence(claimed, color, firstEssenceBonus(claimed, nodeId, base), 'first');

      const manaBonus = firstPlaceManaBonus(claimed, nodeId);
      if (manaBonus > 0) claimed.mana += manaBonus;

      const rest = contributors.filter((c) => c.p.id !== claimed.id);
      // Мытарь получает ману, когда соперник берёт первое место на его узле
      for (const c of rest) {
        const toll = tollmanBonus(c.p);
        if (toll > 0) c.p.mana += toll;
      }
      if (rest.length > 0) {
        const second = Math.max(...rest.map((c) => c.mana));
        seconds = rest.filter((c) => c.mana === second).map((c) => c.p.id);
      }
    }

    for (const id of seconds) {
      const p = player(next, id);
      addEssence(p, color, secondEssenceBonus(p, reward.second), 'second');
    }
    events.push({ t: 'NodeResolved', node: nodeId, total: placement, first, seconds });
  }

  // 7. Жатва удваивает всю эссенцию, полученную в этом раунде
  for (const act of activated.filter((x) => x.charmId === 'harvest')) {
    const p = player(next, act.playerId);
    const gained = roundGains[act.playerId] ?? 0;
    if (gained <= 0) continue;
    // Удваиваем пропорционально: по цветам, полученным в этом раунде
    for (const e of events) {
      if (e.t === 'EssenceGained' && e.playerId === p.id) p.essence[e.color] += e.amount;
    }
    events.push({ t: 'HarvestDoubled', playerId: p.id, amount: gained });
  }

  // 5. Возврат: мана расходуется только при победе
  for (const p of next.players) {
    let returned = 0;
    for (const nodeId of NODE_ORDER) {
      const stake = stacks[p.id]?.[nodeId] ?? 0;
      if (stake <= 0) continue;
      if (winnerByNode[nodeId] === p.id) {
        events.push({ t: 'ManaSpent', playerId: p.id, node: nodeId, amount: stake });
      } else {
        returned += stake;
      }
    }
    if (returned > 0) {
      returned += returnBonus(p, returned);     // Разветвление
      p.mana += returned;
      events.push({ t: 'ManaReturned', playerId: p.id, amount: returned });
    }
    p.manaCap = manaCap(p, DEFAULT_MANA_CAP);   // Резервуар
    const income = INCOME_PER_ROUND + incomeBonus(p);
    const before = p.mana;
    p.mana = Math.min(p.manaCap, p.mana + income);
    events.push({
      t: 'IncomeGained', playerId: p.id,
      amount: p.mana - before, burned: income - (p.mana - before),
    });
  }

  next.history.push({
    round: next.round, epoch: next.epoch, threshold: next.threshold,
    empowered: next.empowered.slice(), stacks: stacksLog, events: events.slice(),
  });
  next.phase = 'building';
  next.ready = [];
  next.pendingActions = {};
  next.version += 1;
  return { next, events };
}

/* ─────────────────── Фаза 6. Строительство ─────────────────── */

export function validateBuilding(state: GameState, action: BuildingAction): void {
  const p = player(state, action.playerId);
  if (!COLOR_ORDER.includes(action.consolationColor)) {
    throw new RuleError('bad-color', 'неизвестный цвет утешительной эссенции');
  }
  validateExchanges(state, p, action.exchanges, 'building');
  if (action.druidColor !== undefined) {
    if (!has(p, 'druid')) throw new RuleError('no-ability', 'цвет объявляет Архимаг-Друид');
    if (p.druidColor !== null) throw new RuleError('already-declared', 'цвет уже объявлен');
    if (state.epoch !== 1) throw new RuleError('wrong-phase', 'Друид объявляет цвет в конце Эпохи I');
    if (!COLOR_ORDER.includes(action.druidColor)) throw new RuleError('bad-color', 'неизвестный цвет');
  }
  if (action.pick === null) return;
  const { charmId, overbid, pay } = action.pick;
  if (NEEDS_COLOR.includes(charmId)) {
    if (!action.pick.choice || !COLOR_ORDER.includes(action.pick.choice)) {
      throw new RuleError('needs-color', `${charmId} требует объявить цвет при покупке`);
    }
  } else if (action.pick.choice !== undefined) {
    throw new RuleError('bad-choice', `${charmId} цвет не выбирает`);
  }
  if (!state.market.includes(charmId)) {
    throw new RuleError('not-on-market', `${charmId} нет на рынке`);
  }
  if (!isInt(overbid) || overbid < 0) {
    throw new RuleError('bad-overbid', 'надбавка должна быть целой и неотрицательной');
  }
  const price = charm(charmId).price + overbid;
  let paid = 0;
  for (const [color, amount] of Object.entries(pay) as [Color, number][]) {
    if (!isInt(amount) || amount < 0) throw new RuleError('bad-payment', 'плата должна быть целой');
    if (amount > p.essence[color]) {
      throw new RuleError('not-enough-essence', `${color}: нужно ${amount}, есть ${p.essence[color]}`);
    }
    paid += amount;
  }
  if (paid !== price) {
    throw new RuleError('payment-mismatch', `плата ${paid} не равна цене с надбавкой ${price}`);
  }
}

export function resolveBuilding(
  state: GameState,
  actions: Record<string, BuildingAction>,
): { next: GameState; events: GameEvent[] } {
  for (const p of state.players) {
    const a = actions[p.id];
    if (!a) throw new RuleError('missing-action', `нет заявки от ${p.id}`);
    validateBuilding(state, a);
  }

  const next = clone(state);
  const events: GameEvent[] = [];

  // Обмены «в момент подсчёта»: Тигель. Строительство — последняя фаза перед Схождением
  for (const p of next.players) {
    const a = actions[p.id] as BuildingAction;
    for (const x of a.exchanges) {
      p.essence[x.from] -= CONVERT_COST;
      if (x.to) p.essence[x.to] += 1;
      markUsed(p, x.charmId);
      events.push({
        t: 'EssenceExchanged', playerId: p.id, charmId: x.charmId,
        from: x.from, to: x.to ?? null, manaGained: 0,
      });
    }
    if (a.druidColor !== undefined && p.druidColor === null) {
      p.druidColor = a.druidColor;
      events.push({ t: 'ColorDeclared', playerId: p.id, charmId: 'druid', color: a.druidColor });
    }
  }

  const byCharm = new Map<string, BuildingAction[]>();
  for (const p of next.players) {
    const a = actions[p.id] as BuildingAction;
    if (!a.pick) continue;
    const list = byCharm.get(a.pick.charmId) ?? [];
    list.push(a);
    byCharm.set(a.pick.charmId, list);
  }

  // Порядок разбора карт фиксируем позицией на рынке — иначе недетерминизм
  for (const charmId of next.market.slice()) {
    const bids = byCharm.get(charmId);
    if (!bids || bids.length === 0) continue;

    const scored = bids.map((a) => {
      const p = player(next, a.playerId);
      const pick = a.pick as NonNullable<BuildingAction['pick']>;
      return { a, p, total: charm(charmId).price + pick.overbid };
    });
    scored.sort((x, y) =>
      y.total - x.total ||
      x.p.corruption - y.p.corruption ||
      totalEssence(x.p.essence) - totalEssence(y.p.essence) ||
      x.p.seat - y.p.seat);

    const win = scored[0] as (typeof scored)[number];
    const pick = win.a.pick as NonNullable<BuildingAction['pick']>;
    for (const [color, amount] of Object.entries(pick.pay) as [Color, number][]) {
      win.p.essence[color] -= amount;
    }
    win.p.charms.push(charmId);
    events.push({ t: 'CharmBought', playerId: win.p.id, charmId, paid: win.total });
    if (pick.choice) {
      win.p.charmChoices[charmId] = pick.choice;
      events.push({ t: 'ColorDeclared', playerId: win.p.id, charmId, color: pick.choice });
    }
    // Якорь бездны срабатывает сразу при покупке, а не в финале
    if (charmId === 'abyss-anchor' && win.p.corruption > 0) {
      const removed = Math.min(2, win.p.corruption);
      win.p.corruption -= removed;
      events.push({ t: 'CorruptionCleared', playerId: win.p.id, amount: removed });
    }

    const losers = scored.slice(1);
    if (losers.length > 0) {
      events.push({
        t: 'CharmContested', charmId, winner: win.p.id, losers: losers.map((l) => l.p.id),
      });
      for (const l of losers) {
        // Эссенция проигравших не списывалась вовсе; сверх возврата — 1 любого цвета
        l.p.essence[l.a.consolationColor] += 1;
        events.push({
          t: 'CharmRefunded', playerId: l.p.id, charmId,
          amount: l.total, consolation: l.a.consolationColor,
        });
      }
    }

    // Купленная карта немедленно заменяется новой из колоды текущей эпохи
    const idx = next.market.indexOf(charmId);
    const replacement = next.charmDecks[next.epoch].shift();
    if (replacement) next.market[idx] = replacement;
    else next.market.splice(idx, 1);
  }

  next.ready = [];
  next.pendingActions = {};
  next.version += 1;
  return { next, events };
}

/** Полный раунд от Пульса до конца Строительства. */
export function resolveRound(
  state: GameState,
  weaving: Record<string, WeavingAction>,
  building: Record<string, BuildingAction>,
): { next: GameState; events: GameEvent[] } {
  const pulse = resolvePulse(state);
  const w = resolveWeaving(pulse.next, weaving);
  const b = resolveBuilding(w.next, building);
  return { next: b.next, events: [...pulse.events, ...w.events, ...b.events] };
}

export { MARKET_SIZE };
