'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  dashboard:     'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  schedule:      'M8 2v4 M16 2v4 M3 10h18 M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z',
  finances:      'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  equipe:        'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  import:        'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  notifications: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  settings:      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  dispos:        'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  pourboires:    'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  logout:        'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  chevronLeft:   'M15 18l-6-6 6-6',
  chevronRight:  'M9 18l6-6-6-6',
} as const

const NAV_GERANT = [
  { href: '/dashboard',     iconKey: 'dashboard'     as const, label: { fr: 'Tableau de bord', en: 'Dashboard'    }},
  { href: '/horaire',       iconKey: 'schedule'      as const, label: { fr: 'Horaire',          en: 'Schedule'     }},
  { href: '/finances',      iconKey: 'finances'      as const, label: { fr: 'Finances',         en: 'Finances'     }},
  { href: '/equipe',        iconKey: 'equipe'        as const, label: { fr: 'Équipe',           en: 'Team'         }},
  { href: '/import',        iconKey: 'import'        as const, label: { fr: 'Import heures',    en: 'Import'       }},
  { href: '/notifications', iconKey: 'notifications' as const, label: { fr: 'Alertes',          en: 'Alerts'       }},
  { href: '/reglages',      iconKey: 'settings'      as const, label: { fr: 'Réglages',         en: 'Settings'     }},
]

const NAV_EMPLOYE = [
  { href: '/dashboard',     iconKey: 'dashboard'     as const, label: { fr: 'Tableau de bord', en: 'Dashboard'    }},
  { href: '/horaire',       iconKey: 'schedule'      as const, label: { fr: 'Horaire',          en: 'Schedule'     }},
  { href: '/dispos',        iconKey: 'dispos'        as const, label: { fr: 'Disponibilités',   en: 'Availability' }},
  { href: '/pourboires',    iconKey: 'pourboires'    as const, label: { fr: 'Paie & Pourboires', en: 'Pay'         }},
  { href: '/notifications', iconKey: 'notifications' as const, label: { fr: 'Alertes',          en: 'Alerts'       }},
  { href: '/reglages',      iconKey: 'settings'      as const, label: { fr: 'Réglages',         en: 'Settings'     }},
]

interface SidebarProps { profile: any }

export default function Sidebar({ profile }: SidebarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : []
  const isManager = roles.includes('gerant') || roles.includes('admin')
  const lang      = (profile?.lang || 'fr') as 'fr' | 'en'
  const nav       = isManager ? NAV_GERANT : NAV_EMPLOYE
  const [exchangeBadge, setExchangeBadge] = useState(0)
  const { userRestaurants, restaurantId: activeRestaurantId, setActiveRestaurant } = useAuth()

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    const val  = localStorage.getItem('sidebar-collapsed') === 'true'
    const fond = localStorage.getItem('gr-theme-fond')
    const texte = localStorage.getItem('gr-theme-texte')
    const slug = localStorage.getItem('gr-theme-slug')
    if (fond)  document.documentElement.style.background = fond
    if (texte) document.documentElement.style.color      = texte
    if (slug)  document.documentElement.setAttribute('data-theme', slug)
    document.documentElement.dataset.sidebar = val ? 'collapsed' : 'open'
    return val
  })

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

  const restaurant = profile?.restaurant_name || 'GestionResto'
  const initials   = (profile?.nom || '?')[0].toUpperCase()

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, height: '100vh',
      width: 'var(--sidebar-w)',
      background: 'var(--sidebar-bg)',
      display: 'flex', flexDirection: 'column',
      zIndex: 'var(--z-sidebar)' as any,
      transition: 'width var(--transition-base)',
      overflow: 'hidden',
    }}>

      {/* ── Brand ── */}
      <div style={{
        padding: collapsed ? '16px 0' : '18px 16px',
        borderBottom: '1px solid var(--sidebar-border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: 10, minHeight: 68, flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: 'var(--sidebar-active-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>🍽️</div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--sidebar-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                letterSpacing: '-0.01em',
              }}>
                {restaurant}
              </div>
              <div style={{
                fontSize: 10, color: 'var(--sidebar-text-muted)',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1,
              }}>
                {isManager ? (lang === 'fr' ? 'Gestion' : 'Management') : (lang === 'fr' ? 'Personnel' : 'Staff')}
              </div>
            </div>
          </div>
        )}

        {collapsed && (
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'var(--sidebar-active-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>🍽️</div>
        )}
      </div>

      {/* ── Restaurant switcher ── */}
      {userRestaurants.length > 1 && !collapsed && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <select
            value={activeRestaurantId || ''}
            onChange={e => setActiveRestaurant(e.target.value)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--sidebar-border)',
              borderRadius: 6, color: 'var(--sidebar-text-muted)', fontSize: 11,
              padding: '5px 8px', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {userRestaurants.map(r => (
              <option key={r.id} value={r.id}
                style={{ background: 'var(--sidebar-bg)', color: 'var(--sidebar-text)' }}
              >
                {r.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Nav ── */}
      <nav style={{
        flex: 1, padding: `8px ${collapsed ? '6px' : '8px'}`,
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 2,
        scrollbarWidth: 'none',
      }}>
        {nav.map(item => {
          const active = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const badge  = item.href === '/horaire' ? exchangeBadge : 0

          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={collapsed ? item.label[lang] : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 10,
                padding: collapsed ? '10px 8px' : '9px 12px',
                borderRadius: 'var(--radius-sm)',
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                position: 'relative',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {/* Active left indicator */}
              {active && (
                <span style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 20,
                  background: 'var(--sidebar-indicator)',
                  borderRadius: '0 2px 2px 0',
                }} />
              )}

              {/* Icon */}
              <span style={{
                color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text-muted)',
                flexShrink: 0, position: 'relative',
                transition: 'color var(--transition-fast)',
                display: 'flex', alignItems: 'center',
              }}>
                <Icon d={ICONS[item.iconKey]} size={17} />
                {badge > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -6,
                    background: 'var(--danger)', borderRadius: '50%',
                    minWidth: 14, height: 14, fontSize: 7, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', padding: '0 2px', lineHeight: 1,
                  }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>

              {/* Label */}
              {!collapsed && (
                <span style={{
                  fontSize: 13, fontFamily: 'var(--font-body)',
                  color: active ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)',
                  fontWeight: active ? 500 : 400,
                  transition: 'color var(--transition-fast)',
                  whiteSpace: 'nowrap',
                }}>
                  {item.label[lang]}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed
          ? (lang === 'fr' ? 'Déplier' : 'Expand')
          : (lang === 'fr' ? 'Replier' : 'Collapse')}
        style={{
          padding: collapsed ? '10px' : '10px 16px',
          background: 'transparent', border: 'none',
          borderTop: '1px solid var(--sidebar-border)',
          cursor: 'pointer',
          color: 'var(--sidebar-text-faint)',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-end',
          flexShrink: 0,
          transition: 'color var(--transition-fast)',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-muted)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-faint)'}
      >
        <Icon d={collapsed ? ICONS.chevronRight : ICONS.chevronLeft} size={15} />
      </button>

      {/* ── User section ── */}
      <div style={{
        padding: collapsed ? '10px 8px 16px' : '12px 14px 16px',
        borderTop: '1px solid var(--sidebar-border)',
        flexShrink: 0,
      }}>
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div
              title={profile?.nom || ''}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--sidebar-active-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: 'var(--sidebar-active-text)', fontWeight: 600,
              }}
            >
              {initials}
            </div>
            <button
              onClick={handleLogout}
              title={lang === 'fr' ? 'Déconnexion' : 'Sign out'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                color: 'var(--sidebar-text-faint)', display: 'flex', alignItems: 'center',
              }}
            >
              <Icon d={ICONS.logout} size={15} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: 'var(--sidebar-active-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'var(--sidebar-active-text)', fontWeight: 600,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 500,
                color: 'var(--sidebar-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {profile?.nom || ''}
              </div>
              <div style={{
                fontSize: 10, color: 'var(--sidebar-text-muted)',
                marginTop: 1, letterSpacing: '0.04em', textTransform: 'capitalize',
              }}>
                {roles[0] || ''}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title={lang === 'fr' ? 'Déconnexion' : 'Sign out'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                color: 'var(--sidebar-text-faint)', display: 'flex', alignItems: 'center',
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-muted)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-faint)'}
            >
              <Icon d={ICONS.logout} size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
