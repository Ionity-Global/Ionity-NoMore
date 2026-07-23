// Copies every file AEDi needs for fully offline OCR into public/ocr.
// Run after dependency updates: node scripts/setup-ocr-assets.mjs
import { copyFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = (await import('node:module')).createRequire(join(root, 'package.json'))

const workerSource = require.resolve('tesseract.js/dist/worker.min.js')
const coreDir = dirname(require.resolve('tesseract.js-core/package.json', {
  paths: [dirname(require.resolve('tesseract.js/package.json'))],
}))
const langSource = join(dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0', 'eng.traineddata.gz')

const targets = [
  [workerSource, join(root, 'public', 'ocr', 'worker.min.js')],
  [langSource, join(root, 'public', 'ocr', 'lang', 'eng.traineddata.gz')],
  ...['tesseract-core-lstm', 'tesseract-core-simd-lstm', 'tesseract-core-relaxedsimd-lstm'].map((name) => [
    join(coreDir, `${name}.wasm.js`),
    join(root, 'public', 'ocr', 'core', `${name}.wasm.js`),
  ]),
]

for (const [source, destination] of targets) {
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(source, destination)
  console.log(`${destination.slice(root.length + 1)} (${(statSync(destination).size / 1024 / 1024).toFixed(2)} MiB)`)
}
