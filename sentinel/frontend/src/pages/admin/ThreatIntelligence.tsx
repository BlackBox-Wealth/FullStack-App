import { useEffect, useState } from 'react'
import { Shield, RefreshCw, Check, X } from 'lucide-react'
import { adminApi } from '../../api/admin'

type ThreatStatus = 'all' | 'pending' | 'approved' | 'rejected'

interface ThreatItem {
  _id: string
  source: string
  title: string
  attack_type: string
  scraped_at: string
  content_summary?: string
  reviewed_at?: string
  review_status?: string
}

const MOCK_PENDING: ThreatItem[] = [
  { _id: 't1', source: 'rbi', title: 'RBI warns of phishing emails impersonating regulatory communications', attack_type: 'phishing', scraped_at: '2026-05-24T02:00:00', content_summary: 'The Reserve Bank of India has issued an advisory warning bank employees of a new wave of phishing emails...' },
  { _id: 't2', source: 'cert_in', title: 'CERT-In advisory on vishing attacks targeting bank staff', attack_type: 'vishing', scraped_at: '2026-05-23T02:00:00', content_summary: 'CERT-In has observed an increase in vishing (voice phishing) attacks targeting employees of financial institutions...' },
  { _id: 't3', source: 'rbi', title: 'Fraudulent UPI-linked credential harvesting campaign detected', attack_type: 'phishing', scraped_at: '2026-05-22T02:00:00', content_summary: 'A campaign targeting UPI users with fake verification portals has been identified. Bank employees are advised...' },
]

const MOCK_APPROVED: ThreatItem[] = [
  { _id: 'ta1', source: 'rbi', title: 'Social engineering via fake internal audit calls', attack_type: 'social_eng', scraped_at: '2026-05-15T02:00:00', reviewed_at: '2026-05-15T10:00:00', review_status: 'approved' },
]

const SOURCE_BADGE: Record<string, string> = { rbi: 'badge-info', cert_in: 'badge-warning' }
const ATTACK_BADGE: Record<string, string> = { phishing: 'badge-danger', vishing: 'badge-warning', social_eng: 'badge-info', general_fraud: 'badge-neutral' }

export default function AdminThreats() {
  const [statusFilter, setStatusFilter] = useState<ThreatStatus>('all')
  const [threats, setThreats] = useState<ThreatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<{ msg: string; ok: boolean } | null>(null)

  const fallbackThreats = (status: ThreatStatus): ThreatItem[] => {
    if (status === 'approved') return MOCK_APPROVED
    if (status === 'pending') return MOCK_PENDING
    if (status === 'all') return [...MOCK_PENDING, ...MOCK_APPROVED]
    return []
  }

  const normalizeStatus = (threat: ThreatItem): string => {
    if (!threat.review_status) return 'pending'
    return String(threat.review_status).toLowerCase()
  }

  const loadThreats = async (status: ThreatStatus) => {
    setLoading(true)
    try {
      const r = await adminApi.getThreats(status)
      setThreats((r.data.data?.threats ?? []) as ThreatItem[])
    } catch {
      setThreats(fallbackThreats(status))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadThreats(statusFilter)
  }, [statusFilter])

  const runScraper = async () => {
    setScraping(true)
    setScrapeResult(null)
    try {
      const r = await adminApi.runScraper()
      setScrapeResult({ msg: `Scraper completed. ${r.data.data?.new_threats_saved ?? 0} new threats saved.`, ok: true })
      await loadThreats(statusFilter)
    } catch {
      setScrapeResult({ msg: 'Scraper failed. Check backend logs.', ok: false })
    }
    setScraping(false)
  }

  const approve = async (id: string) => {
    try {
      await adminApi.approveThreat(id)
      await loadThreats(statusFilter)
    } catch {
      setThreats(prev => prev.filter(t => t._id !== id))
    }
  }

  const reject = async (id: string) => {
    try {
      await adminApi.rejectThreat(id)
      await loadThreats(statusFilter)
    } catch {
      setThreats(prev => prev.filter(t => t._id !== id))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-accent-primary" />
          <h2 className="font-heading text-lg font-semibold text-text-primary">Threat Intelligence</h2>
        </div>
        <div className="flex items-center gap-3">
          {scrapeResult && (
            <span className={`text-xs ${scrapeResult.ok ? 'text-success' : 'text-danger'}`}>{scrapeResult.msg}</span>
          )}
          <button onClick={runScraper} disabled={scraping}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-bg-surface border border-border text-sm text-text-secondary hover:text-text-primary transition-fast disabled:opacity-50">
            <RefreshCw size={13} className={scraping ? 'animate-spin' : ''} />
            {scraping ? 'Scraping…' : 'Run Scraper Now'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-surface p-1 rounded-sm w-fit">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(t => (
          <button key={t} onClick={() => setStatusFilter(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium capitalize transition-fast ${statusFilter === t ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
            {t}
          </button>
        ))}
      </div>

      {statusFilter !== 'approved' && (
        <div className="space-y-3">
          {loading && (
            <div className="card p-8 text-center text-text-muted text-sm">Loading threats…</div>
          )}
          {!loading && threats.length === 0 && (
            <div className="card p-8 text-center text-text-muted text-sm">No threats match the selected status.</div>
          )}
          {!loading && threats.map(threat => {
            const reviewStatus = normalizeStatus(threat)
            return (
            <div key={threat._id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`${SOURCE_BADGE[threat.source] ?? 'badge-neutral'} px-2 py-0.5 rounded text-xs font-medium uppercase`}>{threat.source.replace('_', '-')}</span>
                    <span className={`${ATTACK_BADGE[threat.attack_type] ?? 'badge-neutral'} px-2 py-0.5 rounded text-xs font-medium`}>{threat.attack_type.replace('_', ' ')}</span>
                    <span className="text-xs text-text-muted">{new Date(threat.scraped_at).toLocaleDateString('en-IN')}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-text-primary mb-1">{threat.title}</h4>
                  {threat.content_summary && <p className="text-xs text-text-muted line-clamp-2">{threat.content_summary}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {reviewStatus === 'pending' ? (
                    <>
                      <button onClick={() => approve(threat._id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-sm bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-fast">
                        <Check size={12} /> Approve
                      </button>
                      <button onClick={() => reject(threat._id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-sm bg-danger/10 text-danger text-xs font-medium hover:bg-danger/20 transition-fast">
                        <X size={12} /> Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-text-muted capitalize">{reviewStatus}</span>
                  )}
                </div>
              </div>
            </div>
          )})}
        </div>
      )}

      {statusFilter === 'approved' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-surface">
                {['Source', 'Title', 'Attack Type', 'Reviewed'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {threats.map(t => (
                <tr key={t._id} className="hover:bg-bg-surface transition-fast">
                  <td className="px-4 py-3">
                    <span className={`${SOURCE_BADGE[t.source] ?? 'badge-neutral'} px-2 py-0.5 rounded text-xs uppercase`}>{t.source.replace('_', '-')}</span>
                  </td>
                  <td className="px-4 py-3 text-text-primary text-sm max-w-xs">{t.title}</td>
                  <td className="px-4 py-3">
                    <span className={`${ATTACK_BADGE[t.attack_type] ?? 'badge-neutral'} px-2 py-0.5 rounded text-xs`}>{t.attack_type.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{t.reviewed_at ? new Date(t.reviewed_at).toLocaleDateString('en-IN') : '—'}</td>
                </tr>
              ))}
              {!loading && threats.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted text-sm">No approved threats yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
