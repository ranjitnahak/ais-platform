import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { can } from '../lib/auth.js'
import { buildAthleteLoads } from '../hooks/usePrescription.js'
import { athleteDisplayName } from '../lib/programmeUi.js'
import { getYoutubeEmbedUrl } from '../lib/youtubeEmbed.js'

function formatRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const sec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (sec < 60) return 'Just now'
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const days = Math.floor(h / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function SessionInfoPanel({
  exerciseRow,
  orgId,
  athleteNames,
  oneRmByAthleteExercise,
  sessionTeamId,
  athleteLoadsMessage,
}) {
  const [lastLog, setLastLog] = useState(null)

  const lib = exerciseRow?.exercise_library
  const exId = exerciseRow?.exercise_id
  const embed = useMemo(() => getYoutubeEmbedUrl(lib?.video_url), [lib?.video_url])

  useEffect(() => {
    if (!exId || !orgId) {
      setLastLog(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('athlete_exercise_logs')
          .select('set_number, actual_weight, actual_reps, actual_rpe, logged_at, athletes(full_name, first_name, last_name)')
          .eq('exercise_id', exId)
          .eq('org_id', orgId)
          .order('logged_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) throw error
        if (!cancelled) setLastLog(data ?? null)
      } catch (err) {
        console.error('[SessionInfoPanel] last performance', err)
        if (!cancelled) setLastLog(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [exId, orgId])

  const loads = useMemo(() => {
    if (!exerciseRow || !athleteNames?.length) return []
    return buildAthleteLoads({
      athleteNames,
      exerciseId: exerciseRow.exercise_id,
      prescriptionType: exerciseRow.prescription_type,
      prescriptionValue: exerciseRow.prescription_value == null ? null : Number(exerciseRow.prescription_value),
      secondaryPrescriptionType: exerciseRow.secondary_prescription_type,
      secondaryPrescriptionValue:
        exerciseRow.secondary_prescription_value == null ? null : Number(exerciseRow.secondary_prescription_value),
      tertiaryPrescriptionType: exerciseRow.tertiary_prescription_type,
      tertiaryPrescriptionValue:
        exerciseRow.tertiary_prescription_value == null ? null : Number(exerciseRow.tertiary_prescription_value),
      oneRmByAthleteExercise,
    })
  }, [exerciseRow, athleteNames, oneRmByAthleteExercise])

  const pctDisplay =
    exerciseRow?.prescription_type === 'pct_1rm' && exerciseRow.prescription_value != null && exerciseRow.prescription_value !== ''
      ? exerciseRow.prescription_value
      : exerciseRow?.secondary_prescription_type === 'pct_1rm' &&
          exerciseRow.secondary_prescription_value != null &&
          exerciseRow.secondary_prescription_value !== ''
        ? exerciseRow.secondary_prescription_value
        : exerciseRow?.tertiary_prescription_type === 'pct_1rm' &&
            exerciseRow.tertiary_prescription_value != null &&
            exerciseRow.tertiary_prescription_value !== ''
          ? exerciseRow.tertiary_prescription_value
          : null

  const showPctLoads = pctDisplay != null && pctDisplay !== ''

  const lastAthlete = lastLog?.athletes
  const lastName = lastAthlete ? athleteDisplayName(Array.isArray(lastAthlete) ? lastAthlete[0] : lastAthlete) : ''

  if (!exerciseRow) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, padding: 16 }}>
        <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: 0, textAlign: 'center' }}>
          Select an exercise to see details
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="sc-label-caps" style={{ marginBottom: 8 }}>
          Video
        </div>
        {embed ? (
          <>
            <iframe
              title={lib?.name || 'Exercise video'}
              src={embed}
              style={{
                width: '100%',
                height: 160,
                borderRadius: 'var(--radius-md)',
                border: 'none',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', marginTop: 8, marginBottom: 0 }}>
              {lib?.name || 'Exercise'}
            </p>
          </>
        ) : (
          <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            No video for this exercise
          </p>
        )}
      </div>

      <div>
        <div className="sc-label-caps" style={{ marginBottom: 8 }}>
          Athlete loads (kg)
        </div>
        {!showPctLoads ? (
          <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            Set a % 1RM to see athlete loads
          </p>
        ) : !sessionTeamId ? (
          <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            {athleteLoadsMessage || 'Assign this programme to a team to see athlete loads.'}
          </p>
        ) : !can('programme', 'viewCoachingData') ? (
          <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            Athlete loads are hidden for this role.
          </p>
        ) : (
          <div
            style={{
              background: 'var(--color-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: 12,
            }}
          >
            <p className="sc-body-sm" style={{ color: 'var(--color-on-accent-muted)', margin: '0 0 8px' }}>
              {pctDisplay}% of 1RM
            </p>
            {loads.map((l) => (
              <div
                key={l.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'var(--font-size-body-sm)',
                  marginBottom: 4,
                  color: 'var(--color-on-accent)',
                }}
              >
                <span>{l.name}</span>
                <strong
                  style={{
                    fontWeight: 'var(--font-weight-semibold)',
                    fontStyle: l.load == null ? 'italic' : undefined,
                    color: l.load == null ? 'var(--color-on-accent-muted)' : 'var(--color-on-accent)',
                  }}
                >
                  {l.load != null ? `${l.load} kg` : l.note}
                </strong>
              </div>
            ))}
            <p className="sc-label-caps" style={{ color: 'var(--color-on-accent-muted)', margin: '6px 0 0' }}>
              Based on tested 1RM
            </p>
          </div>
        )}
      </div>

      <div>
        <div className="sc-label-caps" style={{ marginBottom: 8 }}>
          Last performance
        </div>
        {lastLog ? (
          <div
            style={{
              background: 'var(--color-surface-high)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
            }}
          >
            <p style={{ fontSize: 'var(--font-size-body-sm)', fontWeight: 'var(--font-weight-semibold)', margin: '0 0 6px' }}>
              {lastName}
            </p>
            <p className="sc-body-sm" style={{ margin: '0 0 4px', color: 'var(--color-text)' }}>
              {lastLog.set_number ?? 1} × {lastLog.actual_reps ?? '—'} @ {lastLog.actual_weight ?? '—'} kg
            </p>
            <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: 0 }}>
              {formatRelative(lastLog.logged_at)}
            </p>
          </div>
        ) : (
          <p className="sc-body-sm" style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            No previous logs
          </p>
        )}
      </div>
    </div>
  )
}
