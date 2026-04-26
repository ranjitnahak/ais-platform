import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import { getCurrentUser } from '../../lib/auth.js'

const LATERALITY_OPTS = [
  { value: 'bilateral', label: 'Bilateral' },
  { value: 'unilateral', label: 'Unilateral' },
  { value: 'alternating', label: 'Alternating' },
]

const EQUIP_OPTS = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'band', label: 'Band' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'cable', label: 'Cable' },
  { value: 'machine', label: 'Machine' },
  { value: 'trx', label: 'TRX' },
  { value: 'med ball', label: 'Med Ball' },
  { value: 'sled', label: 'Sled' },
  { value: 'other', label: 'Other' },
]

const backdrop = {
  position: 'fixed',
  inset: 0,
  background: 'color-mix(in srgb, var(--color-bg) 55%, transparent)',
  zIndex: 5000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
}

const panel = {
  width: '100%',
  maxWidth: 480,
  maxHeight: '90vh',
  overflow: 'auto',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  padding: 'var(--space-pad-x)',
  boxShadow: '0 12px 40px color-mix(in srgb, var(--color-bg) 35%, transparent)',
}

const inp = {
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 'var(--radius-default)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-low)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
}

const btnRow = { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }

const btnPrimary = {
  padding: '10px 16px',
  borderRadius: 'var(--radius-default)',
  border: 'none',
  background: 'var(--color-primary)',
  color: 'var(--color-text)',
  fontWeight: 'var(--font-weight-semibold)',
  cursor: 'pointer',
}

const btnGhost = {
  ...btnPrimary,
  background: 'transparent',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-muted)',
}

export default function AddExerciseModal({ open, onClose, regions, patterns, onExerciseAdded }) {
  const user = getCurrentUser()
  const [name, setName] = useState('')
  const [regionId, setRegionId] = useState('')
  const [patternId, setPatternId] = useState('')
  const [laterality, setLaterality] = useState('bilateral')
  const [equip, setEquip] = useState(() => new Set())
  const [isAccessory, setIsAccessory] = useState(false)
  const [isPlyometric, setIsPlyometric] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [coachingCues, setCoachingCues] = useState('')
  const [personalOnly, setPersonalOnly] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const patternsForRegion = useMemo(() => {
    if (!regionId) return patterns
    return patterns.filter((p) => p.parent_id === regionId)
  }, [patterns, regionId])

  const resetForm = () => {
    setName('')
    setRegionId('')
    setPatternId('')
    setLaterality('bilateral')
    setEquip(new Set())
    setIsAccessory(false)
    setIsPlyometric(false)
    setVideoUrl('')
    setCoachingCues('')
    setPersonalOnly(false)
    setSubmitError('')
  }

  if (!open) return null

  const toggleEquip = (key) => {
    setEquip((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    const n = name.trim()
    if (!n || !regionId || !patternId) {
      setSubmitError('Name, region, and pattern are required.')
      return
    }
    setSubmitting(true)
    try {
      const equipment_required = [...equip]
      const row = {
        org_id: user.orgId,
        created_by: user.id,
        name: n,
        region_id: regionId,
        pattern_id: patternId,
        laterality,
        equipment_required,
        is_accessory: isAccessory,
        is_plyometric: isPlyometric,
        is_personal: personalOnly,
        status: 'approved',
        movement_pattern: 'custom',
        is_system_default: false,
        video_url: videoUrl.trim() || null,
        coaching_cues: coachingCues.trim() || null,
      }
      const { data, error } = await supabase
        .from('exercise_library')
        .insert(row)
        .select(
          `
          *,
          region:region_id(id, name),
          pattern:pattern_id(id, name)
        `,
        )
        .single()
      if (error) throw error
      const regionName = regions.find((r) => r.id === regionId)?.name ?? ''
      const patternName = patterns.find((p) => p.id === patternId)?.name ?? ''
      const merged = {
        ...data,
        region: data?.region ?? { id: regionId, name: regionName },
        pattern: data?.pattern ?? { id: patternId, name: patternName },
      }
      onExerciseAdded?.(merged)
      resetForm()
      onClose?.()
    } catch (err) {
      console.error('[AddExerciseModal]', err)
      setSubmitError(err?.message ?? 'Could not save exercise.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div style={panel} role="dialog" aria-modal="true" aria-labelledby="add-ex-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="add-ex-title" className="sc-headline" style={{ margin: '0 0 12px' }}>
          New exercise
        </h2>
        <form onSubmit={handleSubmit}>
          <label className="sc-label-caps">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inp} required />

          <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
            Region
          </label>
          <select
            value={regionId}
            onChange={(e) => {
              setRegionId(e.target.value)
              setPatternId('')
            }}
            style={inp}
            required
          >
            <option value="">Select region…</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
            Pattern
          </label>
          <select value={patternId} onChange={(e) => setPatternId(e.target.value)} style={inp} required>
            <option value="">Select pattern…</option>
            {patternsForRegion.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
            Laterality
          </label>
          <select value={laterality} onChange={(e) => setLaterality(e.target.value)} style={inp}>
            {LATERALITY_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <p className="sc-label-caps" style={{ margin: '12px 0 6px' }}>
            Equipment
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EQUIP_OPTS.map((o) => (
              <label key={o.value} className="sc-body-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={equip.has(o.value)} onChange={() => toggleEquip(o.value)} />
                {o.label}
              </label>
            ))}
          </div>

          <label className="sc-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <input type="checkbox" checked={isAccessory} onChange={(e) => setIsAccessory(e.target.checked)} />
            Is accessory
          </label>
          <label className="sc-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <input type="checkbox" checked={isPlyometric} onChange={(e) => setIsPlyometric(e.target.checked)} />
            Is plyometric
          </label>

          <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
            Video URL
          </label>
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} style={inp} placeholder="YouTube or Vimeo…" />

          <label className="sc-label-caps" style={{ display: 'block', marginTop: 12 }}>
            Coaching cues
          </label>
          <textarea value={coachingCues} onChange={(e) => setCoachingCues(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />

          <p className="sc-label-caps" style={{ margin: '12px 0 6px' }}>
            Visibility
          </p>
          <label className="sc-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="vis" checked={!personalOnly} onChange={() => setPersonalOnly(false)} />
            Visible to my org
          </label>
          <label className="sc-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <input type="radio" name="vis" checked={personalOnly} onChange={() => setPersonalOnly(true)} />
            Personal only
          </label>

          {submitError ? (
            <p className="sc-body-sm" style={{ color: 'var(--color-danger)', marginTop: 10 }}>
              {submitError}
            </p>
          ) : null}

          <div style={btnRow}>
            <button type="button" style={btnGhost} onClick={() => { resetForm(); onClose?.() }} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" style={btnPrimary} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save exercise'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
