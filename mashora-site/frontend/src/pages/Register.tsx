import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api/auth'

const cardStyle: React.CSSProperties = {
  maxWidth: '400px',
  margin: '40px auto',
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
  marginBottom: '16px',
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
}

export default function Register() {
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await register(email, password, orgName)
      navigate('/login')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ margin: '0 0 24px', fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>
        Create Account
      </h2>
      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Organization Name</label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          style={inputStyle}
          required
          autoComplete="organization"
        />
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          required
          autoComplete="email"
        />
        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          required
          autoComplete="new-password"
        />
        <label style={labelStyle}>Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={inputStyle}
          required
          autoComplete="new-password"
        />
        <button type="submit" style={btnStyle} disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
      <p style={{ marginTop: '16px', fontSize: '14px', color: '#64748b', textAlign: 'center' }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  )
}
