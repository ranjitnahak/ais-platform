import { useEffect, useRef } from 'react'

/**
 * Refetch session blocks when edits land outside this screen — for example
 * Progression View (another tab/window) updating session_exercises while Session
 * Builder still holds an old blocks snapshot.
 */
export function useSessionBuilderRemoteRefresh(programmeId, reload) {
  const pidRef = useRef(programmeId)
  pidRef.current = programmeId

  useEffect(() => {
    let t
    const debouncedVis = () => {
      clearTimeout(t)
      t = setTimeout(() => void reload(), 120)
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') debouncedVis()
    }
    const onPageShow = (e) => {
      if (e.persisted) debouncedVis()
    }
    const onRemoteExerciseEdit = (e) => {
      const pid = e.detail?.programmeId
      if (pid && pid === pidRef.current) void reload()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('sc-pro-session-exercises-updated', onRemoteExerciseEdit)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('sc-pro-session-exercises-updated', onRemoteExerciseEdit)
    }
  }, [reload])
}
