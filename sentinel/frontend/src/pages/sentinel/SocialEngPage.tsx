import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

interface Option { text: string; index: number }
interface Node {
  node_id: string
  situation: string
  options: Option[]
  scenario_title: string
  landing_page_title?: string
  landing_page_subtitle?: string
  completed: boolean
}

const s: Record<string, React.CSSProperties> = {
  root: {
    margin: 0, padding: 0, minHeight: '100vh',
    background: '#f4f5f7',
    fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif',
    color: '#172b4d',
  },
  topbar: {
    background: '#0052cc',
    padding: '0 24px',
    height: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topbarLogo: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  topbarLogoIcon: {
    width: 28, height: 28, background: '#fff', borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 900, color: '#0052cc',
  },
  topbarTitle: { color: '#fff', fontSize: 14, fontWeight: 600 },
  topbarMeta: { color: '#b3d4ff', fontSize: 12 },
  container: { maxWidth: 760, margin: '32px auto', padding: '0 16px 40px' },
  breadcrumb: { fontSize: 12, color: '#6b778c', marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center' },
  memoCard: {
    background: '#fff',
    border: '1px solid #dfe1e6',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  memoHeader: {
    background: '#f4f5f7',
    borderBottom: '2px solid #dfe1e6',
    padding: '12px 20px',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  memoHeaderBadge: {
    background: '#de350b', color: '#fff', fontSize: 11, fontWeight: 700,
    padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  memoHeaderTitle: { fontSize: 13, fontWeight: 600, color: '#172b4d' },
  memoBody: { padding: '16px 20px', fontSize: 14, color: '#344563', lineHeight: 1.6 },
  situationCard: {
    background: '#fff', border: '1px solid #dfe1e6', borderRadius: 3, padding: '20px 24px', marginBottom: 16,
  },
  situationLabel: {
    fontSize: 11, fontWeight: 700, color: '#6b778c', textTransform: 'uppercase' as const,
    letterSpacing: 0.8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
  },
  situationText: { fontSize: 14, color: '#172b4d', lineHeight: 1.65 },
  optionsCard: {
    background: '#fff', border: '1px solid #dfe1e6', borderRadius: 3, padding: '20px 24px',
  },
  optionsLabel: {
    fontSize: 11, fontWeight: 700, color: '#6b778c', textTransform: 'uppercase' as const,
    letterSpacing: 0.8, marginBottom: 14,
  },
  optionBtn: {
    width: '100%', textAlign: 'left' as const, padding: '14px 16px',
    border: '1px solid #dfe1e6', borderRadius: 3, background: '#fff',
    fontSize: 14, color: '#172b4d', cursor: 'pointer', marginBottom: 8,
    display: 'block', fontFamily: '"Segoe UI", Arial, sans-serif',
    transition: 'background 0.15s',
  },
  transition: {
    background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 3,
    padding: '16px 20px', marginBottom: 16, fontSize: 14, color: '#1565c0',
  },
  completionCard: {
    background: '#fff', border: '1px solid #dfe1e6', borderRadius: 3, padding: '40px 32px',
    textAlign: 'center' as const,
  },
  completionIcon: {
    width: 56, height: 56, background: '#e3fcef', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px', fontSize: 24,
  },
  footer: {
    borderTop: '1px solid #dfe1e6', padding: '12px 24px',
    fontSize: 11, color: '#97a0af', textAlign: 'center' as const,
    background: '#f4f5f7',
  },
}

export default function SocialEngPage() {
  const { token } = useParams<{ token: string }>()
  const [node, setNode] = useState<Node | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hoveredOption, setHoveredOption] = useState<number | null>(null)

  const pageTitle = node?.landing_page_title || 'PSB Internal Audit Portal'
  const pageSubtitle = node?.landing_page_subtitle || 'Compliance Response System'
  const scenarioIntro = node?.scenario_title || 'You have been identified as a key respondent for an urgent internal audit.'

  useEffect(() => {
    if (!token) { setError(true); setLoading(false); return }
    axios.get(`/api/sim/social/${token}`)
      .then(r => { setNode(r.data.data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [token])

  const respond = async (idx: number) => {
    if (!token || transitioning) return
    setTransitioning(true)
    try {
      const r = await axios.post(`/api/sim/social/respond/${token}`, { option_index: idx })
      const data = r.data.data
      if (data.completed) {
        setTimeout(() => { setCompleted(true); setTransitioning(false) }, 1200)
      } else if (data.next_node) {
        setTimeout(() => {
          setNode(prev => ({
            ...data.next_node,
            scenario_title: prev?.scenario_title ?? '',
            landing_page_title: prev?.landing_page_title,
            landing_page_subtitle: prev?.landing_page_subtitle,
            completed: false,
          }))
          setTransitioning(false)
        }, 1400)
      }
    } catch {
      setTransitioning(false)
    }
  }

  if (loading) return (
    <div style={s.root}>
      <div style={s.topbar}>
        <div style={s.topbarLogo}>
          <div style={s.topbarLogoIcon}>PSB</div>
          <span style={s.topbarTitle}>PSB Internal Audit Portal</span>
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: 80, color: '#6b778c', fontSize: 14 }}>Loading session…</div>
    </div>
  )

  if (error) return (
    <div style={s.root}>
      <div style={s.topbar}>
        <div style={s.topbarLogo}>
          <div style={s.topbarLogoIcon}>PSB</div>
          <span style={s.topbarTitle}>PSB Internal Audit Portal</span>
        </div>
      </div>
      <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px', textAlign: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #dfe1e6', borderRadius: 3, padding: '36px 28px' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#172b4d', margin: '0 0 8px' }}>Session Link Expired</p>
          <p style={{ fontSize: 13, color: '#6b778c', margin: 0 }}>This link has expired or is no longer valid. Please contact the audit coordinator if you believe this is an error.</p>
        </div>
      </div>
    </div>
  )

  if (completed) return (
    <div style={s.root}>
      <div style={s.topbar}>
        <div style={s.topbarLogo}>
          <div style={s.topbarLogoIcon}>PSB</div>
          <span style={s.topbarTitle}>{pageTitle}</span>
        </div>
        <span style={s.topbarMeta}>{pageSubtitle}</span>
      </div>
      <div style={s.container}>
        <div style={s.completionCard}>
          <div style={s.completionIcon}>✓</div>
          <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: '#172b4d' }}>Response Submitted</h3>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b778c', lineHeight: 1.6 }}>
            Thank you. Your response has been submitted to the audit coordinator.<br />
            A confirmation will be sent to your registered email address.
          </p>
          <div style={{ display: 'inline-block', background: '#f4f5f7', border: '1px solid #dfe1e6', borderRadius: 3, padding: '8px 20px', fontSize: 12, color: '#6b778c' }}>
            Reference: AUDIT-{token?.slice(0, 8).toUpperCase()}
          </div>
          <p style={{ marginTop: 24, fontSize: 12, color: '#97a0af' }}>You may close this window.</p>
        </div>
      </div>
    </div>
  )

  return (
    <div style={s.root}>
      {/* Top bar */}
      <div style={s.topbar}>
        <div style={s.topbarLogo}>
          <div style={s.topbarLogoIcon}>PSB</div>
          <span style={s.topbarTitle}>{pageTitle}</span>
        </div>
        <span style={s.topbarMeta}>{pageSubtitle}</span>
      </div>

      <div style={s.container}>
        {/* Breadcrumb */}
        <div style={s.breadcrumb}>
          <span>Internal Audit</span>
          <span>›</span>
          <span>Compliance Response</span>
          <span>›</span>
          <span style={{ color: '#172b4d', fontWeight: 600 }}>Active Session</span>
        </div>

        {/* Memo header / context card */}
        <div style={s.memoCard}>
          <div style={s.memoHeader}>
            <span style={s.memoHeaderBadge}>Confidential</span>
            <span style={s.memoHeaderTitle}>Internal Audit — Respondent Required</span>
          </div>
          <div style={s.memoBody}>
            {scenarioIntro}
          </div>
        </div>

        {/* Transition state */}
        {transitioning && (
          <div style={s.transition}>
            <strong>Response recorded.</strong> Loading next step…
          </div>
        )}

        {!transitioning && node && (
          <>
            {/* Situation */}
            <div style={s.situationCard}>
              <div style={s.situationLabel}>
                <span>📋</span>
                <span>Current Situation</span>
              </div>
              <p style={s.situationText}>{node.situation}</p>
            </div>

            {/* Options */}
            <div style={s.optionsCard}>
              <div style={s.optionsLabel}>Select your response</div>
              {node.options.map(opt => (
                <button
                  key={opt.index}
                  style={{
                    ...s.optionBtn,
                    background: hoveredOption === opt.index ? '#f4f5f7' : '#fff',
                    borderColor: hoveredOption === opt.index ? '#4c9aff' : '#dfe1e6',
                  }}
                  onMouseEnter={() => setHoveredOption(opt.index)}
                  onMouseLeave={() => setHoveredOption(null)}
                  onClick={() => respond(opt.index)}
                >
                  <span style={{ color: '#0052cc', fontWeight: 600, marginRight: 10 }}>{opt.index + 1}.</span>
                  {opt.text}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={s.footer}>
        PSB Internal Audit Portal · Compliance Response System · psb-audit.in
      </div>
    </div>
  )
}
