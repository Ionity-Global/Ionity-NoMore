export const AUDIO_CHUNK_BYTES = 12 * 1024

export function encodeAudioChunks(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += AUDIO_CHUNK_BYTES) {
    const slice = bytes.subarray(offset, offset + AUDIO_CHUNK_BYTES)
    let binary = ''
    for (const byte of slice) binary += String.fromCharCode(byte)
    chunks.push(btoa(binary))
  }
  return chunks
}

export function decodeAudioChunks(chunks: string[]) {
  const decoded = chunks.map((chunk) => {
    const binary = atob(chunk)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  })
  const length = decoded.reduce((total, chunk) => total + chunk.length, 0)
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of decoded) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}