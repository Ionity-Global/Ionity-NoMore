// Honest Bluetooth proximity: log-distance path-loss estimation over
// smoothed RSSI. Readings are approximate by physics — the UI must always
// present bands, never false precision.

export type ProximityBand = 'very-close' | 'near' | 'around' | 'far'

const DEFAULT_TX_POWER = -59 // Typical measured RSSI at 1 m for phone BLE.
const PATH_LOSS_EXPONENT = 2.2

export function estimateDistanceMeters(rssi: number, txPower?: number): number {
  const reference = typeof txPower === 'number' && txPower > -120 && txPower < 20 ? txPower : DEFAULT_TX_POWER
  const distance = 10 ** ((reference - rssi) / (10 * PATH_LOSS_EXPONENT))
  return Math.round(Math.min(99, Math.max(0.1, distance)) * 10) / 10
}

export function classifyProximity(distanceMeters: number): ProximityBand {
  if (distanceMeters <= 2) return 'very-close'
  if (distanceMeters <= 5) return 'near'
  if (distanceMeters <= 15) return 'around'
  return 'far'
}

export const BAND_LABELS: Record<ProximityBand, string> = {
  'very-close': 'Very close \u2014 within about 2 m',
  near: 'Near \u2014 roughly 2\u20135 m',
  around: 'Around \u2014 roughly 5\u201315 m',
  far: 'In range \u2014 further away',
}

export class RssiSmoother {
  private value: number | null = null
  private readonly alpha: number

  constructor(alpha = 0.3) {
    this.alpha = alpha
  }

  push(rssi: number): number {
    this.value = this.value === null ? rssi : this.value + this.alpha * (rssi - this.value)
    return this.value
  }

  reset(): void {
    this.value = null
  }
}

// Both peers derive the same anonymous 128-bit service UUID from the shared
// circle id, so beacons carry no identity — only "my circle is here".
export async function circleServiceUuid(circleId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`nomore-nearby:${circleId}`),
  )
  const bytes = new Uint8Array(digest).slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
