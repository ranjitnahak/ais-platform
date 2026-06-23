import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useCurrentUser } from '../lib/auth.js'
import { fetchPatterns, fetchRegions, fetchTags } from '../lib/exerciseCategoryUtils.js'

export function useExerciseCategories() {
  const { user, loading: userLoading } = useCurrentUser()
  const [regions, setRegions] = useState([])
  const [patterns, setPatterns] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.orgId) {
      if (!userLoading) setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [reg, pat, tg] = await Promise.all([
          fetchRegions(supabase, user.orgId),
          fetchPatterns(supabase, user.orgId),
          fetchTags(supabase, user.orgId),
        ])
        if (!cancelled) {
          setRegions(reg)
          setPatterns(pat)
          setTags(tg)
        }
      } catch (e) {
        console.error('[useExerciseCategories]', e)
        if (!cancelled) {
          const msg = [e?.message, e?.details, e?.hint].filter(Boolean).join(' — ') || 'Failed to load exercise categories'
          setError(msg)
          setRegions([])
          setPatterns([])
          setTags([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.orgId, userLoading])

  return { regions, patterns, tags, loading: loading || userLoading, error }
}
