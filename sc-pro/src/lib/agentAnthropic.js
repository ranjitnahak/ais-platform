/** Shared Anthropic Messages API call (browser — uses VITE_ANTHROPIC_API_KEY). */

const ANTHROPIC_VERSION = '2023-06-01'

export async function anthropicMessages({ model, max_tokens, system, messages }) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing VITE_ANTHROPIC_API_KEY')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens, system, messages }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Anthropic ${response.status}: ${errText.slice(0, 200)}`)
  }
  const data = await response.json()
  const raw = data?.content?.[0]?.text
  if (!raw) throw new Error('Empty Anthropic response')
  return raw
}
