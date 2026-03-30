import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  getSubscriptions,
  getPortalUrl,
  cancelSubscription,
  createCheckout,
  SubscriptionResponse,
} from '../api/subscriptions'

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: '#dcfce7', color: '#16a34a' },
  trialing: { bg: '#dbeafe', color: '#1d4ed8' },
  past_due: { bg: '#fef9c3', color: '#a16207' },
  canceled: { bg: '#fee2e2', color: '#dc2626' },
  inactive: { bg: '#F3F4F6', color: '#6b7280' },
}

function statusStyle(status: string): React.CSSProperties {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS['inactive']
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
    background: c.bg,
    color: c.color,
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

export default function Billing() {
  const [searchParams] = useSearchParams()
  const [subscriptions, setSubscriptions] = useState<SubscriptionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [showPlanChange, setShowPlanChange] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const successParam = searchParams.get('success')
  const cancelledParam = searchParams.get('cancelled')

  useEffect(() => {
    getSubscriptions()
      .then(setSubscriptions)
      .catch(() => setError('Failed to load subscription info.'))
      .finally(() => setLoading(false))
  }, [])

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const { portal_url } = await getPortalUrl()
      window.location.href = portal_url
    } catch {
      setError('Failed to open billing portal. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await cancelSubscription(cancelTarget)
      setSubscriptions((prev) => prev.map((s) =>
        s.id === cancelTarget ? { ...s, status: 'canceled' } : s
      ))
      setCancelTarget(null)
    } catch {
      setError('Failed to cancel subscription. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  async function handleChangePlan(slug: string) {
    setCheckoutLoading(slug)
    try {
      const { checkout_url } = await createCheckout(slug)
      window.location.href = checkout_url
    } catch {
      setError('Failed to start checkout. Please try again.')
      setCheckoutLoading(null)
    }
  }

  const activeSub = subscriptions.find((s) => s.status === 'active' || s.status === 'trialing')

  const PLAN_OPTIONS = [
    { slug: 'starter', label: 'Starter', price: '$29/mo' },
    { slug: 'professional', label: 'Professional', price: '$79/mo' },
    { slug: 'enterprise', label: 'Enterprise', price: '$199/mo' },
  ]

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      {/* Success / Cancelled banners */}
      {successParam === 'true' && (
        <div style={{
          background: '#dcfce7',
          color: '#15803d',
          border: '1px solid #bbf7d0',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          Your subscription was activated successfully. Welcome aboard!
        </div>
      )}
      {cancelledParam === 'true' && (
        <div style={{
          background: '#fef9c3',
          color: '#92400e',
          border: '1px solid #fde68a',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          Checkout was cancelled. No changes were made to your subscription.
        </div>
      )}

      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>
          Billing &amp; Subscription
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
          Manage your plan, payments, and billing details.
        </p>
      </div>

      {error && (
        <div style={{
          background: '#fee2e2',
          color: '#b91c1c',
          padding: '10px 14px',
          borderRadius: '6px',
          marginBottom: '20px',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Current Plan Card */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        marginBottom: '20px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
            Current Plan
          </h2>
          <Link to="/pricing" style={{ fontSize: '13px', color: '#7C3AED', textDecoration: 'none', fontWeight: 500 }}>
            View all plans
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            Loading subscription...
          </div>
        ) : activeSub ? (
          <div style={{ padding: '20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
              marginBottom: '20px',
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Plan</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  {PLAN_LABELS[activeSub.plan] ?? activeSub.plan}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                <span style={statusStyle(activeSub.status)}>{activeSub.status}</span>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Amount</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
                  {formatAmount(activeSub.amount_cents, activeSub.currency)}/{activeSub.interval}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Next Billing</div>
                <div style={{ fontSize: '14px', color: '#374151' }}>
                  {formatDate(activeSub.current_period_end)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Period Start</div>
                <div style={{ fontSize: '14px', color: '#374151' }}>
                  {formatDate(activeSub.current_period_start)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowPlanChange((v) => !v)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #7C3AED',
                  background: '#fff',
                  color: '#7C3AED',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Change Plan
              </button>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#7C3AED',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: portalLoading ? 'not-allowed' : 'pointer',
                  opacity: portalLoading ? 0.7 : 1,
                }}
              >
                {portalLoading ? 'Opening...' : 'Manage Billing'}
              </button>
              {activeSub.status !== 'canceled' && (
                <button
                  onClick={() => setCancelTarget(activeSub.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #fca5a5',
                    background: '#fff',
                    color: '#dc2626',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  Cancel Subscription
                </button>
              )}
            </div>

            {/* Change Plan inline panel */}
            {showPlanChange && (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#F3F4F6',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '12px' }}>
                  Select a new plan:
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {PLAN_OPTIONS.map((p) => (
                    <button
                      key={p.slug}
                      onClick={() => handleChangePlan(p.slug)}
                      disabled={checkoutLoading === p.slug || activeSub.plan === p.slug}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: activeSub.plan === p.slug ? '2px solid #7C3AED' : '1px solid #d1d5db',
                        background: activeSub.plan === p.slug ? '#ede9fe' : '#fff',
                        color: activeSub.plan === p.slug ? '#7C3AED' : '#374151',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: activeSub.plan === p.slug || checkoutLoading === p.slug ? 'not-allowed' : 'pointer',
                        opacity: checkoutLoading === p.slug ? 0.7 : 1,
                      }}
                    >
                      {checkoutLoading === p.slug ? 'Redirecting...' : `${p.label} — ${p.price}`}
                      {activeSub.plan === p.slug && ' (current)'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '28px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px' }}>
              You are on the Free plan.
            </p>
            <Link
              to="/pricing"
              style={{
                display: 'inline-block',
                padding: '9px 20px',
                borderRadius: '6px',
                background: '#7C3AED',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                textDecoration: 'none',
              }}
            >
              Upgrade Plan
            </Link>
          </div>
        )}
      </div>

      {/* Usage Card */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        marginBottom: '20px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>Usage</h2>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <UsageBar label="Users" current={1} max={activeSub ? planMaxUsers(activeSub.plan) : 1} />
          <UsageBar label="Apps" current={0} max={activeSub ? planMaxApps(activeSub.plan) : 2} />
        </div>
      </div>

      {/* Invoice History */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>Invoice History</h2>
        </div>
        <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
          Coming soon — invoice history will appear here.
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '10px',
            padding: '28px',
            maxWidth: '420px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
              Cancel Subscription?
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748b', lineHeight: 1.6 }}>
              Your subscription will be cancelled at the end of the current billing period.
              You will retain access until then.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCancelTarget(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                  opacity: cancelling ? 0.7 : 1,
                }}
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function planMaxUsers(plan: string): number {
  const map: Record<string, number> = { free: 1, starter: 5, professional: 25, enterprise: 999 }
  return map[plan] ?? 1
}

function planMaxApps(plan: string): number {
  const map: Record<string, number> = { free: 2, starter: 10, professional: 50, enterprise: 999 }
  return map[plan] ?? 2
}

interface UsageBarProps {
  label: string
  current: number
  max: number
}

function UsageBar({ label, current, max }: UsageBarProps) {
  const isUnlimited = max >= 999
  const pct = isUnlimited ? 0 : Math.min((current / max) * 100, 100)
  const barColor = pct > 90 ? '#dc2626' : pct > 70 ? '#f59e0b' : '#7C3AED'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: '13px', color: '#64748b' }}>
          {current} / {isUnlimited ? 'Unlimited' : max}
        </span>
      </div>
      <div style={{
        height: '6px',
        background: '#e2e8f0',
        borderRadius: '99px',
        overflow: 'hidden',
      }}>
        {!isUnlimited && (
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: '99px',
            transition: 'width 0.3s ease',
          }} />
        )}
        {isUnlimited && (
          <div style={{ height: '100%', width: '100%', background: '#7C3AED', borderRadius: '99px', opacity: 0.3 }} />
        )}
      </div>
    </div>
  )
}
