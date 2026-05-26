import { useCallback, useRef, useState } from 'react'
import { extractProgramme, extractWeek, matchExercises, parseCoachOverride } from '../lib/programmeImporter.js'
import { resolveAgentSessionDate } from '../lib/agentSessionDates.js'
import { getCurrentUser } from '../lib/auth.js'
import { supabase } from '../lib/supabaseClient.js'
import { applyParsedOverrideToWeek } from '../lib/agentOverrides.js'
import { notifyAssistantActionComplete } from '../lib/assistantContext.js'

const BUILD_INTENT_RE =
  /build|create programme|upload|import|generate programme|make a programme|programme from/i

function normCategory(cat) {
  const c = String(cat || 'strength').toLowerCase()
  const allowed = new Set(['strength', 'power', 'speed', 'conditioning', 'mobility', 'recovery', 'mixed'])
  return allowed.has(c) ? c : 'strength'
}

export function isAgentBuildIntent(text, hasFile) {
  if (hasFile) return true
  return BUILD_INTENT_RE.test(String(text || '').trim())
}

export function useAgentExecution({ pageKey, onRefreshProgramme }) {
  const [agentState, setAgentState] = useState('idle')
  const [extractedPlan, setExtractedPlan] = useState(null)
  const [pdfBase64, setPdfBase64] = useState(null)
  const [pdfMediaType, setPdfMediaType] = useState(null)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [currentStep, setCurrentStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)
  const [stepDescription, setStepDescription] = useState('')
  const [completedSteps, setCompletedSteps] = useState([])
  const [activeDecision, setActiveDecision] = useState(null)
  const [overrides, setOverrides] = useState([])
  const [buildReport, setBuildReport] = useState({ completed: [], decisions: [], skipped: [] })
  const [error, setError] = useState(null)
  const [matchMap, setMatchMap] = useState(() => new Map())
  const [lastTextPrompt, setLastTextPrompt] = useState('')
  const [activeProgrammeId, setActiveProgrammeId] = useState(null)
  const [continuationPrompt, setContinuationPrompt] = useState(null)

  const decisionResolver = useRef(null)
  const activeDecisionRef = useRef(null)
  const runningRef = useRef(false)
  const extractedPlanRef = useRef(null)
  const activeProgrammeIdRef = useRef(null)
  const activeProgrammeRowRef = useRef(null)
  const matchMapRef = useRef(matchMap)
  matchMapRef.current = matchMap

  const estimateSteps = useCallback((weekPlan) => {
    let n = 0
    for (const s of weekPlan?.sessions ?? []) {
      n += 1
      for (const b of s?.blocks ?? []) {
        n += 1
        n += (b?.exercises ?? []).length
      }
    }
    return Math.max(1, n)
  }, [])

  const waitForDecision = useCallback((decision) => {
    return new Promise((resolve) => {
      activeDecisionRef.current = decision
      setActiveDecision(decision)
      setAgentState('paused')
      decisionResolver.current = resolve
    })
  }, [])

  const resolveDecision = useCallback((choice) => {
    const dec = activeDecisionRef.current
    activeDecisionRef.current = null
    setActiveDecision(null)
    setAgentState('executing')
    if (dec) {
      setBuildReport((r) => ({
        ...r,
        decisions: [...r.decisions, { description: dec.description, choice: String(choice) }],
      }))
    }
    decisionResolver.current?.(choice)
    decisionResolver.current = null
  }, [])

  const resetAgent = useCallback(() => {
    decisionResolver.current = null
    runningRef.current = false
    setAgentState('idle')
    setExtractedPlan(null)
    setPdfBase64(null)
    setPdfMediaType(null)
    setCurrentWeek(1)
    setCurrentStep(0)
    setTotalSteps(0)
    setStepDescription('')
    setCompletedSteps([])
    setActiveDecision(null)
    setOverrides([])
    setBuildReport({ completed: [], decisions: [], skipped: [] })
    setError(null)
    setMatchMap(new Map())
    setLastTextPrompt('')
    setActiveProgrammeId(null)
    setContinuationPrompt(null)
    extractedPlanRef.current = null
    activeProgrammeIdRef.current = null
    activeProgrammeRowRef.current = null
  }, [])

  const stopBuild = useCallback(() => {
    runningRef.current = false
    if (decisionResolver.current) {
      decisionResolver.current('Stop')
      decisionResolver.current = null
    }
    activeDecisionRef.current = null
    setActiveDecision(null)
    setAgentState('complete')
    notifyAssistantActionComplete(pageKey)
    onRefreshProgramme?.()
  }, [pageKey, onRefreshProgramme])

  const buildInput = useCallback(() => {
    if (pdfBase64) {
      return {
        type: pdfMediaType === 'application/pdf' ? 'pdf' : 'image',
        base64: pdfBase64,
        mediaType: pdfMediaType || 'image/jpeg',
      }
    }
    return { type: 'text', content: lastTextPrompt || '' }
  }, [pdfBase64, pdfMediaType, lastTextPrompt])

  const startBuild = useCallback(async (input) => {
    setError(null)
    setAgentState('extracting')
    setBuildReport({ completed: [], decisions: [], skipped: [] })
    setCompletedSteps([])
    setContinuationPrompt(null)
    setActiveProgrammeId(null)
    activeProgrammeIdRef.current = null
    activeProgrammeRowRef.current = null
    if (input?.type === 'pdf' || input?.type === 'image') {
      setPdfBase64(input.base64)
      setPdfMediaType(input.mediaType || (input.type === 'pdf' ? 'application/pdf' : 'image/jpeg'))
      setLastTextPrompt('')
    } else {
      setPdfBase64(null)
      setPdfMediaType(null)
    }
    if (input?.type === 'text') {
      setLastTextPrompt(String(input.content || ''))
    }
    try {
      const plan = await extractProgramme(input)
      extractedPlanRef.current = plan
      setExtractedPlan(plan)
      const user = await getCurrentUser()
      const m = await matchExercises(plan, supabase, user.orgId, user.id)
      setMatchMap(m)
      matchMapRef.current = m
      setAgentState('planning')
    } catch (e) {
      console.error('[useAgentExecution] extract', e)
      setError(e?.message ?? 'Could not read programme')
      setAgentState('idle')
    }
  }, [])

  const runWeek = useCallback(
    async (weekNumber, coachNote) => {
      const plan = extractedPlanRef.current ?? extractedPlan
      let wk = plan?.weeks?.find((w) => w.week_number === weekNumber)
      if (!wk) wk = plan?.weeks?.[weekNumber - 1]
      if (!wk) {
        setError(`No week ${weekNumber} in extracted plan.`)
        setAgentState('planning')
        return
      }

      let weekData = JSON.parse(JSON.stringify(wk))

      if (!weekData?.sessions?.length) {
        setStepDescription(`Reading Week ${weekNumber} from document...`)
        try {
          const extracted = await extractWeek(
            buildInput(),
            weekNumber,
            import.meta.env.VITE_ANTHROPIC_API_KEY,
          )
          const prevPlan = extractedPlanRef.current ?? extractedPlan
          const nextPlan = JSON.parse(JSON.stringify(prevPlan))
          const idx = nextPlan.weeks.findIndex((w) => w.week_number === weekNumber)
          const i = idx >= 0 ? idx : weekNumber - 1
          if (!nextPlan.weeks[i]) {
            nextPlan.weeks[i] = { week_number: weekNumber, sessions: [] }
          }
          nextPlan.weeks[i] = {
            ...nextPlan.weeks[i],
            ...extracted,
            week_number: weekNumber,
          }
          extractedPlanRef.current = nextPlan
          setExtractedPlan(nextPlan)
          weekData = JSON.parse(JSON.stringify(nextPlan.weeks[i]))

          const user = await getCurrentUser()
          const m = await matchExercises(nextPlan, supabase, user.orgId, user.id)
          setMatchMap(m)
          matchMapRef.current = m
        } catch (e) {
          console.error('[useAgentExecution] extractWeek', e)
          setError(e?.message ?? `Could not read Week ${weekNumber}`)
          setAgentState('planning')
          return
        }
      }

      const parsedList = [...overrides]
      if (coachNote?.trim()) {
        try {
          const p = await parseCoachOverride(coachNote)
          parsedList.push(p)
          setOverrides((o) => [...o, p])
        } catch (e) {
          console.error('[useAgentExecution] override parse', e)
        }
      }
      let merged = weekData
      for (const p of parsedList) {
        merged = applyParsedOverrideToWeek(merged, p, weekNumber)
      }

      const steps = estimateSteps(merged)
      setTotalSteps(steps)
      setCurrentStep(0)
      setCurrentWeek(weekNumber)
      setAgentState('executing')
      setContinuationPrompt(null)
      runningRef.current = true

      let stepCount = 0
      // Requires can('sc_pro', 'use_ai_assistant')
      const user = await getCurrentUser()
      const teamId = user.teamIds?.[0] ?? null

      const addToSkipped = (item, reason) => {
        setBuildReport((prev) => ({
          ...prev,
          skipped: [...prev.skipped, { item, reason: String(reason ?? '') }],
        }))
      }

      const patchExercisePayload = async (payload) => {
        let exerciseId = payload.exercise_id
        if (!exerciseId && payload.exercise_name) {
          try {
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
            if (!exError && newEx?.id) exerciseId = newEx.id
          } catch (e) {
            console.error('[useAgentExecution] create exercise', e)
          }
        }
        if (!exerciseId) return { error: new Error('No exercise id') }
        const prescriptionValue =
          payload.prescription_range_low != null && payload.prescription_range_high != null
            ? (Number(payload.prescription_range_low) + Number(payload.prescription_range_high)) / 2
            : payload.prescription_value != null
              ? Number(payload.prescription_value)
              : null
        const { error } = await supabase.from('session_exercises').insert({
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
        return { error }
      }

      try {
        let programmeId = activeProgrammeIdRef.current
        const progRow = activeProgrammeRowRef.current

        if (!programmeId) {
          setStepDescription('Creating programme…')
          const totalWeeks = Math.min(52, Math.max(1, Number(plan?.total_weeks) || 1))
          try {
            const { data: prog, error: pErr } = await supabase
              .from('programmes')
              .insert({
                org_id: user.orgId,
                name: String(plan?.programme_name ?? 'Imported programme').trim() || 'Imported programme',
                sport: plan?.sport ?? 'General',
                phase_type: plan?.phase_type ?? 'accumulation',
                training_age: 'elite',
                difficulty: 'moderate',
                description: null,
                is_template: false,
              })
              .select()
              .single()
            if (pErr) throw pErr

            const weekRows = Array.from({ length: totalWeeks }, (_, idx) => {
              const n = idx + 1
              const stub = plan?.weeks?.find((w) => w.week_number === n) ?? plan?.weeks?.[idx]
              return {
                programme_id: prog.id,
                org_id: user.orgId,
                week_number: n,
                label: stub?.label ?? `Week ${n}`,
                notes: null,
              }
            })
            const { error: wErr } = await supabase.from('programme_weeks').insert(weekRows)
            if (wErr) throw wErr

            const { data: fullProg, error: fpErr } = await supabase
              .from('programmes')
              .select('*')
              .eq('id', prog.id)
              .eq('org_id', user.orgId)
              .in('team_id', user.teamIds)
              .single()
            if (fpErr) throw fpErr

            programmeId = prog.id
            activeProgrammeIdRef.current = programmeId
            activeProgrammeRowRef.current = fullProg
            setActiveProgrammeId(programmeId)
          } catch (e) {
            console.error('[useAgentExecution] create programme', e)
            setError(e?.message ?? 'Could not create programme')
            setAgentState('planning')
            runningRef.current = false
            return
          }
        }

        const programmeForDates = activeProgrammeRowRef.current ?? progRow
        const { data: progWeek, error: pwErr } = await supabase
          .from('programme_weeks')
          .select('id, label')
          .eq('programme_id', programmeId)
          .eq('org_id', user.orgId)
          .eq('week_number', weekNumber)
          .maybeSingle()
        if (pwErr) throw pwErr
        if (!progWeek?.id) {
          throw new Error(`Programme has no row for week ${weekNumber}`)
        }

        setStepDescription(`Creating Week ${weekNumber}`)
        let sessions = [...(merged?.sessions ?? [])]
        const skipCat = merged?.__skipCategories
        if (skipCat instanceof Set && skipCat.size) {
          sessions = sessions.filter((s) => !skipCat.has(normCategory(s.category)))
        }

        if (sessions.some((s) => !s.day_of_week)) {
          const pat = [0, 2, 4]
          let k = 0
          for (const s of sessions) {
            if (!s.day_of_week) {
              s.day_of_week = ['monday', 'wednesday', 'friday'][pat[k % 3]]
              k++
            }
          }
        }

        for (let si = 0; si < sessions.length; si++) {
          if (!runningRef.current) break
          const sess = sessions[si]
          let sessionDate = ''
          try {
            sessionDate = resolveAgentSessionDate(programmeForDates, weekNumber, sess.day_of_week)
          } catch {
            sessionDate = ''
          }
          if (!sessionDate) {
            addToSkipped(`Session: ${sess.name ?? ''}`, 'No session date')
            continue
          }

          setStepDescription(`Creating session: ${sess.name ?? 'Session'}`)
          stepCount += 1
          setCurrentStep(stepCount)
          setCompletedSteps((c) => [...c.slice(-2), `Session: ${sess.name ?? ''}`])

          let newSession
          try {
            const insertRow = {
              org_id: user.orgId,
              team_id: teamId,
              programme_week_id: progWeek.id,
              name: sess.name || 'Session',
              session_date: sessionDate,
              category: normCategory(sess.category),
              duration_planned: sess.planned_duration_min ?? 60,
              coach_instructions: sess.coach_instructions ?? null,
              start_time: '09:00:00',
              session_type: normCategory(sess.category) === 'strength' ? 'strength' : 'conditioning',
              is_published: false,
              publish_at: null,
            }
            const { data: sessRow, error: sessionError } = await supabase
              .from('sessions')
              .insert(insertRow)
              .select()
              .single()
            if (sessionError) throw sessionError
            newSession = sessRow

            const { data: psRows, error: psErr } = await supabase
              .from('programme_sessions')
              .select('sort_order')
              .eq('programme_week_id', progWeek.id)
              .eq('org_id', user.orgId)
              .order('sort_order', { ascending: false })
              .limit(1)
            if (psErr) throw psErr
            const maxSort = psRows?.[0]?.sort_order ?? 0
            const { error: psInsErr } = await supabase.from('programme_sessions').insert({
              org_id: user.orgId,
              programme_week_id: progWeek.id,
              session_id: sessRow.id,
              sort_order: maxSort + 1,
            })
            if (psInsErr) throw psInsErr
          } catch (e) {
            console.error('[useAgentExecution] session', e)
            addToSkipped(`Session: ${sess.name ?? ''}`, e?.message ?? String(e))
            continue
          }

          const blocks = [...(sess.blocks ?? [])]
          for (let bi = 0; bi < blocks.length; bi++) {
            if (!runningRef.current) break
            const blk = blocks[bi]
            setStepDescription(`Adding Block ${blk.label ?? 'A'} to ${sess.name ?? 'session'}`)
            stepCount += 1
            setCurrentStep(stepCount)

            let newBlock
            try {
              const { data: blockRow, error: blockError } = await supabase
                .from('session_blocks')
                .insert({
                  session_id: newSession.id,
                  org_id: user.orgId,
                  label: String(blk.label ?? 'A').slice(0, 8),
                  block_type: 'main',
                  format: blk.format ?? 'straight',
                  notes: blk.format_note ?? null,
                  sort_order: bi,
                })
                .select()
                .single()
              if (blockError) throw blockError
              newBlock = blockRow
            } catch (e) {
              console.error('[useAgentExecution] block', e)
              addToSkipped(`Block ${blk.label ?? ''}`, e?.message ?? String(e))
              continue
            }

            const exercises = [...(blk.exercises ?? [])]
            for (let ei = 0; ei < exercises.length; ei++) {
              if (!runningRef.current) break
              const ex = exercises[ei]
              const exName = String(ex.name || '').trim()
              const match = matchMapRef.current?.get(exName) ?? {
                matchedId: null,
                matchType: 'none',
                suggestions: [],
              }

              setStepDescription(`Adding exercise: ${exName}`)
              stepCount += 1
              setCurrentStep(stepCount)

              const payload = mapExerciseToCreatePayload(ex, newBlock.id, ei, match)
              try {
                const { error: exError } = await patchExercisePayload(payload)
                if (exError) throw exError
                setCompletedSteps((c) => [...c.slice(-2), `Exercise: ${exName}`])
              } catch (e) {
                console.error('[useAgentExecution] exercise', e)
                addToSkipped(`Exercise: ${exName}`, e?.message ?? String(e))
              }
            }
          }
        }
      } catch (e) {
        console.error('[useAgentExecution] week', e)
        setBuildReport((r) => ({
          ...r,
          skipped: [...r.skipped, { kind: 'fatal', reason: e?.message ?? String(e) }],
        }))
      }

      const totalWeeksPlan = Math.min(plan?.total_weeks ?? 1, plan?.weeks?.length ?? 52)

      setBuildReport((r) => ({
        ...r,
        completed: [...r.completed, `Week ${weekNumber} built`],
      }))

      if (weekNumber < totalWeeksPlan && runningRef.current) {
        setContinuationPrompt(
          `✅ Week ${weekNumber} built successfully.\n\nReady to build Week ${weekNumber + 1} of ${totalWeeksPlan}.\n\nSay "yes" to continue, or give me any adjustments for Week ${weekNumber + 1}.`,
        )
      } else {
        setContinuationPrompt(null)
      }

      notifyAssistantActionComplete(pageKey)
      onRefreshProgramme?.()

      if (weekNumber < totalWeeksPlan && runningRef.current) {
        setAgentState('planning')
        setCurrentWeek(weekNumber + 1)
      } else {
        setAgentState('complete')
      }
    },
    [overrides, extractedPlan, estimateSteps, pageKey, onRefreshProgramme, buildInput],
  )

  const confirmPlan = useCallback(
    async (weekNumber = 1, coachNote) => {
      await runWeek(weekNumber, coachNote)
    },
    [runWeek],
  )

  const addOverride = useCallback((overrideRow) => {
    setOverrides((o) => [...o, overrideRow])
  }, [])

  return {
    agentState,
    extractedPlan,
    pdfBase64,
    pdfMediaType,
    currentWeek,
    currentStep,
    totalSteps,
    completedSteps,
    stepDescription,
    activeDecision,
    overrides,
    buildReport,
    error,
    matchMap,
    activeProgrammeId,
    continuationPrompt,
    startBuild,
    confirmPlan,
    resolveDecision,
    addOverride,
    stopBuild,
    resetAgent,
    runWeek,
  }
}

function mapExerciseToCreatePayload(ex, blockId, sortOrder, match) {
  const m = match || {}
  let prescription_type = ex.prescription_type || 'max'
  let prescription_value = ex.prescription_value ?? null
  let secondary_prescription_type = null
  let secondary_prescription_value = null

  const rLow = ex.prescription_range_low
  const rHigh = ex.prescription_range_high
  if (rLow != null && rHigh != null) {
    prescription_value = (Number(rLow) + Number(rHigh)) / 2
  }

  if (prescription_type === 'rpe') {
    prescription_value = ex.prescription_value ?? ex.rpe ?? null
  } else if (ex.rpe != null && prescription_type !== 'rpe') {
    secondary_prescription_type = 'rpe'
    secondary_prescription_value = Number(ex.rpe)
  }

  if (ex.rpe_range_low != null && ex.rpe_range_high != null && prescription_type === 'rpe') {
    prescription_value = (Number(ex.rpe_range_low) + Number(ex.rpe_range_high)) / 2
  }

  return {
    block_id: blockId,
    sort_order: sortOrder,
    exercise_id: m.matchedId ?? null,
    exercise_name: !m.matchedId ? String(ex.name || '').trim() : null,
    sets: Number(ex.sets) || 3,
    reps: ex.reps != null ? Number(ex.reps) : null,
    prescription_type,
    prescription_value,
    secondary_prescription_type,
    secondary_prescription_value,
    prescription_range_low: ex.prescription_range_low ?? null,
    prescription_range_high: ex.prescription_range_high ?? null,
    rest_seconds: ex.rest_seconds ?? null,
    tempo: ex.tempo ?? null,
    coach_note: ex.coach_note ?? null,
  }
}
