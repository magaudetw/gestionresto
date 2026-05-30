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
      position: 'sticky', top: 0, zIndex: 'var(--z-header)' as any,
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      padding: '10px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      maxWidth: 480, width: '100%', margin: '0 auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
        }}>🍽️</div>
        <div>
          <div style={{ fontSize: 'var(--fz-sm)', color: 'var(--sidebar-text)', fontFamily: 'var(--font-title)', fontWeight: 300, letterSpacing: '0.04em' }}>
            {restaurant || 'GestionResto'}
          </div>
          <div style={{ fontSize: 'var(--fz-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{nom}</div>
        </div>
      </div>
      <button onClick={handleLogout} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 'var(--fz-xs)', color: 'var(--text-faint)',
        fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
        padding: '4px 0',
        transition: 'color var(--transition)',
      }}>
        {lang === 'fr' ? 'Déco.' : 'Out'}
      </button>
    </header>
  )
}
