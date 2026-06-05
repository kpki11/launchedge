module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated/plugin removed: Reanimated 4.x does NOT use a Babel plugin.
    // Including it causes the TurboModule installTurboModule argument-count crash.
  };
};
