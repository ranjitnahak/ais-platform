import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getCurrentUser } from '../../lib/auth'

const WIDTH = 120
const HEIGHT = 40

export default function WellnessTrend({ athleteId }) {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    async function loadTrend() {
      try {
        const user = await getCurrentUser()
        if (!user || !athleteId) return
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
        const { data, error } = await supabase
          .from('wellness_logs')
          .select('log_date, composite_score')
          .eq('org_id', user.orgId)
          .eq('athlete_id', athleteId)
          .gte('log_date', sevenDaysAgo.toISOString().split('T')[0])
          .order('log_date', { ascending: true })
        if (error) throw error
        setLogs(data ?? [])
      } catch (err) {
        console.error('[WellnessTrend] loadTrend failed:', err)
      }
    }
    loadTrend()
  }, [athleteId])

  const { dots, segments, color } = useMemo(() => {
    const byDate = new Map(logs.map((log) => [log.log_date, Number(log.composite_score)]))
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      return date.toISOString().split('T')[0]
    })
    const points = days.map((day, index) => {
      const score = byDate.get(day)
      if (score == null || Number.isNaN(score)) return null
      return { x: index * (WIDTH / 6), y: HEIGHT - ((score - 1) / 4) * HEIGHT, score }
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
    return { dots: points.filter(Boolean), segments: lines, color: stroke }
  }, [logs])

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="7-day wellness trend">
      {segments.map((segment, index) => (
        <polyline key={index} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={segment.map((point) => `${point.x},${point.y}`).join(' ')} />
      ))}
      {dots.map((point) => (
        <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3" fill={color} />
      ))}
    </svg>
  )
}
