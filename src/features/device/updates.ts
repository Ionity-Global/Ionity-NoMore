// Explicit, user-initiated update check. Nothing runs in the background and
// nothing identifies the device: one anonymous request to the public GitHub
// releases API, only when the user taps "Check for updates".
// The web/PWA build updates itself automatically via the service worker.

export const APP_VERSION = __APP_VERSION__

export const RELEASES_API =
  'https://api.github.com/repos/Ionity-Global-Pty-Ltd/Ionity-NoMore/releases/latest'

export interface UpdateCheck {
  status: 'current' | 'update' | 'error'
  latest?: string
  url?: string
}

export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

export function parseReleaseTag(tag: string): string | null {
  const match = /^apk-(\d+(?:\.\d+)*)$/.exec(tag.trim())
  return match ? match[1] : null
}

export async function checkForUpdate(): Promise<UpdateCheck> {
  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) return { status: 'error' }
    const release = (await response.json()) as { tag_name?: string; html_url?: string }
    const latest = release.tag_name ? parseReleaseTag(release.tag_name) : null
    if (!latest || !release.html_url) return { status: 'error' }
    if (compareVersions(latest, APP_VERSION) > 0) {
      return { status: 'update', latest, url: release.html_url }
    }
    return { status: 'current', latest }
  } catch {
    return { status: 'error' }
  }
}
