import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface ListenerHandle {
  remove(): Promise<void> | void;
}

export interface LifecycleDeps {
  doc: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  isNative: () => boolean;
  addAppStateListener: (
    cb: (state: { isActive: boolean }) => void,
  ) => Promise<ListenerHandle>;
}

const defaultDeps = (): LifecycleDeps => ({
  doc: document,
  isNative: () => Capacitor.isNativePlatform(),
  addAppStateListener: (cb) => App.addListener('appStateChange', cb),
});

/**
 * Calls `onHidden` (at most once) when the app goes to the background: the
 * page becomes hidden (`visibilitychange`) or, on native, Capacitor reports
 * `appStateChange` with `isActive: false`. Both usually fire together on
 * Android, hence the once-guard. Returns an unsubscribe function that also
 * removes a native listener whose registration is still pending.
 */
export function onAppHidden(onHidden: () => void, deps: LifecycleDeps = defaultDeps()): () => void {
  let fired = false;
  let disposed = false;
  let handle: ListenerHandle | null = null;

  const fire = (): void => {
    if (fired || disposed) return;
    fired = true;
    onHidden();
  };
  const onVisibility = (): void => {
    if (deps.doc.visibilityState === 'hidden') fire();
  };

  deps.doc.addEventListener('visibilitychange', onVisibility);
  if (deps.isNative()) {
    deps
      .addAppStateListener(({ isActive }) => {
        if (!isActive) fire();
      })
      .then((h) => {
        if (disposed) void h.remove();
        else handle = h;
      })
      .catch(() => {
        // visibilitychange still covers backgrounding
      });
  }

  return () => {
    if (disposed) return;
    disposed = true;
    deps.doc.removeEventListener('visibilitychange', onVisibility);
    if (handle) void handle.remove();
    handle = null;
  };
}
