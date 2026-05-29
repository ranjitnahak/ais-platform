import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'
import { useUser } from '../context/UserContext'
export function useRPELog() {
  const { user, activeOrgId } = useUser()
  // State
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  // Fetch today's sessions on mount
  const isSuperuser = user?.isSuperuser === true
  const effectiveOrgId = (isSuperuser && activeOrgId) ? activeOrgId : user?.orgId

  useEffect(() => { loadTodaySessions() }, [effectiveOrgId, user?.id, activeOrgId])

  async function loadTodaySessions() {
    try {
      const currentUser = user ?? await getCurrentUser()
      if (!currentUser || !effectiveOrgId) return
      let effectiveTeamIds = currentUser.teamIds ?? []
      if (currentUser.isSuperuser && activeOrgId) {
        const { data: orgTeams, error: teamsError } = await supabase
          .from('teams')
          .select('id')
          .eq('org_id', effectiveOrgId) // SUPERUSER: intentional cross-org query
        if (teamsError) throw teamsError
        effectiveTeamIds = orgTeams?.map((team) => team.id) ?? []
      }
      if (!effectiveTeamIds.length) {
        setSessions([])
        return
      }
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('sessions')
        .select('id, name, session_date, category, rpe_planned')
        .eq('org_id', effectiveOrgId) // SUPERUSER: uses activeOrgId
        .in('team_id', effectiveTeamIds)
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
      
      // Get athlete ID linked to this user
      const { data: athlete, error: athleteError } = await supabase
        .from('athletes')
        .select('id')
        .eq('org_id', effectiveOrgId)
        .eq('email', currentUser.email)  
        .maybeSingle()
      
      // If no athlete found, use user.id as fallback
      const athleteId = athlete?.id ?? currentUser.id
      
      const { error: upsertError } = await supabase
        .from('session_athlete_logs')
        .upsert({
          session_id: sessionId,
          athlete_id: athleteId,
          org_id: effectiveOrgId,
          team_id: effectiveTeamIds[0] ?? null,
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
