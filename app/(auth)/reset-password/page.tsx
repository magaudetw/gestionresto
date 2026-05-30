'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Guard: must have an active session (established by the callback page)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setSessionReady(true)
      }
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setDone(true)
      setTimeout(() => router.replace('/dashboard'), 2200)
    }
  }

  if (!sessionReady && !done) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-2xl mx-auto mb-4">
            ✓
          </div>
          <h2 className="text-white text-xl font-light mb-2">Mot de passe changé</h2>
          <p className="text-white/40 text-sm">Redirection vers l'accueil…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C9A84C] to-[#E8C96A] mx-auto mb-4 flex items-center justify-center text-3xl">
            🍽️
          </div>
          <h1 className="text-2xl text-white font-light tracking-wide">
            Nouveau mot de passe
          </h1>
          <p className="text-sm text-white/40 tracking-widest uppercase mt-1">
            GestionResto
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="mb-5">
            <label className="block text-xs tracking-widest uppercase text-white/50 mb-2">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C9A84C]/50 transition-colors"
              placeholder="Min. 8 caractères"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs tracking-widest uppercase text-white/50 mb-2">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C9A84C]/50 transition-colors"
              placeholder="••••••••"
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
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#E8C96A] text-black font-bold text-sm tracking-wide disabled:opacity-50"
          >
            {loading ? 'Enregistrement…' : 'Changer le mot de passe'}
          </button>
        </form>

        <p className="text-center text-xs text-white/20 mt-6">
          Connexion sécurisée · SSL
        </p>
      </div>
    </div>
  )
}
