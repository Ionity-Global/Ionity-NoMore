import { useEffect, useRef, useState } from 'react'
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerAndroidScanningLibrary,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerScanOrientation,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner'
import { Capacitor } from '@capacitor/core'
import { Geolocation, type Position as NativePosition } from '@capacitor/geolocation'
import {
  AlertTriangle,
  Bluetooth,
  Camera,
  Clock3,
  Copy,
  Crosshair,
  KeyRound,
  Link2,
  LocateFixed,
  LockKeyhole,
  Map as MapIcon,
  MessageCircle,
  Mic,
  Radar,
  Radio,
  RefreshCw,
  Send,
  Shield,
  ShieldOff,
  Siren,
  Smartphone,
  Square,
  Trash2,
  Unplug,
  UserPlus,
  Users,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { decodeAudioChunks, encodeAudioChunks } from './audio'
import { EmergencyRow } from '../safety/EmergencyRow'
import { FakeCall } from '../safety/FakeCall'
import { startSosAlarm, stopSosAlarm } from '../safety/alerts'
import {
  BAND_LABELS,
  RssiSmoother,
  circleServiceUuid,
  classifyProximity,
  estimateDistanceMeters,
  type ProximityBand,
} from './nearby'
import { NoMoreNearby, isNativeAndroid, openDialerWithCode } from '../device/native'
import {
  PrivatePeerSession,
  decodeInvite,
  encodeInvite,
  type CircleInvite,
  type CirclePacket,
} from './peer'
import {
  bufferLocation,
  type LocationPrecision,
  type PrivateLocation,
} from './privacy'
import './SafetyCircle.css'

type ConnectionPhase =
  | 'idle'
  | 'creating'
  | 'offer-ready'
  | 'answer-ready'
  | 'connecting'
  | 'connected'
  | 'error'

interface ChatMessage {
  id: string
  sender: string
  kind?: 'text' | 'audio'
  text?: string
  audioUrl?: string
  sentAt: number
  own: boolean
}

interface IncomingAudio {
  sender: string
  sentAt: number
  mimeType: string
  chunks: Array<string | undefined>
  received: number
}

const SIGNAL_CHANNEL = 'nomore-circle-signaling-v1'
const MESSAGE_STORAGE_KEY = 'nomore-circle-message-history-v1'

function loadMessageHistory() {
  try {
    const stored = localStorage.getItem(MESSAGE_STORAGE_KEY)
    return stored ? JSON.parse(stored) as ChatMessage[] : []
  } catch {
    return []
  }
}

export function SafetyCircle() {
  const [displayName, setDisplayName] = useState('My device')
  const [phase, setPhase] = useState<ConnectionPhase>('idle')
  const [inviteValue, setInviteValue] = useState('')
  const [incomingInvite, setIncomingInvite] = useState<CircleInvite | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [peerName, setPeerName] = useState('Trusted member')
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessageHistory)
  const [rememberMessages, setRememberMessages] = useState(true)
  const [message, setMessage] = useState('')
  const [recording, setRecording] = useState(false)
  const [sendingAudio, setSendingAudio] = useState(false)
  const [precision, setPrecision] = useState<LocationPrecision>(500)
  const [shareMinutes, setShareMinutes] = useState(15)
  const [sharingUntil, setSharingUntil] = useState<number | null>(null)
  const [locations, setLocations] = useState<Record<string, PrivateLocation>>({})
  const [nearbyActive, setNearbyActive] = useState(false)
  const [nearbyReading, setNearbyReading] = useState<{ distance: number; band: ProximityBand } | null>(null)
  const [nearbyNote, setNearbyNote] = useState('')
  const [sosArmed, setSosArmed] = useState(false)
  const [sosAlert, setSosAlert] = useState<{ sender: string; sentAt: number } | null>(null)
  const [showFakeCall, setShowFakeCall] = useState(false)
  const sosArmTimerRef = useRef<number | null>(null)
  const nearbySmootherRef = useRef(new RssiSmoother())
  const sessionRef = useRef<PrivatePeerSession | null>(null)
  const watchRef = useRef<{ source: 'native' | 'web'; id: string | number } | null>(null)
  const stopTimerRef = useRef<number | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderStreamRef = useRef<MediaStream | null>(null)
  const recorderChunksRef = useRef<Blob[]>([])
  const recorderTimerRef = useRef<number | null>(null)
  const discardRecordingRef = useRef(false)
  const incomingAudioRef = useRef(new Map<string, IncomingAudio>())
  const audioUrlsRef = useRef(new Set<string>())

  useEffect(() => {
    const signaling = new BroadcastChannel(SIGNAL_CHANNEL)
    const inspectHash = async () => {
      if (!window.location.hash.startsWith('#circle=')) return
      try {
        const invite = decodeInvite(window.location.href)
        setPeerName(invite.displayName)
        if (invite.kind === 'offer') {
          setIncomingInvite(invite)
        } else if (sessionRef.current) {
          await acceptAnswer(invite)
        } else {
          signaling.postMessage(invite)
          setPhase('connecting')
        }
      } catch (reason) {
        showError(reason)
      }
    }
    signaling.onmessage = (event: MessageEvent<CircleInvite>) => {
      if (event.data.kind === 'answer' && sessionRef.current) {
        void acceptAnswer(event.data)
      }
    }
    void inspectHash()
    window.addEventListener('hashchange', inspectHash)
    return () => {
      signaling.close()
      window.removeEventListener('hashchange', inspectHash)
      sessionRef.current?.close()
      stopLocationWatcher()
      discardRecording()
      releaseAudioMessages()
      stopSosAlarm()
      void stopNearby()
    }
  }, [])

  useEffect(() => {
    try {
      if (rememberMessages) {
        const textMessages = messages.filter((item) => item.kind !== 'audio' && !item.audioUrl)
        localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(textMessages.slice(-100)))
      } else {
        localStorage.removeItem(MESSAGE_STORAGE_KEY)
      }
    } catch {
      setError('Message history could not be saved on this device.')
    }
  }, [messages, rememberMessages])

  function callbacks() {
    return {
      onPacket: handlePacket,
      onStateChange: (state: RTCPeerConnectionState) => {
        if (state === 'connected') setPhase('connected')
        if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          stopLocationSharing(false)
          discardRecording()
          void stopNearby()
          setPhase(state === 'failed' ? 'error' : 'idle')
          if (state === 'failed') setError('The direct connection could not be established. Keep both devices on the same reachable network and try again.')
        }
      },
    }
  }

  async function createCircle() {
    setError('')
    setPhase('creating')
    try {
      const result = await PrivatePeerSession.createHost(displayName.trim() || 'My device', callbacks())
      sessionRef.current = result.session
      setInviteValue(encodeInvite(result.invite))
      setPhase('offer-ready')
    } catch (reason) {
      showError(reason)
    }
  }

  async function joinCircle() {
    if (!incomingInvite) return
    setError('')
    setPhase('creating')
    try {
      const result = await PrivatePeerSession.joinOffer(
        incomingInvite,
        displayName.trim() || 'My device',
        callbacks(),
      )
      sessionRef.current = result.session
      setPeerName(incomingInvite.displayName)
      setInviteValue(encodeInvite(result.answer))
      setPhase('answer-ready')
    } catch (reason) {
      showError(reason)
    }
  }

  async function acceptAnswer(invite: CircleInvite) {
    try {
      setPeerName(invite.displayName)
      setPhase('connecting')
      await sessionRef.current?.acceptAnswer(invite)
      window.history.replaceState(null, '', window.location.pathname)
    } catch (reason) {
      showError(reason)
    }
  }

  async function useManualCode() {
    try {
      await receiveInvite(manualCode.trim())
      setManualCode('')
    } catch (reason) {
      showError(reason)
    }
  }

  async function receiveInvite(value: string) {
    const invite = decodeInvite(value)
    setError('')
    setPeerName(invite.displayName)
    if (invite.kind === 'offer') {
      setIncomingInvite(invite)
      setPhase('idle')
    } else {
      await acceptAnswer(invite)
    }
  }

  async function scanInvite() {
    setScanning(true)
    setError('')
    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanInstructions: 'Scan a NoMore private invite or response',
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
        scanOrientation: CapacitorBarcodeScannerScanOrientation.ADAPTIVE,
        android: { scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.ZXING },
        web: { showCameraSelection: true, scannerFPS: 15 },
      })
      await receiveInvite(result.ScanResult)
    } catch (reason) {
      setError(errorMessage(reason, 'The QR scan was cancelled or camera access was denied.'))
    } finally {
      setScanning(false)
    }
  }

  async function renewInvite() {
    sessionRef.current?.close()
    sessionRef.current = null
    setInviteValue('')
    setIncomingInvite(null)
    await createCircle()
  }

  async function sendMessage() {
    const text = message.trim()
    if (!text || phase !== 'connected') return
    const packet: CirclePacket = {
      type: 'chat',
      id: crypto.randomUUID(),
      sender: displayName,
      text,
      sentAt: Date.now(),
    }
    try {
      await sessionRef.current?.send(packet)
      setMessages((current) => [...current, { ...packet, kind: 'text', own: true }])
      setMessage('')
    } catch (reason) {
      showError(reason)
    }
  }

  function handlePacket(packet: CirclePacket) {
    if (packet.type === 'chat') {
      setMessages((current) => [...current, { ...packet, kind: 'text', own: false }])
    }
    if (packet.type === 'audio-start') {
      if (packet.totalChunks < 1 || packet.totalChunks > 512) return
      incomingAudioRef.current.set(packet.id, {
        sender: packet.sender,
        sentAt: packet.sentAt,
        mimeType: packet.mimeType,
        chunks: new Array(packet.totalChunks),
        received: 0,
      })
    }
    if (packet.type === 'audio-chunk') {
      receiveAudioChunk(packet)
    }
    if (packet.type === 'location') {
      setLocations((current) => ({
        ...current,
        [packet.sender]: packet.location as PrivateLocation,
      }))
    }
    if (packet.type === 'sharing-stopped') {
      setLocations((current) => {
        const next = { ...current }
        delete next[packet.sender]
        return next
      })
    }
    if (packet.type === 'sos') {
      setSosAlert({ sender: packet.sender, sentAt: packet.sentAt })
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        sender: packet.sender,
        kind: 'text',
        text: '\u{1F198} SOS \u2014 needs help now. Watch the shared positions map.',
        sentAt: packet.sentAt,
        own: false,
      }])
      startSosAlarm()
    }
  }

  function receiveAudioChunk(packet: Extract<CirclePacket, { type: 'audio-chunk' }>) {
    const incoming = incomingAudioRef.current.get(packet.id)
    if (!incoming || packet.index < 0 || packet.index >= incoming.chunks.length || packet.data.length > 20_000) return
    if (incoming.chunks[packet.index] === undefined) incoming.received += 1
    incoming.chunks[packet.index] = packet.data
    if (incoming.received !== incoming.chunks.length) return
    const bytes = decodeAudioChunks(incoming.chunks as string[])
    const audioUrl = URL.createObjectURL(new Blob([bytes], { type: incoming.mimeType }))
    audioUrlsRef.current.add(audioUrl)
    setMessages((current) => [...current, {
      id: packet.id,
      sender: incoming.sender,
      kind: 'audio',
      audioUrl,
      sentAt: incoming.sentAt,
      own: false,
    }])
    incomingAudioRef.current.delete(packet.id)
  }

  async function startRecording() {
    if (phase !== 'connected' || recording || sendingAudio) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice notes are not supported by this device or browser.')
      return
    }
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      recorderStreamRef.current = stream
      recorderChunksRef.current = []
      discardRecordingRef.current = false
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recorderChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const discarded = discardRecordingRef.current
        const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        finishRecorderCleanup()
        if (!discarded && blob.size > 0) void sendVoiceNote(blob)
      }
      recorder.start(1_000)
      setRecording(true)
      recorderTimerRef.current = window.setTimeout(stopRecording, 30_000)
    } catch (reason) {
      finishRecorderCleanup()
      setError(errorMessage(reason, 'Microphone permission was denied or the microphone is unavailable.'))
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  function discardRecording() {
    discardRecordingRef.current = true
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    } else {
      finishRecorderCleanup()
    }
  }

  function finishRecorderCleanup() {
    if (recorderTimerRef.current !== null) window.clearTimeout(recorderTimerRef.current)
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop())
    recorderTimerRef.current = null
    recorderRef.current = null
    recorderStreamRef.current = null
    recorderChunksRef.current = []
    setRecording(false)
  }

  async function sendVoiceNote(blob: Blob) {
    const id = crypto.randomUUID()
    const chunks = encodeAudioChunks(await blob.arrayBuffer())
    if (chunks.length === 0) return
    if (chunks.length > 512) {
      setError('This recording is too large to send. Try a shorter voice note.')
      return
    }
    setSendingAudio(true)
    try {
      const session = sessionRef.current
      if (!session || phase !== 'connected') throw new Error('The peer connection closed before the recording could be sent.')
      await session.send({
        type: 'audio-start',
        id,
        sender: displayName,
        sentAt: Date.now(),
        mimeType: blob.type || 'audio/webm',
        totalChunks: chunks.length,
      })
      for (const [index, data] of chunks.entries()) {
        await session.send({ type: 'audio-chunk', id, index, data })
      }
      const audioUrl = URL.createObjectURL(blob)
      audioUrlsRef.current.add(audioUrl)
      setMessages((current) => [...current, {
        id,
        sender: displayName,
        kind: 'audio',
        audioUrl,
        sentAt: Date.now(),
        own: true,
      }])
    } catch (reason) {
      setError(errorMessage(reason, 'The encrypted recording could not be sent.'))
    } finally {
      setSendingAudio(false)
    }
  }

  async function startLocationSharing(precisionOverride?: LocationPrecision, minutesOverride?: number) {
    const sharePrecision = precisionOverride ?? precision
    const shareDuration = minutesOverride ?? shareMinutes
    const native = Capacitor.isNativePlatform()
    if ((!native && !navigator.geolocation) || phase !== 'connected') {
      setError('Location sharing needs an active peer connection and device location support.')
      return
    }
    stopLocationWatcher()
    setError('')
    const expiresAt = Date.now() + shareDuration * 60_000
    setSharingUntil(expiresAt)
    try {
      if (native) {
        const permissionName = sharePrecision === 0 ? 'location' : 'coarseLocation'
        let permissions = await Geolocation.checkPermissions()
        if (permissions[permissionName] !== 'granted') {
          permissions = await Geolocation.requestPermissions({ permissions: [permissionName] })
        }
        if (permissions[permissionName] !== 'granted') {
          throw new Error('Location permission was not granted. You can enable it in Android app settings.')
        }
        const id = await Geolocation.watchPosition(
          {
            enableHighAccuracy: sharePrecision === 0,
            maximumAge: 15_000,
            timeout: 20_000,
            interval: 5_000,
            minimumUpdateInterval: 5_000,
          },
          (position, locationError) => handleNativePosition(position, locationError, expiresAt, sharePrecision),
        )
        watchRef.current = { source: 'native', id }
      } else {
        const id = navigator.geolocation.watchPosition(
          (position) => sharePosition(position, expiresAt, sharePrecision),
          (locationError) => handleLocationError(locationError),
          { enableHighAccuracy: sharePrecision === 0, maximumAge: 15_000, timeout: 20_000 },
        )
        watchRef.current = { source: 'web', id }
      }
      stopTimerRef.current = window.setTimeout(() => stopLocationSharing(true), shareDuration * 60_000)
    } catch (reason) {
      stopLocationSharing(false)
      setError(errorMessage(reason, 'Location services are unavailable or turned off.'))
    }
  }

  function handleNativePosition(position: NativePosition | null, locationError: unknown, expiresAt: number, sharePrecision: LocationPrecision) {
    if (locationError) {
      handleLocationError(locationError)
    } else if (position) {
      sharePosition(position, expiresAt, sharePrecision)
    }
  }

  function sharePosition(position: Pick<GeolocationPosition, 'coords' | 'timestamp'> | NativePosition, expiresAt: number, sharePrecision: LocationPrecision) {
    const location = bufferLocation(
      {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      },
      sharePrecision,
    )
    setLocations((current) => ({ ...current, [displayName]: location }))
    void sessionRef.current?.send({
      type: 'location',
      sender: displayName,
      location,
      expiresAt,
    }).catch(handleLocationError)
  }

  function handleLocationError(reason: unknown) {
    stopLocationSharing(false)
    setError(errorMessage(reason, 'Location services are unavailable or turned off.'))
  }

  function stopLocationSharing(notifyPeer = true) {
    stopLocationWatcher()
    setSharingUntil(null)
    setLocations((current) => {
      const next = { ...current }
      delete next[displayName]
      return next
    })
    if (notifyPeer && phase === 'connected') {
      void sessionRef.current?.send({ type: 'sharing-stopped', sender: displayName, sentAt: Date.now() })
    }
  }

  function stopLocationWatcher() {
    if (watchRef.current?.source === 'native') {
      void Geolocation.clearWatch({ id: String(watchRef.current.id) })
    } else if (watchRef.current?.source === 'web') {
      navigator.geolocation.clearWatch(Number(watchRef.current.id))
    }
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current)
    watchRef.current = null
    stopTimerRef.current = null
  }

  async function startNearby() {
    if (!isNativeAndroid()) {
      setNearbyNote('Nearby detection uses Bluetooth and works in the Android app.')
      return
    }
    const session = sessionRef.current
    if (!session || phase !== 'connected') return
    setNearbyNote('')
    nearbySmootherRef.current.reset()
    try {
      await NoMoreNearby.removeAllListeners()
      await NoMoreNearby.addListener('reading', (reading) => {
        const smoothed = nearbySmootherRef.current.push(reading.rssi)
        const distance = estimateDistanceMeters(smoothed, reading.txPower)
        setNearbyReading({ distance, band: classifyProximity(distance) })
      })
      await NoMoreNearby.addListener('scanFailed', () => {
        setNearbyNote('The Bluetooth beacon stopped. Check that Bluetooth is on and try again.')
        void stopNearby()
      })
      await NoMoreNearby.start({ serviceUuid: await circleServiceUuid(session.circleId) })
      setNearbyActive(true)
    } catch (reason) {
      await NoMoreNearby.removeAllListeners().catch(() => undefined)
      setNearbyNote(errorMessage(reason, 'Nearby detection could not start.'))
    }
  }

  async function stopNearby() {
    setNearbyActive(false)
    setNearbyReading(null)
    nearbySmootherRef.current.reset()
    if (!isNativeAndroid()) return
    await NoMoreNearby.stop().catch(() => undefined)
    await NoMoreNearby.removeAllListeners().catch(() => undefined)
  }

  async function pressSos() {
    if (phase !== 'connected') return
    if (!sosArmed) {
      setSosArmed(true)
      if (sosArmTimerRef.current !== null) window.clearTimeout(sosArmTimerRef.current)
      sosArmTimerRef.current = window.setTimeout(() => setSosArmed(false), 4_000)
      return
    }
    if (sosArmTimerRef.current !== null) window.clearTimeout(sosArmTimerRef.current)
    setSosArmed(false)
    const sentAt = Date.now()
    try {
      await sessionRef.current?.send({ type: 'sos', sender: displayName, sentAt })
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        sender: displayName,
        kind: 'text',
        text: '\u{1F198} SOS sent \u2014 sharing my exact location for the next hour.',
        sentAt,
        own: true,
      }])
      setPrecision(0)
      setShareMinutes(60)
      await startLocationSharing(0, 60)
    } catch (reason) {
      showError(reason)
    }
  }

  function dismissSosAlert() {
    stopSosAlarm()
    setSosAlert(null)
  }

  function disconnect() {
    discardRecording()
    stopLocationSharing(true)
    void stopNearby()
    dismissSosAlert()
    sessionRef.current?.close()
    sessionRef.current = null
    setPhase('idle')
    setInviteValue('')
    setIncomingInvite(null)
    setLocations({})
    releaseAudioMessages()
  }

  function releaseAudioMessages() {
    for (const audioUrl of audioUrlsRef.current) URL.revokeObjectURL(audioUrl)
    audioUrlsRef.current.clear()
    incomingAudioRef.current.clear()
    setMessages((current) => current.filter((item) => item.kind !== 'audio' && !item.audioUrl))
  }

  function clearMessageHistory() {
    for (const audioUrl of audioUrlsRef.current) URL.revokeObjectURL(audioUrl)
    audioUrlsRef.current.clear()
    incomingAudioRef.current.clear()
    setMessages([])
    localStorage.removeItem(MESSAGE_STORAGE_KEY)
  }

  function showError(reason: unknown) {
    setError(errorMessage(reason, 'Something went wrong'))
    setPhase('error')
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteValue)
  }

  const paired = phase === 'connected'
  const sharing = sharingUntil !== null

  return (
    <div className="circle-page">
      {sosAlert && <div className="sos-banner" role="alert">
        <Siren size={26} />
        <div><strong>{sosAlert.sender} sent an SOS</strong><br /><span>Sent {new Date(sosAlert.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Their exact location is sharing on the map below.</span></div>
        <div className="sos-actions">
          <button className="solid" type="button" onClick={() => { void openDialerWithCode('112') }}>Call 112</button>
          <button type="button" onClick={dismissSosAlert}>Dismiss</button>
        </div>
      </div>}
      {showFakeCall && <FakeCall onClose={() => setShowFakeCall(false)} />}
      <section className="circle-hero">
        <div>
          <p className="circle-eyebrow"><Shield size={15} /> Safety Circle</p>
          <h1>Close to your people.<br />Invisible to everyone else.</h1>
          <p>Peer-to-peer location and chat with no Ionity account, tracking SDK, map tiles, signaling server, message server, STUN, or TURN.</p>
        </div>
        <div className="privacy-orbit" aria-hidden="true"><Users size={42} /><span /><span /><span /></div>
      </section>

      <section className="circle-workspace">
        <EmergencyRow onFakeCall={() => setShowFakeCall(true)} />
        <div className="privacy-principles">
          <span><LockKeyhole size={17} /><strong>Double encrypted</strong><small>WebRTC plus AES-GCM</small></span>
          <span><Crosshair size={17} /><strong>500 m buffer</strong><small>Exact location is opt-in</small></span>
          <span><Clock3 size={17} /><strong>Auto expires</strong><small>Sharing stops on time</small></span>
          <span><ShieldOff size={17} /><strong>No tracking stack</strong><small>No cloud map or analytics</small></span>
        </div>

        {!paired ? (
          <section className="pairing-layout">
            <div className="pairing-main">
              <p className="section-kicker">Device-to-device pairing</p>
              <h2>{incomingInvite ? `${incomingInvite.displayName} invited you` : 'Create a private link'}</h2>
              <p className="pairing-copy">Both devices should be on the same reachable Wi-Fi or local network. The QR contains only a temporary connection handshake and public encryption key.</p>
              <label className="field-label">Your name on this device<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={32} /></label>

              {incomingInvite ? (
                <button className="circle-primary" type="button" onClick={joinCircle}><Link2 size={18} /> Accept private invite</button>
              ) : (
                <div className="pair-actions">
                  <button className="circle-primary" type="button" onClick={createCircle} disabled={phase === 'creating'}><UserPlus size={18} /> {phase === 'creating' ? 'Preparing locally...' : 'Invite trusted member'}</button>
                </div>
              )}

              <div className="manual-pair">
                <label className="field-label">Or paste an invite / response code<textarea value={manualCode} onChange={(event) => setManualCode(event.target.value)} rows={3} placeholder="Paste the complete NoMore code" /></label>
                <div className="pair-actions">
                  <button className="circle-secondary" type="button" onClick={scanInvite} disabled={scanning}><Camera size={17} /> {scanning ? 'Opening camera...' : 'Scan QR'}</button>
                  <button className="circle-secondary" type="button" onClick={useManualCode} disabled={!manualCode.trim()}>Use code</button>
                </div>
              </div>
              {error && <p className="circle-error"><AlertTriangle size={17} /> {error}</p>}
            </div>

            <aside className="qr-panel">
              {inviteValue ? <>
                <p className="section-kicker">{phase === 'answer-ready' ? 'Return this response' : 'Scan on trusted device'}</p>
                <div className="qr-frame"><QRCodeSVG value={inviteValue} size={220} level="L" marginSize={2} title="Encrypted peer invitation" /></div>
                <div className="pair-actions">
                  <button className="circle-secondary" type="button" onClick={copyInvite}><Copy size={16} /> Copy code</button>
                  {phase === 'offer-ready' && <button className="circle-secondary" type="button" onClick={renewInvite}><RefreshCw size={16} /> Renew</button>}
                </div>
                <p>Valid for 5 minutes. {phase === 'answer-ready' ? 'The inviter scans this response to finish the direct link.' : 'Your friend scans this QR, then returns their response QR.'}</p>
              </> : <>
                <div className="qr-placeholder"><Smartphone size={34} /><Radio size={20} /></div>
                <h3>No pairing server</h3>
                <p>The two QR exchange replaces a signaling service. Invitation data stays in the URL fragment and is not sent with web requests.</p>
              </>}
            </aside>
          </section>
        ) : (
          <section className="circle-dashboard">
            <div className="circle-statusbar">
              <span className="live-peer"><span /> Direct link to <strong>{peerName}</strong></span>
              <button className={sosArmed ? 'sos-button armed' : 'sos-button'} type="button" onClick={() => { void pressSos() }}><Siren size={17} /> {sosArmed ? 'Tap again to send SOS' : 'SOS'}</button>
              <button className="danger-button" type="button" onClick={disconnect}><Unplug size={16} /> Disconnect</button>
            </div>

            <div className="device-panel">
              <div><Smartphone size={19} /><span><strong>{displayName}</strong><small>{Capacitor.isNativePlatform() ? `${Capacitor.getPlatform()} app · this device` : 'Web browser · this device'}</small></span></div>
              <div><Smartphone size={19} /><span><strong>{peerName}</strong><small>Connected peer · encrypted direct link</small></span></div>
              <p><Radio size={15} /> Chat needs reachable Wi-Fi or mobile data such as EDGE. Satellite works only when the device or carrier exposes it as a normal network connection.</p>
            </div>
            {error && <p className="circle-error dashboard-error"><AlertTriangle size={17} /> {error}</p>}

            <div className="nearby-panel">
              <div className="panel-heading"><div><p className="section-kicker">Anonymous Bluetooth beacon</p><h2>Find nearby</h2></div><span><Bluetooth size={17} /> No names broadcast</span></div>
              <div className="nearby-body">
                {nearbyActive ? <>
                  <div className={nearbyReading ? `nearby-reading band-${nearbyReading.band}` : 'nearby-reading'}>
                    <Radar size={22} />
                    {nearbyReading ? <span><strong>{BAND_LABELS[nearbyReading.band]}</strong><small>Estimated ~{nearbyReading.distance} m from {peerName}</small></span> : <span><strong>Listening for {peerName}...</strong><small>Both phones must keep this panel open</small></span>}
                  </div>
                  <button className="circle-secondary" type="button" onClick={() => { void stopNearby() }}><ShieldOff size={16} /> Stop beacon</button>
                </> : <>
                  <p className="nearby-copy">Both phones broadcast an anonymous beacon derived from this circle — no names, no addresses, no message content. Readings are approximate: walls, pockets, and antennas change them.</p>
                  <button className="circle-secondary" type="button" onClick={() => { void startNearby() }}><Radar size={16} /> Find nearby (approximate)</button>
                </>}
                {nearbyNote && <p className="nearby-note"><AlertTriangle size={15} /> {nearbyNote}</p>}
              </div>
            </div>

            <div className="geomap-panel">
              <div className="panel-heading"><div><p className="section-kicker">Local geomap</p><h2>Shared positions</h2></div><span><MapIcon size={17} /> No map server</span></div>
              <LocalGeoMap locations={locations} ownName={displayName} />
              <div className="sharing-controls">
                <label>Location precision<select value={precision} onChange={(event) => setPrecision(Number(event.target.value) as LocationPrecision)} disabled={sharing}>
                  <option value={1000}>Area only · 1 km</option><option value={500}>Neighbourhood · 500 m</option><option value={100}>Nearby · 100 m</option><option value={0}>Exact · higher risk</option>
                </select></label>
                <label>Stop automatically<select value={shareMinutes} onChange={(event) => setShareMinutes(Number(event.target.value))} disabled={sharing}>
                  <option value={5}>After 5 minutes</option><option value={15}>After 15 minutes</option><option value={60}>After 1 hour</option>
                </select></label>
                {sharing ? <button className="stop-sharing" type="button" onClick={() => stopLocationSharing(true)}><ShieldOff size={18} /> Stop sharing now</button> : <button className="circle-primary" type="button" onClick={() => { void startLocationSharing() }}><LocateFixed size={18} /> Share my location</button>}
              </div>
              {precision === 0 && !sharing && <p className="exact-warning"><AlertTriangle size={16} /> Exact mode can reveal a home or routine. Use it briefly and only with people you trust.</p>}
              {sharingUntil && <p className="sharing-visible"><Radio size={15} /> Location sharing is visible and ends at {new Date(sharingUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p>}
            </div>

            <div className="chat-panel">
              <div className="panel-heading"><div><p className="section-kicker">Encrypted inbox</p><h2>Safety chat</h2></div><span><KeyRound size={17} /> E2E</span></div>
              <div className="history-controls"><label><input type="checkbox" checked={rememberMessages} onChange={(event) => setRememberMessages(event.target.checked)} /> Remember text on this device</label><button type="button" onClick={clearMessageHistory} disabled={messages.length === 0} title="Clear local message history"><Trash2 size={15} /> Clear</button></div>
              <div className="message-list" aria-live="polite">
                {messages.length === 0 ? <div className="empty-chat"><MessageCircle size={30} /><p>Text and voice notes travel only over the encrypted peer link. Voice notes are erased when you disconnect.</p></div> : messages.map((item) => <article className={item.own ? 'message own' : 'message'} key={item.id}><strong>{item.own ? 'You' : item.sender}</strong>{item.kind === 'audio' && item.audioUrl ? <audio controls preload="metadata" src={item.audioUrl}>Voice note playback is not supported.</audio> : <p>{item.text}</p>}<time>{new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></article>)}
              </div>
              <form className="message-compose" onSubmit={(event) => { event.preventDefault(); void sendMessage() }}>
                <button className={recording ? 'record-button recording' : 'record-button'} type="button" onClick={recording ? stopRecording : startRecording} disabled={sendingAudio} aria-label={recording ? 'Stop and send voice note' : 'Record encrypted voice note'} title={recording ? 'Stop and send' : 'Record voice note'}>{recording ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</button>
                <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder={recording ? 'Recording... 30 seconds maximum' : sendingAudio ? 'Encrypting and sending voice note...' : `Message ${peerName}`} aria-label={`Message ${peerName}`} disabled={recording || sendingAudio} />
                <button type="submit" aria-label="Send encrypted message" disabled={!message.trim()}><Send size={18} /></button>
              </form>
            </div>
          </section>
        )}
      </section>
    </div>
  )
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason instanceof Error) return reason.message
  if (reason && typeof reason === 'object' && 'message' in reason && typeof reason.message === 'string') {
    return reason.message
  }
  return fallback
}

function LocalGeoMap({ locations, ownName }: { locations: Record<string, PrivateLocation>; ownName: string }) {
  const entries = Object.entries(locations)
  const center = entries[0]?.[1]
  return (
    <div className="local-geomap">
      <div className="map-grid" />
      {center ? entries.map(([name, location], index) => {
        const latitudeOffset = (location.latitude - center.latitude) * 8000
        const longitudeOffset = (location.longitude - center.longitude) * 8000
        const left = Math.max(12, Math.min(88, 50 + longitudeOffset))
        const top = Math.max(12, Math.min(88, 50 - latitudeOffset))
        return <div className={name === ownName ? 'map-member own-member' : 'map-member'} key={name} style={{ left: `${left}%`, top: `${top}%` }}>
          <span>{name.slice(0, 1).toUpperCase()}</span><strong>{name === ownName ? 'You' : name}</strong><small>±{location.accuracy} m · {index === 0 ? 'map centre' : 'shared now'}</small>
        </div>
      }) : <div className="map-empty"><LocateFixed size={30} /><strong>No location is being shared</strong><span>The map has no external tiles or network requests.</span></div>}
    </div>
  )
}