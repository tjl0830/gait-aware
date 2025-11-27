const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .bin files as asset extensions so they can be bundled
config.resolver.assetExts.push('bin');

// Add MediaPipe file extensions for offline support
// .jslib = JavaScript library files (renamed from .js to avoid Metro transpilation)
config.resolver.assetExts.push('wasm', 'tflite', 'data', 'jslib', 'binarypb');

module.exports = config;
