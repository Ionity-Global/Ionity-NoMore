import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  LockKeyhole,
  MessageSquareOff,
  PhoneCall,
  RadioTower,
  ScanText,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { SafetyCircle } from './features/circle/SafetyCircle'
import { analyzeMessageText, askAedi } from './features/aedi/engine'
import { recognizeImage } from './features/aedi/ocr'
import { CARRIERS, type CarrierProfile } from './features/device/carriers'
import { APP_DOWNLOAD_URL, detectCarrier, isNativeAndroid, openDialerWithCode, shareNoMore } from './features/device/native'
import './App.css'

type ActionKey = 'subscriptions' | 'spam' | 'dnc'
type ActionStatus = 'ready' | 'confirming' | 'verifying' | 'complete'

const assistantPrompts = ['How do I stop paid services?', 'Can you read a suspicious SMS photo?', 'How do I scan a friend?', 'How do voice notes work?', 'How is my location protected?']

function App() {
  const [view, setView] = useState<'cleanup' | 'circle'>('cleanup')
  const [selectedAction, setSelectedAction] = useState<ActionKey | null>(null)
  const [status, setStatus] = useState<ActionStatus>('ready')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantReply, setAssistantReply] = useState('I\u2019m AEDi. Ask in your own words, or hand me a photo of a suspicious SMS \u2014 everything is answered with knowledge stored on this device.')
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const [carrier, setCarrier] = useState<CarrierProfile | null>(null)
  const [carrierSource, setCarrierSource] = useState<'sim' | 'manual' | null>(null)
  const [choosingCarrier, setChoosingCarrier] = useState(false)
  const [reading, setReading] = useState(false)
  const [shareNote, setShareNote] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)
  const shareNoteTimerRef = useRef<number | null>(null)

  useEffect(() => {
    void detectCarrier().then((detected) => {
      if (detected) {
        setCarrier(detected)
        setCarrierSource('sim')
      }
    })
  }, [])

  const actions = [
    {
      key: 'subscriptions' as const,
      icon: MessageSquareOff,
      title: 'Paid subscriptions',
      description: carrier?.guidance ?? 'Check and cancel content services billed to your mobile account.',
      code: carrier ? carrier.subscriptionsCode ?? 'App / web only' : 'Choose carrier first',
      carrier: carrier?.name ?? 'Select your carrier above',
    },
    { key: 'spam' as const, icon: ShieldCheck, title: 'Marketing messages', description: 'Use official opt-out guidance for unwanted promotional messages.', code: 'Reply STOP', carrier: 'Message sender' },
    { key: 'dnc' as const, icon: RadioTower, title: 'Do Not Contact', description: 'Open the official WASPA registry and manage your number.', code: 'WASPA DNC', carrier: 'Independent service' },
  ]
  const action = actions.find((item) => item.key === selectedAction)
  const canDial = Boolean(action?.key === 'subscriptions' && carrier?.subscriptionsCode)

  function openAction(actionKey: ActionKey) {
    setSelectedAction(actionKey)
    setStatus('confirming')
  }

  function closeAction() {
    setSelectedAction(null)
    setStatus('ready')
  }

  function continueAction() {
    if (canDial && carrier?.subscriptionsCode) {
      void openDialerWithCode(carrier.subscriptionsCode)
    }
    setStatus('verifying')
  }

  function chooseCarrier(profile: CarrierProfile) {
    setCarrier(profile)
    setCarrierSource('manual')
    setChoosingCarrier(false)
  }

  function answerPrompt(prompt: string) {
    setAssistantReply(askAedi(prompt).answer)
  }

  function askAssistant(event: React.FormEvent) {
    event.preventDefault()
    if (!assistantQuestion.trim()) return
    answerPrompt(assistantQuestion.trim())
    setAssistantQuestion('')
  }

  async function readMessagePhoto(file: File) {
    setReading(true)
    setAssistantReply('Reading the photo on this phone\u2026 the first read loads the local model and takes a few seconds.')
    try {
      const { text } = await recognizeImage(file)
      const analysis = analyzeMessageText(text)
      setAssistantReply(analysis.summary)
    } catch {
      setAssistantReply('I could not read that image on this device. Try a sharper, well-lit photo with the message filling the frame.')
    } finally {
      setReading(false)
    }
  }

  function onPhotoPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void readMessagePhoto(file)
  }

  async function shareApp() {
    const outcome = await shareNoMore()
    const notes = {
      apk: 'Sharing the app itself \u2014 it can travel by Bluetooth or Quick Share, no data needed.',
      link: 'Download link shared.',
      copied: 'Download link copied. Paste it anywhere.',
      unavailable: `Sharing is unavailable here. Download link: ${APP_DOWNLOAD_URL}`,
    }
    setShareNote(notes[outcome])
    if (shareNoteTimerRef.current !== null) window.clearTimeout(shareNoteTimerRef.current)
    shareNoteTimerRef.current = window.setTimeout(() => setShareNote(''), 6_000)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="https://www.ionity.co.za" target="_blank" rel="noreferrer">
          <span className="official-mark"><img src="/brand/ionity-global.png" alt="" /></span>
          <span>IONITY <strong>NoMore</strong></span>
        </a>
        <div className="header-actions">
          <nav className="view-switch" aria-label="App sections">
            <button className={view === 'cleanup' ? 'active' : ''} type="button" onClick={() => setView('cleanup')}><ShieldCheck size={15} /> Cleanup</button>
            <button className={view === 'circle' ? 'active' : ''} type="button" onClick={() => setView('circle')}><Users size={15} /> Safety Circle</button>
          </nav>
          <span className="privacy-badge"><LockKeyhole size={14} /> Private by design</span>
          <button className="icon-button" type="button" onClick={() => { void shareApp() }} title="Share this app" aria-label="Share this app"><Share2 size={19} /></button>
          <button className="icon-button" type="button" title="Help" aria-label="Help"><CircleHelp size={20} /></button>
        </div>
      </header>
      {shareNote && <div className="share-toast" role="status">{shareNote}</div>}

      {view === 'circle' ? <SafetyCircle /> : <>
      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={15} /> Mobile account cleanup</p>
          <h1>Take back control<br />of your mobile number.</h1>
          <p className="hero-description">Find the right official route to cancel paid services, quiet unwanted messages, and reduce marketing calls. Every action stays in your hands.</p>
          <div className="trust-row">
            <span><Check size={16} /> No account</span><span><Check size={16} /> No uploaded phone data</span><span><Check size={16} /> Confirm every action</span>
          </div>
        </div>
        <img className="official-banner" src="/brand/ionity-banner.png" alt="Ionity Global, Building Tomorrow Today" />
      </section>

      <section className="workspace">
        <div className="section-heading">
          <div><p className="section-kicker">Your connection</p><h2>Ready to clean up</h2></div>
          <span className="web-mode"><span /> Guided web mode</span>
        </div>
        <div className="connection-strip">
          <div className="sim-icon"><Smartphone size={22} /></div>
          <div className="connection-copy">
            {carrier ? <>
              <strong>{carrier.name} {carrierSource === 'sim' ? 'SIM detected' : 'selected'}</strong>
              <span>{carrierSource === 'sim' ? 'Read from your SIM on this phone \u2014 nothing was uploaded.' : 'Codes below are matched to this carrier.'}</span>
            </> : <>
              <strong>{isNativeAndroid() ? 'No SIM detected' : 'Choose your carrier'}</strong>
              <span>{isNativeAndroid() ? 'Insert a SIM or choose your carrier manually.' : 'In the Android app your SIM is detected automatically.'}</span>
            </>}
          </div>
          <button className="text-button" type="button" onClick={() => setChoosingCarrier((open) => !open)}>{carrier ? 'Change' : 'Choose carrier'} <ChevronRight size={17} /></button>
        </div>
        {choosingCarrier && <div className="carrier-picker" role="listbox" aria-label="Choose your carrier">
          {CARRIERS.map((profile) => <button type="button" key={profile.key} className={carrier?.key === profile.key ? 'selected' : ''} onClick={() => chooseCarrier(profile)} role="option" aria-selected={carrier?.key === profile.key}>{profile.name}</button>)}
        </div>}
        <div className="action-grid">
          {actions.map((item) => {
            const Icon = item.icon
            return <button className="action-card" type="button" key={item.key} onClick={() => openAction(item.key)}>
              <span className="action-icon"><Icon size={23} /></span>
              <span className="action-copy"><strong>{item.title}</strong><span>{item.description}</span></span>
              <span className="card-arrow"><ArrowRight size={19} /></span>
            </button>
          })}
        </div>
        <aside className="assistant-panel">
          <div className="assistant-intro"><span className="assistant-icon"><Bot size={23} /></span><div><p className="section-kicker">AEDi private assistant</p><h2>Not sure where to start?</h2></div></div>
          <p>Ask in your own words or show AEDi a photo of a suspicious SMS. Reading and matching happen on this device, and nothing is uploaded.</p>
          <button className="secondary-button" type="button" onClick={() => setAssistantOpen(true)}>Ask AEDi <ArrowRight size={17} /></button>
        </aside>
      </section>

      <footer><span>Building Tomorrow, Today.</span><a href="https://www.ionity.co.za" target="_blank" rel="noreferrer">ionity.co.za <ExternalLink size={13} /></a></footer>

      {action && <div className="modal-backdrop" role="presentation" onMouseDown={closeAction}>
        <section className="action-modal" role="dialog" aria-modal="true" aria-labelledby="action-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close icon-button" type="button" onClick={closeAction} aria-label="Close"><X size={20} /></button>
          {status === 'confirming' && <>
            <p className="section-kicker">Review exact action</p><h2 id="action-title">{action.title}</h2><p>{action.description}</p>
            <dl className="action-preview"><div><dt>Action</dt><dd>{action.code}</dd></div><div><dt>Provider</dt><dd>{action.carrier}</dd></div><div><dt>Cost</dt><dd>Standard carrier rates may apply</dd></div></dl>
            <p className="safety-note"><ShieldCheck size={18} /> {canDial ? 'Continue opens your dialer with this code filled in. Nothing dials until you press call yourself.' : 'Nothing runs until you continue and confirm with your carrier.'}</p>
            {action.key === 'subscriptions' && !carrier && <p className="safety-note"><Smartphone size={18} /> Choose your carrier first so AEDi can show the exact code.</p>}
            <button className="primary-button" type="button" onClick={continueAction} disabled={action.key === 'subscriptions' && !carrier}>{canDial ? <><PhoneCall size={18} /> Open dialer with {carrier?.subscriptionsCode}</> : <>Continue safely <ArrowRight size={18} /></>}</button>
          </>}
          {status === 'verifying' && <>
            <span className="modal-status"><Smartphone size={26} /></span><p className="section-kicker">Verification required</p><h2 id="action-title">Did the provider confirm it?</h2>
            <p>NoMore cannot inspect your carrier account. Only mark this complete after you see a success message.</p>
            <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setStatus('confirming')}>Not yet</button><button className="primary-button" type="button" onClick={() => setStatus('complete')}><Check size={18} /> Yes, confirmed</button></div>
          </>}
          {status === 'complete' && <>
            <span className="complete-check"><Check size={34} strokeWidth={3} /></span><p className="section-kicker">Provider confirmed</p><h2 id="action-title">Action complete</h2>
            <p>Your confirmation is stored only for this session. No account or mobile data was uploaded.</p><button className="primary-button" type="button" onClick={closeAction}>Back to cleanup</button>
          </>}
        </section>
      </div>}

      {assistantOpen && <div className="assistant-drawer" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
        <div className="drawer-heading"><span className="assistant-icon"><Bot size={23} /></span><div><p className="section-kicker">On-device guidance</p><h2 id="assistant-title">Ask AEDi</h2></div><button className="icon-button" type="button" onClick={() => setAssistantOpen(false)} aria-label="Close assistant"><X size={20} /></button></div>
        <div className="assistant-answer" aria-live="polite">{assistantReply}</div>
        <form className="assistant-form" onSubmit={askAssistant}><input value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} maxLength={180} placeholder="Ask about pairing, billing, GPS..." aria-label="Ask AEDi" disabled={reading} /><button type="submit" disabled={!assistantQuestion.trim() || reading} aria-label="Ask"><ArrowRight size={18} /></button></form>
        <button className="ocr-button" type="button" onClick={() => photoInputRef.current?.click()} disabled={reading}><ScanText size={18} /> {reading ? 'Reading on this device...' : 'Read a message photo (offline OCR)'}</button>
        <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoPicked} hidden aria-hidden="true" />
        <div className="prompt-list">{assistantPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => answerPrompt(prompt)} disabled={reading}>{prompt}<ChevronRight size={17} /></button>)}</div>
        <p className="drawer-privacy"><LockKeyhole size={14} /> Questions and photos never leave this device.</p>
      </div>}
      </>}
    </main>
  )
}

export default App
