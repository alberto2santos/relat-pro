import { describe, expect, it } from 'vitest';
import { localDateISO } from './dates';

const pad = (n: number) => String(n).padStart(2, '0');

describe('localDateISO', () => {
  it('usa o dia do fuso local, não o de UTC', () => {
    for (const data of [new Date(2026, 10, 15, 23, 30), new Date(2026, 10, 15, 0, 5), new Date(2026, 0, 1, 21, 0)]) {
      expect(localDateISO(data)).toBe(`${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`);
    }
  });
});
