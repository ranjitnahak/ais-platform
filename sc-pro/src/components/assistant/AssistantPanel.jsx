import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAssistant } from '../../hooks/useAssistant.js'
import { useAgentExecution } from '../../hooks/useAgentExecution.js'
import { canSync, useCurrentUser } from '../../lib/auth.js'
import { isFeatureEnabled } from '../../lib/featureFlags.js'
import { assistantPageKeyFromPath, assistantPageLabel } from '../../lib/assistantPageKeys.js'
import AssistantMessage from './AssistantMessage.jsx'
import AssistantActionCard from './AssistantActionCard.jsx'
import AssistantAgentSection from './AssistantAgentSection.jsx'

const fab = {
  position: 'fixed',
  bottom: 24,
  right: 24,
  width: 52,
  height: 52,
  borderRadius: '50%',
  border: 'none',
  background: '#F97316',
  color: '#fff',
  fontSize: 22,
  cursor: 'pointer',
  zIndex: 1000,
  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const panel = {
  position: 'fixed',
  bottom: 88,
  right: 24,
  width: 380,
  height: 520,
  maxHeight: 'calc(100vh - 120px)',
  background: '#1C1C1E',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16,
  zIndex: 999,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '8px 12px' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--color-text-muted)',
            animation: `sc-asst-pulse 1s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes sc-asst-pulse { 0%,100%{opacity:.35} 50%{opacity:1} }`}</style>
    </div>
  )
}

function hasBuildIntent(message) {
  const lower = String(message || '').toLowerCase()
  const buildKeywords = [
    'build',
    'create',
    'generate',
    'make',
    'design',
    'programme',
    'program',
    'plan',
    'week',
    'block',
    'hypertrophy',
    'strength',
    'conditioning',
    'speed',
    'session',
    'loading',
    'deload',
    'accumulation',
    'intensification',
    'peaking',
  ]
  const matchCount = buildKeywords.filter((k) => lower.includes(k)).length
  return matchCount >= 2
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result)
      const base64 = s.includes(',') ? s.split(',')[1] : s
      resolve(base64)
    }
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export default function AssistantPanel() {
  const { user, loading: userLoading } = useCurrentUser()
  const [aiEnabled, setAiEnabled] = useState(false)
  const location = useLocation()
  const pageKey = assistantPageKeyFromPath(location.pathname)
  const { messages, pending, loading, error, sendMessage, confirmAction, cancelAction, clearHistory } =
    useAssistant(pageKey)

  const agent = useAgentExecution({
    pageKey,
    onRefreshProgramme: undefined,
  })

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [coachDraft, setCoachDraft] = useState('')
  const [planningWeek, setPlanningWeek] = useState(1)
  const [attached, setAttached] = useState(null)
  const scrollRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    isFeatureEnabled('ai_assistant').then(setAiEnabled)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, loading, open, pending, agent.agentState])

  useEffect(() => {
    if (agent.agentState !== 'planning') return
    if (agent.currentWeek) setPlanningWeek(agent.currentWeek)
  }, [agent.agentState, agent.currentWeek])

  useEffect(() => {
    const h = () => setOpen(true)
    window.addEventListener('sc-pro-agent-open-build', h)
    return () => window.removeEventListener('sc-pro-agent-open-build', h)
  }, [])

  const runAgentBuild = async (textTrimmed, fileState) => {
    const t = String(textTrimmed || '').trim()
    const att = fileState
    const isBuildPage = pageKey === 'programme_detail' || pageKey === 'programmes'
    const buildRoute = isBuildPage && (Boolean(att) || (t && hasBuildIntent(t)))

    if (!buildRoute) {
      void sendMessage(t)
      return
    }

    try {
      if (att) {
        const caption = t || undefined
        if (att.kind === 'pdf') {
          await agent.startBuild({ type: 'pdf', base64: att.base64, extraText: caption })
        } else {
          await agent.startBuild({
            type: 'image',
            base64: att.base64,
            mediaType: att.mediaType,
            extraText: caption,
          })
        }
      } else if (t) {
        await agent.startBuild({ type: 'text', content: t })
      }
      setDraft('')
      setAttached(null)
    } catch (e) {
      console.error('[AssistantPanel] agent build', e)
    }
  }

  const onSend = () => {
    const t = draft.trim()
    const att = attached
    if (!t && !att) return
    if (loading || agent.agentState === 'paused') return
    setDraft('')
    void runAgentBuild(t, att)
  }

  const onPickFile = async (e) => {
    const file = e.target?.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const base64 = await readFileAsBase64(file)
      const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
      setAttached({
        name: file.name || 'file',
        base64,
        kind: isPdf ? 'pdf' : 'image',
        mediaType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
      })
    } catch (err) {
      console.error('[AssistantPanel] file', err)
    }
  }

  const agentBusy =
    agent.agentState === 'extracting' || agent.agentState === 'executing' || agent.agentState === 'paused'
  const inputDisabled = loading || agent.agentState === 'paused'
  if (userLoading) return null
  if (!aiEnabled) return null
  if (!canSync(user, 'sc_pro', 'view')) return null

  return (
    <>
      <button type="button" aria-label={open ? 'Close assistant' : 'Open assistant'} style={fab} onClick={() => setOpen((o) => !o)}>
        {open ? '×' : '✦'}
      </button>

      {open ? (
        <div
          style={{
            ...panel,
            animation: 'sc-asst-in 0.2s ease-out',
            transformOrigin: 'bottom right',
          }}
        >
          <style>{`@keyframes sc-asst-in { from { opacity:0; transform:translateY(8px)} to { opacity:1; transform:none} }`}</style>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>S&amp;C Assistant</div>
                <div className="sc-body-sm" style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
                  {assistantPageLabel(pageKey)}
                </div>
              </div>
              <button
                type="button"
                title="Clear history"
                onClick={() => {
                  clearHistory()
                  agent.resetAgent()
                  setAttached(null)
                  setCoachDraft('')
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 4,
                }}
              >
                ⌫
              </button>
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            <AssistantAgentSection
              agent={agent}
              planningWeek={planningWeek}
              setPlanningWeek={setPlanningWeek}
              coachDraft={coachDraft}
              setCoachDraft={setCoachDraft}
            />
            {error ? (
              <p className="sc-body-sm" style={{ color: 'var(--color-danger)', marginBottom: 8 }}>
                {error}
              </p>
            ) : null}
            {messages.map((m, i) => (
              <AssistantMessage key={i} role={m.role} content={m.content} timestamp={m.timestamp} />
            ))}
            {loading && agent.agentState === 'idle' ? <TypingDots /> : null}
          </div>

          {pending && agent.agentState === 'idle' ? (
            <div style={{ padding: '0 14px 8px' }}>
              <AssistantActionCard action={pending} onConfirm={() => void confirmAction()} onCancel={cancelAction} />
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, padding: '10px 14px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', alignItems: 'flex-start' }}>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => void onPickFile(e)} />
            <button
              type="button"
              title="Attach programme PDF or image"
              disabled={inputDisabled}
              onClick={() => fileRef.current?.click()}
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                cursor: inputDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              📎
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              {attached ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(249,115,22,0.15)',
                      color: 'var(--color-primary)',
                      maxWidth: 240,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {attached.name}
                  </span>
                  <button
                    type="button"
                    style={{ border: 'none', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                    onClick={() => setAttached(null)}
                  >
                    ✕
                  </button>
                </div>
              ) : null}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void onSend()
                  }
                }}
                placeholder="Ask anything…"
                disabled={inputDisabled || agentBusy}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={loading || agentBusy || (!draft.trim() && !attached)}
              style={{
                padding: '0 16px',
                height: 40,
                borderRadius: 10,
                border: 'none',
                background: loading ? 'var(--color-surface-high)' : '#F97316',
                color: '#fff',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading || agentBusy || (!draft.trim() && !attached) ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
