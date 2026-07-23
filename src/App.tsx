import { useState } from 'react'
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  LockKeyhole,
  MessageSquareOff,
  RadioTower,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { SafetyCircle } from './features/circle/SafetyCircle'
import './App.css'

type ActionKey = 'subscriptions' | 'spam' | 'dnc'
type ActionStatus = 'ready' | 'confirming' | 'verifying' | 'complete'

const actions = [
  { key: 'subscriptions' as const, icon: MessageSquareOff, title: 'Paid subscriptions', description: 'Check and cancel content services billed to your mobile account.', code: '*135*997#', carrier: 'Vodacom' },
  { key: 'spam' as const, icon: ShieldCheck, title: 'Marketing messages', description: 'Use official opt-out guidance for unwanted promotional messages.', code: 'Reply STOP', carrier: 'Message sender' },
  { key: 'dnc' as const, icon: RadioTower, title: 'Do Not Contact', description: 'Open the official WASPA registry and manage your number.', code: 'WASPA DNC', carrier: 'Independent service' },
]

const assistantPrompts = ['How do I scan a friend?', 'How do voice notes work?', 'Does chat need data?', 'How is my location protected?', 'How do I stop paid services?']

function App() {
  const [view, setView] = useState<'cleanup' | 'circle'>('cleanup')
  const [selectedAction, setSelectedAction] = useState<ActionKey | null>(null)
  const [status, setStatus] = useState<ActionStatus>('ready')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantReply, setAssistantReply] = useState('Choose a question below. I only use the guidance stored on this device.')
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const action = actions.find((item) => item.key === selectedAction)

  function openAction(actionKey: ActionKey) {
    setSelectedAction(actionKey)
    setStatus('confirming')
  }

  function closeAction() {
    setSelectedAction(null)
    setStatus('ready')
  }

  function answerPrompt(prompt: string) {
    const replies: Record<string, string> = {
      'How do I stop paid services?': 'Start with Paid subscriptions. NoMore will show the exact carrier code before anything opens.',
      'How do I scan a friend?': 'Open Safety Circle, tap Scan QR, and allow camera access. Scan your friend’s five-minute code, then let them scan your response.',
      'How do voice notes work?': 'After connecting, tap the microphone, allow access, speak for up to 30 seconds, then tap Stop. Each chunk is end-to-end encrypted. Recordings stay only for this connection.',
      'Does chat need data?': 'Chat needs a reachable Wi-Fi or mobile-data path, including EDGE. NoMore has no relay server. Satellite works only when Android or your carrier exposes it as a normal network connection.',
      'How is my location protected?': 'Location permission is requested only after you tap Share. The default position is buffered by 500 m, sent over the encrypted peer link, and stops on the timer.',
    }
    const normalized = prompt.toLowerCase()
    const matched = replies[prompt]
      ?? (normalized.includes('qr') || normalized.includes('scan') || normalized.includes('friend') ? replies['How do I scan a friend?']
        : normalized.includes('voice') || normalized.includes('record') || normalized.includes('microphone') || normalized.includes('hear') ? replies['How do voice notes work?']
          : normalized.includes('data') || normalized.includes('satellite') || normalized.includes('edge') || normalized.includes('network') ? replies['Does chat need data?']
            : normalized.includes('location') || normalized.includes('gps') || normalized.includes('track') ? replies['How is my location protected?']
              : normalized.includes('paid') || normalized.includes('subscription') || normalized.includes('cancel') ? replies['How do I stop paid services?']
                : 'I can help with QR pairing, voice notes, connection requirements, location privacy, and mobile cleanup. No prompt is uploaded or sent to a model.')
    setAssistantReply(matched)
  }

  function askAssistant(event: React.FormEvent) {
    event.preventDefault()
    if (!assistantQuestion.trim()) return
    answerPrompt(assistantQuestion.trim())
    setAssistantQuestion('')
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
          <button className="icon-button" type="button" title="Help" aria-label="Help"><CircleHelp size={20} /></button>
        </div>
      </header>

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
          <div className="connection-copy"><strong>Carrier detection is available in the Android app</strong><span>Choose your carrier manually in this web preview.</span></div>
          <button className="text-button" type="button">Choose carrier <ChevronRight size={17} /></button>
        </div>
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
          <div className="assistant-intro"><span className="assistant-icon"><Bot size={23} /></span><div><p className="section-kicker">Private assistant</p><h2>Not sure where to start?</h2></div></div>
          <p>Ask in your own words. Local intent matching finds guidance without uploading your question.</p>
          <button className="secondary-button" type="button" onClick={() => setAssistantOpen(true)}>Ask NoMore <ArrowRight size={17} /></button>
        </aside>
      </section>

      <footer><span>Building Tomorrow, Today.</span><a href="https://www.ionity.co.za" target="_blank" rel="noreferrer">ionity.co.za <ExternalLink size={13} /></a></footer>

      {action && <div className="modal-backdrop" role="presentation" onMouseDown={closeAction}>
        <section className="action-modal" role="dialog" aria-modal="true" aria-labelledby="action-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close icon-button" type="button" onClick={closeAction} aria-label="Close"><X size={20} /></button>
          {status === 'confirming' && <>
            <p className="section-kicker">Review exact action</p><h2 id="action-title">{action.title}</h2><p>{action.description}</p>
            <dl className="action-preview"><div><dt>Action</dt><dd>{action.code}</dd></div><div><dt>Provider</dt><dd>{action.carrier}</dd></div><div><dt>Cost</dt><dd>Standard carrier rates may apply</dd></div></dl>
            <p className="safety-note"><ShieldCheck size={18} /> Nothing runs until you continue and confirm with your carrier.</p>
            <button className="primary-button" type="button" onClick={() => setStatus('verifying')}>Continue safely <ArrowRight size={18} /></button>
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
        <div className="drawer-heading"><span className="assistant-icon"><Bot size={23} /></span><div><p className="section-kicker">On-device guidance</p><h2 id="assistant-title">Ask NoMore</h2></div><button className="icon-button" type="button" onClick={() => setAssistantOpen(false)} aria-label="Close assistant"><X size={20} /></button></div>
        <div className="assistant-answer">{assistantReply}</div>
        <form className="assistant-form" onSubmit={askAssistant}><input value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} maxLength={180} placeholder="Ask about pairing, data, GPS..." aria-label="Ask the private assistant" /><button type="submit" disabled={!assistantQuestion.trim()} aria-label="Ask"><ArrowRight size={18} /></button></form>
        <div className="prompt-list">{assistantPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => answerPrompt(prompt)}>{prompt}<ChevronRight size={17} /></button>)}</div>
        <p className="drawer-privacy"><LockKeyhole size={14} /> No messages leave this device.</p>
      </div>}
      </>}
    </main>
  )
}

export default App
