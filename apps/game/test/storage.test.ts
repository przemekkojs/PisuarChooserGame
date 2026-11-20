import { describe, expect, it } from 'vitest';
import { createStorage, STORAGE_KEY } from '../src/storage';

const DEFAULT = { balance: 0, records: { easy: 0, medium: 0, hard: 0 } };

function memBackend(initial?: string | null) {
  const m = new Map<string, string>();
  if (initial != null) m.set(STORAGE_KEY, initial);
  return {
    get: async (k: string) => m.get(k) ?? null,
    set: async (k: string, v: string) => void m.set(k, v),
  };
}

describe('storage', () => {
  it('round-trips', async () => {
    const s = createStorage(memBackend());
    const data = { balance: 120, records: { easy: 3, medium: 2, hard: 1 } };
    await s.save(data);
    expect(await s.load()).toEqual(data);
  });
  it('null -> defaults', async () => {
    expect(await createStorage(memBackend(null)).load()).toEqual(DEFAULT);
  });
  it('broken JSON -> defaults', async () => {
    expect(await createStorage(memBackend('{broken')).load()).toEqual(DEFAULT);
  });
  it('wrong shape -> defaults', async () => {
    for (const raw of ['null', '5', '"x"', '[]']) {
      expect(await createStorage(memBackend(raw)).load()).toEqual(DEFAULT);
    }
  });
  it('negative balance -> 0', async () => {
    const raw = JSON.stringify({ balance: -5, records: { easy: 1, medium: 0, hard: 0 } });
    expect(await createStorage(memBackend(raw)).load()).toEqual({
      balance: 0,
      records: { easy: 1, medium: 0, hard: 0 },
    });
  });
  it('coerces NaN/negative/float/non-number values', async () => {
    const raw = JSON.stringify({
      balance: 10.9,
      records: { easy: -1, medium: 'x', hard: 4.7 },
    });
    expect(await createStorage(memBackend(raw)).load()).toEqual({
      balance: 10,
      records: { easy: 0, medium: 0, hard: 4 },
    });
    const nan = '{"balance": null, "records": null}';
    expect(await createStorage(memBackend(nan)).load()).toEqual(DEFAULT);
  });
  it('load swallows backend errors', async () => {
    const s = createStorage({
      get: async () => { throw new Error('boom'); },
      set: async () => {},
    });
    expect(await s.load()).toEqual(DEFAULT);
  });
  it('save never throws', async () => {
    const s = createStorage({
      get: async () => null,
      set: async () => { throw new Error('quota'); },
    });
    await expect(s.save(DEFAULT)).resolves.toBeUndefined();
  });
});
