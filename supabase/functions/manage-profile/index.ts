import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const requestId = crypto.randomUUID().slice(0, 8)
  console.log(`[${requestId}] manage-profile called — method: ${req.method}`)

  try {
    // ── 1. Auth header ────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error(`[${requestId}] No Authorization header`)
      return json({ error: 'Missing Authorization header' }, 401)
    }
    console.log(`[${requestId}] auth header present`)

    // ── 2. Verify caller identity ─────────────────────────────────────────────
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    )

    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) {
      console.error(`[${requestId}] getUser failed:`, authErr?.message)
      return json({ error: 'Unauthorized' }, 401)
    }
    console.log(`[${requestId}] user verified: ${user.id}`)

    // ── 3. Check manager role ──────────────────────────────────────────────────
    const { data: caller, error: profileErr } = await userClient
      .from('profiles').select('roles').eq('id', user.id).single()

    if (profileErr || !caller) {
      console.error(`[${requestId}] profile fetch failed:`, profileErr?.message, profileErr?.code)
      return json({ error: `Impossible de vérifier le rôle: ${profileErr?.message ?? 'profil introuvable'}` }, 401)
    }

    const roles: string[] = Array.isArray(caller.roles) ? caller.roles : []
    console.log(`[${requestId}] caller roles:`, JSON.stringify(roles))

    if (!roles.includes('gerant') && !roles.includes('admin')) {
      console.warn(`[${requestId}] Forbidden — roles: ${JSON.stringify(roles)}`)
      return json({ error: 'Accès refusé : rôle gérant requis' }, 403)
    }

    // ── 4. Service-role admin client (bypasses RLS) ───────────────────────────
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) {
      console.error(`[${requestId}] SUPABASE_SERVICE_ROLE_KEY is not set!`)
      return json({ error: 'Server misconfiguration: missing service key' }, 500)
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── 5. Parse body ──────────────────────────────────────────────────────────
    const { action, payload } = await req.json() as {
      action: string
      payload: Record<string, unknown>
    }
    console.log(`[${requestId}] action: ${action} | payload keys: ${Object.keys(payload ?? {}).join(', ')}`)

    // ── 6. Execute ─────────────────────────────────────────────────────────────
    if (action === 'create') {
      const { error } = await admin.from('profiles').insert(payload)
      if (error) {
        console.error(`[${requestId}] INSERT error — msg: ${error.message} | code: ${error.code} | hint: ${error.hint}`)
        return json({ error: error.message }, 400)
      }
      console.log(`[${requestId}] INSERT ok`)
      return json({ ok: true })
    }

    if (action === 'update') {
      const { id, ...data } = payload
      if (!id) return json({ error: 'payload.id requis pour update' }, 400)
      const { error } = await admin.from('profiles').update(data).eq('id', id as string)
      if (error) {
        console.error(`[${requestId}] UPDATE error — msg: ${error.message} | code: ${error.code} | hint: ${error.hint}`)
        return json({ error: error.message }, 400)
      }
      console.log(`[${requestId}] UPDATE ok, id: ${id}`)
      return json({ ok: true })
    }

    console.error(`[${requestId}] Unknown action: ${action}`)
    return json({ error: `Action inconnue : ${action}` }, 400)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[${requestId}] Unhandled exception:`, msg)
    return json({ error: msg }, 500)
  }
})
