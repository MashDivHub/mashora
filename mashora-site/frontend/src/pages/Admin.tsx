import { useEffect, useState } from 'react'
import { getStats, listAllTenants, listAllTickets, listPendingAddons, updateAddonStatus, PlatformStats } from '../api/admin'

type Tab = 'tenants' | 'tickets' | 'addons'

const ticketStatusColors: Record<string, { bg: string; color: string }> = {
  open: { bg: '#dcfce7', color: '#15803d' },
  in_progress: { bg: '#fef9c3', color: '#a16207' },
  resolved: { bg: '#dbeafe', color: '#1d4ed8' },
  closed: { bg: '#f1f5f9', color: '#64748b' },
}

const tenantStatusColors: Record<string, { bg: string; color: string }> = {
  active: { bg: '#dcfce7', color: '#15803d' },
  suspended: { bg: '#fee2e2', color: '#b91c1c' },
  pending: { bg: '#fef9c3', color: '#a16207' },
}

function Badge({ status, map }: { status: string; map: Record<string, { bg: string; color: string }> }) {
  const c = map[status] ?? { bg: '#f1f5f9', color: '#475569' }
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

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '20px',
      flex: '1 1 160px',
    }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{label}</div>
    </div>
  )
}

export default function Admin() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [tenants, setTenants] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [addons, setAddons] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('tenants')
  const [tabLoading, setTabLoading] = useState(false)
  const [error, setError] = useState('')
  const [addonActionId, setAddonActionId] = useState<string | null>(null)

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => setError('Failed to load platform stats.'))
      .finally(() => setStatsLoading(false))

    loadTab('tenants')
  }, [])

  async function loadTab(tab: Tab) {
    setTabLoading(true)
    setError('')
    try {
      if (tab === 'tenants') {
        const data = await listAllTenants()
        setTenants(data)
      } else if (tab === 'tickets') {
        const data = await listAllTickets()
        setTickets(data)
      } else if (tab === 'addons') {
        const data = await listPendingAddons()
        setAddons(data)
      }
    } catch {
      setError(`Failed to load ${tab}.`)
    } finally {
      setTabLoading(false)
    }
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    loadTab(tab)
  }

  async function handleAddonAction(addonId: string, status: string) {
    setAddonActionId(addonId)
    try {
      await updateAddonStatus(addonId, status)
      setAddons((prev) => prev.filter((a) => a.id !== addonId))
    } catch {
      setError('Failed to update addon status.')
    } finally {
      setAddonActionId(null)
    }
  }

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: '8px 18px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    borderBottom: `2px solid ${activeTab === tab ? '#7C3AED' : 'transparent'}`,
    background: 'none',
    color: activeTab === tab ? '#7C3AED' : '#64748b',
    cursor: 'pointer',
  })

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
          Admin Dashboard
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
          Platform-wide overview and management.
        </p>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '28px' }}>
        {statsLoading ? (
          <div style={{ fontSize: '14px', color: '#94a3b8', padding: '20px' }}>Loading stats...</div>
        ) : stats ? (
          <>
            <StatCard label="Total Orgs" value={stats.total_orgs} icon="&#127970;" />
            <StatCard label="Total Users" value={stats.total_users} icon="&#128100;" />
            <StatCard label="Total Tenants" value={stats.total_tenants} icon="&#128190;" />
            <StatCard label="Active Subscriptions" value={stats.active_subscriptions} icon="&#9889;" />
            <StatCard
              label="Monthly Revenue"
              value={`$${(stats.monthly_revenue_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon="&#128181;"
            />
          </>
        ) : null}
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 8px', background: '#f8fafc' }}>
          <button style={tabStyle('tenants')} onClick={() => switchTab('tenants')}>Tenants</button>
          <button style={tabStyle('tickets')} onClick={() => switchTab('tickets')}>Tickets</button>
          <button style={tabStyle('addons')} onClick={() => switchTab('addons')}>Addon Approvals</button>
        </div>

        <div style={{ padding: '0' }}>
          {tabLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
          ) : activeTab === 'tenants' ? (
            tenants.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>No tenants found.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Org', 'DB Name', 'Subdomain', 'Status', 'Created'].map((h) => (
                      <th key={h} style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid #e2e8f0',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t, i) => (
                    <tr key={t.id ?? i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>{t.org_name ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#475569' }}>{t.db_name ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{t.subdomain ?? '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge status={t.status ?? 'unknown'} map={tenantStatusColors} />
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                        {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : activeTab === 'tickets' ? (
            tickets.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>No tickets found.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Subject', 'User', 'Priority', 'Status', 'Actions'].map((h) => (
                      <th key={h} style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid #e2e8f0',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t, i) => (
                    <tr key={t.id ?? i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>{t.subject ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{t.user_email ?? t.user ?? '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge
                          status={t.priority ?? 'medium'}
                          map={{ low: { bg: '#f1f5f9', color: '#475569' }, medium: { bg: '#fef9c3', color: '#a16207' }, high: { bg: '#ffedd5', color: '#c2410c' }, urgent: { bg: '#fee2e2', color: '#b91c1c' } }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge status={t.status ?? 'open'} map={ticketStatusColors} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>—</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            // Addons tab
            addons.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>No pending addon approvals.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Name', 'Publisher', 'Category', 'Submitted', 'Actions'].map((h) => (
                      <th key={h} style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid #e2e8f0',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {addons.map((a, i) => (
                    <tr key={a.id ?? i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>{a.name ?? a.technical_name ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{a.publisher ?? a.org_name ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{a.category ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                        {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleAddonAction(a.id, 'approved')}
                            disabled={addonActionId === a.id}
                            style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              border: 'none',
                              padding: '4px 12px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: addonActionId === a.id ? 'not-allowed' : 'pointer',
                              opacity: addonActionId === a.id ? 0.7 : 1,
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAddonAction(a.id, 'rejected')}
                            disabled={addonActionId === a.id}
                            style={{
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: 'none',
                              padding: '4px 12px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: addonActionId === a.id ? 'not-allowed' : 'pointer',
                              opacity: addonActionId === a.id ? 0.7 : 1,
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  )
}
