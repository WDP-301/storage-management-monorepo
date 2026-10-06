import { vi } from 'vitest';

// jsdom does not implement matchMedia; Kumo components (e.g. SidebarProvider) rely on it.
window.matchMedia ??= vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// jsdom lacks ResizeObserver; Kumo Tabs uses it for overflow handling.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver ??= ResizeObserverMock as unknown as typeof ResizeObserver;

// jsdom lacks the Web Animations API; Kumo scroll areas call getAnimations().
Element.prototype.getAnimations ??= () => [];
