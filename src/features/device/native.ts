// Bridges to the app's own zero-permission native plugins.
// NoMoreDevice reads the SIM carrier (no permission required) and opens the
// dialer with a pre-filled code — the user always presses call themselves.
// NoMoreNearby runs the anonymous Bluetooth closeness beacon.

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { matchCarrier, type CarrierProfile } from './carriers'

interface CarrierInfo {
  available: boolean
  simOperator?: string
  simOperatorName?: string
  networkOperatorName?: string
}

interface NoMoreDevicePlugin {
  getCarrier(): Promise<CarrierInfo>
  openDialer(options: { code: string }): Promise<{ opened: boolean }>
  shareApp(): Promise<{ shared: boolean }>
}

export interface NearbyReading {
  rssi: number
  txPower: number
}

interface NoMoreNearbyPlugin {
  start(options: { serviceUuid: string }): Promise<void>
  stop(): Promise<void>
  addListener(
    eventName: 'reading',
    listener: (reading: NearbyReading) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'scanFailed',
    listener: (failure: { error: number }) => void,
  ): Promise<PluginListenerHandle>
  removeAllListeners(): Promise<void>
}

const NoMoreDevice = registerPlugin<NoMoreDevicePlugin>('NoMoreDevice')
export const NoMoreNearby = registerPlugin<NoMoreNearbyPlugin>('NoMoreNearby')

export function isNativeAndroid(): boolean {
  return Capacitor.getPlatform() === 'android'
}

export async function detectCarrier(): Promise<CarrierProfile | null> {
  if (!isNativeAndroid()) return null
  try {
    const info = await NoMoreDevice.getCarrier()
    if (!info.available) return null
    return matchCarrier(info)
  } catch {
    return null
  }
}

export async function openDialerWithCode(code: string): Promise<boolean> {
  if (isNativeAndroid()) {
    try {
      const { opened } = await NoMoreDevice.openDialer({ code })
      return opened
    } catch {
      return false
    }
  }
  window.location.href = `tel:${encodeURIComponent(code)}`
  return false
}

export const APP_DOWNLOAD_URL = 'https://github.com/Ionity-Global-Pty-Ltd/Ionity-NoMore/releases/latest'

export type ShareOutcome = 'apk' | 'link' | 'copied' | 'unavailable'

// On Android this shares the installed APK itself — the app can spread
// phone-to-phone over Bluetooth or Quick Share with no data connection.
// On the web it shares (or copies) the official download link.
export async function shareNoMore(): Promise<ShareOutcome> {
  if (isNativeAndroid()) {
    try {
      await NoMoreDevice.shareApp()
      return 'apk'
    } catch {
      return 'unavailable'
    }
  }
  const message = 'Ionity NoMore \u2014 private mobile cleanup and family safety circle.'
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Ionity NoMore', text: message, url: APP_DOWNLOAD_URL })
      return 'link'
    } catch {
      // Fall through to the clipboard when the share sheet is dismissed.
    }
  }
  try {
    await navigator.clipboard.writeText(`${message} ${APP_DOWNLOAD_URL}`)
    return 'copied'
  } catch {
    return 'unavailable'
  }
}
