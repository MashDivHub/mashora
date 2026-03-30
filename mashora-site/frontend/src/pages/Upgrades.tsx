import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { listTenants, Tenant } from '../api/tenants'
import {
  checkAvailableUpgrade,
  startUpgrade,
  listUpgrades,
  AvailableUpgradeResponse,
  UpgradeResponse,
} from '../api/upgrades'

const statusColors: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fef9c3', color: '#a16207' },
  in_progress: { bg: '#dbeafe', color: '#1d4ed8' },
  completed: { bg: '#dcfce7', color: '#15803d' },
  failed: { bg: '#fee2e2', color: '#b91c1c' },
}

function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] ?? { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 600,
      background: c.bg,
      color: c.color,
    }}>
      {status.replace('_', ' ')}
    </span>
  )
}

interface TenantUpgradeState {
  tenant: Tenant
  checkResult: AvailableUpgradeResponse | null
  checking: boolean
  upgrading: boolean
  error: string
  history: UpgradeResponse[]
  historyLoading: boolean
}

export default function Upgrades() {
  const user = useAuthStore((s) => s.user)
  const [states, setStates] = useState<TenantUpgradeState[]>([])
  const [loading, setLoading] = useState(true)
  const [globalError, setGlobalError] = useState('')

  useEffect(() => {
    listTenants()
      .then((tenants) => {
        const initial = tenants.map((t) => ({
          tenant: t,
          checkResult: null,
          checking: false,
          upgrading: false,
          error: '',
          history: [],
          historyLoading: true,
        }))
        setStates(initial)
        // Load upgrade history for each tenant
        tenants.forEach((t, i) => {
          listUpgrades(String(t.id))
            .then((history) => {
              setStates((prev) =>
                prev.map((s, idx) => idx === i ? { ...s, history, historyLoading: false } : s)
              )
            })
            .catch(() => {
              setStates((prev) =>
                prev.map((s, idx) => idx === i ? { ...s, historyLoading: false } : s)
              )
            })
        })
      })
      .catch(() => setGlobalError('Failed to load tenants.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCheck(index: number) {
    const tenantId = String(states[index].tenant.id)
    setStates((prev) => prev.map((s, i) => i === index ? { ...s, checking: true, error: '', checkResult: null } : s))
    try {
      const result = await checkAvailableUpgrade(tenantId)
      setStates((prev) => prev.map((s, i) => i === index ? { ...s, checking: false, checkResult: result } : s))
    } catch {
      setStates((prev) => prev.map((s, i) => i === index ? { ...s, checking: false, error: 'Failed to check for updates.' } : s))
    }
  }

  async function handleUpgrade(index: number) {
    const s = states[index]
    if (!s.checkResult?.latest_version) return
    const tenantId = String(s.tenant.id)
    setStates((prev) => prev.map((st, i) => i === index ? { ...st, upgrading: true, error: '' } : st))
    try {
      const result = await startUpgrade(tenantId, s.checkResult!.latest_version)
      setStates((prev) => prev.map((st, i) => i === index ? {
        ...st,
        upgrading: false,
        checkResult: null,
        history: [result, ...st.history],
      } : st))
    } catch {
      setStates((prev) => prev.map((st, i) => i === index ? { ...st, upgrading: false, error: 'Failed to start upgrade.' } : st))
    }
  }

  if (!user) return null

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
          Upgrades
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
          Manage version upgrades for your tenant instances.
        </p>
      </div>

      {globalError && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
          {globalError}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>Loading tenants...</div>
      ) : states.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '48px', textAlign: 'center', color: '#64748b' }}>
          No tenant instances found.
        </div>
      ) : (
        states.map((s, index) => (
          <div key={s.tenant.id} style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            marginBottom: '20px',
            overflow: 'hidden',
          }}>
            {/* Tenant header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{s.tenant.db_name}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                  {s.checkResult
                    ? `Current: ${s.checkResult.current_version}`
                    : 'Check for updates to see current version'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {s.error && (
                  <span style={{ fontSize: '13px', color: '#b91c1c' }}>{s.error}</span>
                )}
                {s.checkResult && s.checkResult.available && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#15803d', fontWeight: 500 }}>
                      v{s.checkResult.latest_version} available
                    </span>
                    <button
                      onClick={() => handleUpgrade(index)}
                      disabled={s.upgrading}
                      style={{
                        background: '#7C3AED',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: s.upgrading ? 'not-allowed' : 'pointer',
                        opacity: s.upgrading ? 0.7 : 1,
                      }}
                    >
                      {s.upgrading ? 'Upgrading...' : 'Upgrade Now'}
                    </button>
                  </div>
                )}
                {s.checkResult && !s.checkResult.available && (
                  <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 500 }}>Up to date</span>
                )}
                <button
                  onClick={() => handleCheck(index)}
                  disabled={s.checking}
                  style={{
                    background: '#fff',
                    color: '#7C3AED',
                    border: '1px solid #7C3AED',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: s.checking ? 'not-allowed' : 'pointer',
                    opacity: s.checking ? 0.7 : 1,
                  }}
                >
                  {s.checking ? 'Checking...' : 'Check for Updates'}
                </button>
              </div>
            </div>

            {/* Upgrade history */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Upgrade History
              </div>
              {s.historyLoading ? (
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>Loading history...</div>
              ) : s.history.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>No upgrades yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['From', 'To', 'Status', 'Started', 'Completed'].map((h) => (
                        <th key={h} style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid #f1f5f9',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.history.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: '#475569' }}>{u.from_version || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>{u.to_version}</td>
                        <td style={{ padding: '10px 12px' }}><StatusBadge status={u.status} /></td>
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: '#64748b' }}>
                          {u.started_at ? new Date(u.started_at).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: '#64748b' }}>
                          {u.completed_at ? new Date(u.completed_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
