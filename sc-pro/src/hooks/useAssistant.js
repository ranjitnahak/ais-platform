import { useCallback, useRef, useState } from 'react'
import { buildSystemPrompt, notifyAssistantActionComplete } from '../lib/assistantContext.js'
import { executeAction } from '../lib/assistantActions.js'

const ANTHROPIC_VERSION = '2023-06-01'

/** Same-origin path proxied by Vite (dev + preview); avoids browser CORS to api.anthropic.com. */
function anthropicMessagesUrl() {
  const base = import.meta.env.VITE_ASSISTANT_API_BASE?.trim()
  if (base) return `${base.replace(/\/$/, '')}/v1/messages`
  return '/anthropic/v1/messages'
}

function parseJsonFromAssistant(text) {
  let s = String(text || '').trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object in assistant response')
  return JSON.parse(s.slice(start, end + 1))
}

function toAnthropicMessages(entries) {
  return entries
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }))
}

/**
 * Floating assistant: chat history, Anthropic call, pending confirmation, action execution.
 */
export function useAssistant(currentPage) {
  const [messages, setMessages] = useState([])
  const [pending, setPending] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const pageRef = useRef(currentPage)
  const messagesRef = useRef([])
  const loadingRef = useRef(false)
  pageRef.current = currentPage
  messagesRef.current = messages
  loadingRef.current = loading

  const clearHistory = useCallback(() => {
    setMessages([])
    setPending(null)
    setError(null)
  }, [])

  const sendMessage = useCallback(async (userText) => {
    const trimmed = String(userText || '').trim()
    if (!trimmed || loadingRef.current) return

    const userEntry = { role: 'user', content: trimmed, timestamp: Date.now() }
    const next = [...messagesRef.current, userEntry]
    messagesRef.current = next
    setMessages(next)

    setLoading(true)
    loadingRef.current = true
    setError(null)

    try {
      const system = buildSystemPrompt(pageRef.current)
      const body = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system,
        messages: toAnthropicMessages(next),
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        console.error('[useAssistant] Anthropic HTTP', response.status, errText)
        if (response.status === 404) {
          throw new Error(
            'Assistant proxy not found. For production, set VITE_ASSISTANT_API_BASE to your server URL that forwards to Anthropic.',
          )
        }
        if (response.status === 401) {
          let detail = ''
          try {
            const j = JSON.parse(errText)
            const msg = j?.error?.message || j?.message
            if (msg) detail = ` (${msg})`
          } catch {
            /* ignore */
          }
          throw new Error(
            `Anthropic returned 401 (unauthorized).${detail} Use a current secret key from the Anthropic console in sc-pro/.env.local as VITE_ANTHROPIC_API_KEY=sk-ant-… (no spaces or smart quotes), save the file, stop the dev server completely, then run npm run dev again.`,
          )
        }
        throw new Error(`API ${response.status}`)
      }

      const data = await response.json()
      const raw = data?.content?.[0]?.text
      if (!raw) throw new Error('Empty assistant response')

      let parsed
      try {
        parsed = parseJsonFromAssistant(raw)
      } catch (e) {
        console.error('[useAssistant] JSON parse', e, raw)
        throw new Error('Invalid assistant JSON')
      }

      const msg = String(parsed.message || 'Done.')
      const needsConfirm = parsed.requires_confirmation === true && parsed.action?.type

      setMessages((prev) => [...prev, { role: 'assistant', content: msg, timestamp: Date.now() }])

      if (needsConfirm) {
        setPending({
          type: parsed.action.type,
          description: String(parsed.action.description || parsed.action.type),
          payload: parsed.action.payload ?? {},
          reversible: parsed.action.reversible !== false,
        })
      } else {
        setPending(null)
      }
    } catch (e) {
      console.error('[useAssistant]', e)
      const hint =
        e?.message && typeof e.message === 'string' && !e.message.startsWith('API ')
          ? e.message
          : 'Something went wrong — please try again'
      setError(hint)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: hint,
          timestamp: Date.now(),
        },
      ])
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  const confirmAction = useCallback(async () => {
    if (!pending?.type) return
    try {
      await executeAction({ type: pending.type, payload: pending.payload })
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Action completed successfully.', timestamp: Date.now() },
      ])
      setPending(null)
      notifyAssistantActionComplete(pageRef.current)
    } catch (e) {
      console.error('[useAssistant] confirmAction', e)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Action failed: ${e?.message ?? 'Unknown error'}. You can adjust and try again.`,
          timestamp: Date.now(),
        },
      ])
    }
  }, [pending])

  const cancelAction = useCallback(() => {
    if (!pending) return
    setPending(null)
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Action cancelled.', timestamp: Date.now() }])
  }, [pending])

  return {
    messages,
    pending,
    loading,
    error,
    sendMessage,
    confirmAction,
    cancelAction,
    clearHistory,
  }
}

export { isAgentBuildIntent, useAgentExecution } from './useAgentExecution.js'
