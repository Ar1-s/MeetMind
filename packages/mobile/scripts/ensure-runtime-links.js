const fs = require('fs')
const path = require('path')

const mobileRoot = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(mobileRoot, '..', '..')
const mobileNodeModules = path.join(mobileRoot, 'node_modules')
const virtualStoreRoot = path.join(workspaceRoot, 'node_modules', '.pnpm')

const runtimePackages = [
  'expo-modules-core',
  'whatwg-fetch',
  'query-string',
  'stacktrace-parser',
  'web-streams-polyfill',
  'use-latest-callback',
  'fast-deep-equal',
  'escape-string-regexp',
  'decode-uri-component',
  'filter-obj',
  'split-on-first',
  'strict-uri-encode',
  '@react-native/js-polyfills',
  '@tamagui/react-native-web-lite',
]

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function findVirtualStorePackage(pkgName) {
  if (!fs.existsSync(virtualStoreRoot)) {
    return null
  }

  const virtualStorePrefix = `${pkgName.replace(/\//g, '+')}@`
  const matchingDir = fs
    .readdirSync(virtualStoreRoot, { withFileTypes: true })
    .find(entry => entry.isDirectory() && entry.name.startsWith(virtualStorePrefix))

  if (!matchingDir) {
    return null
  }

  const resolvedPath = path.join(virtualStoreRoot, matchingDir.name, 'node_modules', ...pkgName.split('/'))
  return fs.existsSync(resolvedPath) ? resolvedPath : null
}

function isValidLink(linkPath, expectedTarget) {
  try {
    const stat = fs.lstatSync(linkPath)
    if (!stat.isSymbolicLink() && !stat.isDirectory()) {
      return false
    }
    const resolved = fs.realpathSync.native(linkPath)
    const expected = fs.realpathSync.native(expectedTarget)
    return resolved.toLowerCase() === expected.toLowerCase()
  } catch {
    return false
  }
}

function ensureRuntimeLink(pkgName) {
  const fromPath = findVirtualStorePackage(pkgName)
  const toPath = path.join(mobileNodeModules, ...pkgName.split('/'))

  if (!fromPath) {
    return { pkgName, status: 'missing-source' }
  }

  ensureDir(path.dirname(toPath))

  if (isValidLink(toPath, fromPath)) {
    return { pkgName, status: 'ok' }
  }

  try {
    if (fs.existsSync(toPath)) {
      fs.rmSync(toPath, { recursive: true, force: true })
    }
    fs.symlinkSync(fromPath, toPath, 'junction')
    return { pkgName, status: 'linked' }
  } catch (error) {
    return { pkgName, status: 'error', error }
  }
}

function ensureRuntimeLinks() {
  if (!fs.existsSync(virtualStoreRoot)) {
    return []
  }

  return runtimePackages.map(ensureRuntimeLink)
}

module.exports = {
  ensureRuntimeLinks,
}

if (require.main === module) {
  const results = ensureRuntimeLinks()
  for (const result of results) {
    if (result.status === 'error') {
      console.error(`[runtime-link] ${result.pkgName}: ${result.error.message}`)
      process.exitCode = 1
    } else if (result.status !== 'ok') {
      console.log(`[runtime-link] ${result.pkgName}: ${result.status}`)
    }
  }
}
