const Module = require('module')
const fs = require('fs')
const path = require('path')

const mobileRoot = process.env.MEETMIND_MOBILE_ROOT
const workspaceRoot = process.env.MEETMIND_WORKSPACE_ROOT

if (!mobileRoot) {
  return
}

const metroPackages = [
  'metro',
  'metro-cache',
  'metro-config',
  'metro-core',
  'metro-file-map',
  'metro-resolver',
  'metro-runtime',
  'metro-source-map',
  '@babel/helper-module-imports',
]

const originalResolveFilename = Module._resolveFilename
const virtualStoreRoot = workspaceRoot ? path.join(workspaceRoot, 'node_modules', '.pnpm') : null
const virtualStoreCache = new Map()
let isRedirecting = false

function resolveFromVirtualStore(request) {
  if (!virtualStoreRoot || !fs.existsSync(virtualStoreRoot)) {
    return null
  }

  const targetPackage = metroPackages.find(pkg => request === pkg || request.startsWith(`${pkg}/`))

  if (!targetPackage) {
    return null
  }

  let searchRoots = virtualStoreCache.get(targetPackage)

  if (!searchRoots) {
    const virtualStorePrefix = `${targetPackage.replace(/\//g, '+')}@`

    searchRoots = fs
      .readdirSync(virtualStoreRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith(virtualStorePrefix))
      .map(entry => path.join(virtualStoreRoot, entry.name, 'node_modules'))
      .filter(entry => fs.existsSync(entry))

    virtualStoreCache.set(targetPackage, searchRoots)
  }

  for (const searchRoot of searchRoots) {
    try {
      return require.resolve(request, { paths: [searchRoot] })
    } catch (error) {
      // Try the next candidate.
    }
  }

  return null
}

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (!isRedirecting && metroPackages.some(pkg => request === pkg || request.startsWith(`${pkg}/`))) {
    try {
      isRedirecting = true
      return require.resolve(request, { paths: [mobileRoot] })
    } catch (error) {
      const resolvedFromVirtualStore = resolveFromVirtualStore(request)

      if (resolvedFromVirtualStore) {
        return resolvedFromVirtualStore
      }
    } finally {
      isRedirecting = false
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options)
}
