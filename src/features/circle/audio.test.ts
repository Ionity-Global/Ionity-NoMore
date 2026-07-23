import { describe, expect, it } from 'vitest'
import { AUDIO_CHUNK_BYTES, decodeAudioChunks, encodeAudioChunks } from './audio'

describe('voice note chunking', () => {
  it('round-trips binary audio across bounded chunks', () => {
    const source = Uint8Array.from(
      { length: AUDIO_CHUNK_BYTES * 2 + 37 },
      (_, index) => index % 251,
    )

    const chunks = encodeAudioChunks(source.buffer)

    expect(chunks).toHaveLength(3)
    expect(decodeAudioChunks(chunks)).toEqual(source)
  })

  it('handles an empty recording', () => {
    expect(encodeAudioChunks(new ArrayBuffer(0))).toEqual([])
    expect(decodeAudioChunks([])).toEqual(new Uint8Array())
  })
})