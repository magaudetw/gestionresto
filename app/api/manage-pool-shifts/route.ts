import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function err(msg: string, status: number) {
  console.error(`[manage-pool-shifts] ${status}: ${msg}`)
  return NextResponse.json({ error: msg }, { status })
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return err('SUPABASE_SERVICE_ROLE_KEY not set', 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer '))
    return err('Missing Authorization header', 401)

  const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
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

  const { action, payload } = await req.json()
  const admin = createClient(URL, SRK, { auth: { autoRefreshToken: false, persistSession: false } })

  // ── Insert a new pool shift ────────────────────────────────────────────────
  if (action === 'insert') {
    const { restaurant_id, date, service, pool_total, notes } = payload
    if (!restaurant_id || !date || !service || pool_total == null)
      return err('Missing required fields', 400)
    const { data, error } = await admin.from('pool_shifts').insert({
      restaurant_id,
      date,
      service,
      pool_total: parseFloat(pool_total) || 0,
      notes: notes || null,
      statut: 'ouvert',
    }).select().single()
    if (error) {
      console.error('[manage-pool-shifts] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, data })
  }

  // ── Calculate tip distribution for a pool shift ────────────────────────────
  if (action === 'calculate') {
    const { pool_shift_id } = payload
    if (!pool_shift_id) return err('pool_shift_id required', 400)

    const { data: ps, error: psErr } = await admin
      .from('pool_shifts').select('*').eq('id', pool_shift_id).single()
    if (psErr || !ps) return err('Pool shift not found', 404)

    const { data: heures, error: hErr } = await admin
      .from('heures_employes').select('*').eq('pool_shift_id', pool_shift_id)
    if (hErr) return err(hErr.message, 500)
    if (!heures || heures.length === 0)
      return err('No hours found for this shift', 404)

    const userIds = [...new Set(heures.map((h: any) => h.user_id))]
    const { data: profiles } = await admin
      .from('profiles').select('id,roles').in('id', userIds)
    const profileMap: Record<string, string[]> = {}
    ;(profiles || []).forEach((p: any) => { profileMap[p.id] = p.roles || [] })

    const { data: roleTypes } = await admin.from('role_types').select('slug,coefficient_pourboire')
    const coeffMap: Record<string, number> = {}
    ;(roleTypes || []).forEach((rt: any) => { coeffMap[rt.slug] = rt.coefficient_pourboire ?? 1 })

    const rows = heures.map((h: any) => {
      const userRoles = profileMap[h.user_id] || []
      const coeff = coeffMap[userRoles[0]] ?? 1
      return { ...h, coeff, points: (h.heures || 0) * coeff }
    })
    const totalPoints = rows.reduce((s: number, r: any) => s + r.points, 0)
    if (totalPoints === 0) return err('Total points is 0, cannot distribute', 400)

    const poolTotal = ps.pool_total || 0
    const updates = rows.map((r: any) => ({
      id: r.id,
      montant_employe: Math.round((r.points / totalPoints) * poolTotal * 100) / 100,
    }))

    for (const u of updates) {
      const { error: uErr } = await admin
        .from('heures_employes').update({ montant_employe: u.montant_employe }).eq('id', u.id)
      if (uErr) {
        console.error('[manage-pool-shifts] update heures error:', uErr.message)
        return NextResponse.json({ error: uErr.message }, { status: 500 })
      }
    }

    const { error: statusErr } = await admin
      .from('pool_shifts').update({ statut: 'calcule' }).eq('id', pool_shift_id)
    if (statusErr) return err(statusErr.message, 500)

    return NextResponse.json({ ok: true, updates })
  }

  // ── Create a pool shift with employee hours ───────────────────────────────
  if (action === 'create') {
    const { restaurant_id, date, service, pool_carte, pool_especes, pool_total, notes, statut, heures } = payload
    if (!restaurant_id || !date || !service || pool_total == null)
      return err('Missing required fields', 400)
    const { data: poolShift, error: psErr } = await admin.from('pool_shifts').insert({
      restaurant_id, date, service,
      pool_carte:   parseFloat(String(pool_carte  ?? 0)) || 0,
      pool_especes: parseFloat(String(pool_especes ?? 0)) || 0,
      pool_total:   parseFloat(String(pool_total))        || 0,
      notes: notes || null,
      statut: statut ?? 'ouvert',
    }).select().single()
    if (psErr) {
      console.error('[manage-pool-shifts] create error:', psErr.message)
      return NextResponse.json({ error: psErr.message }, { status: 500 })
    }
    if (Array.isArray(heures) && heures.length > 0) {
      const rows = (heures as any[]).map(h => ({
        user_id: h.user_id,
        pool_shift_id: poolShift.id,
        date,
        heures: parseFloat(String(h.heures)) || 0,
        source: h.source || 'manuel',
      }))
      const { error: hErr } = await admin.from('heures_employes').insert(rows)
      if (hErr) {
        console.error('[manage-pool-shifts] create heures error:', hErr.message)
        // Ne pas bloquer — le service est créé, les heures peuvent être ajoutées après
      }
    }
    return NextResponse.json({ ok: true, poolShift })
  }

  // ── Delete a pool shift and its hours ────────────────────────────────────
  if (action === 'delete') {
    const { pool_shift_id } = payload
    if (!pool_shift_id) return err('pool_shift_id required', 400)
    await admin.from('heures_employes').delete().eq('pool_shift_id', pool_shift_id)
    const { error } = await admin.from('pool_shifts').delete().eq('id', pool_shift_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Update a pool shift and replace its hours ─────────────────────────────
  if (action === 'update') {
    const { pool_shift_id, pool_carte, pool_especes, pool_total, notes, heures } = payload
    if (!pool_shift_id) return err('pool_shift_id required', 400)
    const { error: updErr } = await admin.from('pool_shifts')
      .update({
        pool_carte:   pool_carte   ?? 0,
        pool_especes: pool_especes ?? 0,
        pool_total:   pool_total   ?? 0,
        notes: notes || null,
      })
      .eq('id', pool_shift_id)
    if (updErr) return err(updErr.message, 500)
    await admin.from('heures_employes').delete().eq('pool_shift_id', pool_shift_id)
    if (Array.isArray(heures) && heures.length > 0) {
      const { data: ps } = await admin.from('pool_shifts').select('date').eq('id', pool_shift_id).single()
      const rows = (heures as any[]).map(h => ({
        user_id: h.user_id,
        pool_shift_id,
        date: ps?.date,
        heures: parseFloat(String(h.heures)) || 0,
        source: 'manuel',
      }))
      const { error: hErr } = await admin.from('heures_employes').insert(rows)
      if (hErr) console.error('[manage-pool-shifts] update heures error:', hErr.message)
    }
    return NextResponse.json({ ok: true })
  }

  return err(`Unknown action: ${action}`, 400)
}
