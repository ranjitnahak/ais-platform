import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://ais-platform-omega.vercel.app/reset-password'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, fullName, orgId, roleEnum, userType, athleteId } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Step 1: Send invite email
    // Try inviteUserByEmail first — works for new users
    // Falls back to generateLink if user already exists in auth.users
    let authId: string

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: SITE_URL,
      })

    if (inviteError) {
      if (inviteError.code === 'email_exists' || inviteError.message?.includes('already been registered')) {
        // Existing auth user path:
        // 1) resolve authId from existing profile row (or fallback generateLink for lookup),
        // 2) send one recovery email call (avoid back-to-back otp calls that self-rate-limit).
        const { data: existingProfileRows, error: existingProfileErr } = await supabaseAdmin
          .from('users')
          .select('id')
          .ilike('email', email)
          .limit(1)
        if (existingProfileErr) throw existingProfileErr
        authId = existingProfileRows?.[0]?.id ?? ''

        if (!authId) {
          const { data: linkData, error: linkError } =
            await supabaseAdmin.auth.admin.generateLink({
              type: 'magiclink',
              email: email,
              options: { redirectTo: SITE_URL },
            })
          if (linkError) throw linkError
          authId = linkData.user.id
        }
        const { error: recoverError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: SITE_URL,
        })
        if (recoverError) {
          const recoverMsg = String(recoverError.message ?? '')
          if (recoverError.status === 429 || recoverMsg.includes('over_email_send_rate_limit') || recoverMsg.includes('only request this after')) {
            throw new Error('Invite email is rate-limited by Auth provider. Please wait longer before retrying (can be several minutes to an hour), or increase Auth email rate limits in Supabase settings.')
          }
          throw recoverError
        }
      } else {
        throw inviteError
      }
    } else {
      authId = inviteData.user.id
    }

    // Step 2: Create or update identity rows
    if (userType === 'athlete') {
      if (!athleteId) throw new Error('athleteId is required for athlete userType')

      // Check if users row already exists
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', authId)
        .maybeSingle()

      if (!existingUser) {
        // Create users row for identity
        const { error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authId,
            auth_id: authId,
            org_id: orgId,
            email,
            full_name: fullName,
            role: 'athlete',
            athlete_id: athleteId,
            is_active: false,
          })
        if (userError) throw userError

        // Assign Athlete role in user_roles
        const { data: athleteRole } = await supabaseAdmin
          .from('roles')
          .select('id')
          .eq('org_id', orgId)
          .eq('name', 'Athlete')
          .maybeSingle()

        if (athleteRole) {
          await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: authId,
              role_id: athleteRole.id,
              org_id: orgId,
            })
        }
      }

      // Always update athletes.auth_id
      const { error: athleteError } = await supabaseAdmin
        .from('athletes')
        .update({ auth_id: authId })
        .eq('id', athleteId)
        .eq('org_id', orgId)
      if (athleteError) throw athleteError

    } else {
      // Staff path
      // Check if users row already exists
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', authId)
        .maybeSingle()

      if (!existingUser) {
        const { error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authId,
            auth_id: authId,
            org_id: orgId,
            email,
            full_name: fullName,
            role: roleEnum,
            is_active: false,
          })
        if (userError) throw userError

        // Assign role in user_roles
        if (roleEnum) {
          // Map roleEnum to roles.name
          const roleNameMap: Record<string, string> = {
            sc_coach: 'S&C Coach',
            physio: 'Physio',
            head_coach: 'Head Coach',
            analyst: 'Analyst',
            nutritionist: 'Nutritionist',
            manager: 'Manager',
            admin: 'Admin',
          }
          const roleName = roleNameMap[roleEnum]
          if (roleName) {
            const { data: roleRow } = await supabaseAdmin
              .from('roles')
              .select('id')
              .eq('org_id', orgId)
              .eq('name', roleName)
              .maybeSingle()

            if (roleRow) {
              await supabaseAdmin
                .from('user_roles')
                .insert({
                  user_id: authId,
                  role_id: roleRow.id,
                  org_id: orgId,
                })
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ userId: authId, message: 'Invite sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[invite-user]', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})