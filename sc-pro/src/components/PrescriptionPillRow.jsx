import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePrescriptionPills } from '../hooks/usePrescriptionPills.js'
import { derivePills, TABLE_INTENSITY_PILL_KEYS } from '../lib/prescriptionPillLogic.js'
import ExercisePill from './ExercisePill.jsx'
import SetsRepsTable from './SetsRepsTable.jsx'

const INTENSITY_CAP_MESSAGE =
  'You can add up to three intensity markers on one exercise (for example weight, RPE, or distance). To use a different marker, remove one first using the × in its column header.'

export default function PrescriptionPillRow({ exercise, orgId, canEdit, onReload }) {
  const [editingKey, setEditingKey] = useState(null)
  const [tableFocusKey, setTableFocusKey] = useState(null)
  const [capNotice, setCapNotice] = useState('')

  const onIntensityLimitReached = useCallback(() => {
    setCapNotice(INTENSITY_CAP_MESSAGE)
  }, [])

  const { postAddEditKey, clearPostAddEdit, addDimension, removeDimension, savePill } = usePrescriptionPills({
    exercise,
    orgId,
    canEdit,
    onReload,
    onIntensityLimitReached,
  })

  useEffect(() => {
    if (!postAddEditKey) return
    if (TABLE_INTENSITY_PILL_KEYS.has(postAddEditKey)) {
      setTableFocusKey(postAddEditKey)
    } else {
      setEditingKey(postAddEditKey)
    }
    clearPostAddEdit()
  }, [postAddEditKey, clearPostAddEdit])

  useEffect(() => {
    if (!capNotice) return
    const t = window.setTimeout(() => setCapNotice(''), 9000)
    return () => window.clearTimeout(t)
  }, [capNotice])

  useEffect(() => {
    setCapNotice('')
  }, [exercise?.id])

  const onSave = useCallback(
    async (key, raw) => {
      setEditingKey(null)
      await savePill(key, raw)
    },
    [savePill],
  )

  const onFocusConsumed = useCallback(() => setTableFocusKey(null), [])

  const onColumnMenuAdd = useCallback(async (menuKey) => {
    await addDimension(menuKey)
  }, [addDimension])

  const onIntensityBlocked = useCallback(() => {
    setCapNotice(INTENSITY_CAP_MESSAGE)
  }, [])

  const pills = useMemo(() => derivePills(exercise), [exercise])

  if (!canEdit || !exercise) {
    return null
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 8,
        marginTop: 6,
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <SetsRepsTable
        exercise={exercise}
        orgId={orgId}
        canEdit={canEdit}
        onReload={onReload}
        onColumnMenuAdd={onColumnMenuAdd}
        onIntensityBlocked={onIntensityBlocked}
        focusPillKey={tableFocusKey}
        onFocusConsumed={onFocusConsumed}
      />
      {capNotice ? (
        <p className="sc-body-sm" role="status" style={{ margin: 0, color: 'var(--color-primary)', lineHeight: 1.45 }}>
          {capNotice}
        </p>
      ) : null}
      {pills.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {pills.map((p) => (
            <ExercisePill
              key={p.key}
              pillKey={p.key}
              label={p.label}
              variant={p.variant}
              removable={p.removable}
              editing={editingKey === p.key}
              onBeginEdit={() => setEditingKey(p.key)}
              onSave={(raw) => void onSave(p.key, raw)}
              onCancel={() => setEditingKey(null)}
              onRemove={p.removable ? () => void removeDimension(p.key) : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
