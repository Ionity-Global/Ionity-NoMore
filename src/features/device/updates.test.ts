import { describe, expect, it } from 'vitest'
import { compareVersions, parseReleaseTag } from './updates'

describe('compareVersions', () => {
  it('orders calendar versions correctly', () => {
    expect(compareVersions('2027.3', '2027.2')).toBe(1)
    expect(compareVersions('2027.2', '2027.3')).toBe(-1)
    expect(compareVersions('2027.3', '2027.3')).toBe(0)
    expect(compareVersions('2028.1', '2027.9')).toBe(1)
  })

  it('treats missing segments as zero', () => {
    expect(compareVersions('2027', '2027.0')).toBe(0)
    expect(compareVersions('2027.1.1', '2027.1')).toBe(1)
  })
})

describe('parseReleaseTag', () => {
  it('extracts versions from apk release tags', () => {
    expect(parseReleaseTag('apk-2027.3')).toBe('2027.3')
    expect(parseReleaseTag('apk-2027.10.1')).toBe('2027.10.1')
  })

  it('rejects tags that are not apk releases', () => {
    expect(parseReleaseTag('v2.0')).toBeNull()
    expect(parseReleaseTag('apk-')).toBeNull()
    expect(parseReleaseTag('apk-2026-07-23')).toBeNull()
  })
})
