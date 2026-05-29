import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function err(msg: string, status: number) {
  console.error(`[manage-profile] ${status}: ${msg}`)
  return NextResponse.json({ error: msg }, { status })
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Verify caller via their JWT ───────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return err('Missing Authorization header', 401)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth:   { persistSession: false },
    })

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      console.error('[manage-profile] getUser failed:', authError?.message)
      return err('Unauthorized', 401)
    }

    // ── 2. Check manager role ────────────────────────────────────────────────
    const { data: caller, error: profileErr } = await userClient
      .from('profiles').select('roles').eq('id', user.id).single()

    if (profileErr || !caller) {
      console.error('[manage-profile] profile fetch failed:', profileErr?.message)
      return err(`Cannot verify role: ${profileErr?.message ?? 'profile not found'}`, 401)
    }

    const roles: string[] = Array.isArray(caller.roles) ? caller.roles : []
    console.log('[manage-profile] caller roles:', roles)

    if (!roles.includes('gerant') && !roles.includes('admin')) {
      return err('Forbidden: manager role required', 403)
    }

    // ── 3. Parse request body ────────────────────────────────────────────────
    const body = await req.json() as { action: string; payload: Record<string, unknown> }
    const { action, payload } = body
    console.log('[manage-profile] action:', action, '| payload keys:', Object.keys(payload ?? {}))

    // ── 4. Service-role client bypasses RLS entirely ─────────────────────────
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (action === 'create') {
      const { error } = await admin.from('profiles').insert(payload)
      if (error) {
        console.error('[manage-profile] INSERT error:', error.message, 'code:', error.code)
        return err(error.message, 400)
      }
      console.log('[manage-profile] INSERT ok')
      return NextResponse.json({ ok: true })
    }

    if (action === 'update') {
      const { id, ...data } = payload
      if (!id) return err('payload.id required for update', 400)
      const { error } = await admin.from('profiles').update(data).eq('id', id as string)
      if (error) {
        console.error('[manage-profile] UPDATE error:', error.message, 'code:', error.code)
        return err(error.message, 400)
      }
      console.log('[manage-profile] UPDATE ok, id:', id)
      return NextResponse.json({ ok: true })
    }

    return err(`Unknown action: ${action}`, 400)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[manage-profile] unhandled exception:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
