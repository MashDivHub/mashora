import { Link } from 'react-router-dom'

const features = [
  {
    title: 'Multi-Tenant Architecture',
    description: 'Provision isolated ERP instances for each customer with full data separation.',
  },
  {
    title: 'Instant Provisioning',
    description: 'Spin up new tenant databases in seconds with automated setup.',
  },
  {
    title: 'Centralized Management',
    description: 'Monitor, suspend, and manage all tenants from a single dashboard.',
  },
  {
    title: 'Secure by Default',
    description: 'JWT authentication, HTTPS, and per-tenant access controls built in.',
  },
]

export default function Home() {
  return (
    <div>
      <div style={{ textAlign: 'center', padding: '48px 0 40px' }}>
        <h1 style={{ fontSize: '40px', fontWeight: 700, margin: '0 0 16px', color: '#1e293b' }}>
          Mashora — Modern ERP Platform
        </h1>
        <p style={{ fontSize: '18px', color: '#64748b', margin: '0 0 32px', maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
          Provision and manage multi-tenant ERP instances for your organization with ease.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link
            to="/register"
            style={{
              background: '#2563eb',
              color: '#fff',
              padding: '10px 24px',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '15px',
            }}
          >
            Get Started
          </Link>
          <Link
            to="/login"
            style={{
              background: '#fff',
              color: '#1e293b',
              padding: '10px 24px',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '15px',
              border: '1px solid #e2e8f0',
            }}
          >
            Sign In
          </Link>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '40px' }}>
        <h2 style={{ textAlign: 'center', fontSize: '24px', fontWeight: 600, color: '#1e293b', marginBottom: '32px' }}>
          Platform Features
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                {f.title}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
