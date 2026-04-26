import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { getCurrentUser } from '../lib/auth.js'
import { fetchPatterns, fetchRegions, fetchTags } from '../lib/exerciseCategoryUtils.js'

export function useExerciseCategories() {
  const user = getCurrentUser()
  const [regions, setRegions] = useState([])
  const [patterns, setPatterns] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
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
  }, [user.orgId])

  return { regions, patterns, tags, loading, error }
}
