import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

import { onAppHidden, type LifecycleDeps } from '../src/lifecycle';

function fakes(isNative: boolean) {
  const listeners = new Set<() => void>();
  let appCb: ((s: { isActive: boolean }) => void) | null = null;
  const remove = vi.fn();
  let resolveAdd!: () => void;
  const added = new Promise<void>((r) => (resolveAdd = r));
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_t: string, f: () => void) => void listeners.add(f),
    removeEventListener: (_t: string, f: () => void) => void listeners.delete(f),
  };
  const deps: LifecycleDeps = {
    doc: doc as unknown as LifecycleDeps['doc'],
    isNative: () => isNative,
    addAppStateListener: async (cb) => {
      appCb = cb;
      await added;
      return { remove };
    },
  };
  return {
    deps,
    remove,
    resolveAdd,
    hide: () => {
      doc.visibilityState = 'hidden';
      listeners.forEach((f) => f());
    },
    appState: (isActive: boolean) => appCb?.({ isActive }),
    listenerCount: () => listeners.size,
    hasAppListener: () => appCb !== null,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('onAppHidden', () => {
  it('fires on visibilitychange → hidden (browser, no native listener)', () => {
    const f = fakes(false);
    const cb = vi.fn();
    onAppHidden(cb, f.deps);
    expect(f.hasAppListener()).toBe(false);
    f.hide();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('fires on native appStateChange isActive=false, only once with both events', async () => {
    const f = fakes(true);
    const cb = vi.fn();
    onAppHidden(cb, f.deps);
    f.resolveAdd();
    await flush();
    f.appState(true);
    expect(cb).not.toHaveBeenCalled();
    f.appState(false);
    f.hide();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes both listeners', async () => {
    const f = fakes(true);
    const cb = vi.fn();
    const off = onAppHidden(cb, f.deps);
    f.resolveAdd();
    await flush();
    off();
    expect(f.listenerCount()).toBe(0);
    expect(f.remove).toHaveBeenCalledTimes(1);
    f.appState(false);
    expect(cb).not.toHaveBeenCalled();
  });

  it('unsubscribe before native registration resolves still removes the handle', async () => {
    const f = fakes(true);
    const off = onAppHidden(vi.fn(), f.deps);
    off();
    f.resolveAdd();
    await flush();
    expect(f.remove).toHaveBeenCalledTimes(1);
  });
});
