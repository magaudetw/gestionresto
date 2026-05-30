'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const NAV_GERANT = [
  { href: '/dashboard',     icon: '⬡', label: { fr: 'Accueil',   en: 'Home'     }},
  { href: '/horaire',       icon: '◫', label: { fr: 'Horaire',   en: 'Schedule' }},
  { href: '/finances',      icon: '◈', label: { fr: 'Finances',  en: 'Finances' }},
  { href: '/equipe',        icon: '◎', label: { fr: 'Équipe',    en: 'Team'     }},
  { href: '/import',        icon: '⬒', label: { fr: 'Import',    en: 'Import'   }},
  { href: '/notifications', icon: '◉', label: { fr: 'Alertes',   en: 'Alerts'   }},
  { href: '/reglages',      icon: '⚙',  label: { fr: 'Réglages', en: 'Settings' }},
]

const NAV_EMPLOYE = [
  { href: '/dashboard',     icon: '⬡', label: { fr: 'Accueil',   en: 'Home'     }},
  { href: '/horaire',       icon: '◫', label: { fr: 'Horaire',   en: 'Schedule' }},
  { href: '/dispos',        icon: '◻', label: { fr: 'Dispos',    en: 'Avail.'   }},
  { href: '/pourboires',    icon: '◈', label: { fr: 'Paie',      en: 'Pay'      }},
  { href: '/notifications', icon: '◉', label: { fr: 'Alertes',   en: 'Alerts'   }},
  { href: '/reglages',      icon: '⚙',  label: { fr: 'Réglages', en: 'Settings' }},
]

export default function Navigation({ role, lang }: { role: string; lang: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = role === 'gerant' || role === 'admin' ? NAV_GERANT : NAV_EMPLOYE
  const l = lang as 'fr' | 'en'
  const [exchangeBadge, setExchangeBadge] = useState(0)

  useEffect(() => {
    if (role !== 'gerant' && role !== 'admin') return
    supabase.from('echanges')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'en_attente_gerant')
      .then(({ count }) => setExchangeBadge(count || 0))
  }, [role])

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      height: 'var(--nav-h)',
      background: 'var(--surface1)',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'stretch',
      zIndex: 'var(--z-nav-mobile)' as any,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {nav.map(item => {
        const active = pathname === item.href
        const badge = item.href === '/horaire' ? exchangeBadge : 0
        return (
          <button key={item.href} onClick={() => router.push(item.href)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3, padding: '8px 2px',
              position: 'relative', transition: 'opacity var(--transition)',
            }}>
            <span style={{
              fontSize: 'var(--fz-lg)', lineHeight: 1, position: 'relative',
              color: active ? 'var(--accent)' : 'var(--text-faint)',
              transition: 'color var(--transition)',
            }}>
              {item.icon}
              {badge > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  background: 'var(--danger)', borderRadius: '50%',
                  minWidth: 14, height: 14, fontSize: 'var(--fz-8)', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', padding: '0 3px', lineHeight: 1,
                }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span style={{
              fontSize: 'var(--fz-9)', letterSpacing: '0.08em', textTransform: 'uppercase',
              fontFamily: 'var(--font-body)',
              color: active ? 'var(--accent)' : 'var(--text-faint)',
              transition: 'color var(--transition)',
            }}>
              {item.label[l]}
            </span>
            {active && (
              <div style={{
                position: 'absolute', top: 0, left: '50%',
                transform: 'translateX(-50%)', width: 24, height: 2,
                background: 'var(--accent)', borderRadius: '0 0 2px 2px',
              }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
