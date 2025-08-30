'use client'

import { useState } from 'react'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ password })
    })
    if (res.ok) {
      window.location.href = '/admin'
    } else {
      setError('Wrong password')
    }
  }

  return (
    <div className="card" style={{maxWidth:480, margin:'2rem auto'}}>
      <h1>Admin Login</h1>
      <form onSubmit={login}>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
        <button className="primary" type="submit">Sign in</button>
      </form>
      {error && <p style={{color:'crimson'}}>{error}</p>}
      <p><small className="muted">Use the password you set in the ADMIN_PASSWORD env var.</small></p>
    </div>
  )
}
