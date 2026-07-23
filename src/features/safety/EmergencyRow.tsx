import { PhoneCall, TriangleAlert } from 'lucide-react'
import { openDialerWithCode } from '../device/native'
import './safety.css'

// Official South African emergency numbers. 112 works from any mobile,
// even with no airtime, and on any network. The dialer opens with the
// number filled in — the user always presses call themselves.
const EMERGENCY_NUMBERS = [
  { number: '112', label: 'Any emergency', detail: 'Free from any mobile' },
  { number: '10111', label: 'Police (SAPS)', detail: 'Flying Squad' },
  { number: '10177', label: 'Ambulance / Fire', detail: 'Medical emergencies' },
] as const

export function EmergencyRow({ onFakeCall }: { onFakeCall: () => void }) {
  return (
    <div className="emergency-row" role="group" aria-label="Emergency tools">
      <span className="emergency-title"><TriangleAlert size={16} /> Emergency</span>
      {EMERGENCY_NUMBERS.map((entry) => (
        <button
          key={entry.number}
          type="button"
          className="emergency-dial"
          onClick={() => { void openDialerWithCode(entry.number) }}
          title={`${entry.label} — opens your dialer, you press call`}
        >
          <PhoneCall size={15} /> <strong>{entry.number}</strong> {entry.label}
        </button>
      ))}
      <button type="button" className="emergency-escape" onClick={onFakeCall} title="Show a locally generated incoming call">
        Fake call
      </button>
    </div>
  )
}
