import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://app.athleteintelligencesystem.in/reset-password'

/** Lookup auth.users id by email via GoTrue admin API (no email sent). */
async function lookupAuthUserIdByEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
): Promise<string> {
  const url = new URL(`${supabaseUrl}/auth/v1/admin/users`)
  url.searchParams.set('filter', email)

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.msg || body?.message || body?.error_description || `Auth user lookup failed (${res.status})`
    throw new Error(msg)
  }

  const users = Array.isArray(body?.users) ? body.users : []
  const normalized = email.toLowerCase()
  const user = users.find((u: { email?: string }) => u.email?.toLowerCase() === normalized) ?? users[0]
  if (!user?.id) throw new Error('Auth user not found for email')
  return user.id
}

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Step 1: Send invite email
    // Try inviteUserByEmail first — works for new users
    // Falls back to admin user lookup + recovery email if user already exists in auth.users
    let authId: string

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: SITE_URL,
      })

    if (inviteError) {
      if (inviteError.code === 'email_exists' || inviteError.message?.includes('already been registered')) {
        // Existing auth user path:
        // 1) resolve authId from existing profile row (or admin lookup — no email),
        // 2) send one recovery email call (never pair with generateLink — it self-rate-limits).
        const { data: existingProfileRows, error: existingProfileErr } = await supabaseAdmin
          .from('users')
          .select('id, org_id, organisations(name)')
          .ilike('email', email)
          .limit(5)
        if (existingProfileErr) throw existingProfileErr
        const existingInOtherOrg = (existingProfileRows ?? []).find(
          (row: { org_id?: string }) => row.org_id && row.org_id !== orgId,
        )
        if (existingInOtherOrg) {
          const orgName =
            (existingInOtherOrg as { organisations?: { name?: string } | { name?: string }[] })
              .organisations
          const resolvedOrg = Array.isArray(orgName) ? orgName[0]?.name : orgName?.name
          throw new Error(
            `This email already has a login in ${resolvedOrg ?? 'another organisation'}. Use a different email for a separate account, or add organisation access to the existing user.`,
          )
        }
        const existingInTargetOrg = (existingProfileRows ?? []).find(
          (row: { org_id?: string }) => row.org_id === orgId,
        )
        authId = existingInTargetOrg?.id ?? existingProfileRows?.[0]?.id ?? ''

        if (!authId) {
          authId = await lookupAuthUserIdByEmail(supabaseUrl, serviceRoleKey, email)
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
            role: 'athlete',
            athlete_id: athleteId,
            is_active: false,
          })
        if (userError) throw userError

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

      const { error: athleteError } = await supabaseAdmin
        .from('athletes')
        .update({ auth_id: authId })
        .eq('id', athleteId)
        .eq('org_id', orgId)
      if (athleteError) throw athleteError

    } else {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id, org_id')
        .eq('id', authId)
        .maybeSingle()

      if (existingUser?.org_id && existingUser.org_id !== orgId) {
        throw new Error(
          'This email already has a login in another organisation. Use a different email for a separate account.',
        )
      }

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

        if (roleEnum) {
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
