/**
 * Пересказ раунда для панели истории.
 *
 * В состоянии лежат сырые события — их удобно проигрывать, но неудобно читать.
 * Игрок, вернувшийся через сутки, должен понять расклад без напряжения памяти
 * (§11), поэтому история отдаётся уже разобранной по узлам.
 *
 * Скрытого здесь нет по построению: стопки после Раскрытия публичны (§8),
 * а из предзаявок в запись попадают только сработавшие.
 */
import type {
  CharmId, Color, Epoch, GameEvent, NodeId, RoundRecord,
} from '@razlom/core';

export interface NodeDigest {
  node: NodeId;
  total: number;
  overloaded: boolean;
  burned: boolean;
  first: string | null;
  seconds: string[];
  stacks: Array<{ playerId: string; mana: number }>;
  gains: Array<{ playerId: string; color: Color; amount: number; reason: 'first' | 'second' }>;
}

export interface RoundDigest {
  round: number;
  epoch: Epoch;
  threshold: number;
  empowered: NodeId[];
  nodes: NodeDigest[];
  corruption: Array<{ playerId: string; amount: number; reason: 'abyss' | 'overload' }>;
  cleared: Array<{ playerId: string; amount: number }>;
  purchases: Array<{ playerId: string; charmId: CharmId; paid: number }>;
  standingOrders: Array<{ playerId: string; orderId: string }>;
  convergence: Array<{ playerId: string; color: Color; points: number }>;
}

const is = <T extends GameEvent['t']>(t: T) =>
  (e: GameEvent): e is Extract<GameEvent, { t: T }> => e.t === t;

export function buildDigest(record: RoundRecord): RoundDigest {
  const { events } = record;
  const nodes: NodeDigest[] = [];

  const touched = new Set<NodeId>();
  for (const e of events) {
    if (e.t === 'NodeResolved' || e.t === 'NodeOverloaded') touched.add(e.node);
  }

  for (const node of touched) {
    const overload = events.filter(is('NodeOverloaded')).find((e) => e.node === node);
    const resolved = events.filter(is('NodeResolved')).find((e) => e.node === node);
    const raw = record.stacks[node] ?? {};
    nodes.push({
      node,
      total: overload?.total ?? resolved?.total ?? 0,
      overloaded: Boolean(overload),
      burned: events.filter(is('NodeBurned')).some((e) => e.node === node),
      first: resolved?.first ?? null,
      seconds: resolved?.seconds ?? [],
      stacks: Object.entries(raw)
        .map(([playerId, mana]) => ({ playerId, mana }))
        .sort((a, b) => b.mana - a.mana),
      gains: [],
    });
  }

  // Начисления эссенции привязываем к узлу по цвету: цвет узла с ним однозначен
  const byColor = new Map<Color, NodeDigest>();
  for (const d of nodes) byColor.set(nodeColor(d.node), d);
  for (const e of events.filter(is('EssenceGained'))) {
    const target = byColor.get(e.color);
    if (target) target.gains.push({ playerId: e.playerId, color: e.color, amount: e.amount, reason: e.reason });
  }

  // Порядок узлов — тот, в котором они разрешаются
  nodes.sort((a, b) => ORDER.indexOf(a.node) - ORDER.indexOf(b.node));

  return {
    round: record.round,
    epoch: record.epoch,
    threshold: record.threshold,
    empowered: record.empowered.slice(),
    nodes,
    corruption: events.filter(is('CorruptionTaken'))
      .map((e) => ({ playerId: e.playerId, amount: e.amount, reason: e.reason })),
    cleared: events.filter(is('CorruptionCleared'))
      .map((e) => ({ playerId: e.playerId, amount: e.amount })),
    purchases: events.filter(is('CharmBought'))
      .map((e) => ({ playerId: e.playerId, charmId: e.charmId, paid: e.paid })),
    standingOrders: events.filter(is('StandingOrderFired'))
      .map((e) => ({ playerId: e.playerId, orderId: e.orderId })),
    convergence: events.filter(is('ConvergenceScored'))
      .map((e) => ({ playerId: e.playerId, color: e.color, points: e.points })),
  };
}

const ORDER: NodeId[] = ['fire', 'water', 'earth', 'air', 'void'];
const COLOR: Record<NodeId, Color> = {
  fire: 'red', water: 'blue', earth: 'green', air: 'white', void: 'purple',
};
function nodeColor(n: NodeId): Color { return COLOR[n]; }

export function buildHistory(records: readonly RoundRecord[]): RoundDigest[] {
  return records.map(buildDigest);
}
