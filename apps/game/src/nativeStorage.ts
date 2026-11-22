import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { localStorageBackend, type StorageBackend } from './storage';

/**
 * Native (Android) persistence via @capacitor/preferences. Deliberately thin:
 * errors propagate and are swallowed by `createStorage`'s guards.
 */
export function capacitorBackend(): StorageBackend {
  return {
    async get(key) {
      const { value } = await Preferences.get({ key });
      return value;
    },
    async set(key, value) {
      await Preferences.set({ key, value });
    },
  };
}

/** Preferences on a native platform, `localStorage` in the browser. */
export function defaultBackend(): StorageBackend {
  return Capacitor.isNativePlatform() ? capacitorBackend() : localStorageBackend();
}
