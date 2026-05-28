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
        // User already exists in auth — generate a fresh magic link
        console.log('[invite-user] user exists, generating magic link for:', email)
        const { data: linkData, error: linkError } =
          await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
            options: {
              redirectTo: SITE_URL,
            },
          })
        if (linkError) throw linkError
        authId = linkData.user.id
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