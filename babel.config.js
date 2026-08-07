module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // NOTE: Do NOT add react-native-worklets/plugin or react-native-reanimated/plugin here.
    // babel-preset-expo (Expo SDK 57) already includes them automatically.
    // Adding them again causes a "Duplicate plugin" error that crashes Metro.
  };
};
