import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function err(msg: string, status: number) {
  console.error(`[manage-shifts] ${status}: ${msg}`)
  return NextResponse.json({ error: msg }, { status })
}

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ error: 'Config error' }, { status: 500 })

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer '))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const ANON     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const SRK      = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const userClient = createClient(SUPA_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reqUrl        = new URL(req.url)
  const restaurant_id = reqUrl.searchParams.get('restaurant_id')
  const date_start    = reqUrl.searchParams.get('date_start')
  const date_end      = reqUrl.searchParams.get('date_end')

  if (!restaurant_id || !date_start || !date_end)
    return NextResponse.json({ error: 'Params manquants' }, { status: 400 })

  const admin = createClient(SUPA_URL, SRK, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin
    .from('horaire_shifts')
    .select('*, shift_types(*), profiles(nom, roles)')
    .eq('restaurant_id', restaurant_id)
    .gte('date', date_start)
    .lte('date', date_end)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ shifts: data })
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return err('SUPABASE_SERVICE_ROLE_KEY not set', 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer '))
    return err('Missing Authorization header', 401)

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const SRK  = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const userClient = createClient(URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return err('Unauthorized', 401)

  const { data: caller } = await userClient
    .from('profiles').select('roles').eq('id', user.id).single()
  const roles: string[] = Array.isArray(caller?.roles) ? caller.roles : []
  if (!roles.includes('gerant') && !roles.includes('admin'))
    return err('Forbidden: manager role required', 403)

  const { action, payload } = await req.json() as {
    action: string
    payload: Record<string, unknown>
  }
  console.log('[manage-shifts] action:', action, '| user:', user.id)

  const admin = createClient(URL, SRK, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── upsert a shift (create or update) ─────────────────────────────────────
  if (action === 'upsert') {
    const { shift_id, restaurant_id, user_id, shift_type_id, date, statut } = payload
    if (shift_id) {
      const { error } = await admin.from('horaire_shifts')
        .update({ shift_type_id, statut: statut ?? 'brouillon' })
        .eq('id', shift_id as string)
      if (error) {
        console.error('[manage-shifts] update error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    } else {
      const { error } = await admin.from('horaire_shifts').insert({
        restaurant_id, user_id, shift_type_id, date,
        statut: statut ?? 'brouillon',
      })
      if (error) {
        console.error('[manage-shifts] insert error:', error.message, '| hint:', error.hint)
        return NextResponse.json({ error: error.message, hint: error.hint }, { status: 400 })
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── delete a shift ─────────────────────────────────────────────────────────
  if (action === 'delete') {
    const { shift_id } = payload
    if (!shift_id) return err('shift_id required', 400)
    const { error } = await admin.from('horaire_shifts')
      .delete().eq('id', shift_id as string)
    if (error) {
      console.error('[manage-shifts] delete error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── publish all brouillon shifts for a week ────────────────────────────────
  if (action === 'publish') {
    const { restaurant_id, week_start, week_end } = payload
    const { error } = await admin.from('horaire_shifts')
      .update({ statut: 'publie' })
      .eq('restaurant_id', restaurant_id as string)
      .eq('statut', 'brouillon')
      .gte('date', week_start as string)
      .lte('date', week_end as string)
    if (error) {
      console.error('[manage-shifts] publish error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── upsert couverture_minimale rows (legacy: jour/service model) ──────────
  if (action === 'upsert_couverture') {
    const { rows } = payload
    if (!Array.isArray(rows)) return err('rows must be an array', 400)
    const { error } = await admin.from('couverture_minimale')
      .upsert(rows, { onConflict: 'restaurant_id,jour,service' })
    if (error) {
      console.error('[manage-shifts] upsert_couverture error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── upsert couverture_minimale rows (role/service model) ──────────────────
  if (action === 'upsert_couverture_roles') {
    const { rows } = payload
    if (!Array.isArray(rows)) return err('rows must be an array', 400)
    const { error } = await admin.from('couverture_minimale')
      .upsert(rows, { onConflict: 'restaurant_id,role,service' })
    if (error) {
      console.error('[manage-shifts] upsert_couverture_roles error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  return err(`Unknown action: ${action}`, 400)
}
