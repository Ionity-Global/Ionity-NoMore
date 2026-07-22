import { describe, expect, it } from 'vitest'
import {
  createPeerIdentity,
  decryptFromPeer,
  derivePeerKey,
  encryptForPeer,
} from './crypto'

describe('peer encryption', () => {
  it('derives matching keys and decrypts only at the other peer', async () => {
    const alice = await createPeerIdentity()
    const bob = await createPeerIdentity()
    const aliceKey = await derivePeerKey(alice.keyPair.privateKey, bob.publicKey)
    const bobKey = await derivePeerKey(bob.keyPair.privateKey, alice.publicKey)
    const payload = { type: 'chat', text: 'Arrived safely' }

    const encrypted = await encryptForPeer(aliceKey, payload)
    const decrypted = await decryptFromPeer<typeof payload>(bobKey, encrypted)

    expect(decrypted).toEqual(payload)
    expect(encrypted.ciphertext).not.toContain(payload.text)
    expect(encrypted.iv).toHaveLength(16)
  })

  it('rejects authenticated metadata that has been changed', async () => {
    const alice = await createPeerIdentity()
    const bob = await createPeerIdentity()
    const aliceKey = await derivePeerKey(alice.keyPair.privateKey, bob.publicKey)
    const bobKey = await derivePeerKey(bob.keyPair.privateKey, alice.publicKey)
    const encrypted = await encryptForPeer(aliceKey, { type: 'chat', text: 'Private' })

    await expect(
      decryptFromPeer(bobKey, { ...encrypted, sentAt: encrypted.sentAt + 1 }),
    ).rejects.toThrow()
  })
})