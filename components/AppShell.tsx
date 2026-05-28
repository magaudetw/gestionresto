'use client'
import Header from './Header'
import Navigation from './Navigation'
import Sidebar from './Sidebar'
import { getTheme } from '@/lib/themes'

interface AppShellProps {
  profile: any
  restaurant?: string
  children: React.ReactNode
}

export default function AppShell({ profile, restaurant, children }: AppShellProps) {
  const t = getTheme(profile?.theme)
  const role = profile?.roles?.[0] || 'employe'
  const lang = (profile?.lang || 'fr') as 'fr' | 'en'
  const font = profile?.font_family || 'var(--font-body)'
  const restaurantName = restaurant || ''

  return (
    <div style={{ minHeight: '100vh', background: t.fond, color: t.texte, fontFamily: font }}>

      {/* Mobile header — hidden on desktop */}
      <div className="md:hidden">
        <Header nom={profile?.nom || ''} restaurant={restaurantName} lang={lang} />
      </div>

      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar profile={{ ...profile, restaurant_name: restaurantName }} theme={t} />
      </div>

      {/* Content — single render, responsive container */}
      <div className="md:ml-[240px]">
        {/* On mobile: constrain to 480px. On desktop: full width. */}
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
