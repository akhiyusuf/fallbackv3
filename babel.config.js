// FROZEN SCAFFOLD FILE — architect-owned. No feature module may edit.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
    plugins: [
      // react-native-worklets/reanimated must stay last.
      'react-native-worklets/plugin',
    ],
  };
};
