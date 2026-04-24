import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

export function useSessionBuilderCrumb(session, orgId) {
  const [crumb, setCrumb] = useState({ programmeName: '', weekN: '', dayLabel: '' })

  useEffect(() => {
    if (!session?.programme_week_id) return
    let cancel = false
    ;(async () => {
      try {
        const { data: w, error: e1 } = await supabase
          .from('programme_weeks')
          .select('week_number, programme_id, programmes(name)')
          .eq('id', session.programme_week_id)
          .eq('org_id', orgId)
          .maybeSingle()
        if (e1) throw e1
        if (!w || cancel) return
        const prog = w.programmes
        const progName = Array.isArray(prog) ? prog[0]?.name : prog?.name
        const d = session.session_date ? new Date(`${session.session_date}T12:00:00`) : new Date()
        setCrumb({
          programmeName: progName || 'Programme',
          weekN: w.week_number,
          dayLabel: d.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }),
        })
      } catch (e) {
        console.error('[SessionBuilder] breadcrumb', e)
      }
    })()
    return () => {
      cancel = true
    }
  }, [session?.id, session?.programme_week_id, session?.session_date, orgId])

  return crumb
}
