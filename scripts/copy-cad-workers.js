/**
 * Post-install script: copies @mlightcad worker JS and WASM files
 * into public/ so Vite serves them as static assets at runtime.
 */
import { cpSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const nodeModules = join(root, 'node_modules')
const publicDir = join(root, 'public')

const assetsDir = join(publicDir, 'assets')
const wasmDir = join(publicDir, 'wasm')

mkdirSync(assetsDir, { recursive: true })
mkdirSync(wasmDir, { recursive: true })

const workers = [
  {
    src: join(nodeModules, '@mlightcad/data-model/dist/dxf-parser-worker.js'),
    dest: join(assetsDir, 'dxf-parser-worker.js'),
  },
  {
    src: join(nodeModules, '@mlightcad/cad-simple-viewer/dist/libredwg-parser-worker.js'),
    dest: join(assetsDir, 'libredwg-parser-worker.js'),
  },
  {
    src: join(nodeModules, '@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js'),
    dest: join(assetsDir, 'mtext-renderer-worker.js'),
  },
]

const wasmFiles = [
  {
    src: join(nodeModules, '@mlightcad/libredwg-web/wasm/libredwg-web.wasm'),
    dest: join(wasmDir, 'libredwg-web.wasm'),
  },
]

for (const { src, dest } of [...workers, ...wasmFiles]) {
  try {
    cpSync(src, dest)
    console.log(`  copied → ${dest.replace(root, '.')}`)
  } catch (err) {
    console.warn(`  WARN: could not copy ${src}: ${err.message}`)
  }
}

console.log('CAD worker files copied successfully.')
