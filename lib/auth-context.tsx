'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

interface AuthCtx {
  profile: any | null
  userId: string | null
  restaurantId: string | null
  isGerant: boolean
  isAdmin: boolean
  isManager: boolean
  lang: 'fr' | 'en'
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  profile: null, userId: null, restaurantId: null,
  isGerant: false, isAdmin: false, isManager: false,
  lang: 'fr', loading: true,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<any>(null)
  const [userId, setUserId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string) => {
    const { data: p, error } = await supabase
      .from('profiles').select('*').eq('id', uid).single()
    if (error) console.error('AuthContext profile:', error.message)
    setProfile(p ?? null)
    setLoading(false)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId)
  }, [userId, loadProfile])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      setUserId(session.user.id)
      loadProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUserId(session.user.id)
        loadProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setProfile(null)
        setUserId(null)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [loadProfile])

  const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : []
  const isGerant  = roles.includes('gerant')
  const isAdmin   = roles.includes('admin')
  const isManager = isGerant || isAdmin

  return (
    <AuthContext.Provider value={{
      profile,
      userId,
      restaurantId: profile?.restaurant_ids?.[0] ?? null,
      isGerant,
      isAdmin,
      isManager,
      lang: (profile?.lang || 'fr') as 'fr' | 'en',
      loading,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
