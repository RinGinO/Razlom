/**
 * Доменная модель «Разлома».
 *
 * Ядро не знает ни о сети, ни о базе. Никакого Math.random: всё случайное
 * идёт через сериализуемый RngState, иначе партия не воспроизведётся из лога.
 *
 * Отличия от спецификации разработки, принятые сознательно:
 *  - `ready` и `pendingActions` — массив и объект, а не Set и Map: они уходят
 *    в JSONB как есть. Спека сама предупреждает про эту мину.
 *  - нет `isBot`, `allowBots` и `eliminated`: ботов в игре не будет, а стол
 *    при уходе игрока просто ждёт.
 *  - у BuildingAction появилось поле `pay`: цена платится эссенцией любых
 *    цветов, а какими именно — решает игрок, и это влияет на Схождение.
 *    В спецификации поля не было.
 */

export type NodeId = 'fire' | 'water' | 'earth' | 'air' | 'void';
export type Color = 'red' | 'blue' | 'green' | 'white' | 'purple';

/** Порядок фиксирован: некоторые эффекты срабатывают в момент разрешения узла. */
export const NODE_ORDER: readonly NodeId[] = ['fire', 'water', 'earth', 'air', 'void'] as const;

export const NODE_COLOR: Record<NodeId, Color> = {
  fire: 'red', water: 'blue', earth: 'green', air: 'white', void: 'purple',
};

export const COLOR_ORDER: readonly Color[] = ['red', 'blue', 'green', 'white', 'purple'] as const;

export type Epoch = 1 | 2 | 3;

export type Phase =
  | 'draft' | 'pulse' | 'weaving' | 'reveal'
  | 'resonance' | 'upkeep' | 'building' | 'convergence' | 'finished';

export type Essence = Record<Color, number>;

export type ArchmageId =
  | 'pyromancer' | 'seer' | 'necromancer' | 'illusionist'
  | 'keeper' | 'alchemist' | 'druid' | 'voidlord';

export type CharmId = string;

/** Обмен эссенции: Родник, Алхимик, Тигель. */
export interface Exchange {
  charmId: CharmId;
  /** какой цвет тратим */
  from: Color;
  /** во что превращаем; у Родника цели нет — он даёт ману */
  to?: Color;
}

/** Нацеленная карта: Печать малая, Печать, Клеймо. */
export interface TargetedUse {
  charmId: CharmId;
  targetPlayerId: string;
  /** печатям нужен узел, Клейму — нет */
  node?: NodeId;
}

export interface PlayerState {
  id: string;
  seat: number;              // 0..7 — решает ничьи последним аргументом
  archmage: ArchmageId | null;
  mana: number;              // запас: выложенное на узлы здесь уже не лежит
  manaCap: number;
  essence: Essence;
  corruption: number;
  charms: CharmId[];
  /** сколько раз карта уже сработала в текущем окне («раз в раунд» / «раз за эпоху») */
  charmUses: Record<CharmId, number>;
  /** цвет, выбранный при покупке: Столп, Друид-Чара */
  charmChoices: Record<CharmId, Color>;
  /** универсальный цвет Архимага-Друида, объявляется в конце Эпохи I */
  druidColor: Color | null;
  scoredVP: number;          // зафиксировано на Схождениях
  connected: boolean;
}

export interface NodeState {
  id: NodeId;
  active: boolean;           // false после выгорания в Эпохе III
  empowered: boolean;
}

/** Условное распоряжение. Типы объявлены; разрешение — Этап 6. */
export interface StandingOrder {
  id: string;
  trigger:
    | { type: 'overload'; node: NodeId }
    | { type: 'no-overload'; node: NodeId }
    | { type: 'losing'; node: NodeId }
    | { type: 'always' };
  effect:
    | { type: 'move-stack'; from: NodeId; to: NodeId }
    | { type: 'swap-stacks'; a: NodeId; b: NodeId }
    | { type: 'add-mana'; node: NodeId; amount: number; costCorruption: number }
    | { type: 'use-charm'; charmId: CharmId; target?: NodeId | string };
}

export interface WeavingAction {
  kind: 'weaving';
  playerId: string;
  stacks: Partial<Record<NodeId, number>>;
  corruptionTaken: number;
  standingOrders: StandingOrder[];
  /** обмены, доступные до ставки: Родник даёт ману, Алхимик перекладывает эссенцию */
  exchanges: Exchange[];
  /** нацеленные карты; цель скрыта до Раскрытия, как и всё в Плетении */
  targeted: TargetedUse[];
}

export interface BuildingAction {
  kind: 'building';
  playerId: string;
  /** null — пас */
  pick: {
    charmId: CharmId;
    overbid: number;
    /** чем платим: сумма обязана равняться цене плюс надбавке */
    pay: Partial<Record<Color, number>>;
    /** цвет, который требует сама карта: Столп, Друид */
    choice?: Color;
  } | null;
  /** цвет утешительной эссенции при проигрыше в конфликте */
  consolationColor: Color;
  /** обмен «в момент подсчёта»: Тигель. Строительство — последняя фаза перед Схождением */
  exchanges: Exchange[];
  /** объявление универсального цвета Архимагом-Друидом в конце Эпохи I */
  druidColor?: Color;
}

export type PlayerAction = WeavingAction | BuildingAction;

export interface PulseCard {
  id: string;
  thresholdModifier: number;   // −2..+2
  empowered: NodeId[];         // один или два узла
}

export interface GameConfig {
  roundsPerEpoch: 4 | 6 | 8;
  playerCount: number;
}

export interface RoundRecord {
  round: number;
  epoch: Epoch;
  threshold: number;
  empowered: NodeId[];
  /** публично после Раскрытия: узел → игрок → мана */
  stacks: Record<string, Record<string, number>>;
  events: GameEvent[];
}

export interface RngState { s: number }

export interface GameState {
  version: number;
  roomId: string;
  config: GameConfig;
  epoch: Epoch;
  round: number;             // сквозной, 1..roundsPerEpoch*3
  roundInEpoch: number;
  phase: Phase;
  players: PlayerState[];
  nodes: NodeState[];
  threshold: number;
  empowered: NodeId[];
  market: CharmId[];
  charmDecks: Record<Epoch, CharmId[]>;
  pulseDeck: PulseCard[];
  ready: string[];
  pendingActions: Record<string, PlayerAction>;
  history: RoundRecord[];
  rng: RngState;
}

export type GameEvent =
  | { t: 'NodeOverloaded'; node: NodeId; total: number; threshold: number; players: string[] }
  | { t: 'NodeBurned'; node: NodeId }
  | { t: 'StandingOrderFired'; playerId: string; orderId: string }
  | { t: 'NodeResolved'; node: NodeId; total: number; first: string | null; seconds: string[] }
  | { t: 'EssenceGained'; playerId: string; color: Color; amount: number; reason: 'first' | 'second' }
  | { t: 'CorruptionTaken'; playerId: string; amount: number; reason: 'abyss' | 'overload' }
  | { t: 'CorruptionCleared'; playerId: string; amount: number }
  | { t: 'EssenceExchanged'; playerId: string; charmId: CharmId; from: Color; to: Color | null; manaGained: number }
  | { t: 'NodeSealed'; playerId: string; targetPlayerId: string; node: NodeId; voided: number }
  | { t: 'Branded'; playerId: string; targetPlayerId: string; bonus: number }
  | { t: 'OverloadIgnored'; playerId: string; node: NodeId; charmId: CharmId }
  | { t: 'OverloadCancelled'; playerId: string; node: NodeId }
  | { t: 'HarvestDoubled'; playerId: string; amount: number }
  | { t: 'ColorDeclared'; playerId: string; charmId: CharmId; color: Color }
  | { t: 'ManaSpent'; playerId: string; node: NodeId; amount: number }
  | { t: 'ManaReturned'; playerId: string; amount: number }
  | { t: 'IncomeGained'; playerId: string; amount: number; burned: number }
  | { t: 'CharmBought'; playerId: string; charmId: CharmId; paid: number }
  | { t: 'CharmContested'; charmId: CharmId; winner: string; losers: string[] }
  | { t: 'CharmRefunded'; playerId: string; charmId: CharmId; amount: number; consolation: Color }
  | { t: 'ConvergenceScored'; playerId: string; color: Color; points: number }
  | { t: 'EpochAdvanced'; epoch: Epoch; nodesAdded: NodeId[] }
  | { t: 'GameFinished'; reason: 'rounds' | 'nodes-exhausted' };

export class RuleError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'RuleError';
  }
}
