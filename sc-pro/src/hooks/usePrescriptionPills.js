import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import {
  buildRemovePatch,
  buildSavePatch,
  INTENSITY_ADD_MENU_KEYS,
  mergeAddPatch,
  pillKeyAfterAdd,
  prescriptionTableColumnCount,
} from '../lib/prescriptionPillLogic.js'

export function usePrescriptionPills({ exercise, orgId, canEdit, onReload, onIntensityLimitReached }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [postAddEditKey, setPostAddEditKey] = useState(null)

  const updateExercise = useCallback(
    async (patch) => {
      if (!exercise?.id || !canEdit || !Object.keys(patch).length) return
      try {
        const { error } = await supabase.from('session_exercises').update(patch).eq('id', exercise.id).eq('org_id', orgId)
        if (error) throw error
        await onReload?.()
      } catch (err) {
        console.error('[Pill]', err)
      }
    },
    [exercise?.id, orgId, canEdit, onReload],
  )

  const addDimension = useCallback(
    async (menuKey) => {
      if (!exercise) return
      const n = prescriptionTableColumnCount(exercise)
      if (n >= 3 && INTENSITY_ADD_MENU_KEYS.has(menuKey)) {
        onIntensityLimitReached?.()
        setMenuOpen(false)
        return
      }
      const patch = mergeAddPatch(exercise, menuKey)
      if (!patch || Object.keys(patch).length === 0) return
      await updateExercise(patch)
      setMenuOpen(false)
      setPostAddEditKey(pillKeyAfterAdd(menuKey, patch))
    },
    [exercise, updateExercise, onIntensityLimitReached],
  )

  const removeDimension = useCallback(
    async (pillKey) => {
      if (!exercise) return
      const patch = buildRemovePatch(exercise, pillKey)
      await updateExercise(patch)
    },
    [exercise, updateExercise],
  )

  const savePill = useCallback(
    async (pillKey, value) => {
      const patch = buildSavePatch(pillKey, value)
      await updateExercise(patch)
    },
    [updateExercise],
  )

  const clearPostAddEdit = useCallback(() => setPostAddEditKey(null), [])

  return {
    menuOpen,
    setMenuOpen,
    postAddEditKey,
    clearPostAddEdit,
    addDimension,
    removeDimension,
    savePill,
  }
}
