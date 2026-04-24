const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')
const sharedRoot = path.resolve(workspaceRoot, 'packages/shared')

const config = getDefaultConfig(projectRoot)

// Windows on this machine frequently blocks Metro's child-process workers with
// `spawn EPERM`. Keep bundling on a single worker and prefer worker threads.
config.maxWorkers = 1
config.transformer.unstable_workerThreads = true
config.watcher.unstable_workerThreads = true

// Let Metro see the monorepo root so workspace entry shims and sibling packages
// remain visible during Expo's monorepo resolution on Windows.
config.watchFolders = [workspaceRoot, sharedRoot]

// Resolve from both the local app and the workspace root. Some Expo-generated
// entry points resolve through the pnpm virtual store under the repo root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules/.pnpm/node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = false

// Resolve pnpm symlinks for workspace packages.
config.resolver.unstable_enableSymlinks = true

// Teach Metro to resolve the shared source package directly.
config.resolver.extraNodeModules = {
  '@meetmind/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
  '@react-native-masked-view/masked-view': path.resolve(projectRoot, 'shims/masked-view.js'),
}

// Ensure Tamagui and other modern packages resolve correctly.
config.resolver.sourceExts = [...new Set([...(config.resolver.sourceExts || []), 'mjs'])]

// Ignore temporary folders, Python virtualenvs, and pnpm placeholder symlinks
// that frequently trigger EACCES/EPERM while Metro crawls the workspace.
config.resolver.blockList =
  /(^|[\\/])\.tmp([\\/].*)?$|(^|[\\/])\.ignored_[^\\/]+$|(^|[\\/])packages[\\/]api[\\/](?:\.?venv[^\\/]*|venv)([\\/].*)?$|(^|[\\/])node_modules[\\/]\.pnpm[\\/]node_modules([\\/].*)?$/

module.exports = config
