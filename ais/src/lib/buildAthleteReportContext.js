import { supabase } from './supabase'

export async function buildAthleteReportContext({ athleteId, orgId, dateRangeStart, dateRangeEnd }) {
  const context = {}

  try {
    const { data: athlete, error } = await supabase
      .from('athletes')
      .select('id, full_name, gender, date_of_birth, position, photo_url, email')
      .eq('id', athleteId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (error) throw error
    if (!athlete) return null
    context.athlete = athlete
  } catch (err) {
    console.error('[buildAthleteReportContext] athlete fetch failed:', err)
    return null
  }

  try {
    const { data: latestSession, error: sessionError } = await supabase
      .from('assessment_sessions')
      .select('id, name, assessed_on')
      .eq('org_id', orgId)
      .order('assessed_on', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!latestSession) {
      context.assessments = null
    } else {
      const { data: results, error: resultsError } = await supabase
        .from('assessment_results')
        .select('test_id, value, percentile_rank, classification, test_definitions(name, unit)')
        .eq('org_id', orgId)
        .eq('session_id', latestSession.id)
        .eq('athlete_id', athleteId)
      if (resultsError) throw resultsError
      context.assessments = results?.length
        ? { sessionName: latestSession.name, sessionDate: latestSession.assessed_on, results }
        : null
    }
  } catch {
    context.assessments = null
  }

  try {
    const { data: rpeLogs, error } = await supabase
      .from('session_athlete_logs')
      .select('actual_rpe, actual_duration_min, session_load, logged_at, sessions(name, session_date)')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .gte('logged_at', dateRangeStart)
      .lte('logged_at', dateRangeEnd)
      .order('logged_at', { ascending: false })
    if (error) throw error
    if (rpeLogs?.length) {
      const avgActual = rpeLogs.reduce((sum, row) => sum + (row.actual_rpe ?? 0), 0) / rpeLogs.length
      context.rpe = { logs: rpeLogs, averageActualRpe: Math.round(avgActual * 10) / 10, totalSessions: rpeLogs.length, totalLoad: rpeLogs.reduce((sum, row) => sum + (row.session_load ?? 0), 0) }
    } else {
      context.rpe = null
    }
  } catch {
    context.rpe = null
  }

  try {
    const { data: wellnessLogs, error } = await supabase
      .from('wellness_logs')
      .select('log_date, composite_score, responses, flagged')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .gte('log_date', dateRangeStart)
      .lte('log_date', dateRangeEnd)
      .order('log_date', { ascending: false })
    if (error) throw error
    if (wellnessLogs?.length) {
      const avgScore = wellnessLogs.reduce((sum, row) => sum + (row.composite_score ?? 0), 0) / wellnessLogs.length
      const latest = wellnessLogs[0]?.composite_score
      const oldest = wellnessLogs[wellnessLogs.length - 1]?.composite_score
      context.wellness = { logs: wellnessLogs, averageScore: Math.round(avgScore * 100) / 100, flagCount: wellnessLogs.filter((row) => row.flagged).length, totalDays: wellnessLogs.length, trend: wellnessLogs.length >= 3 ? (latest > oldest ? 'improving' : 'declining') : 'insufficient_data' }
    } else {
      context.wellness = null
    }
  } catch {
    context.wellness = null
  }

  try {
    const { data: notes, error } = await supabase
      .from('athlete_staff_notes')
      .select('domain, note, note_date, created_at, author_id, users(full_name)')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .gte('note_date', dateRangeStart)
      .lte('note_date', dateRangeEnd)
      .order('created_at', { ascending: false })
    if (error) throw error
    context.staffNotes = notes?.length ? groupNotesByDomain(notes) : null
  } catch {
    context.staffNotes = null
  }

  return context
}

function groupNotesByDomain(notes) {
  return notes.reduce((byDomain, note) => {
    const users = Array.isArray(note.users) ? note.users[0] : note.users
    const next = { note: note.note, date: note.note_date, author: users?.full_name ?? 'Staff' }
    byDomain[note.domain] = [...(byDomain[note.domain] ?? []), next]
    return byDomain
  }, {})
}
