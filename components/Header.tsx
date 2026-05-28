'use client'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Header({
  nom, restaurant, lang
}: {
  nom: string, restaurant: string, lang: string
}) {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: '#111111', borderBottom: '1px solid rgba(255,255,255,0.08)',
      padding: '11px 18px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', maxWidth: 480, width: '100%', margin: '0 auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #C9A84C, #E8C96A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
        }}>🍽️</div>
        <div>
          <div style={{ fontSize: 13, color: '#F0EBE3', fontFamily: 'Georgia, serif' }}>
            {restaurant}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(240,235,227,0.3)' }}>{nom}</div>
        </div>
      </div>
      <button onClick={handleLogout} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 12, color: 'rgba(240,235,227,0.3)'
      }}>
        {lang === 'fr' ? 'Déconnexion' : 'Sign out'}
      </button>
    </header>
  )
}