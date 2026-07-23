import { describe, expect, it } from 'vitest'
import { analyzeMessageText, askAedi } from './engine'

describe('askAedi', () => {
  it('answers natural questions about voice notes', () => {
    const result = askAedi('can my friend hear my recordings later?')

    expect(result.topic).toBe('voice')
    expect(result.answer).toContain('end-to-end encrypted')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('routes billing complaints to the subscription guidance', () => {
    const result = askAedi('why is airtime being deducted every day, how do I cancel?')

    expect(result.topic).toBe('subscription')
    expect(result.answer).toContain('press call')
  })

  it('understands synonyms like GPS for location privacy', () => {
    expect(askAedi('can anyone track my gps?').topic).toBe('location')
  })

  it('explains the OCR flow for suspicious messages', () => {
    expect(askAedi('can you read a screenshot of a suspicious sms?').topic).toBe('ocr')
  })

  it('falls back honestly when it cannot help', () => {
    const result = askAedi('what is the weather tomorrow?')

    expect(result.topic).toBe('fallback')
    expect(result.confidence).toBe(0)
  })

  it('knows the South African emergency numbers offline', () => {
    const result = askAedi('what is the police emergency number?')

    expect(result.topic).toBe('emergency')
    expect(result.answer).toContain('10111')
    expect(result.answer).toContain('112')
  })

  it('explains the SOS panic flow', () => {
    expect(askAedi('how does the panic alarm work?').topic).toBe('sos')
  })

  it('explains the fake call escape', () => {
    expect(askAedi('can you fake a ring to help me escape?').topic).toBe('fakecall')
  })
})

describe('analyzeMessageText', () => {
  it('flags a WASP subscription with price, short code, and STOP route', () => {
    const analysis = analyzeMessageText(
      'You are subscribed to FunClub for R7.00 per day. To cancel SMS STOP to 31234',
    )

    expect(analysis.looksLikeSubscription).toBe(true)
    expect(analysis.prices).toContain('R7.00')
    expect(analysis.shortCodes).toContain('31234')
    expect(analysis.hasStopInstruction).toBe(true)
    expect(analysis.summary).toContain('reply STOP to 31234')
  })

  it('does not invent subscriptions in ordinary messages', () => {
    const analysis = analyzeMessageText('Hey, are we still meeting at the park at 3?')

    expect(analysis.looksLikeSubscription).toBe(false)
    expect(analysis.summary).toContain('does not look like a paid subscription')
  })

  it('handles unreadable images gracefully', () => {
    expect(analyzeMessageText('   ').summary).toContain('could not read any text')
  })
})
