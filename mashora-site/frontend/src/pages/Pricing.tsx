import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { createCheckout } from '../api/subscriptions'

interface Plan {
  name: string
  slug: string
  price_cents: number
  interval: string
  description: string
  features: string[]
  max_users: number
  max_apps: number
  highlight?: boolean
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    slug: 'free',
    price_cents: 0,
    interval: 'mo',
    description: 'Perfect for individuals and small projects.',
    features: [
      'Up to 1 user',
      'Up to 2 apps',
      'Community support',
      'Basic analytics',
    ],
    max_users: 1,
    max_apps: 2,
  },
  {
    name: 'Starter',
    slug: 'starter',
    price_cents: 2900,
    interval: 'mo',
    description: 'Great for growing teams.',
    features: [
      'Up to 5 users',
      'Up to 10 apps',
      'Email support',
      'Advanced analytics',
      'Custom subdomain',
    ],
    max_users: 5,
    max_apps: 10,
  },
  {
    name: 'Professional',
    slug: 'professional',
    price_cents: 7900,
    interval: 'mo',
    description: 'Built for professional teams that need more power.',
    features: [
      'Up to 25 users',
      'Up to 50 apps',
      'Priority support',
      'Advanced analytics',
      'Custom subdomain',
      'SSO integration',
      'Audit logs',
    ],
    max_users: 25,
    max_apps: 50,
    highlight: true,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    price_cents: 19900,
    interval: 'mo',
    description: 'For large organizations with demanding requirements.',
    features: [
      'Unlimited users',
      'Unlimited apps',
      'Dedicated support',
      'Advanced analytics',
      'Custom subdomain',
      'SSO integration',
      'Audit logs',
      'Custom SLA',
      'On-premise option',
    ],
    max_users: 999,
    max_apps: 999,
  },
]

function formatPrice(cents: number): string {
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(0)}`
}

export default function Pricing() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleSubscribe(slug: string) {
    if (!isAuthenticated) {
      navigate('/login?next=/pricing')
      return
    }
    setLoadingSlug(slug)
    setError('')
    try {
      const { checkout_url } = await createCheckout(slug)
      window.location.href = checkout_url
    } catch {
      setError('Failed to start checkout. Please try again.')
      setLoadingSlug(null)
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, color: '#1e293b', margin: '0 0 12px' }}>
          Simple, Transparent Pricing
        </h1>
        <p style={{ fontSize: '18px', color: '#64748b', margin: 0 }}>
          Choose the plan that fits your team. Upgrade or downgrade at any time.
        </p>
      </div>

      {error && (
        <div style={{
          background: '#fee2e2',
          color: '#b91c1c',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '24px',
          fontSize: '14px',
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* Plan Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '24px',
        alignItems: 'stretch',
      }}>
        {PLANS.map((plan) => (
          <div
            key={plan.slug}
            style={{
              background: '#fff',
              border: plan.highlight ? '2px solid #7C3AED' : '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              boxShadow: plan.highlight ? '0 4px 24px rgba(124,58,237,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            {plan.highlight && (
              <div style={{
                position: 'absolute',
                top: '-13px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#7C3AED',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                padding: '3px 14px',
                borderRadius: '20px',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
              }}>
                MOST POPULAR
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
                {plan.name}
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px', minHeight: '36px' }}>
                {plan.description}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: plan.highlight ? '#7C3AED' : '#1e293b' }}>
                  {formatPrice(plan.price_cents)}
                </span>
                {plan.price_cents > 0 && (
                  <span style={{ fontSize: '14px', color: '#94a3b8' }}>/{plan.interval}</span>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '20px', fontSize: '12px', color: '#64748b', display: 'flex', gap: '16px' }}>
              <span>
                <strong style={{ color: '#1e293b' }}>{plan.max_users === 999 ? 'Unlimited' : plan.max_users}</strong> users
              </span>
              <span>
                <strong style={{ color: '#1e293b' }}>{plan.max_apps === 999 ? 'Unlimited' : plan.max_apps}</strong> apps
              </span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
              {plan.features.map((f) => (
                <li key={f} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  color: '#374151',
                  marginBottom: '8px',
                }}>
                  <span style={{ color: '#7C3AED', fontWeight: 700, fontSize: '16px', lineHeight: 1 }}>&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>

            {plan.slug === 'free' ? (
              <Link
                to="/register"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '10px 0',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '15px',
                  background: '#F3F4F6',
                  color: '#1e293b',
                  textDecoration: 'none',
                  border: '1px solid #e2e8f0',
                }}
              >
                Get Started
              </Link>
            ) : (
              <button
                onClick={() => handleSubscribe(plan.slug)}
                disabled={loadingSlug === plan.slug}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 0',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '15px',
                  background: plan.highlight ? '#7C3AED' : '#1e293b',
                  color: '#fff',
                  border: 'none',
                  cursor: loadingSlug === plan.slug ? 'not-allowed' : 'pointer',
                  opacity: loadingSlug === plan.slug ? 0.7 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {loadingSlug === plan.slug ? 'Redirecting...' : 'Subscribe'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '40px' }}>
        All paid plans include a 14-day free trial. No credit card required for Free plan.
        {!isAuthenticated && (
          <>
            {' '}Already have an account?{' '}
            <Link to="/login" style={{ color: '#7C3AED', textDecoration: 'none', fontWeight: 500 }}>Log in</Link>
          </>
        )}
      </p>
    </div>
  )
}
