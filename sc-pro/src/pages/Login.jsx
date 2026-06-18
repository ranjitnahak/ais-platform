import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'

const inputStyle = {
  width: '100%',
  borderRadius: 'var(--radius-xl)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-high)',
  padding: '12px 16px',
  fontSize: 'var(--font-size-body-sm)',
  color: 'var(--color-text)',
  outline: 'none',
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      if (data.session) {
        navigate('/programmes', { replace: true })
        return
      }
      setCheckingSession(false)
    })()
    return () => { mounted = false }
  }, [navigate])

  async function handleSignIn() {
    setError('')
    setSubmitting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      navigate('/programmes')
    } catch (err) {
      setError(err.message || 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingSession) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    )
  }

  return (
    <main style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-container)', background: 'var(--color-bg)', fontFamily: 'var(--font-family)' }}>
      <section style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ margin: '0 auto 20px', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-xl)', background: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontWeight: 700, fontSize: 18 }}>AIS</div>
          <p className="sc-label-caps">Athlete Intelligence System</p>
          <p className="sc-headline" style={{ color: 'var(--color-text)', margin: '12px 0 4px' }}>S&C Pro</p>
          <h1 className="sc-display" style={{ color: 'var(--color-text)', margin: '8px 0', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>Sign In</h1>
          <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: 0 }}>Access is invite-only for organisation users.</p>
        </div>
        <div style={{ borderRadius: 'var(--radius-xl)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-container)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onKeyDown={(e) => { if (e.key === 'Enter') handleSignIn() }}>
            <label>
              <span className="sc-label-caps" style={{ display: 'block', marginBottom: 8 }}>Email</span>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organisation.com" style={inputStyle} />
            </label>
            <label>
              <span className="sc-label-caps" style={{ display: 'block', marginBottom: 8 }}>Password</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" style={inputStyle} />
            </label>
            <button type="button" onClick={handleSignIn} disabled={submitting} style={{ width: '100%', borderRadius: 'var(--radius-xl)', border: 'none', background: 'var(--color-primary)', color: 'var(--color-text)', padding: '12px 16px', fontSize: 'var(--font-size-label)', fontWeight: 700, letterSpacing: 'var(--letter-spacing-label)', textTransform: 'uppercase', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
          {error && <p className="sc-body-sm" style={{ color: 'var(--color-danger)', marginTop: 16, marginBottom: 0 }}>{error}</p>}
        </div>
      </section>
    </main>
  )
}
