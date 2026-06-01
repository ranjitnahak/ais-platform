import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = 'claude-sonnet-4-20250514'

const DEXA_FIELDS = [
  'scan_date', 'scan_id', 'machine_model', 'analysis_version',
  'height_cm', 'weight_kg', 'bmi',
  'total_bmd', 'total_bmc', 't_score', 'z_score',
  'l_arm_bmc', 'r_arm_bmc', 'trunk_bmc', 'l_leg_bmc', 'r_leg_bmc',
  'l_arm_fat', 'r_arm_fat', 'trunk_fat', 'l_leg_fat', 'r_leg_fat',
  'l_arm_lean', 'r_arm_lean', 'trunk_lean', 'l_leg_lean', 'r_leg_lean',
  'l_arm_fat_pct', 'r_arm_fat_pct', 'trunk_fat_pct', 'l_leg_fat_pct', 'r_leg_fat_pct',
  'total_fat_g', 'total_lean_g', 'total_fat_pct',
  'android_fat_g', 'gynoid_fat_g', 'android_gynoid_ratio',
  'fat_trunk_fat_legs_ratio', 'trunk_limb_fat_mass_ratio', 'fat_mass_height2',
  'vat_mass_g', 'vat_volume_cm3', 'vat_area_cm2',
  'lean_height2', 'appen_lean_height2',
]

const SYSTEM_PROMPT = `You are a precise data extraction assistant. Extract all fields from this DEXA scan report and return ONLY a valid JSON object with no preamble, no markdown, no backticks. Use exactly these field names: ${DEXA_FIELDS.join(', ')}. Return null for any field not present in the report. Return scan_date as YYYY-MM-DD format. All numeric values as numbers, not strings.`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function parseExtractionJson(text: string) {
  const trimmed = (text ?? '').trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed
  return JSON.parse(candidate)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { pdfBase64 } = await req.json()
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return new Response(
        JSON.stringify({ error: 'pdfBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: 'Extract all DEXA scan fields from this report as JSON.',
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic error: ${response.status} ${err}`)
    }

    const data = await response.json()
    const text = data.content?.[0]?.text
    if (!text) throw new Error('No extraction response from AI.')

    const fields = parseExtractionJson(text)

    return new Response(
      JSON.stringify({ fields }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[extract-dexa-scan]', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Extraction failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
