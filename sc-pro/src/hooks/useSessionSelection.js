import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { can } from '../lib/auth.js'
import {
  bulkDeleteSessionsOrdered,
  bulkPublishSessions,
  fetchSessionsForBulkCopy,
  pasteClipboardToWeekDay,
} from '../lib/sessionBulkOps.js'

export function useSessionSelection({
  user,
  weekId,
  weekSessionIds,
  refreshWeek,
  setToast,
  dismissSingleClipboard,
}) {
  const [selectedSessionIds, setSelectedSessionIds] = useState(() => new Set())
  const [barDeleteConfirm, setBarDeleteConfirm] = useState(false)
  const [barBusy, setBarBusy] = useState(false)
  const [copiedSessions, setCopiedSessions] = useState([])
  const copiedSessionsRef = useRef([])

  const clearSelection = useCallback(() => {
    setSelectedSessionIds(new Set())
    setBarDeleteConfirm(false)
  }, [])

  const selectionActive = selectedSessionIds.size > 0

  useEffect(() => {
    copiedSessionsRef.current = copiedSessions
  }, [copiedSessions])

  useEffect(() => {
    if (!selectionActive) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectionActive, clearSelection])

  const toggleSessionInSelection = useCallback((sessionId) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }, [])

  const selectAllInWeek = useCallback(() => {
    setSelectedSessionIds(new Set(weekSessionIds))
  }, [weekSessionIds])

  const onGridBackgroundPointerUp = useCallback(
    (e) => {
      if (e.target.closest('[data-session-card]')) return
      if (e.target.closest('[data-clipboard-paste-slot]')) return
      if (e.target.closest('[data-session-selection-bar]')) return
      if (e.target.closest('[data-programme-detail-footer]')) return
      if (e.target.closest('button')) return
      if (selectionActive) clearSelection()
    },
    [selectionActive, clearSelection],
  )

  const publishAllSelected = useCallback(() => {
    if (!can('programme', 'edit')) return
    const ids = Array.from(selectedSessionIds)
    if (!ids.length) return
    setBarBusy(true)
    void (async () => {
      try {
        await bulkPublishSessions(supabase, user.orgId, ids)
        setToast(`${ids.length} sessions published`)
        clearSelection()
        await refreshWeek()
      } catch (err) {
        console.error('[BulkPublish]', err)
        setToast(err.message ?? 'Publish failed')
      } finally {
        setBarBusy(false)
      }
    })()
  }, [user.orgId, selectedSessionIds, setToast, clearSelection, refreshWeek])

  const copyAllSelected = useCallback(() => {
    if (!can('programme', 'edit')) return
    const ids = Array.from(selectedSessionIds)
    if (!ids.length) return
    setBarBusy(true)
    void (async () => {
      try {
        dismissSingleClipboard?.()
        const payloads = await fetchSessionsForBulkCopy(supabase, user.orgId, ids)
        copiedSessionsRef.current = payloads
        setCopiedSessions(payloads)
        setToast(`${ids.length} sessions copied — click empty slots to paste`)
        clearSelection()
      } catch (err) {
        console.error('[BulkCopy]', err)
        setToast(err.message ?? 'Copy failed')
      } finally {
        setBarBusy(false)
      }
    })()
  }, [user.orgId, selectedSessionIds, setToast, clearSelection, dismissSingleClipboard])

  const confirmDeleteSelected = useCallback(() => {
    if (!can('programme', 'edit')) return
    const ids = Array.from(selectedSessionIds)
    if (!ids.length) return
    setBarBusy(true)
    void (async () => {
      try {
        await bulkDeleteSessionsOrdered(supabase, user.orgId, ids)
        setToast(`${ids.length} sessions deleted`)
        clearSelection()
        await refreshWeek()
      } catch (err) {
        console.error('[BulkDelete]', err)
        setToast(err.message ?? 'Delete failed')
      } finally {
        setBarBusy(false)
        setBarDeleteConfirm(false)
      }
    })()
  }, [user.orgId, selectedSessionIds, setToast, clearSelection, refreshWeek])

  const tryPasteBulkSlot = useCallback(
    (targetDateIso) => {
      const q = copiedSessionsRef.current
      if (!q.length || !weekId) return false
      const clip = q[0]
      void (async () => {
        try {
          await pasteClipboardToWeekDay(supabase, {
            orgId: user.orgId,
            clipboard: clip,
            targetDateIso,
            programmeWeekId: weekId,
          })
          const rest = copiedSessionsRef.current.slice(1)
          copiedSessionsRef.current = rest
          setCopiedSessions(rest)
          if (!rest.length) setToast('All sessions pasted')
          else setToast(`${rest.length} session(s) left to paste`)
          await refreshWeek()
        } catch (err) {
          console.error('[BulkPaste]', err)
          setToast(err.message ?? 'Paste failed')
        }
      })()
      return true
    },
    [user.orgId, weekId, refreshWeek, setToast],
  )

  return {
    selectedSessionIds,
    selectionActive,
    toggleSessionInSelection,
    selectAllInWeek,
    clearSelection,
    onGridBackgroundPointerUp,
    publishAllSelected,
    copyAllSelected,
    barDeleteConfirm,
    setBarDeleteConfirm,
    barBusy,
    confirmDeleteSelected,
    tryPasteBulkSlot,
    bulkPasteQueueLength: copiedSessions.length,
  }
}
