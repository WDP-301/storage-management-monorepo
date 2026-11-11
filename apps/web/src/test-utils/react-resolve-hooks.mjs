// Node ESM customization hooks for the Vitest environment.
//
// The workspace installs with node-linker=hoisted, which leaves a physical copy of
// React inside many packages (@phosphor-icons/react, @cloudflare/kumo, @base-ui/*,
// framer-motion, react-router, ...). Externalized ESM deps resolve `import 'react'`
// through Node's own resolver — past Vite's alias — so each package can load a
// different React instance than the renderer and act() can never flush work.
// Redirect every `react` specifier to the copy react-dom itself uses. test-setup.ts
// installs the equivalent patch for CJS require() calls.
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require_ = createRequire(import.meta.url);
const reactDomDir = path.dirname(require_.resolve('react-dom/package.json'));
const reactURL = (specifier) =>
  pathToFileURL(require_.resolve(specifier, { paths: [reactDomDir] })).href;

export function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' || specifier.startsWith('react/')) {
    return { url: reactURL(specifier), shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
