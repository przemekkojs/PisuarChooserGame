import type { Difficulty } from '@pisuar/core';

export const STORAGE_KEY = 'pisuar-chooser-save-v1';

export interface Saved {
  balance: number;
  records: Record<Difficulty, number>;
}

export interface Storage {
  load(): Promise<Saved>;
  save(s: Saved): Promise<void>;
}

export interface StorageBackend {
  get(k: string): Promise<string | null>;
  set(k: string, v: string): Promise<void>;
}

const nonNegInt = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

function defaults(): Saved {
  return { balance: 0, records: { easy: 0, medium: 0, hard: 0 } };
}

function coerce(raw: unknown): Saved {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return defaults();
  const o = raw as Record<string, unknown>;
  const r =
    typeof o.records === 'object' && o.records !== null
      ? (o.records as Record<string, unknown>)
      : {};
  return {
    balance: nonNegInt(o.balance),
    records: { easy: nonNegInt(r.easy), medium: nonNegInt(r.medium), hard: nonNegInt(r.hard) },
  };
}

export function createStorage(backend: StorageBackend): Storage {
  return {
    async load() {
      try {
        const raw = await backend.get(STORAGE_KEY);
        if (raw === null) return defaults();
        return coerce(JSON.parse(raw));
      } catch {
        return defaults();
      }
    },
    async save(s) {
      try {
        await backend.set(STORAGE_KEY, JSON.stringify(s));
      } catch {
        // persistence is best-effort; never break the game
      }
    },
  };
}

export function localStorageBackend(): StorageBackend {
  return {
    async get(k) {
      try {
        return globalThis.localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    async set(k, v) {
      try {
        globalThis.localStorage.setItem(k, v);
      } catch {
        // ignore (private mode / quota)
      }
    },
  };
}
