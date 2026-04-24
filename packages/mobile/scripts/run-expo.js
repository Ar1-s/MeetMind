const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const { ensureRuntimeLinks } = require('./ensure-runtime-links')

const mobileRoot = path.resolve(__dirname, '..')
const metroHook = path.join(__dirname, 'expo-metro-hook.js')
const workspaceRoot = path.resolve(mobileRoot, '..', '..')
const virtualStoreRoot = path.join(workspaceRoot, 'node_modules', '.pnpm')
const mobileNodeModules = path.join(mobileRoot, 'node_modules')
const metroPackageNodePaths = fs.existsSync(virtualStoreRoot)
  ? fs
      .readdirSync(virtualStoreRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith('metro'))
      .map(entry => path.join(virtualStoreRoot, entry.name, 'node_modules'))
      .filter(dir => fs.existsSync(dir))
  : []
const existingNodePath = process.env.NODE_PATH

for (const result of ensureRuntimeLinks()) {
  if (result.status === 'error') {
    console.warn(`[runtime-link] ${result.pkgName}: ${result.error.message}`)
  }
}

const env = {
  ...process.env,
  EXPO_OFFLINE: process.env.EXPO_OFFLINE || '1',
  MEETMIND_MOBILE_ROOT: mobileRoot,
  MEETMIND_WORKSPACE_ROOT: workspaceRoot,
  NODE_PATH: [
    mobileNodeModules,
    path.join(workspaceRoot, 'node_modules', '.pnpm', 'node_modules'),
    path.join(workspaceRoot, 'node_modules'),
    ...metroPackageNodePaths,
    existingNodePath,
  ]
    .filter(Boolean)
    .join(path.delimiter),
}

// Android Studio emulator must access the host machine through 10.0.2.2.
// Without this, Expo frequently bakes 127.0.0.1 into the manifest, which
// causes Expo Go to fail with "Failed to download remote update".
if (!env.REACT_NATIVE_PACKAGER_HOSTNAME) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = '10.0.2.2'
}

for (const proxyKey of [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
]) {
  delete env[proxyKey]
}

const expoCli = require.resolve('expo/bin/cli', { paths: [mobileRoot] })
const args = process.argv.slice(2)

function removeIfExists(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return
  }

  fs.rmSync(targetPath, { recursive: true, force: true })
}

function clearStaleAndroidNativeBuildArtifacts() {
  const cleanupTargets = [path.join(mobileRoot, 'android', 'app', '.cxx')]

  try {
    const expoAvPackageJson = require.resolve('expo-av/package.json', { paths: [mobileRoot] })
    const expoAvRoot = path.dirname(expoAvPackageJson)
    cleanupTargets.push(path.join(expoAvRoot, 'android', '.cxx'))
    cleanupTargets.push(path.join(expoAvRoot, 'android', 'build'))
  } catch (error) {
    console.warn(`[android-cleanup] expo-av: ${error.message}`)
  }

  for (const cleanupTarget of cleanupTargets) {
    try {
      removeIfExists(cleanupTarget)
    } catch (error) {
      console.warn(`[android-cleanup] ${cleanupTarget}: ${error.message}`)
    }
  }
}

const nodeCandidates = [
  process.env.MEETMIND_EXPO_NODE,
  'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Microsoft\\VisualStudio\\NodeJs\\node.exe',
  'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Microsoft\\VisualStudio\\NodeJs\\win-x86\\node.exe',
  process.execPath,
].filter(candidate => candidate && fs.existsSync(candidate))

const expoNode = nodeCandidates[0] || process.execPath

if (expoNode !== process.execPath) {
  console.log(`Using Expo Node runtime: ${expoNode}`)
}

if (args[0] === 'run:android') {
  // Windows + Expo AV can leave stale Ninja/CMake state behind between runs.
  // Clearing generated native artifacts keeps development builds reproducible.
  clearStaleAndroidNativeBuildArtifacts()

  // Emulator builds do not need extra device ABIs. Restricting to x86_64 avoids
  // unnecessary native compilation and side-steps flaky arm64-v8a generator runs.
  env.ORG_GRADLE_PROJECT_reactNativeArchitectures =
    env.ORG_GRADLE_PROJECT_reactNativeArchitectures || 'x86_64'
}

const child = spawn(expoNode, ['-r', metroHook, expoCli, ...args], {
  cwd: mobileRoot,
  env,
  stdio: 'inherit',
})

child.on('exit', code => {
  process.exit(code ?? 0)
})

child.on('error', error => {
  console.error(error)
  process.exit(1)
})
