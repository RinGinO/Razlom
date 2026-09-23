/**
 * Сообщения WebSocket. Каждое входящее валидируется zod-схемой на сервере:
 * заявка приходит из браузера, а браузер — не наш код.
 *
 * Отличия от §7 спецификации, вытекающие из принятых решений:
 *  - нет vote_replace и vote_open: ботов не будет, стол при уходе игрока ждёт;
 *  - добавлены create и join с именем — без них комнату не собрать.
 */
import { z } from 'zod';
import { NODE_ORDER, COLOR_ORDER } from '@razlom/core';
import type { GameEvent } from '@razlom/core';
import type { LobbyView, PlayerView, PublicGameView } from './view.js';

const nodeId = z.enum(NODE_ORDER as unknown as [string, ...string[]]);
const color = z.enum(COLOR_ORDER as unknown as [string, ...string[]]);
const count = z.number().int().min(0).max(64);

export const stacksSchema = z.record(nodeId, count);

/** Обмен эссенции: Родник, Алхимик, Тигель. */
export const exchangeSchema = z.object({
  charmId: z.string().min(1).max(64),
  from: color,
  to: color.optional(),
});

/** Нацеленная карта: Печать малая, Печать, Клеймо. */
export const targetedSchema = z.object({
  charmId: z.string().min(1).max(64),
  targetPlayerId: z.string().min(1).max(64),
  node: nodeId.optional(),
});

export const weavingSchema = z.object({
  stacks: stacksSchema,
  corruptionTaken: z.number().int().min(0).max(16),
  exchanges: z.array(exchangeSchema).max(4).default([]),
  targeted: z.array(targetedSchema).max(4).default([]),
});

export const buildingSchema = z.object({
  pick: z.object({
    charmId: z.string().min(1).max(64),
    overbid: z.number().int().min(0).max(64),
    pay: z.record(color, count),
    choice: color.optional(),
  }).nullable(),
  consolationColor: color,
  exchanges: z.array(exchangeSchema).max(4).default([]),
  druidColor: color.optional(),
});

export const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('create'),
    name: z.string().min(1).max(24),
    roundsPerEpoch: z.union([z.literal(4), z.literal(6), z.literal(8)]),
  }),
  z.object({ t: z.literal('join'), roomCode: z.string().min(4).max(12), name: z.string().min(1).max(24) }),
  z.object({ t: z.literal('rejoin'), roomCode: z.string().min(4).max(12), token: z.string().min(8).max(64) }),
  z.object({ t: z.literal('start') }),
  z.object({ t: z.literal('submit_draft'), archmage: z.string().min(2).max(24) }),
  z.object({ t: z.literal('submit_weaving'), action: weavingSchema }),
  z.object({ t: z.literal('submit_building'), action: buildingSchema }),
  z.object({ t: z.literal('unready') }),
  z.object({ t: z.literal('resync'), since: z.number().int().min(0) }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ServerMessage =
  | { t: 'joined'; roomCode: string; playerId: string; token: string }
  | { t: 'lobby'; view: LobbyView }
  | { t: 'snapshot'; view: PlayerView }
  | { t: 'patch'; events: GameEvent[]; version: number }
  | { t: 'ready_map'; ready: string[]; version: number }
  | { t: 'presence'; playerId: string; connected: boolean }
  /** стол ждёт только этого игрока — повод для заголовка вкладки и push (§11) */
  | { t: 'your_turn'; phase: 'weaving' | 'building'; round: number; version: number }
  | { t: 'public'; view: PublicGameView }
  | { t: 'error'; code: string; message: string };

export function parseClientMessage(raw: unknown):
  { ok: true; msg: ClientMessage } | { ok: false; code: string; message: string } {
  const parsed = clientMessageSchema.safeParse(raw);
  if (parsed.success) return { ok: true, msg: parsed.data };
  const first = parsed.error.issues[0];
  return {
    ok: false,
    code: 'bad-message',
    message: first ? `${first.path.join('.') || 'сообщение'}: ${first.message}` : 'не разобрано',
  };
}
