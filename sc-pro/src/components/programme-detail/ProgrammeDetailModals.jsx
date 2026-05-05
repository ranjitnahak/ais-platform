import { supabase } from '../../lib/supabaseClient.js'
import AssignProgrammeModal from '../AssignProgrammeModal.jsx'
import { deepCopyWeek } from '../../lib/programmeWeeklyCopy.js'
import { SESSION_CATS } from '../../lib/programmeSessionUi.js'
import CreateSessionModal from './CreateSessionModal.jsx'
import CopyWeekModal from './CopyWeekModal.jsx'
import EditProgrammeDetailsModal from '../programmes/EditProgrammeDetailsModal.jsx'

export default function ProgrammeDetailModals({
  v,
  programme,
  programmeId: id,
  assignOpen,
  setAssignOpen,
  copyWeekBusy,
  setCopyWeekBusy,
  copyWeekLockRef,
  editDetailsOpen,
  setEditDetailsOpen,
  settingsBusy,
  setSettingsBusy,
}) {
  return (
    <>
      {v.createOpen && (
        <CreateSessionModal
          initial={v.createOpen}
          categories={SESSION_CATS}
          onClose={() => v.setCreateOpen(null)}
          onSave={v.createSession}
        />
      )}
      {assignOpen && (
        <AssignProgrammeModal
          programmeId={id}
          orgId={v.user.orgId}
          onClose={() => setAssignOpen(false)}
          onError={(msg) => v.setToast(msg)}
          onSuccess={(msg) => {
            v.setToast(msg)
            setAssignOpen(false)
            void v.load()
          }}
        />
      )}
      {v.copyOpen && (
        <CopyWeekModal
          emptyWeeks={v.emptyWeekTargets}
          busy={copyWeekBusy}
          onClose={() => {
            if (!copyWeekBusy) v.setCopyOpen(false)
          }}
          onConfirm={async (targetWeekId) => {
            if (copyWeekLockRef.current) return
            copyWeekLockRef.current = true
            setCopyWeekBusy(true)
            try {
              await deepCopyWeek({
                supabase,
                user: v.user,
                programme,
                sourceWeekId: v.weekId,
                targetWeekId,
                weeks: v.weeks,
              })
              v.setCopyOpen(false)
              v.setToast('Week copied successfully')
              v.setWeekId(targetWeekId)
            } catch (e) {
              console.error('[ProgrammeDetail] copy', e)
              v.setToast(e.message ?? 'Copy failed')
            } finally {
              copyWeekLockRef.current = false
              setCopyWeekBusy(false)
            }
          }}
        />
      )}
      {editDetailsOpen ? (
        <EditProgrammeDetailsModal
          programme={programme}
          busy={settingsBusy}
          onClose={() => !settingsBusy && setEditDetailsOpen(false)}
          onSave={async (payload) => {
            setSettingsBusy(true)
            try {
              await v.updateProgrammeDetails(payload)
              setEditDetailsOpen(false)
            } finally {
              setSettingsBusy(false)
            }
          }}
        />
      ) : null}
    </>
  )
}
