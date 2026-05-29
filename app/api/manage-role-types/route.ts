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
  if (!roles.includes('admin')) return err('Forbidden — admin only', 403)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const body = await req.json()
  const { action, payload } = body

  if (action === 'upsert') {
    const { id, restaurant_id, nom, slug, coefficient_pourboire, couleur, icone } = payload
    if (id) {
      const { error } = await admin.from('role_types')
        .update({ nom, slug, coefficient_pourboire, couleur, icone })
        .eq('id', id)
      if (error) return err(error.message, 500)
    } else {
      const { error } = await admin.from('role_types')
        .insert({ restaurant_id: restaurant_id || null, nom, slug, coefficient_pourboire, couleur, icone })
      if (error) return err(error.message, 500)
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'archive') {
    const { id, slug } = payload
    if (slug === 'admin' || slug === 'gerant') return err('Cannot archive admin or gerant role', 400)
    const { error } = await admin.from('role_types').update({ actif: false }).eq('id', id)
    if (error) return err(error.message, 500)
    return NextResponse.json({ ok: true })
  }

  if (action === 'restore') {
    const { id } = payload
    const { error } = await admin.from('role_types').update({ actif: true }).eq('id', id)
    if (error) return err(error.message, 500)
    return NextResponse.json({ ok: true })
  }

  return err('Unknown action', 400)
}
