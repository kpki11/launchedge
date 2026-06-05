// metro.config.js
// Required for SheetJS (xlsx) to work in React Native / Expo.
// xlsx uses Node.js built-ins (stream, crypto, etc.) that Metro cannot resolve
// by default in the React Native bundle. Without this config, `import * as XLSX
// from 'xlsx'` silently produces an empty object at runtime, making all XLSX
// parsing calls fail with no useful error message.
//
// This config provides empty shims for Node modules that xlsx references but
// does not actually use at runtime in the browser/RN context.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Provide empty shims for Node built-ins that xlsx imports but doesn't use in RN
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: require.resolve('stream-browserify'),
  crypto: require.resolve('crypto-browserify'),
  // The xlsx package.json marks these as false for browser, but Metro doesn't
  // read package.json browser field by default:
  buffer: require.resolve('buffer/'),
  process: require.resolve('process/browser'),
  fs: false,
  path: false,
};

module.exports = config;
