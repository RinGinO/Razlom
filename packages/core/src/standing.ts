/**
 * Предзаявки (§8). Условное распоряжение объявляется в фазе Плетения и
 * срабатывает после Раскрытия, до Резонанса.
 *
 * Порядок фиксирован:
 *   1. влияющие на размещение маны (перенос, обмен, добавление)
 *   2. влияющие на Порог
 *   3. влияющие на подсчёт мест
 * Внутри группы — по возрастанию номера места за столом.
 *
 * Толкование, которого в правилах нет буквально: условия проверяются один раз
 * по вскрытым стопкам, ДО применения любых распоряжений. Иначе перенос одного
 * игрока меняет условие другого, порядок начинает решать всё, и предсказать
 * исход становится нельзя — а вся ценность предзаявки в том, что игрок
 * угадывает чужую заготовку.
 */
import { canUse, has } from './effects.js';
import {
  NODE_ORDER, RuleError,
  type CharmId, type GameState, type NodeId, type PlayerState, type StandingOrder,
  type WeavingAction,
} from './types.js';

/**
 * Карты, активируемые предзаявкой. Иначе нельзя: обе реактивные («при
 * перегрузке»), а ставки одновременны — увидев результат и решив потом,
 * игрок сломал бы весь блеф. §8 существует ровно для этого случая.
 */
export const ACTIVATABLE: CharmId[] = ['lightning-rod', 'mute-node', 'harvest'];
/** Громоотвод и Немой узел действуют на конкретный узел, Жатва — на весь раунд. */
export const NEEDS_NODE: CharmId[] = ['lightning-rod', 'mute-node'];

export const MAX_STANDING_ORDERS = 3;
export const NECROMANCER_MANA = 2;

/** Соседний по порядку разрешения узел (§9, Иллюзионист). */
export function neighbours(node: NodeId): NodeId[] {
  const i = NODE_ORDER.indexOf(node);
  return [NODE_ORDER[i - 1], NODE_ORDER[i + 1]].filter((n): n is NodeId => n !== undefined);
}

export function validateStandingOrders(state: GameState, action: WeavingAction): void {
  const p = state.players.find((x) => x.id === action.playerId);
  if (!p) throw new RuleError('unknown-player', `нет игрока ${action.playerId}`);
  const orders = action.standingOrders;
  if (orders.length === 0) return;
  if (orders.length > MAX_STANDING_ORDERS) {
    throw new RuleError('too-many-orders', `предзаявок не больше ${MAX_STANDING_ORDERS}`);
  }
  const ids = new Set<string>();
  const active = new Set(state.nodes.filter((n) => n.active).map((n) => n.id));

  for (const o of orders) {
    if (ids.has(o.id)) throw new RuleError('duplicate-order', 'предзаявки с одинаковым номером');
    ids.add(o.id);

    if ('node' in o.trigger && !active.has(o.trigger.node)) {
      throw new RuleError('inactive-node', `условие ссылается на узел ${o.trigger.node}, которого нет в игре`);
    }

    switch (o.effect.type) {
      case 'move-stack': {
        if (!has(p, 'illusionist')) {
          throw new RuleError('no-ability', 'переносить стопку умеет Иллюзионист');
        }
        if (!active.has(o.effect.from) || !active.has(o.effect.to)) {
          throw new RuleError('inactive-node', 'перенос ссылается на узел вне игры');
        }
        if (!neighbours(o.effect.from).includes(o.effect.to)) {
          throw new RuleError('not-adjacent', 'Иллюзионист переносит только на соседний по порядку узел');
        }
        break;
      }
      case 'swap-stacks': {
        if (!has(p, 'mirror')) throw new RuleError('no-ability', 'менять стопки местами позволяет Зеркало');
        if (!active.has(o.effect.a) || !active.has(o.effect.b)) {
          throw new RuleError('inactive-node', 'обмен ссылается на узел вне игры');
        }
        if (o.effect.a === o.effect.b) throw new RuleError('same-node', 'обмен требует двух разных узлов');
        break;
      }
      case 'add-mana': {
        if (!has(p, 'necromancer')) throw new RuleError('no-ability', 'добавлять ману умеет Некромант');
        if (!active.has(o.effect.node)) throw new RuleError('inactive-node', 'узел вне игры');
        if (o.effect.amount !== NECROMANCER_MANA || o.effect.costCorruption !== 1) {
          throw new RuleError('bad-order', 'Некромант добавляет ровно 2 маны ценой 1 Скверны');
        }
        break;
      }
      case 'use-charm': {
        const id = o.effect.charmId;
        if (!ACTIVATABLE.includes(id)) {
          throw new RuleError('not-activatable', `${id} через предзаявку не активируется`);
        }
        if (!has(p, id)) throw new RuleError('no-ability', `${id} у вас нет`);
        if (!canUse(p, id)) throw new RuleError('no-uses-left', `${id} в этом окне уже сработала`);
        if (NEEDS_NODE.includes(id)) {
          const target = o.effect.target;
          if (typeof target !== 'string' || !active.has(target as NodeId)) {
            throw new RuleError('bad-target', `${id} требует активный узел`);
          }
        }
        break;
      }
      default:
        throw new RuleError('bad-order', 'неизвестное распоряжение');
    }
  }
}

type Stacks = Record<string, Partial<Record<NodeId, number>>>;

function totalOn(stacks: Stacks, node: NodeId): number {
  return Object.values(stacks).reduce((s, byNode) => s + (byNode[node] ?? 0), 0);
}

function leaderOn(stacks: Stacks, node: NodeId): string | null {
  let best = 0;
  let leader: string | null = null;
  let tie = false;
  for (const [id, byNode] of Object.entries(stacks)) {
    const v = byNode[node] ?? 0;
    if (v > best) { best = v; leader = id; tie = false; }
    else if (v === best && v > 0) tie = true;
  }
  return tie ? null : leader;
}

/** Сработало ли условие — по вскрытым стопкам, до любых распоряжений. */
export function triggerFires(
  order: StandingOrder, playerId: string, revealed: Stacks, threshold: number,
): boolean {
  const t = order.trigger;
  if (t.type === 'always') return true;
  if (t.type === 'overload') return totalOn(revealed, t.node) > threshold;
  if (t.type === 'no-overload') return totalOn(revealed, t.node) <= threshold;
  if (t.type === 'losing') {
    const mine = revealed[playerId]?.[t.node] ?? 0;
    if (mine <= 0) return true;                    // не стоишь — значит не первый
    return leaderOn(revealed, t.node) !== playerId;
  }
  return false;
}

const GROUP: Record<StandingOrder['effect']['type'], 1 | 2 | 3> = {
  'move-stack': 1, 'swap-stacks': 1, 'add-mana': 1, 'use-charm': 3,
};

/** Активация карты через предзаявку: Громоотвод, Немой узел, Жатва. */
export interface Activation {
  playerId: string;
  charmId: CharmId;
  node?: NodeId;
}

export interface StandingResult {
  stacks: Stacks;
  corruption: Record<string, number>;
  fired: Array<{ playerId: string; orderId: string }>;
  activated: Activation[];
}

/**
 * Применить все сработавшие распоряжения. Возвращает новую раскладку стопок
 * и добавленную Скверну; исходные данные не мутируются.
 */
export function applyStandingOrders(
  players: readonly PlayerState[],
  actions: Record<string, WeavingAction>,
  threshold: number,
): StandingResult {
  const revealed: Stacks = {};
  for (const p of players) revealed[p.id] = { ...(actions[p.id]?.stacks ?? {}) };

  const working: Stacks = structuredClone(revealed);
  const corruption: Record<string, number> = {};
  const fired: StandingResult['fired'] = [];
  const activated: Activation[] = [];

  const bySeat = [...players].sort((a, b) => a.seat - b.seat);

  for (const group of [1, 2, 3] as const) {
    for (const p of bySeat) {
      for (const o of actions[p.id]?.standingOrders ?? []) {
        if (GROUP[o.effect.type] !== group) continue;
        if (!triggerFires(o, p.id, revealed, threshold)) continue;

        const mine = working[p.id] as Partial<Record<NodeId, number>>;
        switch (o.effect.type) {
          case 'move-stack': {
            const amount = mine[o.effect.from] ?? 0;
            if (amount <= 0) continue;             // нечего переносить — не срабатывает
            mine[o.effect.from] = 0;
            mine[o.effect.to] = (mine[o.effect.to] ?? 0) + amount;
            break;
          }
          case 'swap-stacks': {
            const a = mine[o.effect.a] ?? 0;
            const b = mine[o.effect.b] ?? 0;
            if (a === 0 && b === 0) continue;
            mine[o.effect.a] = b;
            mine[o.effect.b] = a;
            break;
          }
          case 'add-mana': {
            // Скверна и есть источник маны, как при черпании из бездны
            mine[o.effect.node] = (mine[o.effect.node] ?? 0) + o.effect.amount;
            corruption[p.id] = (corruption[p.id] ?? 0) + o.effect.costCorruption;
            break;
          }
          case 'use-charm': {
            const node = NEEDS_NODE.includes(o.effect.charmId)
              ? (o.effect.target as NodeId) : undefined;
            activated.push(node
              ? { playerId: p.id, charmId: o.effect.charmId, node }
              : { playerId: p.id, charmId: o.effect.charmId });
            break;
          }
          default:
            continue;
        }
        fired.push({ playerId: p.id, orderId: o.id });
      }
    }
  }

  return { stacks: working, corruption, fired, activated };
}
