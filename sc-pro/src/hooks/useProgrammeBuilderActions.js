import { useEffect } from 'react'
import { registerAction, unregisterAction } from '../lib/assistantActions.js'
import { supabase } from '../lib/supabaseClient.js'
import { getCurrentUser } from '../lib/auth.js'
import { setProgrammeAgentHost } from '../lib/agentProgrammeHost.js'

const ACTION_KEYS = [
  'create_session_for_build',
  'create_block_for_build',
  'create_exercise_for_build',
  'build_programme_from_plan',
]

/**
 * Registers Supabase write actions for the agentic programme builder + exposes host context.
 */
export function useProgrammeBuilderActions({ programme, weeks, weekId, refreshWeek, load }) {
  useEffect(() => {
    const user = getCurrentUser()
    if (!programme?.id || !weekId) {
      setProgrammeAgentHost(null)
      return undefined
    }

    setProgrammeAgentHost({
      programmeId: programme.id,
      programme,
      weeks: weeks ?? [],
      weekId,
      refreshWeek,
      load,
      teamId: user.teamIds?.[0] ?? null,
    })

    registerAction('create_session_for_build', async (payload) => {
      const insertRow = {
        org_id: user.orgId,
        team_id: payload.team_id,
        programme_week_id: payload.programme_week_id,
        name: payload.name,
        session_date: payload.session_date,
        category: payload.category,
        duration_planned: payload.planned_duration_min ?? payload.duration_planned ?? 60,
        coach_instructions: payload.coach_instructions ?? null,
        start_time: payload.start_time ?? '09:00:00',
        session_type: payload.category === 'strength' ? 'strength' : 'conditioning',
        is_published: false,
        publish_at: null,
        created_by: null,
      }
      const { data: sess, error } = await supabase.from('sessions').insert(insertRow).select().single()
      if (error) throw error

      const { data: psRows, error: psErr } = await supabase
        .from('programme_sessions')
        .select('sort_order')
        .eq('programme_week_id', payload.programme_week_id)
        .eq('org_id', user.orgId)
        .order('sort_order', { ascending: false })
        .limit(1)
      if (psErr) throw psErr
      const maxSort = psRows?.[0]?.sort_order ?? 0
      const { error: e2 } = await supabase.from('programme_sessions').insert({
        org_id: user.orgId,
        programme_week_id: payload.programme_week_id,
        session_id: sess.id,
        sort_order: maxSort + 1,
      })
      if (e2) throw e2
      return sess
    })

    registerAction('create_block_for_build', async (payload) => {
      const { data, error } = await supabase
        .from('session_blocks')
        .insert({
          session_id: payload.session_id,
          org_id: user.orgId,
          label: payload.label,
          block_type: 'main',
          format: payload.format ?? 'straight',
          notes: payload.format_note ?? null,
          sort_order: payload.sort_order ?? 0,
        })
        .select()
        .single()
      if (error) throw error
      return data
    })

    registerAction('create_exercise_for_build', async (payload) => {
      let exerciseId = payload.exercise_id

      if (!exerciseId && payload.exercise_name) {
        const { data: newEx, error: exError } = await supabase
          .from('exercise_library')
          .insert({
            org_id: user.orgId,
            name: String(payload.exercise_name).trim(),
            is_system_default: false,
            movement_pattern: 'custom',
          })
          .select()
          .single()
        if (exError) throw exError
        exerciseId = newEx.id
      }

      const prescriptionValue =
        payload.prescription_range_low != null && payload.prescription_range_high != null
          ? (Number(payload.prescription_range_low) + Number(payload.prescription_range_high)) / 2
          : payload.prescription_value != null
            ? Number(payload.prescription_value)
            : null

      const { data, error } = await supabase
        .from('session_exercises')
        .insert({
          block_id: payload.block_id,
          org_id: user.orgId,
          exercise_id: exerciseId,
          sort_order: payload.sort_order ?? 0,
          sets: payload.sets ?? 3,
          reps: payload.reps ?? null,
          prescription_type: payload.prescription_type ?? 'max',
          prescription_value: prescriptionValue,
          secondary_prescription_type: payload.secondary_prescription_type ?? null,
          secondary_prescription_value: payload.secondary_prescription_value ?? null,
          rest_seconds: payload.rest_seconds ?? null,
          tempo: payload.tempo ?? null,
          coach_note: payload.coach_note ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    })

    registerAction('build_programme_from_plan', async () => {
      window.dispatchEvent(new CustomEvent('sc-pro-agent-open-build'))
      return { ok: true }
    })

    return () => {
      setProgrammeAgentHost(null)
      for (const k of ACTION_KEYS) unregisterAction(k)
    }
  }, [programme, weeks, weekId, refreshWeek, load])
}
