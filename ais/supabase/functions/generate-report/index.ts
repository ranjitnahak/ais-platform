import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = 'claude-sonnet-4-20250514'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { contextText } = await req.json()
    if (!contextText) {
      return new Response(
        JSON.stringify({ error: 'contextText is required' }),
        { status: 400, headers: { ...corsHeaders,
          'Content-Type': 'application/json' } }
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
        max_tokens: 1500,
        system: `You are a sports science analyst generating unified
athlete and team performance reports for coaching staff.

Your task: consolidate the provided staff inputs and performance
data into one coherent, professional report.

Rules:
- Be specific — reference actual values and observations
- Be balanced — acknowledge strengths alongside concerns
- Be actionable — every concern should have a suggested direction
- Tone: professional, direct, evidence-based
- Length: 4-6 paragraphs maximum
- Structure:
  1. Overall Summary (1 paragraph)
  2. Physical Status and Performance (1-2 paragraphs)
  3. Wellbeing and Readiness (only if wellness data present)
  4. Staff Observations (consolidating staff notes)
  5. Recommendations (3-4 specific action points)
- Do NOT invent data — only reference what is provided
- Do NOT make medical diagnoses
- Skip any section that has no data`,
        messages: [{
          role: 'user',
          content: `Generate a unified performance report for:\n\n${contextText}`
        }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic error: ${response.status} ${err}`)
    }

    const data = await response.json()
    const synthesis = data.content?.[0]?.text ?? ''

    return new Response(
      JSON.stringify({ synthesis }),
      { headers: { ...corsHeaders,
        'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[generate-report]', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders,
        'Content-Type': 'application/json' } }
    )
  }
})
