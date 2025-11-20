const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .bin files as asset extensions so they can be bundled
config.resolver.assetExts.push('bin');

module.exports = config;
