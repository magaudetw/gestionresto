'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const PAGE_TITLES: Record<string, { fr: string; en: string }> = {
  '/dashboard':     { fr: 'Tableau de bord',    en: 'Dashboard'    },
  '/horaire':       { fr: 'Horaire',             en: 'Schedule'     },
  '/finances':      { fr: 'Finances',            en: 'Finances'     },
  '/equipe':        { fr: 'Équipe',              en: 'Team'         },
  '/import':        { fr: 'Import heures',       en: 'Import'       },
  '/notifications': { fr: 'Alertes',             en: 'Alerts'       },
  '/pourboires':    { fr: 'Paie & Pourboires',   en: 'Pay'          },
  '/dispos':        { fr: 'Disponibilités',      en: 'Availability' },
  '/reglages':      { fr: 'Réglages',            en: 'Settings'     },
}

function BellIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

export default function Topbar({ profile }: { profile: any }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { restaurantName, userRestaurants, restaurantId, setActiveRestaurant } = useAuth()
  const lang    = (profile?.lang || 'fr') as 'fr' | 'en'
  const nom     = profile?.nom || ''
  const initial = nom[0]?.toUpperCase() || '?'
  const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : []

  const [unread, setUnread]       = useState(0)
  const [dropOpen, setDropOpen]   = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const pageKey = Object.keys(PAGE_TITLES).find(k =>
    pathname === k || (k !== '/dashboard' && pathname.startsWith(k))
  ) || '/dashboard'
  const title = PAGE_TITLES[pageKey]?.[lang] || ''

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .then(({ count }) => setUnread(count || 0))
  }, [profile?.id, pathname])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    if (dropOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [dropOpen])

  async function handleLogout() {
    setDropOpen(false)
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header style={{
      position:       'sticky',
      top:            0,
      height:         'var(--topbar-h)',
      background:     'var(--surface1)',
      borderBottom:   '1px solid var(--border)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '0 28px',
      zIndex:         'var(--z-header)' as any,
      gap:            16,
      boxShadow:      '0 1px 0 var(--border)',
    }}>

      {/* Left: page title */}
      <span style={{ fontSize: 'var(--fz-lg)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
        {title}
      </span>

      {/* Right: restaurant selector + bell + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Restaurant selector (multi-restaurant managers) */}
        {userRestaurants.length > 1 ? (
          <select
            value={restaurantId || ''}
            onChange={e => setActiveRestaurant(e.target.value)}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text)',
              fontSize: 'var(--fz-sm)', padding: '5px 10px',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}
          >
            {userRestaurants.map(r => (
              <option key={r.id} value={r.id}>{r.nom}</option>
            ))}
          </select>
        ) : restaurantName ? (
          <span style={{ fontSize: 'var(--fz-sm)', color: 'var(--text-secondary)', display: 'none' }}
            className="md:block">
            {restaurantName}
          </span>
        ) : null}

        {/* Bell */}
        <button
          onClick={() => router.push('/notifications')}
          title={lang === 'fr' ? 'Alertes' : 'Alerts'}
          style={{
            position: 'relative', background: 'transparent', border: 'none',
            cursor: 'pointer', padding: '6px',
            color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center',
            transition: 'color var(--transition-fast), background var(--transition-fast)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text)'
            ;(e.currentTarget as HTMLElement).style.background = 'var(--surface2)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          <BellIcon />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: 3, right: 3,
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--accent-coral, var(--danger))',
              border: '1.5px solid var(--surface1)',
            }} />
          )}
        </button>

        {/* Avatar dropdown */}
        <div ref={dropRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropOpen(o => !o)}
            style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: dropOpen ? 'var(--accent)' : 'var(--accent-subtle)',
              color: dropOpen ? 'var(--accent-text)' : 'var(--accent)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--fz-sm)', fontWeight: 700,
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
          >
            {initial}
          </button>

          {dropOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'var(--surface1)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-menu)',
              minWidth: 200, zIndex: 900,
              animation: 'scaleIn 0.15s ease both',
              transformOrigin: 'top right',
            }}>
              {/* User info */}
              <div style={{
                padding: '12px 14px 10px',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 'var(--fz-sm)', fontWeight: 600, color: 'var(--text)' }}>
                  {nom}
                </div>
                <div style={{
                  fontSize: 'var(--fz-xs)', color: 'var(--text-muted)',
                  marginTop: 2, textTransform: 'capitalize',
                }}>
                  {roles[0] || ''}{restaurantName ? ` · ${restaurantName}` : ''}
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: '6px 6px' }}>
                <button
                  onClick={() => { setDropOpen(false); router.push('/reglages') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', background: 'transparent', border: 'none',
                    padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', color: 'var(--text-secondary)',
                    fontSize: 'var(--fz-sm)', fontFamily: 'var(--font-body)',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <SettingsIcon />
                  {lang === 'fr' ? 'Réglages' : 'Settings'}
                </button>

                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', background: 'transparent', border: 'none',
                    padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', color: 'var(--danger)',
                    fontSize: 'var(--fz-sm)', fontFamily: 'var(--font-body)',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--danger-subtle)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <LogoutIcon />
                  {lang === 'fr' ? 'Déconnexion' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
