import { describe, expect, it } from 'vitest'
import { decodeInvite, encodeInvite, type CircleInvite } from './peer'

const invite: CircleInvite = {
  version: 1,
  kind: 'offer',
  circleId: 'circle-123',
  displayName: 'Alice',
  publicKey: { kty: 'EC', crv: 'P-256', x: 'public-x', y: 'public-y' },
  description: { type: 'offer', sdp: 'v=0\r\na=ice-options:trickle\r\n' },
}

describe('QR invitation encoding', () => {
  it('round-trips a compressed invite in a URL fragment', () => {
    const encoded = encodeInvite(invite, 'https://nomore.example/app')

    expect(encoded).toContain('/app#circle=')
    expect(decodeInvite(encoded)).toEqual(invite)
  })

  it('decodes the fragment payload without a hosting URL', () => {
    const encoded = encodeInvite(invite, 'https://nomore.example').split('#circle=')[1]

    expect(decodeInvite(encoded)).toEqual(invite)
  })

  it('rejects an expired renewable invite', () => {
    const expired = encodeInvite({ ...invite, expiresAt: Date.now() - 1 }, 'https://nomore.example')

    expect(() => decodeInvite(expired)).toThrow('invite has expired')
  })
})