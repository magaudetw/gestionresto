'use client'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const PAGE_TITLES: Record<string, { fr: string; en: string }> = {
  '/dashboard':     { fr: 'Tableau de bord', en: 'Dashboard'   },
  '/horaire':       { fr: 'Horaire',         en: 'Schedule'    },
  '/finances':      { fr: 'Finances',        en: 'Finances'    },
  '/equipe':        { fr: 'Équipe',          en: 'Team'        },
  '/import':        { fr: 'Import heures',   en: 'Import'      },
  '/notifications': { fr: 'Alertes',         en: 'Alerts'      },
  '/pourboires':    { fr: 'Paie & Pourboires', en: 'Pay'       },
  '/dispos':        { fr: 'Disponibilités',  en: 'Availability'},
  '/reglages':      { fr: 'Réglages',        en: 'Settings'    },
}

export default function Topbar({ profile }: { profile: any }) {
  const pathname = usePathname()
  const { restaurantName, userRestaurants, restaurantId, setActiveRestaurant } = useAuth()
  const lang = (profile?.lang || 'fr') as 'fr' | 'en'
  const nom = profile?.nom || ''
  const initial = nom[0]?.toUpperCase() || '?'

  const pageKey = Object.keys(PAGE_TITLES).find(k =>
    pathname === k || (k !== '/dashboard' && pathname.startsWith(k))
  ) || '/dashboard'
  const title = PAGE_TITLES[pageKey]?.[lang] || ''

  return (
    <header style={{
      position:       'sticky',
      top:            0,
      height:         'var(--topbar-h, 56px)',
      background:     'var(--surface1)',
      borderBottom:   '1px solid var(--border)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '0 28px',
      zIndex:         'var(--z-header)' as any,
      gap:            16,
    }}>
      <span style={{ fontSize: 'var(--fz-lg)', fontWeight: 600, color: 'var(--text)' }}>
        {title}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {userRestaurants.length > 1 ? (
          <select
            value={restaurantId || ''}
            onChange={e => setActiveRestaurant(e.target.value)}
            style={{
              background:    'var(--surface2)',
              border:        '1px solid var(--border)',
              borderRadius:  'var(--radius-md)',
              color:         'var(--text)',
              fontSize:      'var(--fz-sm)',
              padding:       '6px 10px',
              cursor:        'pointer',
              fontFamily:    'var(--font-body)',
            }}
          >
            {userRestaurants.map(r => (
              <option key={r.id} value={r.id}>{r.nom}</option>
            ))}
          </select>
        ) : restaurantName ? (
          <span style={{ fontSize: 'var(--fz-sm)', color: 'var(--text-secondary)' }}>
            {restaurantName}
          </span>
        ) : null}

        <div style={{
          width:           32,
          height:          32,
          borderRadius:    '50%',
          background:      'var(--accent-subtle)',
          color:           'var(--accent)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        'var(--fz-sm)',
          fontWeight:      700,
          flexShrink:      0,
        }}>
          {initial}
        </div>
      </div>
    </header>
  )
}
