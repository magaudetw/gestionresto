'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    // Surface any error Supabase appended to the URL (e.g. otp_expired, access_denied)
    const params = new URLSearchParams(window.location.search)
    const errorCode = params.get('error')
    const errorDesc = params.get('error_description')

    if (errorCode) {
      setErrorMsg(
        errorCode === 'access_denied' || errorCode === 'otp_expired'
          ? 'Ce lien est invalide ou a expiré. Demandez un nouveau lien de réinitialisation.'
          : errorDesc || errorCode
      )
      return
    }

    // createBrowserClient auto-processes the URL (PKCE code exchange or hash token)
    // and fires onAuthStateChange with the correct event type.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/auth/reset-password')
      } else if (event === 'SIGNED_IN' && session) {
        router.replace('/dashboard')
      }
    })

    const timeout = setTimeout(() => {
      setErrorMsg('Délai dépassé — le lien est peut-être expiré. Veuillez réessayer.')
    }, 12000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl mx-auto mb-6">
            ✕
          </div>
          <h2 className="text-white text-lg font-light mb-3">Lien invalide</h2>
          <p className="text-white/50 text-sm mb-8 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => router.replace('/login')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#E8C96A] text-black font-bold text-sm tracking-wide"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/40 text-sm tracking-widest uppercase">Vérification…</p>
      </div>
    </div>
  )
}
