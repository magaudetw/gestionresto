'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'forgot' | 'sent'

export default function LoginPage() {
  const [mode, setMode]         = useState<Mode>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Veuillez entrer votre adresse courriel'); return }
    setLoading(true)
    setError('')

    const redirectTo = `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMode('sent')
    }
  }

  const Logo = (
    <div className="text-center mb-10">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C9A84C] to-[#E8C96A] mx-auto mb-4 flex items-center justify-center text-3xl">
        🍽️
      </div>
      <h1 className="text-2xl text-white font-light tracking-wide">GestionResto</h1>
      <p className="text-sm text-white/40 tracking-widest uppercase mt-1">
        Le Carré · Le Caméléon
      </p>
    </div>
  )

  // ── Email sent confirmation ─────────────────────────────────────────────────
  if (mode === 'sent') {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {Logo}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center text-xl mx-auto mb-4">
              ✉️
            </div>
            <h2 className="text-white text-lg font-light mb-2">Email envoyé</h2>
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              Vérifiez votre boîte de réception — un lien de réinitialisation a été envoyé à{' '}
              <span className="text-[#C9A84C]">{email}</span>.
            </p>
            <button
              onClick={() => { setMode('login'); setError('') }}
              className="text-xs text-white/40 hover:text-white/60 transition-colors tracking-wide"
            >
              ← Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Forgot password form ────────────────────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {Logo}
          <form onSubmit={handleForgot} className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-white text-lg font-light mb-1">Mot de passe oublié</h2>
            <p className="text-white/40 text-xs mb-6 leading-relaxed">
              Entrez votre courriel pour recevoir un lien de réinitialisation.
            </p>

            <div className="mb-6">
              <label className="block text-xs tracking-widest uppercase text-white/50 mb-2">
                Courriel
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C9A84C]/50 transition-colors"
                placeholder="nom@email.com"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#E8C96A] text-black font-bold text-sm tracking-wide disabled:opacity-50 mb-4"
            >
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setMode('login'); setError('') }}
                className="text-xs text-white/40 hover:text-white/60 transition-colors tracking-wide"
              >
                ← Retour à la connexion
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Login form (default) ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {Logo}

        <form onSubmit={handleLogin} className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="mb-5">
            <label className="block text-xs tracking-widest uppercase text-white/50 mb-2">
              Courriel
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C9A84C]/50 transition-colors"
              placeholder="nom@email.com"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs tracking-widest uppercase text-white/50 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C9A84C]/50 transition-colors"
              placeholder="••••••••"
            />
            <div className="text-right mt-2">
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError('') }}
                className="text-xs text-[#C9A84C] hover:text-[#E8C96A] transition-colors cursor-pointer"
              >
                Mot de passe oublié ?
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#E8C96A] text-black font-bold text-sm tracking-wide disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-xs text-white/20 mt-6">
          Connexion sécurisée · SSL
        </p>
      </div>
    </div>
  )
}
