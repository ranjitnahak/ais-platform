import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
import { useUser } from '../context/UserContext'
export function useWellness() {
  const { activeOrgId } = useUser()
  const [formItems, setFormItems] = useState([])
  const [todayLog, setTodayLog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => { loadWellnessData() }, [activeOrgId])

  async function loadWellnessData() {
    try {
      const user = await getCurrentUser()
      if (!user || !activeOrgId) return
      const today = new Date().toISOString().split('T')[0]

      // Fetch form definition for this org
      const { data: items, error: itemsError } = await supabase
        .from('wellness_form_items')
        .select('id, key, label, label_translations, input_type, scale_min, scale_max, scale_min_label, scale_max_label, options, direction, sort_order, is_required')
        .eq('org_id', activeOrgId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (itemsError) throw itemsError

      // Check if already submitted today
      // Get athlete linked to this user
      const { data: athlete } = await supabase.from('athletes').select('id').eq('org_id', activeOrgId).eq('email', user.email).maybeSingle()
      const athleteId = athlete?.id ?? user.id

      const { data: existing } = await supabase
        .from('wellness_logs')
        .select('id, responses, composite_score, logged_at')
        .eq('org_id', activeOrgId).eq('athlete_id', athleteId).eq('log_date', today).maybeSingle()

      setFormItems(items ?? [])
      setTodayLog(existing ?? null)
      if (existing) setSubmitted(true)
    } catch (err) {
      console.error('[useWellness] loadWellnessData failed:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitWellness(responses) {
    try {
      setSubmitting(true)
      setError(null)
      const user = await getCurrentUser()
      if (!user || !activeOrgId) throw new Error('Not authenticated')
      const today = new Date().toISOString().split('T')[0]

      const { data: athlete } = await supabase.from('athletes').select('id').eq('org_id', activeOrgId).eq('email', user.email).maybeSingle()
      const athleteId = athlete?.id ?? user.id

      // Compute composite score
      // Average of numeric slider responses (exclude radio/body_map)
      const numericItems = formItems.filter(item => item.input_type === 'slider' || item.input_type === 'number')
      const numericValues = numericItems
        .map(item => {
          const val = responses[item.key]
          return item.direction === 'lower_better' ? (item.scale_max - val + item.scale_min) : val
        })
        .filter(v => v != null && !isNaN(v))

      const compositeScore = numericValues.length > 0
        ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
        : null

      const { error: upsertError } = await supabase
        .from('wellness_logs')
        .upsert({
          athlete_id: athleteId, org_id: activeOrgId, team_id: user.teamIds[0] ?? null,
          log_date: today, responses,
          composite_score: compositeScore ? Math.round(compositeScore * 100) / 100 : null,
        }, { onConflict: 'athlete_id,log_date' })
      if (upsertError) throw upsertError
      setSubmitted(true)
    } catch (err) {
      console.error('[useWellness] submitWellness failed:', err)
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return { formItems, todayLog, loading, submitting, error, submitted, submitWellness }
}
