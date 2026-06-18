import { Navigate } from 'react-router-dom'
import { useUser } from '../../context/UserContext.jsx'
import { canSync } from '../../lib/auth.js'

const centerPage = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-bg)',
}

const spinnerStyle = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '2px solid var(--color-border)',
  borderTopColor: 'var(--color-primary)',
  animation: 'protected-route-spin 0.8s linear infinite',
}

const deniedWrap = {
  ...centerPage,
  flexDirection: 'column',
  padding: 'var(--space-container)',
  textAlign: 'center',
  gap: 8,
}

const AccessDenied = ({ user }) => (
  <div style={deniedWrap}>
    <p style={{ margin: 0, fontSize: 'var(--font-size-headline)', color: 'var(--color-text)', fontWeight: 'var(--font-weight-semibold)' }}>
      {user.role}
    </p>
    <p style={{ margin: 0, fontSize: 'var(--font-size-body)', color: 'var(--color-text-muted)', maxWidth: 360 }}>
      You do not have access to S&C Pro. Contact your administrator.
    </p>
  </div>
)

export default function ProtectedRoute({ children }) {
  const { user, loading } = useUser()
  if (loading) {
    return (
      <div style={centerPage}>
        <style>{'@keyframes protected-route-spin { to { transform: rotate(360deg); } }'}</style>
        <div style={spinnerStyle} />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!canSync(user, 'sc_pro', 'view')) return <AccessDenied user={user} />
  return children
}
