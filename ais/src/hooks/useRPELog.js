import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
export function useRPELog() {
  // State
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  // Fetch today's sessions on mount
  useEffect(() => { loadTodaySessions() }, [])

  async function loadTodaySessions() {
    try {
      const user = await getCurrentUser()
      if (!user) return
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('sessions')
        .select('id, name, session_date, planned_rpe, category')
        .eq('org_id', user.orgId)
        .in('team_id', user.teamIds)
        .eq('session_date', today)
        .order('session_date', { ascending: true })
      if (error) throw error
      setSessions(data ?? [])
    } catch (err) {
      console.error('[useRPELog] loadTodaySessions failed:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitRPELog({ sessionId, actualRpe, actualDurationMin, notes }) {
    try {
      setSubmitting(true)
      setError(null)
      const user = await getCurrentUser()
      if (!user) throw new Error('Not authenticated')
      
      // Get athlete ID linked to this user
      const { data: athlete, error: athleteError } = await supabase
        .from('athletes')
        .select('id')
        .eq('org_id', user.orgId)
        .eq('email', user.email)  
        .single()
      
      // If no athlete found, use user.id as fallback
      const athleteId = athlete?.id ?? user.id
      
      const { error: upsertError } = await supabase
        .from('session_athlete_logs')
        .upsert({
          session_id: sessionId,
          athlete_id: athleteId,
          org_id: user.orgId,
          team_id: user.teamIds[0] ?? null,
          actual_rpe: actualRpe,
          actual_duration_min: actualDurationMin,
          notes: notes ?? null,
        }, {
          onConflict: 'session_id,athlete_id'
        })
      if (upsertError) throw upsertError
      setSubmitted(true)
    } catch (err) {
      console.error('[useRPELog] submitRPELog failed:', err)
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return { sessions, loading, submitting, error, submitted, submitRPELog }
}
