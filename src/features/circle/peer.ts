import { deflateRaw, inflateRaw } from 'pako'
import {
  createPeerIdentity,
  decryptFromPeer,
  derivePeerKey,
  encryptForPeer,
  type EncryptedEnvelope,
  type PeerIdentity,
} from './crypto'

export interface CircleInvite {
  version: 1
  kind: 'offer' | 'answer'
  circleId: string
  displayName: string
  expiresAt?: number
  publicKey: JsonWebKey
  description: RTCSessionDescriptionInit
}

const INVITE_LIFETIME_MS = 5 * 60_000

export type CirclePacket =
  | { type: 'chat'; id: string; sender: string; text: string; sentAt: number }
  | { type: 'audio-start'; id: string; sender: string; sentAt: number; mimeType: string; totalChunks: number }
  | { type: 'audio-chunk'; id: string; index: number; data: string }
  | { type: 'location'; sender: string; location: unknown; expiresAt: number }
  | { type: 'sharing-stopped'; sender: string; sentAt: number }
  | { type: 'sos'; sender: string; sentAt: number }

interface SessionCallbacks {
  onPacket: (packet: CirclePacket) => void
  onStateChange: (state: RTCPeerConnectionState) => void
}

export class PrivatePeerSession {
  readonly circleId: string
  readonly identity: PeerIdentity
  readonly displayName: string
  private readonly connection: RTCPeerConnection
  private readonly callbacks: SessionCallbacks
  private channel?: RTCDataChannel
  private peerKey?: CryptoKey

  private constructor(
    circleId: string,
    displayName: string,
    identity: PeerIdentity,
    connection: RTCPeerConnection,
    callbacks: SessionCallbacks,
  ) {
    this.circleId = circleId
    this.displayName = displayName
    this.identity = identity
    this.connection = connection
    this.callbacks = callbacks
    this.connection.onconnectionstatechange = () => {
      callbacks.onStateChange(this.connection.connectionState)
    }
  }

  static async createHost(displayName: string, callbacks: SessionCallbacks) {
    const identity = await createPeerIdentity()
    const connection = createPrivateConnection()
    const session = new PrivatePeerSession(
      crypto.randomUUID(),
      displayName,
      identity,
      connection,
      callbacks,
    )
    session.attachChannel(connection.createDataChannel('nomore-circle', { ordered: true }))
    await connection.setLocalDescription(await connection.createOffer())
    await waitForIceGathering(connection)

    return {
      session,
      invite: session.makeInvite('offer'),
    }
  }

  static async joinOffer(invite: CircleInvite, displayName: string, callbacks: SessionCallbacks) {
    if (invite.kind !== 'offer') throw new Error('Expected a circle offer')

    const identity = await createPeerIdentity()
    const connection = createPrivateConnection()
    const session = new PrivatePeerSession(
      invite.circleId,
      displayName,
      identity,
      connection,
      callbacks,
    )
    session.peerKey = await derivePeerKey(identity.keyPair.privateKey, invite.publicKey)
    connection.ondatachannel = (event) => session.attachChannel(event.channel)
    await connection.setRemoteDescription(invite.description)
    await connection.setLocalDescription(await connection.createAnswer())
    await waitForIceGathering(connection)

    return {
      session,
      answer: session.makeInvite('answer'),
    }
  }

  async acceptAnswer(invite: CircleInvite) {
    if (invite.kind !== 'answer' || invite.circleId !== this.circleId) {
      throw new Error('This answer belongs to a different safety circle')
    }
    this.peerKey = await derivePeerKey(
      this.identity.keyPair.privateKey,
      invite.publicKey,
    )
    await this.connection.setRemoteDescription(invite.description)
  }

  async send(packet: CirclePacket) {
    if (!this.peerKey || this.channel?.readyState !== 'open') {
      throw new Error('The peer connection is not ready')
    }
    await this.waitForChannelCapacity()
    const envelope = await encryptForPeer(this.peerKey, packet)
    if (this.channel.readyState !== 'open') throw new Error('The peer connection closed')
    this.channel.send(JSON.stringify(envelope))
  }

  close() {
    this.channel?.close()
    this.connection.close()
  }

  private makeInvite(kind: CircleInvite['kind']): CircleInvite {
    if (!this.connection.localDescription) throw new Error('Missing local description')
    return {
      version: 1,
      kind,
      circleId: this.circleId,
      displayName: this.displayName,
      expiresAt: Date.now() + INVITE_LIFETIME_MS,
      publicKey: this.identity.publicKey,
      description: this.connection.localDescription.toJSON(),
    }
  }

  private attachChannel(channel: RTCDataChannel) {
    this.channel = channel
    this.channel.onmessage = async (event) => {
      if (!this.peerKey || typeof event.data !== 'string') return
      try {
        const envelope = JSON.parse(event.data) as EncryptedEnvelope
        const packet = await decryptFromPeer<CirclePacket>(this.peerKey, envelope)
        this.callbacks.onPacket(packet)
      } catch {
        this.close()
      }
    }
  }

  private async waitForChannelCapacity() {
    const channel = this.channel
    if (!channel || channel.readyState !== 'open') throw new Error('The peer connection is not ready')
    if (channel.bufferedAmount <= 256 * 1024) return
    channel.bufferedAmountLowThreshold = 64 * 1024
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup()
        reject(new Error('The encrypted connection is too busy to send this recording'))
      }, 10_000)
      const handleLow = () => {
        cleanup()
        resolve()
      }
      const handleClose = () => {
        cleanup()
        reject(new Error('The peer connection closed'))
      }
      const cleanup = () => {
        window.clearTimeout(timeout)
        channel.removeEventListener('bufferedamountlow', handleLow)
        channel.removeEventListener('close', handleClose)
      }
      channel.addEventListener('bufferedamountlow', handleLow, { once: true })
      channel.addEventListener('close', handleClose, { once: true })
    })
  }
}

export function encodeInvite(invite: CircleInvite, appUrl?: string) {
  const compressed = deflateRaw(new TextEncoder().encode(JSON.stringify(invite)), {
    level: 9,
  })
  const encoded = toBase64Url(compressed)
  const base = appUrl ?? `${window.location.origin}${window.location.pathname}`
  return `${base}#circle=${encoded}`
}

export function decodeInvite(value: string): CircleInvite {
  const encoded = value.includes('#circle=') ? value.split('#circle=')[1] : value
  if (!encoded) throw new Error('The QR invite is empty')
  const json = new TextDecoder().decode(inflateRaw(fromBase64Url(encoded)))
  const invite = JSON.parse(json) as CircleInvite
  if (invite.version !== 1 || !['offer', 'answer'].includes(invite.kind)) {
    throw new Error('Unsupported safety circle invitation')
  }
  if (invite.expiresAt && invite.expiresAt <= Date.now()) {
    throw new Error('This private invite has expired. Ask your friend to renew it.')
  }
  return invite
}

function createPrivateConnection() {
  return new RTCPeerConnection({
    iceServers: [],
    bundlePolicy: 'max-bundle',
  })
}

function waitForIceGathering(connection: RTCPeerConnection) {
  if (connection.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Local peer discovery timed out'))
    }, 10_000)
    const handleState = () => {
      if (connection.iceGatheringState === 'complete') {
        cleanup()
        resolve()
      }
    }
    const cleanup = () => {
      window.clearTimeout(timeout)
      connection.removeEventListener('icegatheringstatechange', handleState)
    }
    connection.addEventListener('icegatheringstatechange', handleState)
  })
}

function toBase64Url(bytes: Uint8Array) {
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