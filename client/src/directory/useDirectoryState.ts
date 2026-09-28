import { useMemo, useSyncExternalStore } from 'react';
import { readState, stateParams, type DirectoryState } from './state';

const event = 'directory:navigate';
const subscribe = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  window.addEventListener(event, notify);
  return () => {
    window.removeEventListener('popstate', notify);
    window.removeEventListener(event, notify);
  };
};

export const useDirectoryState = () => {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  const state = useMemo(() => readState(search), [search]);
  const update = (patch: Partial<DirectoryState>, replace = false) => {
    const next = { ...readState(window.location.search), ...patch };
    const url = new URL(window.location.href);
    url.search = stateParams(next).toString();
    if (url.href === window.location.href) return;
    window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
    window.dispatchEvent(new Event(event));
  };
  return { state, update };
};
