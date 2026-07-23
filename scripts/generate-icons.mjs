// Generates official Ionity Android launcher icons from public/brand/ionity-global.png.
// Run once after changing brand assets: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const brand = join(root, 'public', 'brand', 'ionity-global.png')
const resDir = join(root, 'android', 'app', 'src', 'main', 'res')

// The wordmark is drawn for a light surface, so icons use the brand's white background.
const background = '#ffffff'
const trimmedMark = await sharp(brand).trim().png().toBuffer()

const densities = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
]

async function markOnCanvas(canvas, markRatio) {
  const mark = Math.round(canvas * markRatio)
  const logo = await sharp(trimmedMark)
    .resize(mark, mark, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer()
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
}

for (const [density, legacySize, foregroundSize] of densities) {
  const dir = join(resDir, `mipmap-${density}`)
  mkdirSync(dir, { recursive: true })

  await (await markOnCanvas(legacySize, 0.86)).toFile(join(dir, 'ic_launcher.png'))

  const roundMask = Buffer.from(
    `<svg width="${legacySize}" height="${legacySize}"><circle cx="${legacySize / 2}" cy="${legacySize / 2}" r="${legacySize / 2}" fill="#fff"/></svg>`,
  )
  const square = await (await markOnCanvas(legacySize, 0.78)).toBuffer()
  await sharp(square).composite([{ input: roundMask, blend: 'dest-in' }]).png().toFile(join(dir, 'ic_launcher_round.png'))

  // Adaptive foreground: the mark must stay inside the middle 66/108 safe zone.
  await (await markOnCanvas(foregroundSize, 0.52)).toFile(join(dir, 'ic_launcher_foreground.png'))
  console.log(`mipmap-${density} written`)
}

writeFileSync(
  join(resDir, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${background}</color>\n</resources>\n`,
)
console.log('ic_launcher_background.xml written')
