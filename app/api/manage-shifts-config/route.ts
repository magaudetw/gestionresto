import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function err(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status })
}

export async function POST(req: NextRequest) {
  if (!SERVICE_ROLE_KEY) return err('Server misconfiguration', 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return err('Missing Authorization header', 401)

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return err('Unauthorized', 401)

  const { data: profile } = await userClient.from('profiles').select('roles').eq('id', user.id).single()
  const roles: string[] = profile?.roles ?? []
  if (!roles.includes('gerant') && !roles.includes('admin')) return err('Forbidden', 403)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let body: any
  try { body = await req.json() } catch { return err('Invalid JSON', 400) }
  const { action, payload } = body

  if (action === 'upsert') {
    const { id, restaurant_id, nom, debut, fin, couleur } = payload
    if (!nom || !debut || !fin) return err('Champs manquants', 400)
    if (id) {
      const { data, error } = await admin.from('shift_types').update({ nom, debut, fin, couleur }).eq('id', id).select().single()
      if (error) { console.error('[shifts-config] update:', error.message); return err(error.message, 500) }
      console.log('[shifts-config] upsert result:', JSON.stringify(data))
      return NextResponse.json({ ok: true, data })
    } else {
      if (!restaurant_id) return err('restaurant_id manquant', 400)
      const { data, error } = await admin.from('shift_types').insert({ restaurant_id, nom, debut, fin, couleur }).select().single()
      if (error) { console.error('[shifts-config] insert:', error.message); return err(error.message, 500) }
      console.log('[shifts-config] upsert result:', JSON.stringify(data))
      return NextResponse.json({ ok: true, data })
    }
  }

  if (action === 'delete') {
    const { id } = payload
    if (!id) return err('id manquant', 400)
    const { error } = await admin.from('shift_types').delete().eq('id', id)
    if (error) { console.error('[shifts-config] delete:', error.message); return err(error.message, 500) }
    return NextResponse.json({ ok: true })
  }

  return err('Unknown action', 400)
}
