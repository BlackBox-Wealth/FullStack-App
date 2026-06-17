import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

interface Option { text: string; index: number }
interface Node { node_id: string; situation: string; options: Option[]; scenario_title: string; completed: boolean }

export default function ScenarioPage() {
  const { token } = useParams<{ token: string }>()
  const [node, setNode] = useState<Node | null>(null)
  const [feedback, setFeedback] = useState('')
  const [completed, setCompleted] = useState(false)
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    axios.get(`/api/sim/social/${token}`)
      .then(r => setNode(r.data.data))
      .catch(() => setNode(null))
      .finally(() => setLoading(false))
  }, [token])

  const respond = async (idx: number) => {
    if (!token || submitting) return
    setSubmitting(true)
    try {
      const r = await axios.post(`/api/sim/social/respond/${token}`, { option_index: idx })
      const data = r.data.data
      setFeedback(data.feedback ?? '')
      if (data.completed) {
        setCompleted(true)
        setResult({ score: data.score, passed: data.passed })
      } else if (data.next_node) {
        setTimeout(() => {
          setFeedback('')
          setNode({ ...data.next_node, scenario_title: node?.scenario_title ?? '', completed: false })
          setSubmitting(false)
        }, 1800)
        return
      }
    } catch {
      setFeedback('Unable to submit response. Please try again.')
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="text-text-muted text-sm">Loading…</div>
    </div>
  )

  if (!node && !loading) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="text-center">
        <h2 className="font-heading text-xl font-bold text-text-primary mb-2">Session Expired</h2>
        <p className="text-text-muted text-sm">This scenario link is no longer valid.</p>
      </div>
    </div>
  )

  if (completed && result) return (
    <div className="min-h-screen bg-composite flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-8 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${result.passed ? 'bg-success/10' : 'bg-danger/10'}`}>
          <span className="font-heading font-bold text-2xl" style={{ color: result.passed ? '#0f9d58' : '#dc2626' }}>{result.score}</span>
        </div>
        <h2 className="font-heading text-xl font-bold text-text-primary mb-2">
          {result.passed ? 'Well Done' : 'Simulation Complete'}
        </h2>
        <p className="text-sm text-text-secondary">
          {result.passed
            ? 'You demonstrated good security awareness in this scenario.'
            : 'You have completed this scenario. A detailed analysis report will be sent to your Internal Mail.'}
        </p>
        <p className="mt-4 text-xs text-text-muted">You may close this window.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-composite flex items-center justify-center p-4">
      <div className="card max-w-xl w-full">
        {/* Header — looks like internal compliance tool */}
        <div className="px-6 py-4 border-b border-border">
          <div className="text-xs text-text-muted font-medium uppercase tracking-widest mb-1">PSB Internal Tool</div>
          <h2 className="font-heading text-lg font-semibold text-text-primary">{node?.scenario_title ?? 'Compliance Response Handler'}</h2>
        </div>

        <div className="p-6">
          {/* Situation */}
          <div className="rounded-sm bg-bg-surface border border-border p-4 mb-5">
            <p className="text-xs text-text-muted font-semibold mb-2 uppercase tracking-wider">Situation</p>
            <p className="text-sm text-text-primary leading-relaxed">{node?.situation}</p>
          </div>

          {/* Feedback */}
          {feedback && (
            <div className="mb-4 px-4 py-3 rounded-sm bg-info/10 border border-info/20 text-sm text-info">
              {feedback}
            </div>
          )}

          {/* Options */}
          {!feedback && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted font-semibold mb-3 uppercase tracking-wider">Select your response</p>
              {node?.options.map(opt => (
                <button
                  key={opt.index}
                  onClick={() => respond(opt.index)}
                  disabled={submitting}
                  className="w-full text-left px-4 py-3.5 rounded-sm border border-border hover:border-accent-primary hover:bg-accent-primary/5 transition-fast text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  {opt.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
