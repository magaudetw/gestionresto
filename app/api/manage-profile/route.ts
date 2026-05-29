import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

function generateTempPassword(): string {
  // 16 hex chars + fixed suffix ensures uppercase, digit, special
  return randomBytes(8).toString('hex') + 'Aa1!'
}

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function err(msg: string, status: number) {
  console.error(`[manage-profile] ${status}: ${msg}`)
  return NextResponse.json({ error: msg }, { status })
}

export async function POST(req: NextRequest) {
  // ── 0. Diagnose environment ────────────────────────────────────────────────
  console.log('SERVICE KEY EXISTS:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log('SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(not set)')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[manage-profile] SUPABASE_SERVICE_ROLE_KEY is not set in environment')
    return NextResponse.json(
      { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set' },
      { status: 500 }
    )
  }

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
    console.log('ACTION:', action)
    console.log('PAYLOAD:', JSON.stringify(payload))

    // ── 4. Service-role client bypasses RLS entirely ─────────────────────────
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (action === 'create') {
      // Pull auth-specific fields out of the payload
      const { email, password: rawPassword, ...profileFields } = payload

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return err('email valide requis pour créer un compte', 400)
      }

      const password = (typeof rawPassword === 'string' && rawPassword.trim())
        ? rawPassword.trim()
        : generateTempPassword()

      // 1. Create the Auth user — this generates the UUID
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
      })

      if (authErr || !authData?.user) {
        console.error('[manage-profile] createUser error:', authErr?.message)
        return NextResponse.json(
          { error: authErr?.message ?? 'Impossible de créer le compte Auth' },
          { status: 400 }
        )
      }

      const userId = authData.user.id
      console.log('[manage-profile] Auth user created:', userId)

      // 2. Insert the profile row using the Auth UUID as id
      const { error: insertErr } = await admin.from('profiles').insert({
        id: userId,
        ...profileFields,
      })

      if (insertErr) {
        console.error('[manage-profile] INSERT error:', insertErr.message, '| code:', insertErr.code, '| hint:', insertErr.hint)
        // Rollback: remove the orphaned auth user
        await admin.auth.admin.deleteUser(userId)
        console.log('[manage-profile] Auth user deleted (rollback)')
        return NextResponse.json(
          { error: insertErr.message, code: insertErr.code, hint: insertErr.hint },
          { status: 400 }
        )
      }

      console.log('[manage-profile] Profile INSERT ok, id:', userId)
      return NextResponse.json({ ok: true, userId })
    }

    if (action === 'update') {
      const { id, ...data } = payload
      if (!id) return err('payload.id required for update', 400)
      const { error } = await admin.from('profiles').update(data).eq('id', id as string)
      if (error) {
        console.error('[manage-profile] UPDATE error:', error.message, '| code:', error.code, '| hint:', error.hint)
        return NextResponse.json(
          { error: error.message, code: error.code, hint: error.hint },
          { status: 400 }
        )
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
