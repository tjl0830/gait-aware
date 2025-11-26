const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .bin files as asset extensions so they can be bundled
config.resolver.assetExts.push('bin');

// Add MediaPipe file extensions for offline support
// Note: Adding 'js' here might cause Metro to bundle them as-is instead of transpiling
config.resolver.assetExts.push('wasm', 'tflite', 'data');

module.exports = config;
