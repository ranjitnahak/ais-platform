import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'

const ROLE_DOMAINS = {
  'S&C Coach': 's_and_c',
  Physio: 'physio',
  Analyst: 'analysis',
  Nutritionist: 'nutrition',
  'Head Coach': 'coaching',
}

export function getStaffDomain(role) {
  if (role === 'Admin' || role === 'Superuser') return null
  return ROLE_DOMAINS[role] ?? null
}

export function useStaffNotes({ teamId, athleteId = null }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [userDomain, setUserDomain] = useState(null)

  useEffect(() => { loadNotes() }, [teamId, athleteId])

  async function loadNotes() {
    try {
      setLoading(true)
      setError(null)
      const user = await getCurrentUser()
      if (!user || (!teamId && !athleteId)) {
        setNotes([])
        return
      }
      const domain = getStaffDomain(user.role)
      setUserDomain(domain)
      let query = supabase
        .from('athlete_staff_notes')
        .select('id, note, domain, note_level, note_date, created_at, author_id, users(full_name)')
        .eq('org_id', user.orgId)
        .order('created_at', { ascending: false })
      if (athleteId) {
        query = query.eq('athlete_id', athleteId)
        if (domain) query = query.eq('domain', domain)
      } else {
        query = query.eq('team_id', teamId).eq('note_level', 'team')
      }
      const { data, error: notesError } = await query
      if (notesError) throw notesError
      setNotes(data ?? [])
    } catch (err) {
      console.error('[useStaffNotes] loadNotes failed:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitNote({ note, domain }) {
    try {
      setSubmitting(true)
      setError(null)
      const user = await getCurrentUser()
      if (!user) throw new Error('Not authenticated')
      if (!teamId) throw new Error('Select a team first')
      const allowedDomain = getStaffDomain(user.role)
      const noteDomain = allowedDomain ?? domain
      if (!noteDomain) throw new Error('Select a domain')
      const today = new Date().toISOString().split('T')[0]
      const { error: insertError } = await supabase.from('athlete_staff_notes').insert({
        athlete_id: athleteId ?? null,
        team_id: teamId,
        org_id: user.orgId,
        author_id: user.id,
        domain: noteDomain,
        note,
        note_level: athleteId ? 'athlete' : 'team',
        note_date: today,
      })
      if (insertError) throw insertError
      await loadNotes()
    } catch (err) {
      console.error('[useStaffNotes] submitNote failed:', err)
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return { notes, loading, submitting, error, submitNote, userDomain }
}
