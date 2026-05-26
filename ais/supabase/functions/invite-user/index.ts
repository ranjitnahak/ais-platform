import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, fullName, orgId, roleEnum } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })

    if (authError) throw authError

    const authId = authUser.user.id

    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authId,
        auth_id: authId,
        org_id: orgId,
        email,
        full_name: fullName,
        role: roleEnum,
        // is_active false until they set password
        is_active: false,
      })

    if (userError) throw userError

    return new Response(
      JSON.stringify({ userId: authId }),
      { headers: { ...corsHeaders,
        'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[invite-user]', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders,
        'Content-Type': 'application/json' } }
    )
  }
})
