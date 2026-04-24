import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Debounced autosave (1.5s). Returns status + manual retry flag.
 * @param {() => Promise<void>} saveFn
 * @param {unknown[]} deps — when changed, schedules save
 */
export function useAutosave(saveFn, deps, enabled = true) {
  const [status, setStatus] = useState('idle')
  const [failed, setFailed] = useState(false)
  const [lastError, setLastError] = useState(null)
  const timer = useRef(null)
  const seq = useRef(0)

  const run = useCallback(async () => {
    const id = ++seq.current
    setStatus('saving')
    setFailed(false)
    setLastError(null)
    try {
      await saveFn()
      if (seq.current === id) {
        setLastError(null)
        setStatus('saved')
      }
    } catch (e) {
      console.error('[useAutosave]', e)
      const msg = e?.message ?? (typeof e === 'string' ? e : 'Save failed')
      if (seq.current === id) {
        setStatus('failed')
        setFailed(true)
        setLastError(msg)
      }
    }
  }, [saveFn])

  useEffect(() => {
    if (!enabled) {
      if (timer.current) clearTimeout(timer.current)
      return
    }
    if (timer.current) clearTimeout(timer.current)
    setStatus((s) => (s === 'saving' ? s : 'dirty'))
    timer.current = setTimeout(() => {
      void run()
    }, 1500)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps])

  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    await run()
  }, [run])

  return { status, failed, lastError, saveNow }
}
