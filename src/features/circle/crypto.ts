export interface PeerIdentity {
  keyPair: CryptoKeyPair
  publicKey: JsonWebKey
  fingerprint: string
}

export interface EncryptedEnvelope {
  version: 1
  id: string
  sentAt: number
  iv: string
  ciphertext: string
}

export async function createPeerIdentity(): Promise<PeerIdentity> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey'],
  )) as CryptoKeyPair
  const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const fingerprintBytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(publicKey)),
  )

  return {
    keyPair,
    publicKey,
    fingerprint: toBase64Url(fingerprintBytes).slice(0, 16),
  }
}

export async function derivePeerKey(
  privateKey: CryptoKey,
  peerPublicKey: JsonWebKey,
): Promise<CryptoKey> {
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    peerPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )

  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptForPeer(
  key: CryptoKey,
  payload: unknown,
): Promise<EncryptedEnvelope> {
  const id = crypto.randomUUID()
  const sentAt = Date.now()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const additionalData = new TextEncoder().encode(`nomore-v1:${id}:${sentAt}`)
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData },
    key,
    plaintext,
  )

  return {
    version: 1,
    id,
    sentAt,
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(ciphertext),
  }
}

export async function decryptFromPeer<T>(
  key: CryptoKey,
  envelope: EncryptedEnvelope,
): Promise<T> {
  if (envelope.version !== 1) {
    throw new Error('Unsupported encrypted message version')
  }

  const additionalData = new TextEncoder().encode(
    `nomore-v1:${envelope.id}:${envelope.sentAt}`,
  )
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64Url(envelope.iv),
      additionalData,
    },
    key,
    fromBase64Url(envelope.ciphertext),
  )

  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}

function toBase64Url(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}