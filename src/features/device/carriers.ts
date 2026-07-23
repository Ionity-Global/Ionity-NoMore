// South African mobile carriers with their official self-service codes.
// Matching uses the SIM's MCC+MNC first, then the operator name.

export interface CarrierProfile {
  key: 'vodacom' | 'mtn' | 'cellc' | 'telkom' | 'rain'
  name: string
  subscriptionsCode: string | null
  guidance: string
}

export interface CarrierSignals {
  simOperator?: string
  simOperatorName?: string
  networkOperatorName?: string
}

export const CARRIERS: CarrierProfile[] = [
  {
    key: 'vodacom',
    name: 'Vodacom',
    subscriptionsCode: '*135*997#',
    guidance: 'Opens Vodacom\u2019s content services menu where you can view and cancel WASP subscriptions.',
  },
  {
    key: 'mtn',
    name: 'MTN',
    subscriptionsCode: '*141*5#',
    guidance: 'Opens MTN\u2019s content services menu to review and stop subscription services.',
  },
  {
    key: 'cellc',
    name: 'Cell C',
    subscriptionsCode: '*133*1#',
    guidance: 'Opens Cell C\u2019s content services menu to manage and cancel subscriptions.',
  },
  {
    key: 'telkom',
    name: 'Telkom',
    subscriptionsCode: '*180#',
    guidance: 'Opens Telkom\u2019s self-service menu \u2014 choose Content Services to manage subscriptions.',
  },
  {
    key: 'rain',
    name: 'rain',
    subscriptionsCode: null,
    guidance: 'rain is data-only and has no USSD menu. Manage services in the rain app or at rain.co.za.',
  },
]

// MCC 655 = South Africa.
const MCC_MNC: Record<string, CarrierProfile['key']> = {
  '65501': 'vodacom',
  '65510': 'mtn',
  '65507': 'cellc',
  '65502': 'telkom',
  '65538': 'rain',
}

export function matchCarrier(signals: CarrierSignals): CarrierProfile | null {
  const byNumber = signals.simOperator && MCC_MNC[signals.simOperator.trim()]
  if (byNumber) return CARRIERS.find((carrier) => carrier.key === byNumber) ?? null

  const names = [signals.simOperatorName, signals.networkOperatorName]
  for (const name of names) {
    const normalized = name?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
    if (!normalized) continue
    for (const carrier of CARRIERS) {
      const target = carrier.name.toLowerCase().replace(/[^a-z]/g, '')
      if (normalized.includes(target)) return carrier
    }
  }
  return null
}
