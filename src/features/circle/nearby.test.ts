import { describe, expect, it } from 'vitest'
import {
  circleServiceUuid,
  classifyProximity,
  estimateDistanceMeters,
  RssiSmoother,
} from './nearby'

describe('estimateDistanceMeters', () => {
  it('reads the reference power as roughly one metre', () => {
    expect(estimateDistanceMeters(-59)).toBeCloseTo(1, 0)
  })

  it('grows with signal loss and stays within honest bounds', () => {
    const near = estimateDistanceMeters(-65)
    const far = estimateDistanceMeters(-90)

    expect(near).toBeGreaterThan(1)
    expect(far).toBeGreaterThan(near)
    expect(estimateDistanceMeters(-20)).toBeGreaterThanOrEqual(0.1)
    expect(estimateDistanceMeters(-130)).toBeLessThanOrEqual(99)
  })

  it('ignores absent tx power markers', () => {
    expect(estimateDistanceMeters(-59, -2147483648)).toBeCloseTo(1, 0)
  })
})

describe('classifyProximity', () => {
  it('maps distances to honest bands', () => {
    expect(classifyProximity(1.2)).toBe('very-close')
    expect(classifyProximity(3.4)).toBe('near')
    expect(classifyProximity(9)).toBe('around')
    expect(classifyProximity(40)).toBe('far')
  })
})

describe('RssiSmoother', () => {
  it('dampens jitter instead of jumping between readings', () => {
    const smoother = new RssiSmoother(0.3)
    smoother.push(-60)
    const afterSpike = smoother.push(-90)

    expect(afterSpike).toBeGreaterThan(-90)
    expect(afterSpike).toBeLessThan(-60)
  })
})

describe('circleServiceUuid', () => {
  it('derives a stable, well-formed UUID per circle', async () => {
    const first = await circleServiceUuid('circle-123')
    const second = await circleServiceUuid('circle-123')
    const other = await circleServiceUuid('circle-456')

    expect(first).toBe(second)
    expect(first).not.toBe(other)
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
