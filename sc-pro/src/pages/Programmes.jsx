import { useEffect } from 'react'
import { PHASE_TYPES, TRAINING_AGES } from '../lib/programmeUi.js'
import { useProgrammesLibrary } from '../hooks/useProgrammesLibrary.js'
import ProgrammeLibraryTable from '../components/programmes/ProgrammeLibraryTable.jsx'
import CreateProgrammeModal from '../components/programmes/CreateProgrammeModal.jsx'
import { FilterSelect, btnOutline, btnPrimary } from '../components/programmes/programmeLibraryUi.jsx'
import { registerPageContext, unregisterPageContext } from '../lib/assistantContext.js'
import { registerAction, unregisterAction } from '../lib/assistantActions.js'
import { getCurrentUser } from '../lib/auth.js'
import { supabase } from '../lib/supabaseClient.js'

const PROGRAMMES_PAGE_ACTIONS = [
  'create_programme',
  'build_programme_from_plan',
  'create_session_for_build',
  'create_block_for_build',
  'create_exercise_for_build',
]

export default function Programmes() {
  const v = useProgrammesLibrary()

  useEffect(() => {
    const user = getCurrentUser()
    const filtered = v.filtered ?? []

    registerPageContext('programmes', () => ({
      orgId: user.orgId,
      pageDescription:
        'Programme Library — coach can create new programmes and use the AI agent to build complete programmes from text prompts or uploaded files',
      programmes: filtered.map((p) => ({
        id: p.id,
        name: p.name,
        sport: p.sport,
        phase_type: p.phase_type,
      })),
      availableActions: [
        'create_programme',
        'build_programme_from_plan',
        'create_session_for_build',
        'create_block_for_build',
        'create_exercise_for_build',
      ],
    }))

    registerAction('create_programme', async (payload) => {
      const { data, error } = await supabase
        .from('programmes')
        .insert({
          org_id: user.orgId,
          name: payload.name,
          sport: payload.sport ?? 'Kabaddi',
          phase_type: payload.phase_type ?? 'accumulation',
          training_age: payload.training_age ?? 'elite',
          difficulty: payload.difficulty ?? 'moderate',
          description: payload.description ?? null,
          is_template: false,
          created_by: user.id,
          athlete_id: payload.athlete_id ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data
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
      unregisterPageContext('programmes')
      for (const k of PROGRAMMES_PAGE_ACTIONS) unregisterAction(k)
    }
  }, [v.filtered])

  return (
    <div style={{ padding: 'var(--space-container)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 className="sc-headline" style={{ margin: 0, flex: '1 1 200px' }}>
          Programme Library
        </h1>
        <input
          type="search"
          placeholder="Search programmes…"
          value={v.search}
          onChange={(e) => {
            v.setSearch(e.target.value)
            v.setPage(1)
          }}
          style={{
            flex: '1 1 220px',
            maxWidth: 360,
            padding: '10px 12px',
            borderRadius: 'var(--radius-default)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--color-primary)'
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--color-border)'
          }}
        />
        <button
          type="button"
          style={{
            ...btnOutline,
            borderColor: v.onlyTemplates ? 'var(--color-primary)' : 'var(--color-border)',
            color: v.onlyTemplates ? 'var(--color-primary)' : 'var(--color-text)',
          }}
          onClick={() => {
            v.setOnlyTemplates((t) => !t)
            v.setPage(1)
          }}
        >
          Templates ({v.templateCount})
        </button>
        <button type="button" style={btnPrimary} onClick={() => v.setModal({})}>
          + Create Programme
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <FilterSelect label="Sport" value={v.sport} options={v.sportOptions} onChange={v.setSport} resetPage={() => v.setPage(1)} />
        <FilterSelect label="Phase type" value={v.phase} options={['All', ...PHASE_TYPES]} onChange={v.setPhase} resetPage={() => v.setPage(1)} />
        <FilterSelect label="Training age" value={v.age} options={['All', ...TRAINING_AGES]} onChange={v.setAge} resetPage={() => v.setPage(1)} />
        <FilterSelect label="Created by" value={v.createdBy} options={['Any Coach']} onChange={v.setCreatedBy} resetPage={() => v.setPage(1)} />
      </div>

      {v.error && (
        <p style={{ color: 'var(--color-danger)', marginBottom: 12 }} role="alert">
          {v.error}
        </p>
      )}

      {v.loading ? (
        <div style={{ color: 'var(--color-text-muted)' }}>Loading programmes…</div>
      ) : v.filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>No programmes yet. Create your first programme.</p>
          <button type="button" style={{ ...btnPrimary, marginTop: 16 }} onClick={() => v.setModal({})}>
            + Create Programme
          </button>
        </div>
      ) : (
        <ProgrammeLibraryTable
          slice={v.slice}
          filteredLength={v.filtered.length}
          pageSafe={v.pageSafe}
          totalPages={v.totalPages}
          teamUsage={v.teamUsage}
          navigate={v.navigate}
          duplicateProgramme={v.duplicateProgramme}
          deleteProgramme={v.deleteProgramme}
          saveAsTemplate={v.saveAsTemplate}
          setPage={v.setPage}
        />
      )}

      {v.modal && <CreateProgrammeModal onClose={() => v.setModal(null)} onSave={v.handleCreate} />}
    </div>
  )
}
