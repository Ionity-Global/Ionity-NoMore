import { useEffect, useState } from 'react'
import { Mic, Phone, PhoneOff, User, Volume2 } from 'lucide-react'
import { startRinging, stopRinging } from './alerts'
import './safety.css'

// A locally generated incoming-call screen: a discreet exit from an
// uncomfortable situation. Nothing is dialed and nothing leaves the phone.
export function FakeCall({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<'ringing' | 'active'>('ringing')
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (stage === 'ringing') {
      startRinging()
      return stopRinging
    }
    const timer = window.setInterval(() => setSeconds((current) => current + 1), 1_000)
    return () => window.clearInterval(timer)
  }, [stage])

  const minutes = Math.floor(seconds / 60)
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="fake-call" role="dialog" aria-modal="true" aria-label="Incoming call">
      <div className="fake-call-top">
        <p className="fake-call-state">{stage === 'ringing' ? 'Incoming call' : clock}</p>
        <span className="fake-call-avatar"><User size={44} /></span>
        <h2>Home</h2>
        <p className="fake-call-line">mobile</p>
      </div>
      {stage === 'ringing' ? (
        <div className="fake-call-actions">
          <button className="fake-decline" type="button" onClick={onClose} aria-label="Decline">
            <PhoneOff size={26} />
          </button>
          <button className="fake-answer" type="button" onClick={() => setStage('active')} aria-label="Answer">
            <Phone size={26} />
          </button>
        </div>
      ) : (
        <div className="fake-call-actions active">
          <span className="fake-call-tool"><Mic size={22} /></span>
          <button className="fake-decline" type="button" onClick={onClose} aria-label="End call">
            <PhoneOff size={26} />
          </button>
          <span className="fake-call-tool"><Volume2 size={22} /></span>
        </div>
      )}
    </div>
  )
}
