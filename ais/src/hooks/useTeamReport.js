import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
import { buildAthleteReportContext } from '../lib/buildAthleteReportContext'
import { filterReportContext } from '../lib/filterReportContext'

export function useTeamReport(activeOrgId) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [reportId, setReportId] = useState(null)

  async function generateTeamReport({ teamId, dateRangeStart, dateRangeEnd, enabledSources }) {
    try {
      setGenerating(true)
      setError(null)
      setReportId(null)
      const user = await getCurrentUser()
      if (!user || !activeOrgId) throw new Error('Not authenticated')
      if (!teamId) throw new Error('Select a team')
      if (!enabledSources?.length) throw new Error('Select at least one data source')

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .eq('org_id', activeOrgId)
        .single()
      if (teamError) throw teamError

      const { data: rows, error: rosterError } = await supabase
        .from('athlete_teams')
        .select('athlete_id, athletes!inner(id, full_name, gender, position)')
        .eq('team_id', teamId)
        .eq('athletes.org_id', activeOrgId)
      if (rosterError) throw rosterError

      const athletes = (rows ?? []).map((row) => Array.isArray(row.athletes) ? row.athletes[0] : row.athletes).filter(Boolean)
      const contexts = []
      for (const athlete of athletes) {
        const context = await buildAthleteReportContext({ athleteId: athlete.id, orgId: activeOrgId, dateRangeStart, dateRangeEnd })
        if (!context) continue
        const filtered = filterReportContext(filterSources(context, enabledSources), user)
        contexts.push({ athlete, context: filtered })
      }

      const teamSummary = buildTeamSummary(contexts, enabledSources)
      const contextText = buildTeamContextText(contexts, team?.name ?? 'Team')
      const { data: fnData, error: fnError } = await supabase.functions.invoke('generate-report', { body: { contextText } })
      if (fnError) throw new Error(fnError.message)
      if (fnData?.error) throw new Error(fnData.error)

      const { data: saved, error: saveError } = await supabase
        .from('team_reports')
        .insert({
          org_id: activeOrgId,
          team_id: teamId,
          generated_by: user.id,
          date_range_start: dateRangeStart,
          date_range_end: dateRangeEnd,
          section_squad_overview: teamSummary,
          section_ai_synthesis: { text: fnData?.synthesis ?? '' },
          status: 'final',
          ai_model_version: 'claude-sonnet-4-20250514',
        })
        .select()
        .single()
      if (saveError) throw saveError
      setReportId(saved.id)
      return saved.id
    } catch (err) {
      console.error('[useTeamReport] generateTeamReport failed:', err)
      setError(err.message)
      throw err
    } finally {
      setGenerating(false)
    }
  }

  return { generating, error, reportId, generateTeamReport }
}

function filterSources(context, enabledSources) {
  return {
    ...context,
    assessments: enabledSources.includes('assessments') ? context.assessments : null,
    rpe: enabledSources.includes('rpe_logging') ? context.rpe : null,
    wellness: enabledSources.includes('wellness') ? context.wellness : null,
    staffNotes: enabledSources.length ? context.staffNotes : null,
  }
}

function buildTeamSummary(contexts, dataSources) {
  const wellnessScores = contexts.map(({ context }) => context.wellness?.averageScore).filter((score) => score != null)
  const assessed = contexts.filter(({ context }) => context.assessments).length
  const flagged = contexts.filter(({ context }) => (context.wellness?.averageScore ?? 5) < 2.5).map(({ athlete }) => athlete.full_name)
  return {
    athleteCount: contexts.length,
    avgWellness: wellnessScores.length ? Math.round((wellnessScores.reduce((sum, score) => sum + score, 0) / wellnessScores.length) * 100) / 100 : null,
    flaggedAthletes: flagged,
    assessmentCoverage: contexts.length ? Math.round((assessed / contexts.length) * 100) : 0,
    dataSources,
  }
}

function buildTeamContextText(athleteContexts, teamName) {
  const athleteSummaries = athleteContexts.map(({ athlete, context }) => {
    const parts = []
    if (context.assessments) {
      const topResults = context.assessments.results.slice(0, 3).map((r) => `${r.test_definitions?.name}: ${r.value} (${r.classification ?? ''})`).join(', ')
      parts.push(`Assessment: ${topResults}`)
    }
    if (context.rpe) parts.push(`Training: ${context.rpe.totalSessions} sessions, avg RPE ${context.rpe.averageActualRpe}`)
    if (context.wellness) parts.push(`Wellness: avg score ${context.wellness.averageScore}/5, trend ${context.wellness.trend}`)
    if (context.staffNotes) {
      const notes = Object.entries(context.staffNotes).map(([domain, noteList]) => `${domain}: ${noteList[0]?.note}`).join('; ')
      parts.push(`Staff notes: ${notes}`)
    }
    return `ATHLETE: ${athlete.full_name} (${athlete.position ?? 'unknown position'})\n${parts.join(' | ')}`
  }).join('\n\n')
  return `TEAM: ${teamName}\n\nGenerate a brief 2-3 sentence paragraph for each athlete below, followed by one team summary paragraph. Keep each athlete paragraph under 60 words. Be specific, evidence-based, and actionable.\n\n${athleteSummaries}`
}
