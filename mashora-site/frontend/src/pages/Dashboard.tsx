import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { listTenants, suspendTenant, Tenant } from '../api/tenants'
import { getSubscriptions, SubscriptionResponse } from '../api/subscriptions'

const badgeStyle = (status: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '12px',
  fontSize: '12px',
  fontWeight: 500,
  background: status === 'active' ? '#dcfce7' : '#fee2e2',
  color: status === 'active' ? '#16a34a' : '#dc2626',
})

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

const quickLinkCards: { to: string; label: string; description: string; icon: string; color: string }[] = [
  {
    to: '/dashboard/upgrades',
    label: 'Upgrades',
    description: 'Check for version updates and manage upgrade history.',
    icon: '&#8593;',
    color: '#7C3AED',
  },
  {
    to: '/dashboard/support',
    label: 'Support',
    description: 'Open tickets, view status, and chat with support.',
    icon: '&#128172;',
    color: '#0ea5e9',
  },
  {
    to: '/dashboard/admin',
    label: 'Admin',
    description: 'Platform stats, tenant management, and addon approvals.',
    icon: '&#9881;',
    color: '#475569',
  },
]

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null)

  useEffect(() => {
    listTenants()
      .then(setTenants)
      .catch(() => setError('Failed to load tenants.'))
      .finally(() => setLoading(false))

    getSubscriptions()
      .then((subs) => {
        const active = subs.find((s) => s.status === 'active' || s.status === 'trialing') ?? null
        setSubscription(active)
      })
      .catch(() => {
        // Non-critical: subscription info is best-effort on dashboard
      })
  }, [])

  async function handleSuspend(id: number) {
    try {
      const updated = await suspendTenant(id)
      setTenants((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      setError('Failed to suspend tenant.')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
            Dashboard
          </h1>
          {user && (
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
              Welcome back, {user.email} — {user.org_name}
            </p>
          )}
        </div>
        <Link
          to="/dashboard/tenants/new"
          style={{
            background: '#2563eb',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '14px',
            textDecoration: 'none',
          }}
        >
          + Create New Instance
        </Link>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Billing summary card */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: '#ede9fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
          }}>
            &#9889;
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
              {subscription
                ? `${PLAN_LABELS[subscription.plan] ?? subscription.plan} Plan`
                : 'Free Plan'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {subscription
                ? `Active — renews ${subscription.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}`
                : 'No active subscription'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link
            to="/dashboard/billing"
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #7C3AED',
              background: '#fff',
              color: '#7C3AED',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Manage Billing
          </Link>
          {!subscription && (
            <Link
              to="/pricing"
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: '#7C3AED',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {quickLinkCards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            style={{
              flex: '1 1 200px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px 18px',
              textDecoration: 'none',
              display: 'block',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = card.color)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: card.color + '1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              marginBottom: '10px',
              color: card.color,
            }}
              dangerouslySetInnerHTML={{ __html: card.icon }}
            />
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{card.label}</div>
            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>{card.description}</div>
          </Link>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            Tenant Instances
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
        ) : tenants.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            No tenants yet.{' '}
            <Link to="/dashboard/tenants/new">Create your first instance.</Link>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['DB Name', 'Subdomain', 'Status', 'Created', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 20px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 20px', fontSize: '14px', fontWeight: 500 }}>{t.db_name}</td>
                  <td style={{ padding: '12px 20px', fontSize: '14px', color: '#64748b' }}>{t.subdomain}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={badgeStyle(t.status)}>{t.status}</span>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: '14px', color: '#64748b' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    {t.status === 'active' && (
                      <button
                        onClick={() => handleSuspend(t.id)}
                        style={{
                          background: 'none',
                          border: '1px solid #fca5a5',
                          color: '#dc2626',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
