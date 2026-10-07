const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Force every `react` request to resolve from the monorepo root.
//
// `apps/web` declares react ^19.2.5 while Expo SDK 54 pins mobile to 19.1.0, so pnpm installs
// both. The hoisted root copy is 19.1.0, but `use-sync-external-store` (pulled in by
// @react-navigation/elements) gets a nested 19.3.0 — two Reacts, two hook dispatchers, and the
// app dies at render with "Cannot read property 'useRef' of null".
//
// Resolving from a path inside the root node_modules makes Node's lookup start there, so the
// nested copy is never reached. Covers subpaths (`react/jsx-runtime`) too.
const reactResolutionOrigin = path.resolve(monorepoRoot, 'node_modules', 'metro-react-origin.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest(
      { ...context, originModulePath: reactResolutionOrigin },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});
