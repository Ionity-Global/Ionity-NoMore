// Local sound and vibration alerts. Everything is synthesized on-device
// with WebAudio — no audio files, no network, no permissions.

let audio: AudioContext | null = null

function context(): AudioContext | null {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    return audio
  } catch {
    return null
  }
}

function tone(frequency: number, offsetSeconds: number, durationSeconds: number, volume = 0.35) {
  const ctx = context()
  if (!ctx) return
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const start = ctx.currentTime + offsetSeconds
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.02)
  gain.gain.setValueAtTime(volume, start + durationSeconds - 0.03)
  gain.gain.linearRampToValueAtTime(0, start + durationSeconds)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + durationSeconds + 0.02)
}

export function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Vibration is unsupported here; audio and visuals still alert.
  }
}

let ringTimer: number | null = null

// South African ringback cadence: 400 Hz, on for two short bursts, then quiet.
export function startRinging() {
  stopRinging()
  const burst = () => {
    tone(400, 0, 0.4)
    tone(400, 0.6, 0.4)
    vibrate([400, 200, 400])
  }
  burst()
  ringTimer = window.setInterval(burst, 3_000)
}

export function stopRinging() {
  if (ringTimer !== null) {
    window.clearInterval(ringTimer)
    ringTimer = null
  }
  vibrate([0])
}

let sosTimer: number | null = null
let sosStopTimer: number | null = null

export function startSosAlarm() {
  stopSosAlarm()
  const burst = () => {
    tone(880, 0, 0.18, 0.45)
    tone(660, 0.24, 0.18, 0.45)
    tone(880, 0.48, 0.18, 0.45)
    vibrate([250, 120, 250, 120, 250])
  }
  burst()
  sosTimer = window.setInterval(burst, 1_600)
  // Cap the audible alarm; the visual banner stays until dismissed.
  sosStopTimer = window.setTimeout(stopSosAlarm, 30_000)
}

export function stopSosAlarm() {
  if (sosTimer !== null) {
    window.clearInterval(sosTimer)
    sosTimer = null
  }
  if (sosStopTimer !== null) {
    window.clearTimeout(sosStopTimer)
    sosStopTimer = null
  }
  vibrate([0])
}
