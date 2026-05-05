import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { can } from '../lib/auth.js'
import { ASSISTANT_ACTION_COMPLETE } from '../lib/assistantContext.js'
import { useProgrammeDetailPage } from '../hooks/useProgrammeDetailPage.js'
import { useSessionSelection } from '../hooks/useSessionSelection.js'
import { useAssistantProgrammeDetail } from '../hooks/useAssistantProgrammeDetail.js'
import { useProgrammeBuilderActions } from '../hooks/useProgrammeBuilderActions.js'
import ProgrammeDetailView from '../components/programme-detail/ProgrammeDetailView.jsx'

export default function ProgrammeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [, setSearchParams] = useSearchParams()
  const v = useProgrammeDetailPage(id)
  const [assignOpen, setAssignOpen] = useState(false)
  const [previewSessionId, setPreviewSessionId] = useState(null)
  const [copyWeekBusy, setCopyWeekBusy] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameBusy, setNameBusy] = useState(false)
  const [editDetailsOpen, setEditDetailsOpen] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const copyWeekLockRef = useRef(false)

  useEffect(() => {
    setPreviewSessionId(null)
  }, [location.pathname])

  useEffect(() => {
    setNameDraft(v.programme?.name || '')
  }, [v.programme?.id, v.programme?.name])

  useEffect(() => {
    if (!v.programme || !can('programme', 'edit')) return
    if (!location.pathname.endsWith('/edit')) return
    setEditDetailsOpen(true)
    setHeaderMenuOpen(false)
    navigate(`/programmes/${id}`, { replace: true })
  }, [v.programme?.id, id, location.pathname, navigate, v.programme])

  useEffect(() => {
    if (!headerMenuOpen) return
    const close = (e) => {
      if (e.target.closest?.('[data-programme-header-menu]')) return
      setHeaderMenuOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [headerMenuOpen])

  useEffect(() => {
    if (!v.copiedSession) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      v.dismissSessionClipboard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [v.copiedSession, v.dismissSessionClipboard])

  const weekSessionIds = useMemo(
    () => (v.links ?? []).map((r) => r.session_id ?? r.sessions?.id).filter(Boolean),
    [v.links],
  )

  const selection = useSessionSelection({
    user: v.user,
    weekId: v.weekId,
    weekSessionIds,
    refreshWeek: v.refreshWeek,
    setToast: v.setToast,
    dismissSingleClipboard: v.dismissSessionClipboard,
  })

  const selectionCount = selection.selectedSessionIds.size
  const showSelectionBar = can('programme', 'edit') && selectionCount > 0
  const bulkPasteActive = selection.bulkPasteQueueLength > 0
  const bottomChromePadding = showSelectionBar ? 170 : bulkPasteActive ? 130 : 100

  useAssistantProgrammeDetail({
    programme: v.programme,
    weeks: v.weeks,
    weekId: v.weekId,
    links: v.links,
    counts: v.counts,
    assignTargets: v.assignTargets,
  })

  useProgrammeBuilderActions({
    programme: v.programme,
    weeks: v.weeks,
    weekId: v.weekId,
    refreshWeek: v.refreshWeek,
    load: v.load,
  })

  useEffect(() => {
    const h = (e) => {
      if (e.detail?.pageKey !== 'programme_detail') return
      void v.refreshWeek()
      void v.load()
    }
    window.addEventListener(ASSISTANT_ACTION_COMPLETE, h)
    return () => window.removeEventListener(ASSISTANT_ACTION_COMPLETE, h)
  }, [v.refreshWeek, v.load])

  if (v.loading) return <div style={{ padding: 24, color: 'var(--color-text-muted)' }}>Loading…</div>
  if (v.error || !v.programme) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'var(--color-danger)' }}>{v.error || 'Not found'}</p>
        <Link to="/programmes" style={{ color: 'var(--color-primary)' }}>
          Back to library
        </Link>
      </div>
    )
  }

  const programme = v.programme

  const saveName = async () => {
    if (!can('programme', 'edit') || nameBusy) return
    const next = nameDraft.trim()
    if (!next || next === programme.name) return
    setNameBusy(true)
    try {
      await v.renameProgramme(next)
    } finally {
      setNameBusy(false)
    }
  }

  return (
    <ProgrammeDetailView
      v={v}
      programme={programme}
      programmeId={id}
      setSearchParams={setSearchParams}
      nameDraft={nameDraft}
      setNameDraft={setNameDraft}
      nameBusy={nameBusy}
      saveName={saveName}
      bottomChromePadding={bottomChromePadding}
      assignOpen={assignOpen}
      setAssignOpen={setAssignOpen}
      previewSessionId={previewSessionId}
      setPreviewSessionId={setPreviewSessionId}
      copyWeekBusy={copyWeekBusy}
      setCopyWeekBusy={setCopyWeekBusy}
      copyWeekLockRef={copyWeekLockRef}
      headerMenuOpen={headerMenuOpen}
      setHeaderMenuOpen={setHeaderMenuOpen}
      editDetailsOpen={editDetailsOpen}
      setEditDetailsOpen={setEditDetailsOpen}
      settingsBusy={settingsBusy}
      setSettingsBusy={setSettingsBusy}
      selection={selection}
      selectionCount={selectionCount}
      showSelectionBar={showSelectionBar}
    />
  )
}
