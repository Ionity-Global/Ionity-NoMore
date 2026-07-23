// Proves the bundled offline OCR model genuinely reads a subscription SMS.
// Runs tesseract.js in Node against the same eng.traineddata.gz that ships
// in public/ocr, then feeds the result through AEDi's message analyzer.
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createWorker } from 'tesseract.js'
import { analyzeMessageText } from './engine'

const here = import.meta.dirname

describe('offline OCR pipeline', () => {
  it('reads the fixture SMS and flags it as a paid subscription', { timeout: 120_000 }, async () => {
    const worker = await createWorker('eng', 1, {
      langPath: resolve(here, '../../../public/ocr/lang'),
      gzip: true,
      cacheMethod: 'none',
    })
    try {
      const { data } = await worker.recognize(
        resolve(here, '__fixtures__/subscription-sms.png'),
      )
      const analysis = analyzeMessageText(data.text)

      expect(data.text).toMatch(/STOP/i)
      expect(analysis.looksLikeSubscription).toBe(true)
      expect(analysis.shortCodes).toContain('31234')
    } finally {
      await worker.terminate()
    }
  })
})
