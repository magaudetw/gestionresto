'use client'
import Header from './Header'
import Navigation from './Navigation'
import Sidebar from './Sidebar'
import { useAuth } from '@/lib/auth-context'

interface AppShellProps {
  profile: any
  restaurant?: string
  children: React.ReactNode
}

export default function AppShell({ profile, children }: AppShellProps) {
  const role = profile?.roles?.[0] || 'employe'
  const lang = (profile?.lang || 'fr') as 'fr' | 'en'
  const font = profile?.font_family || 'var(--font-body)'
  const { restaurantName } = useAuth()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: font }}>

      {/* Mobile header — hidden on desktop */}
      <div className="md:hidden">
        <Header nom={profile?.nom || ''} restaurant={restaurantName} lang={lang} />
      </div>

      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar profile={{ ...profile, restaurant_name: restaurantName }} />
      </div>

      {/* Content — margin tracks sidebar width via CSS var */}
      <div className="main-offset">
        <div className="max-w-[480px] mx-auto md:max-w-none md:mx-0">
          {children}
        </div>
      </div>

      {/* Mobile nav — hidden on desktop */}
      <div className="md:hidden">
        <Navigation role={role} lang={lang} />
      </div>
    </div>
  )
}
