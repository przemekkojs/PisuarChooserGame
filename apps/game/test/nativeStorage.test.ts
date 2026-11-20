import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: vi.fn(), set: vi.fn() },
}));

import { Preferences } from '@capacitor/preferences';
import { capacitorBackend } from '../src/nativeStorage';
import { createStorage, STORAGE_KEY } from '../src/storage';

const DEFAULT = { balance: 0, records: { easy: 0, medium: 0, hard: 0 } };
const get = vi.mocked(Preferences.get);
const set = vi.mocked(Preferences.set);

describe('capacitorBackend', () => {
  beforeEach(() => {
    get.mockReset();
    set.mockReset();
  });

  it('get passes the key and returns the value', async () => {
    get.mockResolvedValue({ value: 'abc' });
    expect(await capacitorBackend().get('k1')).toBe('abc');
    expect(get).toHaveBeenCalledWith({ key: 'k1' });
  });

  it('get returns null for a missing key', async () => {
    get.mockResolvedValue({ value: null });
    expect(await capacitorBackend().get('k1')).toBeNull();
  });

  it('set passes key and value', async () => {
    set.mockResolvedValue(undefined);
    await capacitorBackend().set('k1', 'v1');
    expect(set).toHaveBeenCalledWith({ key: 'k1', value: 'v1' });
  });

  it('round-trips through createStorage', async () => {
    const m = new Map<string, string>();
    set.mockImplementation(async ({ key, value }) => void m.set(key, value));
    get.mockImplementation(async ({ key }) => ({ value: m.get(key) ?? null }));
    const s = createStorage(capacitorBackend());
    const data = { balance: 7, records: { easy: 2, medium: 1, hard: 0 } };
    await s.save(data);
    expect(m.has(STORAGE_KEY)).toBe(true);
    expect(await s.load()).toEqual(data);
  });

  it('createStorage swallows Preferences errors', async () => {
    get.mockRejectedValue(new Error('native boom'));
    set.mockRejectedValue(new Error('native boom'));
    const s = createStorage(capacitorBackend());
    expect(await s.load()).toEqual(DEFAULT);
    await expect(s.save(DEFAULT)).resolves.toBeUndefined();
  });
});
