'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C9A84C] to-[#E8C96A] mx-auto mb-4 flex items-center justify-center text-3xl">
            🍽️
          </div>
          <h1 className="text-2xl text-white font-light tracking-wide">
            GestionResto
          </h1>
          <p className="text-sm text-white/40 tracking-widest uppercase mt-1">
            Le Carré · Le Caméléon
          </p>
        </div>

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
              <span className="text-xs text-[#C9A84C] cursor-pointer">
                Mot de passe oublié ?
              </span>
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