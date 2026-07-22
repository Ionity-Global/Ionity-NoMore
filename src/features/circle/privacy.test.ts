import { describe, expect, it } from 'vitest'
import { bufferLocation } from './privacy'

const capeTown = {
  latitude: -33.9249,
  longitude: 18.4241,
  accuracy: 12,
  timestamp: 1_700_000_000_000,
}

describe('bufferLocation', () => {
  it('shares a coarser coordinate and never claims finer accuracy', () => {
    const shared = bufferLocation(capeTown, 500)

    expect(shared.latitude).not.toBe(capeTown.latitude)
    expect(shared.longitude).not.toBe(capeTown.longitude)
    expect(shared.accuracy).toBe(500)
    expect(shared.precision).toBe(500)
    expect(shared.sharedAt).toBe(capeTown.timestamp)
  })

  it('preserves exact coordinates only when explicitly requested', () => {
    const shared = bufferLocation(capeTown, 0)

    expect(shared.latitude).toBe(capeTown.latitude)
    expect(shared.longitude).toBe(capeTown.longitude)
    expect(shared.accuracy).toBe(capeTown.accuracy)
    expect(shared.precision).toBe(0)
  })
})