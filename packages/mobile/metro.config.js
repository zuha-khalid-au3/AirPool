const path = require('path');
const { resolve } = require('metro-resolver');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Yarn workspaces: resolve packages hoisted to the repo root
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Keep a single copy of navigation + React across the monorepo
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  '@react-navigation/native': path.resolve(workspaceRoot, 'node_modules/@react-navigation/native'),
  '@react-navigation/core': path.resolve(workspaceRoot, 'node_modules/@react-navigation/core'),
};

// react-native-webrtc imports "event-target-shim/index" but v6 only exports "."
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'event-target-shim/index') {
    return resolve(context, 'event-target-shim', platform);
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return resolve(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
