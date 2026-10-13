import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { sb } from '../lib/supabase'

export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState(''), [pw, setPw] = useState('')
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false)
  const [err, setErr] = useState(''), [info, setInfo] = useState('')

  useEffect(() => {
    document.title = 'Admin sign in'
    sb?.auth.getSession().then(({ data }) => { if (data.session) nav('/admin/dashboard', { replace: true }) })
  }, [nav])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!sb) { setErr('Backend is not configured. See the README.'); return }
    setBusy(true); setErr(''); setInfo('')
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw })
    setBusy(false)
    if (error) setErr('Invalid email or password.')
    else nav('/admin/dashboard', { replace: true })
  }
  const reset = async () => {
    if (!sb || !email.trim()) { setErr('Enter your email first, then choose Forgot password.'); return }
    await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/admin/dashboard` })
    setErr(''); setInfo('If that account exists, a reset link is on its way.')
  }

  return (
    <main className="auth">
      <form onSubmit={submit} aria-labelledby="login-h">
        <h1 id="login-h">Admin sign in</h1>
        <label className="field">Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">Password
          <span className="pw">
            <input type={show ? 'text' : 'password'} autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="icon" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        {info && <p className="ok" role="status">{info}</p>}
        <button className="btn primary" disabled={busy} type="submit">
          {busy && <Loader2 size={16} className="spin" />} {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="muted" onClick={reset}>Forgot password?</button>
      </form>
    </main>
  )
}
