import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
import { buildAthleteReportContext } from '../lib/buildAthleteReportContext'
import { filterReportContext } from '../lib/filterReportContext'

export function useTeamReport() {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [reportId, setReportId] = useState(null)

  async function generateTeamReport({ teamId, dateRangeStart, dateRangeEnd, enabledSources }) {
    try {
      setGenerating(true)
      setError(null)
      setReportId(null)
      const user = await getCurrentUser()
      if (!user) throw new Error('Not authenticated')
      if (!teamId) throw new Error('Select a team')
      if (!enabledSources?.length) throw new Error('Select at least one data source')

      const { data: rows, error: rosterError } = await supabase
        .from('athlete_teams')
        .select('athlete_id, athletes!inner(id, full_name, gender, position)')
        .eq('team_id', teamId)
        .eq('athletes.org_id', user.orgId)
      if (rosterError) throw rosterError

      const athletes = (rows ?? []).map((row) => Array.isArray(row.athletes) ? row.athletes[0] : row.athletes).filter(Boolean)
      const contexts = []
      for (const athlete of athletes) {
        const context = await buildAthleteReportContext({ athleteId: athlete.id, orgId: user.orgId, dateRangeStart, dateRangeEnd })
        if (!context) continue
        const filtered = filterReportContext(filterSources(context, enabledSources), user)
        contexts.push({ athlete, context: filtered })
      }

      const teamSummary = buildTeamSummary(contexts, enabledSources)
      const contextText = buildTeamContextText(contexts, teamSummary)
      const { data: fnData, error: fnError } = await supabase.functions.invoke('generate-report', { body: { contextText } })
      if (fnError) throw new Error(fnError.message)
      if (fnData?.error) throw new Error(fnData.error)

      const { data: saved, error: saveError } = await supabase
        .from('team_reports')
        .insert({
          org_id: user.orgId,
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

function buildTeamContextText(contexts, summary) {
  const athleteSummaries = contexts.map(({ athlete, context }) => [
    `ATHLETE: ${athlete.full_name} (${athlete.position ?? 'Position not set'})`,
    context.assessments ? `Assessment: ${context.assessments.sessionName}` : null,
    context.rpe ? `RPE: avg ${context.rpe.averageActualRpe}, load ${context.rpe.totalLoad}` : null,
    context.wellness ? `Wellness: avg ${context.wellness.averageScore}, trend ${context.wellness.trend}` : null,
    context.staffNotes ? `Staff notes domains: ${Object.keys(context.staffNotes).join(', ')}` : null,
  ].filter(Boolean).join('\n')).join('\n\n')
  return `TEAM SUMMARY:\nAthletes: ${summary.athleteCount}\nAvg wellness: ${summary.avgWellness ?? 'n/a'}\nFlagged: ${summary.flaggedAthletes.join(', ') || 'none'}\nAssessment coverage: ${summary.assessmentCoverage}%\nSources: ${summary.dataSources.join(', ')}\n\n${athleteSummaries}`
}
