'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { applyThemeToDocument } from './themes'

interface RestaurantInfo { id: string; nom: string }

interface AuthCtx {
  profile: any | null
  userId: string | null
  restaurantId: string | null
  restaurantName: string
  userRestaurants: RestaurantInfo[]
  setActiveRestaurant: (id: string) => void
  isGerant: boolean
  isAdmin: boolean
  isManager: boolean
  lang: 'fr' | 'en'
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  profile: null, userId: null, restaurantId: null,
  restaurantName: '', userRestaurants: [],
  setActiveRestaurant: () => {},
  isGerant: false, isAdmin: false, isManager: false,
  lang: 'fr', loading: true,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile]                     = useState<any>(null)
  const [userId, setUserId]                       = useState<string | null>(null)
  const [loading, setLoading]                     = useState(true)
  const [activeRestaurantId, setActiveId]         = useState<string | null>(null)
  const [userRestaurants, setUserRestaurants]     = useState<RestaurantInfo[]>([])

  const setActiveRestaurant = useCallback((id: string) => {
    setActiveId(id)
    if (typeof localStorage !== 'undefined')
      localStorage.setItem('active_restaurant_id', id)
  }, [])

  const loadProfile = useCallback(async (uid: string) => {
    const { data: p, error } = await supabase
      .from('profiles').select('*').eq('id', uid).single()
    if (error) console.error('AuthContext profile:', error.message)
    setProfile(p ?? null)
    setLoading(false)

    if (p) {
      applyThemeToDocument(p.theme, p.font_family, p.font_size)

      // Fetch restaurant names (table may not exist yet — handle gracefully)
      const ids: string[] = Array.isArray(p.restaurant_ids) ? p.restaurant_ids : []
      if (ids.length > 0) {
        const { data: rests } = await supabase
          .from('restaurants').select('id,nom').in('id', ids)
        setUserRestaurants(rests || [])
      } else {
        setUserRestaurants([])
      }

      // Active restaurant: validate stored value or fall back to first
      const stored = typeof localStorage !== 'undefined'
        ? localStorage.getItem('active_restaurant_id') : null
      const validId = stored && ids.includes(stored) ? stored : (ids[0] ?? null)
      setActiveId(validId)
      if (validId && typeof localStorage !== 'undefined')
        localStorage.setItem('active_restaurant_id', validId)
    }
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
        setActiveId(null)
        setUserRestaurants([])
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [loadProfile])

  const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : []
  const isGerant  = roles.includes('gerant')
  const isAdmin   = roles.includes('admin')
  const isManager = isGerant || isAdmin

  const restaurantName =
    userRestaurants.find(r => r.id === activeRestaurantId)?.nom || ''

  return (
    <AuthContext.Provider value={{
      profile,
      userId,
      restaurantId: activeRestaurantId,
      restaurantName,
      userRestaurants,
      setActiveRestaurant,
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
