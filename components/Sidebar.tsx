'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Theme } from '@/lib/themes'

const NAV_GERANT = [
  { href: '/dashboard',     icon: '⬡', label: { fr: 'Tableau de bord', en: 'Dashboard'   }},
  { href: '/horaire',       icon: '◫', label: { fr: 'Horaire',         en: 'Schedule'    }},
  { href: '/finances',      icon: '◈', label: { fr: 'Finances',        en: 'Finances'    }},
  { href: '/equipe',        icon: '◎', label: { fr: 'Équipe',          en: 'Team'        }},
  { href: '/import',        icon: '⬒', label: { fr: 'Import heures',   en: 'Import'      }},
  { href: '/notifications', icon: '◉', label: { fr: 'Alertes',         en: 'Alerts'      }},
  { href: '/reglages',      icon: '⚙',  label: { fr: 'Réglages',       en: 'Settings'    }},
]

const NAV_EMPLOYE = [
  { href: '/dashboard',     icon: '⬡', label: { fr: 'Tableau de bord', en: 'Dashboard'   }},
  { href: '/horaire',       icon: '◫', label: { fr: 'Horaire',         en: 'Schedule'    }},
  { href: '/dispos',        icon: '◻', label: { fr: 'Disponibilités',  en: 'Availability'}},
  { href: '/pourboires',    icon: '◈', label: { fr: 'Paie & Pourboires', en: 'Pay'       }},
  { href: '/notifications', icon: '◉', label: { fr: 'Alertes',         en: 'Alerts'      }},
  { href: '/reglages',      icon: '⚙',  label: { fr: 'Réglages',       en: 'Settings'    }},
]

interface SidebarProps {
  profile: any
  theme: Theme
}

export default function Sidebar({ profile, theme: t }: SidebarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : []
  const isManager = roles.includes('gerant') || roles.includes('admin')
  const lang      = (profile?.lang || 'fr') as 'fr' | 'en'
  const nav       = isManager ? NAV_GERANT : NAV_EMPLOYE
  const [exchangeBadge, setExchangeBadge] = useState(0)

  // Lazy init — reads localStorage synchronously to avoid margin flash
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    const val = localStorage.getItem('sidebar-collapsed') === 'true'
    document.documentElement.dataset.sidebar = val ? 'collapsed' : 'open'
    return val
  })

  // Keep html data-attr in sync whenever collapsed state changes
  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'open'
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])

  useEffect(() => {
    if (!isManager) return
    supabase.from('echanges')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'en_attente_gerant')
      .then(({ count }) => setExchangeBadge(count || 0))
  }, [isManager])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const restaurant = profile?.restaurant_name || ''

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, width: 'var(--sidebar-w)', height: '100vh',
      background: 'rgba(8,8,8,0.96)',
      borderRight: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column', zIndex: 50,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      transition: 'width 0.28s ease',
      overflow: 'hidden',
    }}>

      {/* Brand */}
      <div style={{
        padding: collapsed ? '18px 0' : '20px 18px 16px',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start', gap: 10,
        minHeight: 74, flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, #C9A84C, #E8C96A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
          boxShadow: 'var(--shadow-accent)',
        }}>🍽️</div>
        {!collapsed && (
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div className="font-title" style={{ fontSize: 15, color: t.texte, whiteSpace: 'nowrap' }}>
              {restaurant || 'GestionResto'}
            </div>
            <div style={{ fontSize: 10, color: t.texteFaible, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1, whiteSpace: 'nowrap' }}>
              {isManager ? (lang === 'fr' ? 'Gestion' : 'Management') : (lang === 'fr' ? 'Personnel' : 'Staff')}
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{
        flex: 1, padding: `10px ${collapsed ? '6px' : '10px'}`,
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 1,
      }}>
        {nav.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const badge  = item.href === '/horaire' ? exchangeBadge : 0
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={active ? 'nav-item-active' : undefined}
              title={collapsed ? item.label[lang] : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? 0 : 10,
                padding: collapsed ? '10px 8px' : '9px 12px',
                borderRadius: 'var(--radius-sm)',
                background: active ? `${t.accent}18` : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                position: 'relative', transition: 'background var(--transition)',
              }}
            >
              <span style={{
                fontSize: 16, lineHeight: 1, flexShrink: 0, position: 'relative',
                color: active ? t.accent : t.texteFaible,
                transition: 'color var(--transition)',
              }}>
                {item.icon}
                {badge > 0 && (
                  <span style={{
                    position: 'absolute', top: -3, right: -5,
                    background: '#E07070', borderRadius: '50%',
                    minWidth: 13, height: 13, fontSize: 7, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', padding: '0 2px', lineHeight: 1,
                  }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              {!collapsed && (
                <span style={{
                  fontSize: 13, fontFamily: 'var(--font-body)',
                  color: active ? t.texte : t.texteSecondaire,
                  fontWeight: active ? 500 : 400,
                  transition: 'color var(--transition)',
                  whiteSpace: 'nowrap',
                }}>
                  {item.label[lang]}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed
          ? (lang === 'fr' ? 'Déplier la barre' : 'Expand sidebar')
          : (lang === 'fr' ? 'Replier la barre'  : 'Collapse sidebar')}
        style={{
          padding: collapsed ? '8px' : '8px 18px',
          background: 'transparent', border: 'none',
          borderTop: `1px solid ${t.border}22`,
          cursor: 'pointer', color: t.texteFaible, fontSize: 15, lineHeight: 1,
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-end',
          flexShrink: 0,
          transition: 'color var(--transition)',
        }}
      >
        {collapsed ? '›' : '‹'}
      </button>

      {/* User section */}
      <div style={{ padding: collapsed ? '10px 8px 16px' : '12px 18px 18px', borderTop: `1px solid ${t.border}` }}>
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div
              title={profile?.nom || ''}
              style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: `${t.accent}22`, border: `1px solid ${t.borderAccent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: t.accent, fontWeight: 600,
              }}
            >
              {(profile?.nom || '?')[0].toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              title={lang === 'fr' ? 'Déconnexion' : 'Sign out'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: t.texteFaible, fontSize: 14, lineHeight: 1 }}
            >⇥</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: `${t.accent}22`, border: `1px solid ${t.borderAccent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: t.accent, fontWeight: 600,
            }}>
              {(profile?.nom || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: t.texte, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.nom || ''}
              </div>
              <div style={{ fontSize: 10, color: t.texteFaible, marginTop: 1, letterSpacing: '0.04em' }}>
                {roles[0] || ''}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title={lang === 'fr' ? 'Déconnexion' : 'Sign out'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: t.texteFaible, fontSize: 16, lineHeight: 1, transition: 'color var(--transition)' }}
            >⇥</button>
          </div>
        )}
      </div>
    </aside>
  )
}
