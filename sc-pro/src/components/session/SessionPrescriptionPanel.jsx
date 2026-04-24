import { useMemo } from 'react'
import { can } from '../../lib/auth.js'
import { buildAthleteLoads, usePrescriptionEditor } from '../../hooks/usePrescription.js'

const btnPrimary = {
  width: '100%',
  padding: '10px 16px',
  borderRadius: 'var(--radius-default)',
  border: 'none',
  background: 'var(--color-primary)',
  color: 'var(--color-text)',
  fontWeight: 'var(--font-weight-semibold)',
  cursor: 'pointer',
  marginTop: 12,
}

const inp = {
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 'var(--radius-default)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-low)',
  color: 'var(--color-text)',
}

const LABEL_OPTS = [
  { value: 'absolute', label: 'Absolute' },
  { value: 'pct_1rm', label: '% 1RM' },
  { value: 'rpe', label: 'RPE' },
  { value: 'rir', label: 'RIR' },
  { value: 'velocity', label: 'Velocity' },
  { value: 'max', label: 'Max' },
  { value: 'time', label: 'Time' },
]

function valueSuffix(type) {
  if (type === 'absolute') return 'kg'
  if (type === 'pct_1rm') return '%'
  if (type === 'rpe') return '/10'
  if (type === 'rir') return 'reps left'
  if (type === 'velocity') return 'm/s'
  if (type === 'time') return 'sec'
  return ''
}

export default function SessionPrescriptionPanel({
  exerciseRow,
  orgId,
  exerciseName,
  athleteNames,
  oneRmByAthleteExercise,
  onReload,
  sessionTeamId,
  athleteLoadsMessage,
}) {
  const editor = usePrescriptionEditor(exerciseRow, orgId, onReload)
  const loads = useMemo(
    () =>
      buildAthleteLoads({
        athleteNames,
        exerciseId: exerciseRow?.exercise_id,
        prescriptionType: editor.prescriptionType,
        prescriptionValue: editor.prescriptionValue === '' ? null : Number(editor.prescriptionValue),
        secondaryPrescriptionType: exerciseRow?.secondary_prescription_type,
        secondaryPrescriptionValue:
          exerciseRow?.secondary_prescription_value == null ? null : Number(exerciseRow.secondary_prescription_value),
        tertiaryPrescriptionType: exerciseRow?.tertiary_prescription_type,
        tertiaryPrescriptionValue:
          exerciseRow?.tertiary_prescription_value == null ? null : Number(exerciseRow.tertiary_prescription_value),
        oneRmByAthleteExercise,
      }),
    [
      athleteNames,
      exerciseRow?.exercise_id,
      exerciseRow?.secondary_prescription_type,
      exerciseRow?.secondary_prescription_value,
      exerciseRow?.tertiary_prescription_type,
      exerciseRow?.tertiary_prescription_value,
      editor.prescriptionType,
      editor.prescriptionValue,
      oneRmByAthleteExercise,
    ],
  )

  const showValue = editor.prescriptionType !== 'max'
  const autosaveLabel =
    editor.autosaveStatus === 'saving'
      ? 'Saving…'
      : editor.autosaveStatus === 'saved'
        ? 'All changes saved ✓'
        : editor.autosaveStatus === 'failed'
          ? 'Save failed — retry'
          : editor.autosaveStatus === 'dirty'
            ? 'Pending…'
            : ''

  if (!exerciseRow) {
    return (
      <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Select an exercise to edit prescription.</p>
    )
  }

  return (
    <div>
      <h2 className="sc-headline" style={{ marginTop: 0 }}>
        Prescription
      </h2>
      <p className="sc-body-sm" style={{ color: 'var(--color-primary)', marginTop: 4 }}>
        Editing: {exerciseName || 'Exercise'}
      </p>
      <div className="sc-body-sm" style={{ color: 'var(--color-text-muted)', minHeight: 20, marginBottom: 8 }}>
        {autosaveLabel}
        {editor.autosaveLastError && (
          <p role="alert" style={{ color: 'var(--color-danger)', margin: '8px 0 0', fontSize: 'var(--font-size-body-sm)' }}>
            {editor.autosaveLastError}
          </p>
        )}
        {editor.autosaveFailed && (
          <button type="button" style={{ ...btnPrimary, marginTop: 8, width: 'auto', padding: '6px 12px' }} onClick={() => void editor.savePrescriptionNow()}>
            Retry save
          </button>
        )}
      </div>

      <label className="sc-label-caps">Sets</label>
      <input value={editor.sets} onChange={(e) => editor.setSets(e.target.value)} style={{ ...inp, width: 88 }} inputMode="numeric" />

      <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
        Reps
      </label>
      <input value={editor.reps} onChange={(e) => editor.setReps(e.target.value)} style={{ ...inp, width: 88 }} inputMode="numeric" />

      <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
        Type
      </label>
      <select value={editor.prescriptionType} onChange={(e) => editor.setType(e.target.value)} style={inp}>
        {LABEL_OPTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {showValue && (
        <>
          <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
            Value
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={editor.prescriptionValue}
              onChange={(e) => editor.setValue(e.target.value)}
              style={{ ...inp, flex: 1 }}
              inputMode="decimal"
            />
            <span className="sc-body-sm" style={{ color: 'var(--color-text-muted)', minWidth: 56 }}>
              {valueSuffix(editor.prescriptionType)}
            </span>
          </div>
        </>
      )}

      {can('programme', 'viewCoachingData') && (
        <div
          style={{
            marginTop: 16,
            background: 'var(--color-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-pad-x)',
          }}
        >
          <p className="sc-label-caps" style={{ color: 'var(--color-text)', margin: '0 0 8px' }}>
            Athlete loads (kg)
          </p>
          {!sessionTeamId ? (
            <p className="sc-body-sm" style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              {athleteLoadsMessage || 'Assign this programme to a team to see athlete loads.'}
            </p>
          ) : (
            <>
              {loads.map((l) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text)', fontSize: 'var(--font-size-body-sm)', marginBottom: 4 }}>
                  <span>{l.name}</span>
                  <strong>{l.load != null ? l.load : l.note}</strong>
                </div>
              ))}
              <p className="sc-body-sm" style={{ color: 'rgba(255,255,255,0.7)', margin: '8px 0 0' }}>
                Based on tested 1RM
              </p>
            </>
          )}
        </div>
      )}

      <label className="sc-label-caps" style={{ display: 'block', marginTop: 16 }}>
        Secondary: RPE target
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <input type="checkbox" checked={editor.secondaryOn} onChange={(e) => editor.setSecondaryOn(e.target.checked)} />
        <span className="sc-body-sm" style={{ color: 'var(--color-text-muted)' }}>Enable</span>
      </label>
      {editor.secondaryOn && (
        <input
          value={editor.secondaryVal}
          onChange={(e) => editor.setSecondaryVal(e.target.value)}
          style={{ ...inp, width: 88, marginTop: 8 }}
          inputMode="numeric"
          placeholder="1–10"
        />
      )}

      <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
        Tempo
      </label>
      <input value={editor.tempo} onChange={(e) => editor.setTempo(e.target.value)} style={inp} placeholder="3-1-1-0" />

      <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
        Rest (sec)
      </label>
      <input value={editor.rest} onChange={(e) => editor.setRest(e.target.value)} style={{ ...inp, width: 120 }} inputMode="numeric" />

      <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
        Coach note
      </label>
      <textarea value={editor.coachNote} onChange={(e) => editor.setCoachNote(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Specific cues for this exercise…" />

      <button
        type="button"
        style={{
          ...btnPrimary,
          opacity: editor.autosaveStatus === 'saving' ? 0.75 : 1,
          cursor: editor.autosaveStatus === 'saving' ? 'wait' : 'pointer',
        }}
        disabled={editor.autosaveStatus === 'saving'}
        onClick={() => void editor.savePrescriptionNow()}
      >
        {editor.autosaveStatus === 'saving' ? 'Saving…' : 'Save prescription'}
      </button>
    </div>
  )
}
