import { describe, expect, it } from 'vitest'
import { CARRIERS, matchCarrier } from './carriers'

describe('matchCarrier', () => {
  it('matches by MCC+MNC before anything else', () => {
    expect(matchCarrier({ simOperator: '65501' })?.key).toBe('vodacom')
    expect(matchCarrier({ simOperator: '65510' })?.key).toBe('mtn')
    expect(matchCarrier({ simOperator: '65538' })?.key).toBe('rain')
  })

  it('falls back to operator names with loose formatting', () => {
    expect(matchCarrier({ simOperatorName: 'Cell C (Pty) Ltd' })?.key).toBe('cellc')
    expect(matchCarrier({ networkOperatorName: 'TELKOM-SA' })?.key).toBe('telkom')
  })

  it('returns null for foreign or unknown SIMs', () => {
    expect(matchCarrier({ simOperator: '23410', simOperatorName: 'O2 UK' })).toBeNull()
    expect(matchCarrier({})).toBeNull()
  })

  it('always pairs a dial code with human guidance', () => {
    for (const carrier of CARRIERS) {
      expect(carrier.guidance.length).toBeGreaterThan(20)
      if (carrier.subscriptionsCode) {
        expect(carrier.subscriptionsCode).toMatch(/^\*\d+(\*\d+)*#$/)
      }
    }
  })
})
