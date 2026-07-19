import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getCurrentUser } from '../../lib/auth'
import { useUser } from '../../context/UserContext'
import { addDays, toISODate } from '../../lib/periodisationUtils'

const WIDTH = 120
const HEIGHT = 40

function defaultSevenDayWindow() {
  const dateTo = toISODate(new Date())
  return { dateFrom: addDays(dateTo, -6), dateTo }
}

function daysInRange(dateFrom, dateTo) {
  const days = []
  let cursor = dateFrom
  while (cursor <= dateTo) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days.length ? days : [dateTo]
}

export default function WellnessTrend({ athleteId, dateFrom, dateTo }) {
  const { activeOrgId } = useUser()
  const [logs, setLogs] = useState([])
  const window = useMemo(() => {
    if (dateFrom && dateTo) return { dateFrom, dateTo }
    return defaultSevenDayWindow()
  }, [dateFrom, dateTo])

  useEffect(() => {
    async function loadTrend() {
      try {
        const user = await getCurrentUser()
        if (!user || !athleteId) return
        const orgId = activeOrgId ?? user.orgId
        if (!orgId) return
        const { data, error } = await supabase
          .from('wellness_logs')
          .select('log_date, composite_score')
          .eq('org_id', orgId)
          .eq('athlete_id', athleteId)
          .gte('log_date', window.dateFrom)
          .lte('log_date', window.dateTo)
          .order('log_date', { ascending: true })
        if (error) throw error
        setLogs(data ?? [])
      } catch (err) {
        console.error('[WellnessTrend] loadTrend failed:', err)
      }
    }
    loadTrend()
  }, [athleteId, activeOrgId, window.dateFrom, window.dateTo])

  const { dots, segments, color, dayCount } = useMemo(() => {
    const byDate = new Map(logs.map((log) => [log.log_date, Number(log.composite_score)]))
    const days = daysInRange(window.dateFrom, window.dateTo)
    const span = Math.max(days.length - 1, 1)
    const points = days.map((day, index) => {
      const score = byDate.get(day)
      if (score == null || Number.isNaN(score)) return null
      return { x: index * (WIDTH / span), y: HEIGHT - ((score - 1) / 4) * HEIGHT, score }
    })
    const latest = [...points].reverse().find(Boolean)?.score ?? 0
    const stroke = latest >= 4 ? 'var(--color-tertiary)' : latest >= 3 ? 'var(--color-primary)' : 'var(--color-error)'
    const lines = []
    let current = []
    points.forEach((point) => {
      if (point) current.push(point)
      if (!point && current.length) {
        if (current.length > 1) lines.push(current)
        current = []
      }
    })
    if (current.length > 1) lines.push(current)
    return { dots: points.filter(Boolean), segments: lines, color: stroke, dayCount: days.length }
  }, [logs, window.dateFrom, window.dateTo])

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${dayCount}-day wellness trend`}>
      {segments.map((segment, index) => (
        <polyline key={index} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={segment.map((point) => `${point.x},${point.y}`).join(' ')} />
      ))}
      {dots.map((point) => (
        <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3" fill={color} />
      ))}
    </svg>
  )
}
