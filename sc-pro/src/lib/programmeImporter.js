import { anthropicMessages } from './agentAnthropic.js'

const EXTRACT_MODEL = 'claude-sonnet-4-20250514'
const EXTRACT_MAX_TOKENS = 6000
const OVERRIDE_MAX_TOKENS = 1000

const SYSTEM_EXTRACT = `CRITICAL: Your response must be ONLY valid JSON.
No markdown code fences. No backticks. No prose.
No explanation before or after.
Start your response with { and end with }.
Any text outside the JSON object will cause a critical failure.

You are a strength and conditioning programme parser.
Extract the complete programme structure from the provided content and return ONLY valid JSON — no markdown, no prose.

IMPORTANT: Extract ONLY Week 1 sessions and exercises in full detail.
For every other week (week_number 2 and above), include only week_number and label in each weeks[] entry — no sessions, blocks, or exercises (use "sessions": [] or omit sessions).
Set total_weeks to the full number of weeks in the source programme. This enables week-by-week building later.

Return this exact schema:
{
  "programme_name": string,
  "sport": string or null,
  "phase_type": "accumulation|intensification|realisation|transition|general",
  "total_weeks": number,
  "sessions_per_week": number,
  "weeks": [
    {
      "week_number": number,
      "label": string or null,
      "sessions": [
        {
          "name": string,
          "day_of_week": "monday|tuesday|wednesday|thursday|friday|saturday|sunday" or null,
          "category": "strength|speed|conditioning|power|mobility|recovery|mixed",
          "planned_duration_min": number or null,
          "coach_instructions": string or null,
          "blocks": [
            {
              "label": "A|B|C|D|E|F",
              "format": "straight|superset|circuit|emom|amrap|custom",
              "format_note": string or null,
              "exercises": [
                {
                  "name": string,
                  "sets": number,
                  "reps": number or null,
                  "reps_note": string or null,
                  "prescription_type": "absolute|pct_1rm|rpe|rir|max|time|distance" or null,
                  "prescription_value": number or null,
                  "prescription_range_low": number or null,
                  "prescription_range_high": number or null,
                  "rpe": number or null,
                  "rpe_range_low": number or null,
                  "rpe_range_high": number or null,
                  "rest_seconds": number or null,
                  "tempo": string or null,
                  "coach_note": string or null
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "decision_points": [
    {
      "type": "unsupported_format|missing_day|ambiguous_load|exercise_unknown|other",
      "description": string,
      "options": [string],
      "default": string,
      "affects": "week_number or 'all'"
    }
  ]
}

Rules for extraction:
- "Cluster Sets" format → format: "custom", format_note: "Cluster Sets", decision_points entry: unsupported_format
- Load ranges like "82-85%" → use midpoint (83.5), set prescription_range_low and prescription_range_high, decision_points entry: ambiguous_load
- Unknown exercises → include them as-is in name field, decision_points entry: exercise_unknown
- Missing day assignments → decision_points entry: missing_day
- RPE ranges like "RPE 7-8" → rpe_range_low: 7, rpe_range_high: 8, rpe: null`

export function stripMarkdownFences(text) {
  let s = String(text || '').trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  return s
}

/**
 * Attempt to recover parseable JSON when Claude hit output limits mid-response.
 * Uses string-aware brace counts plus optional "coach_note" last-complete-exercise cut.
 */
function repairTruncatedJSON(text) {
  const raw = String(text || '').trim()
  if (!raw) return null

  function countBalanced(s) {
    let braces = 0
    let brackets = 0
    let inString = false
    let esc = false
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]
      if (esc) {
        esc = false
        continue
      }
      if (ch === '\\' && inString) {
        esc = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === '{') braces++
      else if (ch === '}') braces--
      else if (ch === '[') brackets++
      else if (ch === ']') brackets--
    }
    return { braces, brackets }
  }

  let braces = 0
  let brackets = 0
  let lastValidPos = -1
  let inString = false
  let esc = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (esc) {
      esc = false
      continue
    }
    if (ch === '\\' && inString) {
      esc = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') braces++
    if (ch === '}') {
      braces--
      if (braces === 0) lastValidPos = i
    }
    if (ch === '[') brackets++
    if (ch === ']') brackets--
  }

  let repaired = raw
  if (braces > 0 || brackets > 0) {
    if (lastValidPos > 0) {
      repaired = raw.slice(0, lastValidPos + 1)
    }

    const lastCompleteExercise = raw.lastIndexOf('"coach_note"')
    if (lastCompleteExercise > 0) {
      const colon = raw.indexOf(':', lastCompleteExercise)
      if (colon > 0) {
        let pos = colon + 1
        while (pos < raw.length && /\s/.test(raw[pos])) pos++
        let endVal = -1
        if (raw[pos] === '"') {
          pos++
          while (pos < raw.length) {
            if (raw[pos] === '\\') {
              pos += 2
              continue
            }
            if (raw[pos] === '"') {
              endVal = pos
              break
            }
            pos++
          }
        } else if (raw.slice(pos, pos + 4) === 'null') {
          endVal = pos + 3
        }
        if (endVal > 0) {
          let j = endVal + 1
          while (j < raw.length && /\s/.test(raw[j])) j++
          const afterNote = raw.indexOf('}', j)
          if (afterNote > 0) {
            repaired = raw.slice(0, afterNote + 1)
            let ob = 0
            let ob2 = 0
            inString = false
            esc = false
            for (let i = 0; i < repaired.length; i++) {
              const c = repaired[i]
              if (esc) {
                esc = false
                continue
              }
              if (c === '\\' && inString) {
                esc = true
                continue
              }
              if (c === '"') {
                inString = !inString
                continue
              }
              if (inString) continue
              if (c === '{') ob++
              else if (c === '}') ob--
              else if (c === '[') ob2++
              else if (c === ']') ob2--
            }
            let extra = ''
            if (!repaired.includes('"decision_points"')) {
              extra += ',"decision_points":[]'
            }
            for (let i = 0; i < ob2; i++) extra += ']'
            for (let i = 0; i < ob; i++) extra += '}'
            try {
              return JSON.parse(repaired + extra)
            } catch {
              /* try generic close below */
            }
          }
        }
      }
    }

    let closings = ''
    let { braces: bRem, brackets: brRem } = countBalanced(repaired)
    for (let i = 0; i < brRem; i++) closings += ']'
    for (let i = 0; i < bRem; i++) closings += '}'
    try {
      return JSON.parse(repaired + closings)
    } catch {
      /* fall through */
    }
    closings = ''
    ;({ braces: bRem, brackets: brRem } = countBalanced(raw))
    for (let i = 0; i < brRem; i++) closings += ']'
    for (let i = 0; i < bRem; i++) closings += '}'
    try {
      return JSON.parse(raw + closings)
    } catch {
      return null
    }
  }

  return null
}

/**
 * Robust JSON extraction for Claude responses (fences, prose, or raw JSON).
 */
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null

  const firstBrace = text.indexOf('{')

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim())
    } catch {
      /* try next strategy */
    }
  }

  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1))
    } catch {
      /* try next strategy */
    }
  }

  try {
    return JSON.parse(text.trim())
  } catch {
    /* fall through */
  }

  const repaired = repairTruncatedJSON(firstBrace !== -1 ? text.slice(firstBrace) : text)
  if (repaired != null && typeof repaired === 'object') {
    console.warn(
      '[programmeImporter] Response was truncated — recovered partial programme. Some weeks may be missing.',
    )
    return repaired
  }

  return null
}

function cleanBase64(base64String) {
  if (!base64String || typeof base64String !== 'string') return base64String
  return base64String.includes(',') ? base64String.split(',')[1] : base64String
}

function buildExtractUserContent(input) {
  if (input.type === 'text') {
    return [{ type: 'text', text: String(input.content || '') }]
  }
  if (input.type === 'image') {
    const note = input.extraText ? `${input.extraText}\n\nExtract the programme` : 'Extract the programme'
    const data = cleanBase64(input.base64)
    return [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: input.mediaType || 'image/jpeg',
          data,
        },
      },
      { type: 'text', text: note },
    ]
  }
  if (input.type === 'pdf') {
    const note = input.extraText ? `${input.extraText}\n\nExtract the programme` : 'Extract the programme'
    const data = cleanBase64(input.base64)
    return [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data,
        },
      },
      { type: 'text', text: note },
    ]
  }
  throw new Error('Invalid extract input type')
}

function buildExtractWeekUserContent(input, weekNumber) {
  if (input.type === 'text') {
    return [
      {
        type: 'text',
        text: `Extract Week ${weekNumber} from this programme:\n\n${String(input.content || '')}`,
      },
    ]
  }
  if (input.type === 'image') {
    const data = cleanBase64(input.base64)
    return [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: input.mediaType || 'image/jpeg',
          data,
        },
      },
      { type: 'text', text: `Extract only Week ${weekNumber} from this programme document.` },
    ]
  }
  if (input.type === 'pdf') {
    const data = cleanBase64(input.base64)
    return [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data,
        },
      },
      { type: 'text', text: `Extract only Week ${weekNumber} from this programme document.` },
    ]
  }
  throw new Error('Invalid extract week input type')
}

function systemPromptForWeek(weekNumber) {
  return `CRITICAL: Your response must be ONLY valid JSON.
No markdown code fences. No backticks. No prose.
Start your response with { and end with }.

You are a strength and conditioning programme parser.
Extract ONLY Week ${weekNumber} from the provided programme.
Return ONLY valid JSON — no markdown, no prose.

Return exactly one object with this shape:
{
  "week_number": ${weekNumber},
  "label": string or null,
  "sessions": [
    {
      "name": string,
      "day_of_week": "monday|tuesday|wednesday|thursday|friday|saturday|sunday" or null,
      "category": "strength|speed|conditioning|power|mobility|recovery|mixed",
      "planned_duration_min": number or null,
      "coach_instructions": string or null,
      "blocks": [
        {
          "label": string,
          "format": "straight|superset|circuit|emom|amrap|custom",
          "format_note": string or null,
          "exercises": [
            {
              "name": string,
              "sets": number,
              "reps": number or null,
              "reps_note": string or null,
              "prescription_type": "absolute|pct_1rm|rpe|rir|max|time|distance" or null,
              "prescription_value": number or null,
              "prescription_range_low": number or null,
              "prescription_range_high": number or null,
              "rpe": number or null,
              "rpe_range_low": number or null,
              "rpe_range_high": number or null,
              "rest_seconds": number or null,
              "tempo": string or null,
              "coach_note": string or null
            }
          ]
        }
      ]
    }
  ]
}`.trim()
}

/**
 * Extract a single week's sessions/blocks from PDF, image, or full text programme.
 * @param {{ type: 'pdf', base64: string } | { type: 'image', base64: string, mediaType?: string } | { type: 'text', content: string }} input
 * @param {string} [_anthropicKey] unused — API key from env (VITE_ANTHROPIC_API_KEY)
 */
export async function extractWeek(input, weekNumber, _anthropicKey) {
  const messages = [{ role: 'user', content: buildExtractWeekUserContent(input, weekNumber) }]
  const raw = await anthropicMessages({
    model: EXTRACT_MODEL,
    max_tokens: EXTRACT_MAX_TOKENS,
    system: systemPromptForWeek(weekNumber),
    messages,
  })
  const responseText = String(raw ?? '')
  console.log(`[programmeImporter] Week ${weekNumber} response:`, responseText)

  const parsed = extractJSON(responseText)
  if (!parsed) {
    throw new Error(`Could not parse Week ${weekNumber} — please try again`)
  }

  if (Array.isArray(parsed.weeks) && parsed.weeks[0]) {
    const w = parsed.weeks[0]
    if (w.week_number == null) w.week_number = weekNumber
    return w
  }
  if (parsed.week_number != null || Array.isArray(parsed.sessions)) {
    if (parsed.week_number == null) parsed.week_number = weekNumber
    return parsed
  }

  throw new Error(`Could not parse Week ${weekNumber} — invalid shape`)
}

/**
 * @param {{ type: 'image', base64: string, mediaType: string } | { type: 'pdf', base64: string } | { type: 'text', content: string }} input
 * @param {string} [_anthropicKey] unused — key read from env per project conventions
 */
export async function extractProgramme(input, _anthropicKey) {
  const messages = [{ role: 'user', content: buildExtractUserContent(input) }]
  const raw = await anthropicMessages({
    model: EXTRACT_MODEL,
    max_tokens: EXTRACT_MAX_TOKENS,
    system: SYSTEM_EXTRACT,
    messages,
  })
  const responseText = String(raw ?? '')
  console.log('[programmeImporter] Raw Claude response:', responseText)

  const parsed = extractJSON(responseText)
  if (!parsed) {
    console.error('[programmeImporter] Failed to parse. Raw response:', responseText)
    throw new Error('Could not parse programme — please check the file is clear and try again')
  }

  const weeks = parsed.weeks
  const totalWeeks = parsed.total_weeks
  if (Array.isArray(weeks) && typeof totalWeeks === 'number' && weeks.length < totalWeeks) {
    console.warn(
      `[programmeImporter] Only extracted ${weeks.length} of ${totalWeeks} weeks due to response length limits.`,
    )
    parsed.total_weeks = weeks.length
    parsed._truncated = true
  }

  return parsed
}

function collectExerciseNames(plan) {
  const names = new Set()
  for (const w of plan?.weeks ?? []) {
    for (const s of w?.sessions ?? []) {
      for (const b of s?.blocks ?? []) {
        for (const ex of b?.exercises ?? []) {
          const n = String(ex?.name ?? '').trim()
          if (n) names.add(n)
        }
      }
    }
  }
  return [...names]
}

/** Visibility OR matching SessionExerciseSearch / assistantActions patterns */
function libraryVisibilityOr(orgId, userId) {
  return `org_id.is.null,and(org_id.eq.${orgId},or(status.eq.approved,created_by.eq.${userId}))`
}

/**
 * @returns {Promise<Map<string, { exerciseName: string, matchType: string, matchedId: string | null, suggestions: { id: string, name: string }[] }>>}
 */
export async function matchExercises(plan, supabase, orgId, userId) {
  const map = new Map()
  const names = collectExerciseNames(plan)
  for (const exerciseName of names) {
    const en = String(exerciseName).trim()

    const { data: exactRows, error: exErr } = await supabase
      .from('exercise_library')
      .select('id, name')
      .or(libraryVisibilityOr(orgId, userId))
      .ilike('name', en)
      .limit(20)
    if (exErr) throw exErr

    const lower = en.toLowerCase()
    const exactHit = (exactRows ?? []).find((r) => String(r.name ?? '').toLowerCase() === lower)

    if (exactHit?.id) {
      map.set(en, {
        exerciseName: en,
        matchType: 'exact',
        matchedId: exactHit.id,
        suggestions: [],
      })
      continue
    }

    const firstWord = en.split(/\s+/)[0] || en
    const { data: fuzzyRows, error: fzErr } = await supabase
      .from('exercise_library')
      .select('id, name')
      .or(libraryVisibilityOr(orgId, userId))
      .ilike('name', `%${firstWord}%`)
      .limit(3)
    if (fzErr) throw fzErr

    const sug = (fuzzyRows ?? []).map((r) => ({ id: r.id, name: r.name }))
    map.set(en, {
      exerciseName: en,
      matchType: sug.length ? 'fuzzy' : 'none',
      matchedId: null,
      suggestions: sug,
    })
  }
  return map
}

/**
 * Weekly PDF reference ping — does not mutate DB; satisfies supervised autonomy contract.
 */
export async function pingWeekBuildWithReference({
  pdfBase64,
  pdfMediaType,
  weekNumber,
  weekData,
  overrides,
}) {
  if (!pdfBase64) return null
  const mediaType = pdfMediaType || 'application/pdf'
  const docPart =
    mediaType === 'application/pdf'
      ? {
          type: 'document',
          source: { type: 'base64', media_type: mediaType, data: pdfBase64 },
        }
      : {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: pdfBase64 },
        }

  const text = `Original programme reference above.
Now executing Week ${weekNumber}.
Active overrides: ${JSON.stringify(overrides ?? [])}
Week data to build: ${JSON.stringify(weekData)}`

  const raw = await anthropicMessages({
    model: EXTRACT_MODEL,
    max_tokens: 500,
    system: 'Acknowledge briefly (one sentence) that you are supervising this week build. No JSON.',
    messages: [{ role: 'user', content: [docPart, { type: 'text', text }] }],
  })
  return String(raw || '').trim()
}

const OVERRIDE_SYSTEM = `Parse this coach instruction as a programme override.
Return JSON only:
{
  "scope": "next_week" | "all_remaining",
  "type": "intensity" | "volume" | "replace" | "skip" | "other",
  "target": "exercise name or session type or null",
  "adjustment": "description of change",
  "parsed_value": number or null
}`

export async function parseCoachOverride(message) {
  const raw = await anthropicMessages({
    model: EXTRACT_MODEL,
    max_tokens: OVERRIDE_MAX_TOKENS,
    system: OVERRIDE_SYSTEM,
    messages: [{ role: 'user', content: String(message || '') }],
  })
  try {
    const s = stripMarkdownFences(raw)
    const start = s.indexOf('{')
    const end = s.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('no json')
    return JSON.parse(s.slice(start, end + 1))
  } catch {
    return {
      scope: 'next_week',
      type: 'other',
      target: null,
      adjustment: String(message || ''),
      parsed_value: null,
    }
  }
}
