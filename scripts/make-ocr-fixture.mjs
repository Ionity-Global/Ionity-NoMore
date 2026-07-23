// Regenerates the OCR test fixture: node scripts/make-ocr-fixture.mjs
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const svg = Buffer.from(`<svg width="760" height="220" xmlns="http://www.w3.org/2000/svg">
  <rect width="760" height="220" fill="white"/>
  <text x="30" y="70" font-family="Arial" font-size="34" fill="black">You are subscribed to FunClub</text>
  <text x="30" y="120" font-family="Arial" font-size="34" fill="black">for R7.00 per day.</text>
  <text x="30" y="170" font-family="Arial" font-size="34" fill="black">To cancel SMS STOP to 31234</text>
</svg>`)

mkdirSync('src/features/aedi/__fixtures__', { recursive: true })
await sharp(svg).png().toFile('src/features/aedi/__fixtures__/subscription-sms.png')
console.log('fixture written')
