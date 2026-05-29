import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // ── 0. Env check ────────────────────────────────────────────────────────────
  console.log('[save-prefs] SERVICE KEY EXISTS:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log('[save-prefs] SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(not set)')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set' },
      { status: 500 },
    )
  }

  // ── 1. Verify caller JWT ─────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  console.log('[save-prefs] auth header starts with Bearer:', authHeader.startsWith('Bearer '))
  console.log('[save-prefs] token length:', authHeader.replace('Bearer ', '').length)

  if (!authHeader.startsWith('Bearer ') || authHeader === 'Bearer ') {
    return NextResponse.json({ error: 'Missing or empty token' }, { status: 401 })
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  )

  const { data: { user }, error: authError } = await anonClient.auth.getUser()
  console.log('[save-prefs] user id:', user?.id ?? null, '| auth error:', authError?.message ?? null)

  if (authError || !user) {
    return NextResponse.json({ error: authError?.message ?? 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────────
  let body: { theme?: string; lang?: string; font_family?: string; font_size?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { theme, lang, font_family, font_size } = body
  console.log('[save-prefs] payload:', { theme, lang, font_family, font_size })

  // ── 3. Service-role update (bypasses RLS) ────────────────────────────────────
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { error, count } = await admin
    .from('profiles')
    .update({ theme, lang, font_family, font_size })
    .eq('id', user.id)

  if (error) {
    console.error('[save-prefs] UPDATE error:', error.message, '| code:', error.code, '| hint:', error.hint)
    return NextResponse.json(
      { error: error.message, code: error.code, hint: error.hint },
      { status: 400 },
    )
  }

  console.log('[save-prefs] UPDATE ok, rows affected:', count)
  return NextResponse.json({ ok: true })
}
