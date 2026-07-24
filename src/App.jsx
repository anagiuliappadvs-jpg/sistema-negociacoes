import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import './App.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession()
        setSession(data?.session)
      }
      setLoading(false)
    }

    checkSession()

    let authListener = null
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)
      })
      authListener = data
    }

    return () => authListener?.subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  return session && supabase ? (
    <Dashboard session={session} />
  ) : supabase ? (
    <Login />
  ) : (
    <div className="error-message">
      <h2>Configuração incompleta</h2>
      <p>As variáveis de ambiente do Supabase não estão configuradas.</p>
      <p>Crie um arquivo .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY</p>
    </div>
  )
}
