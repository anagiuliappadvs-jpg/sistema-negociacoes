import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
    }
    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Sistema de Negociações Bancárias</h1>
        <p className="subtitle">Paccola & Pelegrini Advogados</p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="error-text">{error}</div>}

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Conectando...' : 'Entrar'}
          </button>
        </form>

        <div className="info-text">
          <p>Usuários são criados pelo administrador do sistema.</p>
          <p>Contate um advogado sênior para solicitar acesso.</p>
        </div>
      </div>
    </div>
  )
}
