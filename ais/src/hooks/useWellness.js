import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
import { resolveAthleteId } from '../lib/resolveAthleteId'
import { loadWellnessFormItems } from '../lib/loadWellnessFormItems'
import { useUser } from '../context/UserContext'
export function useWellness() {
  const { user, activeOrgId } = useUser()
  const isSuperuser = user?.isSuperuser === true
  const effectiveOrgId = (isSuperuser && activeOrgId) ? activeOrgId : user?.orgId
  const [formItems, setFormItems] = useState([])
  const [todayLog, setTodayLog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => { loadWellnessData() }, [effectiveOrgId, user?.id, activeOrgId])

  async function loadWellnessData() {
    try {
      const currentUser = user ?? await getCurrentUser()
      if (!currentUser || !effectiveOrgId) return
      const today = new Date().toISOString().split('T')[0]

      const items = await loadWellnessFormItems(supabase, effectiveOrgId)

      // Check if already submitted today
      const athleteId = await resolveAthleteId(currentUser, effectiveOrgId)
      if (!athleteId) {
        setFormItems(items ?? [])
        setTodayLog(null)
        setError('No athlete profile linked to this account.')
        return
      }

      const { data: existing } = await supabase
        .from('wellness_logs')
        .select('id, responses, composite_score, logged_at')
        .eq('org_id', effectiveOrgId).eq('athlete_id', athleteId).eq('log_date', today).maybeSingle()

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
      const currentUser = user ?? await getCurrentUser()
      if (!currentUser || !effectiveOrgId) throw new Error('Not authenticated')
      let effectiveTeamIds = currentUser.teamIds ?? []
      if (currentUser.isSuperuser && activeOrgId) {
        const { data: orgTeams, error: teamsError } = await supabase
          .from('teams')
          .select('id')
          .eq('org_id', effectiveOrgId) // SUPERUSER: intentional cross-org query
        if (teamsError) throw teamsError
        effectiveTeamIds = orgTeams?.map((team) => team.id) ?? []
      }
      const today = new Date().toISOString().split('T')[0]

      const athleteId = await resolveAthleteId(currentUser, effectiveOrgId)
      if (!athleteId) throw new Error('No athlete profile linked to this account.')

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
          athlete_id: athleteId, org_id: effectiveOrgId, team_id: effectiveTeamIds[0] ?? null,
          log_date: today, responses,
          composite_score: compositeScore != null ? Math.round(compositeScore * 100) / 100 : null,
        }, { onConflict: 'athlete_id,log_date' })
      if (upsertError) throw upsertError

      const { data: savedLog } = await supabase
        .from('wellness_logs')
        .select('id, responses, composite_score, logged_at')
        .eq('org_id', effectiveOrgId)
        .eq('athlete_id', athleteId)
        .eq('log_date', today)
        .maybeSingle()
      setTodayLog(savedLog ?? null)
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
