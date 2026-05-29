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

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    // Verify caller identity and role using their JWT (respects RLS)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: caller, error: profileErr } = await userClient
      .from('profiles').select('roles').eq('id', user.id).single()
    if (profileErr || !caller) {
      console.error('[manage-profile] role check failed:', profileErr?.message)
      return json({ error: `Impossible de vérifier le rôle: ${profileErr?.message ?? 'profil introuvable'}` }, 401)
    }

    const roles: string[] = Array.isArray(caller.roles) ? caller.roles : []
    if (!roles.includes('gerant') && !roles.includes('admin')) {
      return json({ error: 'Accès refusé : rôle gérant requis' }, 403)
    }

    // Service-role client bypasses RLS entirely
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    const { action, payload } = await req.json() as {
      action: string
      payload: Record<string, unknown>
    }

    if (action === 'create') {
      const { error } = await admin.from('profiles').insert(payload)
      if (error) {
        console.error('[manage-profile] insert error:', error.message, error.code)
        return json({ error: error.message }, 400)
      }
      return json({ ok: true })
    }

    if (action === 'update') {
      const { id, ...data } = payload
      if (!id) return json({ error: 'payload.id requis pour update' }, 400)
      const { error } = await admin.from('profiles').update(data).eq('id', id as string)
      if (error) {
        console.error('[manage-profile] update error:', error.message, error.code)
        return json({ error: error.message }, 400)
      }
      return json({ ok: true })
    }

    return json({ error: `Action inconnue : ${action}` }, 400)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
