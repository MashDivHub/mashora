import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createTenant } from '../api/tenants'

const cardStyle: React.CSSProperties = {
  maxWidth: '480px',
  margin: '0 auto',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '32px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '4px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '14px',
  marginBottom: '4px',
}

const hintStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8',
  marginBottom: '16px',
  display: 'block',
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '15px',
  cursor: 'pointer',
  marginBottom: '12px',
}

export default function CreateTenant() {
  const [dbName, setDbName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createTenant(dbName, subdomain)
      navigate('/dashboard')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create tenant. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link to="/dashboard" style={{ fontSize: '14px', color: '#64748b' }}>
          &larr; Back to Dashboard
        </Link>
      </div>
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>
          Create New Instance
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748b' }}>
          Provision a new isolated ERP tenant database.
        </p>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Database Name</label>
          <input
            type="text"
            value={dbName}
            onChange={(e) => setDbName(e.target.value)}
            style={inputStyle}
            placeholder="e.g. acme_corp"
            pattern="^[a-z][a-z0-9_]*$"
            required
          />
          <span style={hintStyle}>Lowercase letters, numbers, and underscores only.</span>

          <label style={labelStyle}>Subdomain</label>
          <input
            type="text"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
            style={inputStyle}
            placeholder="e.g. acme"
            pattern="^[a-z][a-z0-9-]*$"
            required
          />
          <span style={hintStyle}>Will be used as: {subdomain || 'your-subdomain'}.mashora.app</span>

          <button type="submit" style={btnStyle} disabled={loading}>
            {loading ? 'Creating...' : 'Create Instance'}
          </button>
          <Link
            to="/dashboard"
            style={{
              display: 'block',
              textAlign: 'center',
              fontSize: '14px',
              color: '#64748b',
            }}
          >
            Cancel
          </Link>
        </form>
      </div>
    </div>
  )
}
