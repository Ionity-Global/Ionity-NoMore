// AEDi: Ionity's private on-device assistant.
// A compact intent engine — tokenizing, synonym expansion, and weighted
// scoring over a local knowledge base. No prompt ever leaves the device.

export interface AediAnswer {
  topic: string
  answer: string
  confidence: number
}

interface KnowledgeEntry {
  topic: string
  keywords: Record<string, number>
  answer: string
}

const SYNONYMS: Record<string, string> = {
  buddy: 'friend', mate: 'friend', family: 'friend', partner: 'friend', child: 'friend',
  qrcode: 'qr', barcode: 'qr', code: 'qr', invite: 'qr', pair: 'scan', pairing: 'scan',
  connect: 'scan', connection: 'network', joining: 'scan', join: 'scan',
  record: 'voice', recordings: 'voice', recording: 'voice', audio: 'voice', mic: 'voice',
  microphone: 'voice', speak: 'voice', hear: 'voice', note: 'voice', notes: 'voice',
  gps: 'location', position: 'location', track: 'location', tracked: 'location',
  tracking: 'location', follow: 'location', map: 'location', whereabouts: 'location',
  internet: 'network', wifi: 'network', data: 'network', signal: 'network', edge: 'network',
  satellite: 'network', offline: 'network', airtime: 'billing', bill: 'billing',
  billed: 'billing', billing: 'billing', charge: 'billing', charged: 'billing',
  charges: 'billing', deducted: 'billing', money: 'billing', paid: 'billing',
  wasp: 'subscription', subscriptions: 'subscription', subscribed: 'subscription',
  service: 'subscription', services: 'subscription', cancel: 'stop', unsubscribe: 'stop',
  stopping: 'stop', quit: 'stop', block: 'stop', vodacom: 'carrier', mtn: 'carrier',
  cellc: 'carrier', telkom: 'carrier', rain: 'carrier', sim: 'carrier', network2: 'carrier',
  operator: 'carrier', provider: 'carrier', ussd: 'dial', dialer: 'dial', dialing: 'dial',
  call: 'dial', photo: 'ocr', photograph: 'ocr', picture: 'ocr', image: 'ocr',
  screenshot: 'ocr', read: 'ocr', reading: 'ocr', text2: 'ocr',
  encrypted: 'privacy', encryption: 'privacy', secure: 'privacy', security: 'privacy',
  private: 'privacy', safe: 'privacy', spy: 'privacy', server: 'privacy', cloud: 'privacy',
  nearby: 'proximity', close: 'proximity', near: 'proximity', distance: 'proximity',
  bluetooth: 'proximity', indoors: 'proximity', find: 'proximity', metres: 'proximity',
  meters: 'proximity', spam: 'marketing', promo: 'marketing', promotional: 'marketing',
  advert: 'marketing', adverts: 'marketing', ads: 'marketing', sms: 'message',
  texts: 'message', messages: 'message',
}

const KNOWLEDGE: KnowledgeEntry[] = [
  {
    topic: 'pairing',
    keywords: { qr: 3, scan: 3, friend: 2, renew: 2, expired: 2, circle: 1, camera: 1 },
    answer:
      'Open Safety Circle and tap Scan QR, then allow camera access. Scan your friend\u2019s code and let them scan your reply code. Codes expire after five minutes for safety \u2014 tap Renew if one expires.',
  },
  {
    topic: 'voice',
    keywords: { voice: 3, stop: 1, message: 1, seconds: 1, chunk: 1 },
    answer:
      'After connecting, tap the microphone and speak for up to 30 seconds. Every chunk is end-to-end encrypted before it leaves your phone, and recordings exist only for this session \u2014 they are never stored on a server.',
  },
  {
    topic: 'network',
    keywords: { network: 3, chat: 1, work: 1, need: 1 },
    answer:
      'Chat needs any reachable data path between the two phones \u2014 Wi\u2011Fi or mobile data, even EDGE. There is no relay server: if your networks cannot reach each other directly, the private link cannot form.',
  },
  {
    topic: 'location',
    keywords: { location: 3, share: 2, buffer: 2, accuracy: 1, privacy: 1 },
    answer:
      'Location permission is requested only after you tap Share. By default your position is buffered to 500 m before it is encrypted and sent to your peer, and sharing stops automatically on the timer.',
  },
  {
    topic: 'subscription',
    keywords: { subscription: 3, stop: 3, billing: 3, carrier: 1, dial: 1 },
    answer:
      'Open Paid subscriptions in Cleanup. AEDi shows the exact code for your carrier \u2014 on Android your SIM is detected automatically. The dialer opens with the code filled in; nothing runs until you press call.',
  },
  {
    topic: 'carrier',
    keywords: { carrier: 3, detect: 2, choose: 1, wrong: 1 },
    answer:
      'In the Android app your carrier is read from the SIM itself \u2014 no permission or account needed, and nothing is uploaded. On the web you choose your carrier manually from the list.',
  },
  {
    topic: 'ocr',
    keywords: { ocr: 3, message: 2, suspicious: 1, check: 1 },
    answer:
      'Tap \u201cRead a message photo\u201d and choose a screenshot or photo of the SMS. AEDi reads it entirely on this phone with a bundled OCR model \u2014 no upload \u2014 then tells you if it looks like a paid subscription and which code stops it.',
  },
  {
    topic: 'privacy',
    keywords: { privacy: 3, location: 1, message: 1, account: 1 },
    answer:
      'NoMore has no account, no analytics, and no server that stores your content. Chat, voice notes, and location travel directly between the two phones over an ECDH P\u2011256 + AES\u2011GCM encrypted link.',
  },
  {
    topic: 'proximity',
    keywords: { proximity: 3, friend: 1, accuracy: 1, room: 1 },
    answer:
      'When connected, tap Find nearby. Both phones exchange an anonymous Bluetooth beacon derived from your circle \u2014 no names, no addresses \u2014 and AEDi shows an approximate closeness band. Walls, pockets, and phone antennas change readings, so treat it as a guide, not a ruler.',
  },
  {
    topic: 'marketing',
    keywords: { marketing: 3, stop: 2, message: 2, waspa: 1 },
    answer:
      'For promotional SMS, reply STOP to the sender \u2014 South African senders must honour it. For broader relief, open Do Not Contact in Cleanup to use the WASPA registry.',
  },
]

const FALLBACK =
  'I can help with QR pairing, voice notes, connection requirements, location privacy, reading a suspicious SMS photo, carrier codes, and nearby detection. Ask in your own words \u2014 nothing you type or photograph leaves this phone.'

export function normalizeToken(token: string): string {
  const cleaned = token.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!cleaned) return ''
  const synonym = SYNONYMS[cleaned]
  if (synonym) return synonym
  const singular = cleaned.length > 3 && cleaned.endsWith('s') ? cleaned.slice(0, -1) : cleaned
  return SYNONYMS[singular] ?? singular
}

export function askAedi(question: string): AediAnswer {
  const tokens = new Set(question.split(/\s+/).map(normalizeToken).filter(Boolean))
  let best: { entry: KnowledgeEntry; score: number } | null = null
  for (const entry of KNOWLEDGE) {
    let score = 0
    for (const [keyword, weight] of Object.entries(entry.keywords)) {
      if (tokens.has(keyword)) score += weight
    }
    if (score > 0 && (!best || score > best.score)) best = { entry, score }
  }
  if (!best || best.score < 2) {
    return { topic: 'fallback', answer: FALLBACK, confidence: 0 }
  }
  return {
    topic: best.entry.topic,
    answer: best.entry.answer,
    confidence: Math.min(1, best.score / 6),
  }
}

export interface MessageAnalysis {
  looksLikeSubscription: boolean
  shortCodes: string[]
  prices: string[]
  hasStopInstruction: boolean
  summary: string
}

const SUBSCRIPTION_WORDS =
  /subscri|content service|wasp|club|vip|winner|prize|claim|renew|billed|deducted|airtime|per day|per week|per month|p\/d|\/day|\/week|\/month/i

export function analyzeMessageText(raw: string): MessageAnalysis {
  const text = raw.replace(/\s+/g, ' ').trim()
  const shortCodes = [...new Set(text.match(/\b\d{5}\b/g) ?? [])]
  const prices = [...new Set(text.match(/R\s?\d+(?:[.,]\d{2})?/gi) ?? [])].map((price) => price.replace(/\s/g, ''))
  const hasStopInstruction = /\bstop\b/i.test(text)
  const looksLikeSubscription = SUBSCRIPTION_WORDS.test(text) || (prices.length > 0 && shortCodes.length > 0)

  let summary: string
  if (!text) {
    summary = 'I could not read any text in that image. Try a sharper photo with the message filling the frame.'
  } else if (looksLikeSubscription) {
    const parts = ['This looks like a paid subscription service.']
    if (prices.length) parts.push(`It mentions ${prices.join(', ')}.`)
    if (hasStopInstruction && shortCodes.length) {
      parts.push(`You can reply STOP to ${shortCodes.join(' or ')} \u2014 South African WASPs must honour it.`)
    } else if (shortCodes.length) {
      parts.push(`It uses short code ${shortCodes.join(', ')}.`)
    }
    parts.push('The safest route is your carrier\u2019s own cancellation code in Paid subscriptions below.')
    summary = parts.join(' ')
  } else {
    summary =
      'I read the message but it does not look like a paid subscription. If it is marketing, reply STOP; if it feels like a scam, do not reply at all \u2014 block the sender.'
  }

  return { looksLikeSubscription, shortCodes, prices, hasStopInstruction, summary }
}
