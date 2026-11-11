import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { vi } from 'vitest';

// The workspace installs with node-linker=hoisted, so several dependencies carry their
// own physical copy of React (react-dom, @cloudflare/kumo, react-router, testing-library,
// framer-motion, ...). In dev the Vite alias pins them to one instance, but Vitest's SSR
// loader runs externalized CJS deps through Node's require() — which ignores aliases —
// so each package loads its own React and Testing Library's act() can never flush the
// renderer's work. Redirect every require('react') to the copy react-dom itself uses.
const require_ = createRequire(import.meta.url);
const reactEntry = require_.resolve('react', {
  paths: [path.dirname(require_.resolve('react-dom/package.json'))],
});
const reactDir = path.dirname(reactEntry);
type ModuleInternals = { _resolveFilename: (request: string, ...args: unknown[]) => string };
const moduleInternals = Module as unknown as ModuleInternals;
const resolveFilename = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function patchedResolveFilename(request, ...args) {
  if (request === 'react') {
    return reactEntry;
  }
  if (request.startsWith('react/')) {
    return resolveFilename.call(this, path.join(reactDir, request.slice(6)), ...args);
  }
  return resolveFilename.call(this, request, ...args);
};

// Same redirect for `import 'react'` inside externalized ESM dependencies.
Module.register('./test-utils/react-resolve-hooks.mjs', import.meta.url);

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

// React only flushes a concurrent render inside act() with this flag on; Testing Library's
// own beforeAll can miss it depending on vitest's module init order.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
