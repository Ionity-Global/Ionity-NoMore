// Fully offline OCR for AEDi. Every asset — worker, WASM core, and the
// English model — is bundled in public/ocr, so no request ever leaves
// the device and OCR works without any connection.

export interface OcrResult {
  text: string
  confidence: number
}

type TesseractWorker = import('tesseract.js').Worker

let workerPromise: Promise<TesseractWorker> | null = null

async function loadWorker(): Promise<TesseractWorker> {
  workerPromise ??= (async () => {
    const { createWorker } = await import('tesseract.js')
    return createWorker('eng', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/core',
      langPath: '/ocr/lang',
      gzip: true,
    })
  })()
  return workerPromise
}

export async function recognizeImage(image: File | Blob): Promise<OcrResult> {
  const worker = await loadWorker()
  const { data } = await worker.recognize(image)
  return { text: data.text.trim(), confidence: data.confidence }
}

export async function releaseOcr(): Promise<void> {
  const pending = workerPromise
  workerPromise = null
  if (pending) {
    try {
      await (await pending).terminate()
    } catch {
      // The worker was never fully created; nothing to release.
    }
  }
}
