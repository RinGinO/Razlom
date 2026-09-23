import { describe, expect, it } from 'vitest';
import { parseClientMessage } from '../src/messages.js';

const ok = (raw: unknown) => parseClientMessage(raw).ok;

describe('валидация входящих сообщений', () => {
  it('пропускает корректные', () => {
    expect(ok({ t: 'create', name: 'Аня', roundsPerEpoch: 6 })).toBe(true);
    expect(ok({ t: 'join', roomCode: 'КВРЗЛ', name: 'Борис' })).toBe(true);
    expect(ok({ t: 'start' })).toBe(true);
    expect(ok({ t: 'unready' })).toBe(true);
    expect(ok({ t: 'resync', since: 0 })).toBe(true);
    expect(ok({ t: 'submit_weaving', action: { stacks: { fire: 3 }, corruptionTaken: 0 } })).toBe(true);
  });

  it('отвергает неизвестный тип', () => {
    expect(ok({ t: 'hack' })).toBe(false);
    expect(ok({})).toBe(false);
    expect(ok(null)).toBe(false);
    expect(ok('строка')).toBe(false);
  });

  it('отвергает отрицательную и дробную ману', () => {
    expect(ok({ t: 'submit_weaving', action: { stacks: { fire: -1 }, corruptionTaken: 0 } })).toBe(false);
    expect(ok({ t: 'submit_weaving', action: { stacks: { fire: 1.5 }, corruptionTaken: 0 } })).toBe(false);
    expect(ok({ t: 'submit_weaving', action: { stacks: { fire: 1 }, corruptionTaken: -2 } })).toBe(false);
  });

  it('отвергает несуществующий узел', () => {
    expect(ok({ t: 'submit_weaving', action: { stacks: { lava: 3 }, corruptionTaken: 0 } })).toBe(false);
  });

  it('отвергает абсурдные величины — это защита от мусора, не от игрока', () => {
    expect(ok({ t: 'submit_weaving', action: { stacks: { fire: 1e9 }, corruptionTaken: 0 } })).toBe(false);
    expect(ok({ t: 'create', name: 'я'.repeat(200), roundsPerEpoch: 6 })).toBe(false);
    expect(ok({ t: 'create', name: '', roundsPerEpoch: 6 })).toBe(false);
    expect(ok({ t: 'create', name: 'Аня', roundsPerEpoch: 5 })).toBe(false);
  });

  it('сообщает, что именно не так', () => {
    const r = parseClientMessage({ t: 'join', roomCode: 'A', name: 'Аня' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/roomCode/);
  });

  it('лишние поля не ломают разбор', () => {
    expect(ok({ t: 'start', подпись: 'мусор' })).toBe(true);
  });
});
