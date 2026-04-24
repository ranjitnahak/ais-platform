import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePrescriptionPills } from '../hooks/usePrescriptionPills.js'
import {
  availableAddOptions,
  derivePills,
  filterAddMenuRespectingIntensityCap,
  prescriptionTableColumnCount,
  TABLE_INTENSITY_PILL_KEYS,
} from '../lib/prescriptionPillLogic.js'
import ExercisePill from './ExercisePill.jsx'
import SetsRepsTable from './SetsRepsTable.jsx'

const addBtn = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: '2px dashed var(--color-text-muted)',
  color: 'var(--color-text-muted)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  padding: 0,
  flexShrink: 0,
}

function AddPrescriptionMenu({ options, menuOpen, menuPos, menuPanelRef, onPick }) {
  if (!menuOpen || !menuPos) return null

  const panel = (
    <div
      ref={menuPanelRef}
      style={{
        position: 'fixed',
        top: menuPos.top,
        right: menuPos.viewportW - menuPos.right,
        minWidth: 220,
        maxHeight: 'min(420px, 70vh)',
        overflowY: 'auto',
        background: 'var(--color-surface-highest)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        zIndex: 4000,
        boxShadow: '0 8px 24px color-mix(in srgb, var(--color-bg) 40%, transparent)',
      }}
    >
      {Object.entries(options)
        .filter(([, items]) => items.length > 0)
        .map(([group, items]) => (
          <div key={group}>
            <div
              className="sc-label-caps"
              style={{
                fontSize: 'var(--font-size-label)',
                letterSpacing: 'var(--letter-spacing-label)',
                color: 'var(--color-text-muted)',
                padding: '8px 14px 4px',
              }}
            >
              {group}
            </div>
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                className="sc-body"
                onClick={() => void onPick(it.key)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text)',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-body)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-primary-soft)'
                  e.currentTarget.style.color = 'var(--color-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--color-text)'
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
        ))}
    </div>
  )

  return createPortal(panel, document.body)
}

const INTENSITY_CAP_MESSAGE =
  'You can add up to three intensity markers on one exercise (for example weight, RPE, or distance). To use a different marker, remove one first using the × in its column header.'

export default function PrescriptionPillRow({ exercise, orgId, canEdit, onReload }) {
  const [editingKey, setEditingKey] = useState(null)
  const [tableFocusKey, setTableFocusKey] = useState(null)
  const [menuPos, setMenuPos] = useState(null)
  const [capNotice, setCapNotice] = useState('')
  const addButtonRef = useRef(null)
  const menuPanelRef = useRef(null)

  const onIntensityLimitReached = useCallback(() => {
    setCapNotice(INTENSITY_CAP_MESSAGE)
  }, [])

  const { menuOpen, setMenuOpen, postAddEditKey, clearPostAddEdit, addDimension, removeDimension, savePill } = usePrescriptionPills({
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

  const updateMenuPos = useCallback(() => {
    const el = addButtonRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenuPos({
      top: r.bottom + 6,
      right: r.right,
      viewportW: typeof window !== 'undefined' ? window.innerWidth : 0,
    })
  }, [])

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null)
      return
    }
    updateMenuPos()
    const onScrollOrResize = () => updateMenuPos()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [menuOpen, updateMenuPos])

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => {
      const t = e.target
      if (addButtonRef.current?.contains(t)) return
      if (menuPanelRef.current?.contains(t)) return
      setMenuOpen(false)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [menuOpen, setMenuOpen])

  const pills = useMemo(() => derivePills(exercise), [exercise])
  const intensityColumnCount = useMemo(() => prescriptionTableColumnCount(exercise), [exercise])
  const addOptionsFlat = useMemo(() => availableAddOptions(exercise), [exercise])
  const menuItemsFlat = useMemo(
    () => filterAddMenuRespectingIntensityCap(addOptionsFlat, intensityColumnCount),
    [addOptionsFlat, intensityColumnCount],
  )
  const showHeaderPlus = menuItemsFlat.length > 0
  const options = useMemo(() => {
    const groups = {}
    for (const o of menuItemsFlat) {
      if (!groups[o.group]) groups[o.group] = []
      groups[o.group].push(o)
    }
    return groups
  }, [menuItemsFlat])

  useEffect(() => {
    if (!showHeaderPlus) setMenuOpen(false)
  }, [showHeaderPlus, setMenuOpen])

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

  const onSaveIntensity = useCallback(
    async (pillKey, raw) => {
      await savePill(pillKey, raw)
    },
    [savePill],
  )

  const onFocusConsumed = useCallback(() => setTableFocusKey(null), [])

  const onPickMenu = useCallback(
    async (key) => {
      await addDimension(key)
    },
    [addDimension],
  )

  if (!canEdit || !exercise) {
    return null
  }

  const headerAddSlot = showHeaderPlus ? (
    <div style={{ display: 'inline-flex' }}>
      <button
        ref={addButtonRef}
        type="button"
        aria-label="Add intensity or prescription"
        aria-expanded={menuOpen}
        style={addBtn}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-primary)'
          e.currentTarget.style.color = 'var(--color-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-text-muted)'
          e.currentTarget.style.color = 'var(--color-text-muted)'
        }}
        onClick={() => setMenuOpen((o) => !o)}
      >
        +
      </button>
    </div>
  ) : null

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
      <AddPrescriptionMenu
        options={options}
        menuOpen={menuOpen}
        menuPos={menuPos}
        menuPanelRef={menuPanelRef}
        onPick={onPickMenu}
      />
      <SetsRepsTable
        exercise={exercise}
        orgId={orgId}
        canEdit={canEdit}
        onReload={onReload}
        headerAddSlot={headerAddSlot}
        onSaveIntensity={onSaveIntensity}
        onRemoveIntensity={(pillKey) => void removeDimension(pillKey)}
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
