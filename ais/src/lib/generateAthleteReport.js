import { supabase } from './supabase'
import { buildAthleteReportContext } from './buildAthleteReportContext'
import { filterReportContext } from './filterReportContext'

const MODEL = 'claude-sonnet-4-20250514'

export async function generateAthleteReport({ athleteId, orgId, user, dateRangeStart, dateRangeEnd }) {
  try {
    const fullContext = await buildAthleteReportContext({ athleteId, orgId, dateRangeStart, dateRangeEnd })
    if (!fullContext) throw new Error('Athlete not found')

    const filteredContext = filterReportContext(fullContext, user)
    const sections = buildPromptSections(filteredContext)
    if (sections.length < 2) {
      throw new Error('Insufficient data to generate report. Please ensure staff notes or assessment data exists.')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: `You are a sports science analyst generating a unified athlete performance report for coaching staff.

Your task: consolidate the provided staff inputs and performance data into one coherent, professional report.

Rules:
- Be specific - reference actual values and observations
- Be balanced - acknowledge strengths alongside concerns
- Be actionable - every concern should have a suggested direction
- Tone: professional, direct, evidence-based
- Length: 4-6 paragraphs maximum
- Structure your response as:
  1. Overall Summary (1 paragraph)
  2. Physical Status & Performance (1-2 paragraphs)
  3. Wellbeing & Readiness (1 paragraph, only if wellness data present)
  4. Staff Observations (1 paragraph consolidating staff notes)
  5. Recommendations (1 paragraph, 3-4 specific action points)
- Do NOT invent data - only reference what is provided
- Do NOT make medical diagnoses
- If a section has no data, skip it entirely`,
        messages: [{
          role: 'user',
          content: `Please generate a unified athlete report for the following data:\n\n${sections.join('\n\n---\n\n')}`,
        }],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(`Anthropic API error: ${response.status} ${errBody}`)
    }

    const aiData = await response.json()
    const aiSynthesis = aiData.content?.[0]?.text ?? ''
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
        ai_model_version: MODEL,
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
