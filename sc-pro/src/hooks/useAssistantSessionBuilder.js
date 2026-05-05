import { useEffect } from 'react'
import { registerPageContext, unregisterPageContext } from '../lib/assistantContext.js'
import { registerAction, unregisterAction } from '../lib/assistantActions.js'
import { supabase } from '../lib/supabaseClient.js'
import { getCurrentUser } from '../lib/auth.js'

const ACTIONS = ['add_exercise_to_block', 'add_block', 'change_prescription']

function exerciseLabel(ex) {
  const lib = ex.exercise_library
  const row = Array.isArray(lib) ? lib[0] : lib
  return row?.name ?? ex.exercise_name ?? ex.name ?? 'Exercise'
}

export function useAssistantSessionBuilder({ session, blocks }) {
  useEffect(() => {
    const user = getCurrentUser()
    if (!session?.id) {
      unregisterPageContext('session_builder')
      return
    }

    registerPageContext('session_builder', () => ({
      orgId: user.orgId,
      session: {
        id: session.id,
        name: session.name,
        date: session.session_date,
        category: session.category,
      },
      blocks: (blocks ?? []).map((b) => ({
        id: b.id,
        label: b.label,
        format: b.format,
        exercises: (b.session_exercises ?? []).map((e) => ({
          id: e.id,
          name: exerciseLabel(e),
          sets: e.sets,
          reps: e.reps,
          prescription_type: e.prescription_type,
          prescription_value: e.prescription_value,
        })),
      })),
      availableActions: ACTIONS,
    }))

    registerAction('add_block', async () => {
      const nextLabel = String.fromCharCode(65 + (blocks?.length ?? 0))
      const sort = blocks?.length ? Math.max(...blocks.map((b) => b.sort_order ?? 0)) + 1 : 0
      const { error } = await supabase.from('session_blocks').insert({
        session_id: session.id,
        org_id: user.orgId,
        label: nextLabel,
        block_type: 'main',
        format: 'straight',
        sort_order: sort,
      })
      if (error) throw error
    })

    registerAction('add_exercise_to_block', async (payload) => {
      const blockId = payload.block_id
      const exerciseId = payload.exercise_id
      if (!blockId || !exerciseId) throw new Error('block_id and exercise_id are required')
      const block = blocks.find((b) => b.id === blockId)
      const nextSort = block?.session_exercises?.length
        ? Math.max(...block.session_exercises.map((e) => e.sort_order ?? 0)) + 1
        : 0
      const { error } = await supabase.from('session_exercises').insert({
        block_id: blockId,
        org_id: user.orgId,
        exercise_id: exerciseId,
        sort_order: nextSort,
        sets: payload.sets ?? 3,
        reps: payload.reps ?? null,
        prescription_type: payload.prescription_type ?? 'absolute',
        prescription_value: payload.prescription_value ?? null,
      })
      if (error) throw error
    })

    registerAction('change_prescription', async (payload) => {
      const exerciseRowId = payload.session_exercise_id
      if (!exerciseRowId) throw new Error('session_exercise_id is required')
      const patch = {
        prescription_type: payload.prescription_type,
        prescription_value: payload.prescription_value,
        sets: payload.sets,
        reps: payload.reps,
      }
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      const { error } = await supabase.from('session_exercises').update(clean).eq('id', exerciseRowId).eq('org_id', user.orgId)
      if (error) throw error
    })

    return () => {
      unregisterPageContext('session_builder')
      for (const a of ACTIONS) unregisterAction(a)
    }
  }, [session, blocks])
}
