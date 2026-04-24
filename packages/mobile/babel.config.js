module.exports = function (api) {
  api.cache(true)
  const useTamaguiPlugin = process.env.MEETMIND_ENABLE_TAMAGUI_PLUGIN === '1'
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(useTamaguiPlugin
        ? [
            [
              '@tamagui/babel-plugin',
              {
                components: ['tamagui'],
                config: './tamagui.config.ts',
                logTimings: true,
                disableExtraction: process.env.NODE_ENV === 'development',
              },
            ],
          ]
        : []),
      // reanimated MUST be last
      'react-native-reanimated/plugin',
    ],
  }
}
