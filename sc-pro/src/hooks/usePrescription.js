import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAutosave } from './useAutosave.js'

const PRESET_TYPES = ['absolute', 'pct_1rm', 'rpe', 'rir', 'velocity', 'max', 'time']

function parseOptionalInt(fieldLabel, raw) {
  if (raw === '' || raw == null) return null
  const t = String(raw).trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n)) {
    throw new Error(`${fieldLabel} must be a valid number (or leave blank).`)
  }
  return Math.round(n)
}

function parseOptionalNumber(fieldLabel, raw) {
  if (raw === '' || raw == null) return null
  const t = String(raw).trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n)) {
    throw new Error(`${fieldLabel} must be a valid number (or leave blank).`)
  }
  return n
}

export function pick1rmSource(row) {
  if (!row) return null
  const t = row.tested_1rm != null ? Number(row.tested_1rm) : null
  if (t) return t
  const e = row.estimated_1rm != null ? Number(row.estimated_1rm) : null
  if (e) return e
  const w = row.working_max != null ? Number(row.working_max) : null
  if (w) return w
  return null
}

export function roundToHalfKg(kg) {
  if (kg == null || Number.isNaN(kg)) return null
  return Math.round(kg / 2.5) * 2.5
}

export function buildAthleteLoads({
  athleteNames,
  exerciseId,
  prescriptionType,
  prescriptionValue,
  secondaryPrescriptionType,
  secondaryPrescriptionValue,
  tertiaryPrescriptionType,
  tertiaryPrescriptionValue,
  oneRmByAthleteExercise,
}) {
  let pct = null
  if (prescriptionType === 'pct_1rm' && prescriptionValue != null && prescriptionValue !== '') {
    pct = Number(prescriptionValue)
  } else if (secondaryPrescriptionType === 'pct_1rm' && secondaryPrescriptionValue != null && secondaryPrescriptionValue !== '') {
    pct = Number(secondaryPrescriptionValue)
  } else if (tertiaryPrescriptionType === 'pct_1rm' && tertiaryPrescriptionValue != null && tertiaryPrescriptionValue !== '') {
    pct = Number(tertiaryPrescriptionValue)
  }
  if (pct == null || Number.isNaN(pct) || !pct) {
    return athleteNames.map((a) => ({ id: a.id, name: a.name, load: null, note: '—' }))
  }
  return athleteNames.map((a) => {
    const row = oneRmByAthleteExercise[`${a.id}:${exerciseId}`]
    const src = pick1rmSource(row)
    if (!src) return { id: a.id, name: a.name, load: null, note: 'No 1RM' }
    const raw = (pct / 100) * src
    const load = roundToHalfKg(raw)
    return { id: a.id, name: a.name, load, note: 'Based on tested 1RM' }
  })
}

export function usePrescriptionEditor(exerciseRow, orgId, onAfterSave) {
  const onAfterSaveRef = useRef(onAfterSave)
  onAfterSaveRef.current = onAfterSave

  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [prescriptionType, setType] = useState('absolute')
  const [prescriptionValue, setValue] = useState('')
  const [secondaryOn, setSecondaryOn] = useState(false)
  const [secondaryVal, setSecondaryVal] = useState('')
  const [tempo, setTempo] = useState('')
  const [rest, setRest] = useState('')
  const [coachNote, setCoachNote] = useState('')

  useEffect(() => {
    if (!exerciseRow) return
    setSets(exerciseRow.sets != null ? String(exerciseRow.sets) : '')
    setReps(exerciseRow.reps != null ? String(exerciseRow.reps) : '')
    setType(PRESET_TYPES.includes(exerciseRow.prescription_type) ? exerciseRow.prescription_type : 'absolute')
    setValue(exerciseRow.prescription_value != null ? String(exerciseRow.prescription_value) : '')
    const secOn = exerciseRow.secondary_prescription_type === 'rpe'
    setSecondaryOn(secOn)
    setSecondaryVal(secOn && exerciseRow.secondary_prescription_value != null ? String(exerciseRow.secondary_prescription_value) : '')
    setTempo(exerciseRow.tempo || '')
    setRest(exerciseRow.rest_seconds != null ? String(exerciseRow.rest_seconds) : '')
    setCoachNote(exerciseRow.coach_note || '')
  }, [exerciseRow?.id])

  const persist = useCallback(async () => {
    if (!exerciseRow?.id) return
    const valueTrimmed = String(prescriptionValue ?? '').trim()
    const payload = {
      sets: parseOptionalInt('Sets', sets),
      reps: parseOptionalInt('Reps', reps),
      prescription_type: prescriptionType,
      prescription_value:
        prescriptionType === 'max' ? null : valueTrimmed === '' ? null : parseOptionalNumber('Value', prescriptionValue),
      secondary_prescription_type: secondaryOn ? 'rpe' : null,
      secondary_prescription_value:
        secondaryOn && String(secondaryVal).trim() !== '' ? parseOptionalNumber('RPE target', secondaryVal) : null,
      tempo: tempo || null,
      rest_seconds: parseOptionalInt('Rest (sec)', rest),
      coach_note: coachNote || null,
    }
    const { data, error } = await supabase
      .from('session_exercises')
      .update(payload)
      .eq('id', exerciseRow.id)
      .eq('org_id', orgId)
      .select('id')
    if (error) throw error
    if (!data?.length) {
      throw new Error('Could not save: no row was updated. Check organisation access or try reloading the page.')
    }
    const after = onAfterSaveRef.current?.()
    if (after != null && typeof after.then === 'function') await after
  }, [
    exerciseRow?.id,
    orgId,
    sets,
    reps,
    prescriptionType,
    prescriptionValue,
    secondaryOn,
    secondaryVal,
    tempo,
    rest,
    coachNote,
  ])

  const { status, failed, lastError, saveNow } = useAutosave(
    persist,
    [sets, reps, prescriptionType, prescriptionValue, secondaryOn, secondaryVal, tempo, rest, coachNote],
    !!exerciseRow,
  )

  return {
    sets,
    setSets,
    reps,
    setReps,
    prescriptionType,
    setType,
    prescriptionValue,
    setValue,
    secondaryOn,
    setSecondaryOn,
    secondaryVal,
    setSecondaryVal,
    tempo,
    setTempo,
    rest,
    setRest,
    coachNote,
    setCoachNote,
    autosaveStatus: status,
    autosaveFailed: failed,
    autosaveLastError: lastError,
    savePrescriptionNow: saveNow,
  }
}
