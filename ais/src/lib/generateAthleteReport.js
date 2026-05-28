import { supabase } from './supabase'
import { buildAthleteReportContext } from './buildAthleteReportContext'
import { filterReportContext } from './filterReportContext'

export async function generateAthleteReport({ athleteId, orgId, user, dateRangeStart, dateRangeEnd }) {
  try {
    const fullContext = await buildAthleteReportContext({ athleteId, orgId, dateRangeStart, dateRangeEnd })
    if (!fullContext) throw new Error('Athlete not found')

    const filteredContext = filterReportContext(fullContext, user)
    const sections = buildPromptSections(filteredContext)
    if (sections.length < 2) {
      throw new Error('Insufficient data to generate report. Please ensure staff notes or assessment data exists.')
    }

    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      'generate-report',
      { body: { contextText: sections.join('\n\n---\n\n') } }
    )
    if (fnError) throw new Error(fnError.message)
    if (fnData?.error) throw new Error(fnData.error)
    const aiSynthesis = fnData?.synthesis ?? ''
    const { data: savedReport, error: saveError } = await supabase
      .from('athlete_reports')
      .insert({
        athlete_id: athleteId,
        org_id: orgId,
        team_id: fullContext.athlete ? null : null,
        generated_by: user.id,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        section_assessment: filteredContext.assessments,
        section_training: filteredContext.rpe,
        section_wellness: filteredContext.wellness,
        section_staff_notes: filteredContext.staffNotes,
        section_ai_synthesis: { text: aiSynthesis },
        ai_model_version: 'claude-sonnet-4-20250514',
        status: 'final',
      })
      .select()
      .single()
    if (saveError) throw saveError
    return savedReport
  } catch (err) {
    console.error('[generateAthleteReport] failed:', err)
    throw err
  }
}

function buildPromptSections(context) {
  const sections = []
  if (context.athlete) {
    sections.push(`ATHLETE: ${context.athlete.full_name}, ${context.athlete.position ?? 'Position not set'}, ${context.athlete.gender}`)
  }
  if (context.assessments) {
    const results = context.assessments.results.map(formatAssessmentResult).join('\n')
    sections.push(`ASSESSMENT DATA (${context.assessments.sessionDate}):\n${results}`)
  }
  if (context.rpe) {
    sections.push(`TRAINING LOAD (${context.rpe.totalSessions} sessions):
Average RPE: ${context.rpe.averageActualRpe}/10
Total Load: ${context.rpe.totalLoad} AU`)
  }
  if (context.wellness) {
    sections.push(`WELLNESS (${context.wellness.totalDays} days logged):
Average Readiness Score: ${context.wellness.averageScore}/5
Flagged Days: ${context.wellness.flagCount}
Trend: ${context.wellness.trend}`)
  }
  if (context.staffNotes) sections.push(`STAFF NOTES:\n${formatStaffNotes(context.staffNotes)}`)
  return sections
}

function formatAssessmentResult(result) {
  const test = Array.isArray(result.test_definitions) ? result.test_definitions[0] : result.test_definitions
  const percentile = result.percentile_rank ? `${result.percentile_rank}th percentile` : ''
  return `${test?.name}: ${result.value} (${result.classification ?? 'unclassified'}, ${percentile})`
}

function formatStaffNotes(staffNotes) {
  return Object.entries(staffNotes)
    .map(([domain, notes]) => `${domain.toUpperCase()}:\n${notes.map((note) => `  [${note.date}] ${note.author}: ${note.note}`).join('\n')}`)
    .join('\n\n')
}
