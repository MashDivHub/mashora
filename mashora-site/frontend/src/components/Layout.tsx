import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface LayoutProps {
  children: React.ReactNode
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 24px',
  height: '56px',
  background: '#1e293b',
  color: '#fff',
}

const logoStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#fff',
  textDecoration: 'none',
  letterSpacing: '-0.5px',
}

const navLinksStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  alignItems: 'center',
}

const navLinkStyle: React.CSSProperties = {
  color: '#cbd5e1',
  textDecoration: 'none',
  fontSize: '14px',
}

const navLinkAccentStyle: React.CSSProperties = {
  color: '#a78bfa',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 500,
}

const logoutBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #475569',
  color: '#cbd5e1',
  padding: '4px 12px',
  borderRadius: '4px',
  fontSize: '14px',
  cursor: 'pointer',
}

const mainStyle: React.CSSProperties = {
  maxWidth: '960px',
  margin: '0 auto',
  padding: '32px 24px',
}

export default function Layout({ children }: LayoutProps) {
  const { isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <>
      <nav style={navStyle}>
        <Link to="/" style={logoStyle}>Mashora</Link>
        <div style={navLinksStyle}>
          <Link to="/" style={navLinkStyle}>Home</Link>
          <Link to="/pricing" style={navLinkStyle}>Pricing</Link>
          <Link to="/addons" style={navLinkAccentStyle}>Addons</Link>
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" style={navLinkStyle}>Dashboard</Link>
              <Link to="/dashboard/upgrades" style={navLinkStyle}>Upgrades</Link>
              <Link to="/dashboard/support" style={navLinkStyle}>Support</Link>
              <Link to="/dashboard/publisher" style={navLinkStyle}>Publisher</Link>
              <Link to="/dashboard/admin" style={navLinkStyle}>Admin</Link>
              <button onClick={handleLogout} style={logoutBtnStyle}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" style={navLinkStyle}>Login</Link>
              <Link to="/register" style={navLinkStyle}>Register</Link>
            </>
          )}
        </div>
      </nav>
      <main style={mainStyle}>
        {children}
      </main>
    </>
  )
}
