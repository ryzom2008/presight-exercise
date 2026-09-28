import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: query.includes('min-width: 62em'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
// JSDOM has no layout engine. Supply dimensions for the real virtualizer.
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get() {
    return this.classList.contains('directory-scroll') ? 600 : 156;
  },
});
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get() {
    return 700;
  },
});
HTMLElement.prototype.scrollTo = function (options: ScrollToOptions | number, y?: number) {
  const previous = this.scrollTop;
  this.scrollTop = typeof options === 'number' ? (y ?? 0) : (options.top ?? this.scrollTop);
  if (this.scrollTop !== previous) queueMicrotask(() => this.dispatchEvent(new Event('scroll')));
};

window.HTMLElement.prototype.scrollIntoView = vi.fn();
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

beforeEach(() => {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: query.includes('min-width: 62em'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});
