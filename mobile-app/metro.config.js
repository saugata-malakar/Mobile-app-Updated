const path = require('path');
const { getDefaultConfig } = require('metro-config');

const defaultConfig = getDefaultConfig.getDefaultValues(__dirname);

module.exports = {
  ...defaultConfig,
  projectRoot: path.resolve(__dirname),
  serializer: {
    ...defaultConfig.serializer,
    getPolyfills: () => require('react-native/rn-get-polyfills')(),
  },
  transformer: {
    ...defaultConfig.transformer,
    assetRegistryPath: 'react-native/Libraries/Image/AssetRegistry',
    assetPlugins: [],
  },
  resolver: {
    ...defaultConfig.resolver,
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json'],
  },
};
