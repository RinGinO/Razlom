import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('../src/', import.meta.url).pathname;
const files = readdirSync(SRC).filter((f: string) => f.endsWith('.ts'));

/** Проверяем код, а не комментарии: иначе тест ловит слова из пояснений. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function source(f: string): string {
  return stripComments(readFileSync(join(SRC, f), 'utf8'));
}

describe('границы пакета', () => {
  it('в src есть файлы, иначе проверка бессмысленна', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('core не тянет ничего извне себя', () => {
    for (const f of files) {
      const code = source(f);
      const imports = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1] as string);
      for (const spec of imports) {
        expect(spec.startsWith('./') || spec.startsWith('node:'), `${f} импортирует ${spec}`).toBe(true);
      }
    }
  });

  it('в ядре нет Math.random — партия обязана воспроизводиться из лога', () => {
    for (const f of files) {
      const code = source(f);
      expect(code.includes('Math.random'), `${f} содержит Math.random`).toBe(false);
    }
  });

  it('в ядре нет обращений ко времени', () => {
    for (const f of files) {
      const code = source(f);
      expect(/Date\.now|new Date\(/.test(code), `${f} обращается ко времени`).toBe(false);
    }
  });
});
