const path = require('path');
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

module.exports = withNativeWind(config, { input: './global.css' });
