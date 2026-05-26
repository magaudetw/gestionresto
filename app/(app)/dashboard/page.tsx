'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profile)
      setLoading(false)
    }
    loadUser()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="text-[#C9A84C] text-sm tracking-widest uppercase">
        Chargement...
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080808] text-white p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C9A84C] to-[#E8C96A] flex items-center justify-center text-base">
            🍽️
          </div>
          <div>
            <div className="text-sm font-light tracking-wide">GestionResto</div>
            <div className="text-xs text-white/30">Le Carré</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          Déconnexion
        </button>
      </div>

      <div className="mb-8">
        <p className="text-white/50 text-sm mb-1">Bon retour 👋</p>
        <h1 className="text-3xl font-light">
          {profile?.nom?.split(' ')[0] || 'Bienvenue'}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Rôle', value: profile?.roles?.[0] || '—', color: '#C9A84C' },
          { label: 'Restaurant', value: 'Le Carré', color: '#7EB8F7' },
          { label: 'Taux horaire', value: `$${profile?.taux_horaire || 0}/h`, color: '#82E0AA' },
          { label: 'Statut', value: profile?.actif ? 'Actif' : 'Inactif', color: '#72BA80' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/5 border border-white/8 rounded-xl p-4">
            <div className="text-xs tracking-widest uppercase text-white/40 mb-2">{label}</div>
            <div className="text-lg font-light" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="text-xs tracking-widest uppercase text-[#C9A84C] mb-3">
          Modules disponibles
        </div>
        {[
          { icon: '📅', label: 'Horaire', desc: 'Voir votre horaire de la semaine' },
          { icon: '💰', label: 'Paie & Pourboires', desc: 'Vos gains et pourboires' },
          { icon: '🔔', label: 'Notifications', desc: 'Vos alertes et messages' },
        ].map(({ icon, label, desc }) => (
          <div key={label} className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
            <span className="text-2xl">{icon}</span>
            <div>
              <div className="text-sm text-white">{label}</div>
              <div className="text-xs text-white/30">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}