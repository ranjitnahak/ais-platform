/** Map React Router pathname → assistant registry key (no per-page logic in AssistantPanel). */
export function assistantPageKeyFromPath(pathname) {
  const p = pathname || ''
  if (p === '/programmes' || p === '/programmes/') return 'programmes'
  if (p.startsWith('/athletes')) return 'athletes'
  if (/^\/programmes\/[^/]+\/sessions\//.test(p)) return 'session_builder'
  if (/^\/programmes\//.test(p)) return 'programme_detail'
  if (p.startsWith('/exercise-library')) return 'exercise_library'
  if (p.startsWith('/analytics')) return 'analytics'
  if (p === '/' || p.startsWith('/home')) return 'home'
  return 'home'
}

export function assistantPageLabel(pageKey) {
  const labels = {
    home: 'Home',
    programmes: 'Programmes',
    programme_detail: 'Programme detail',
    session_builder: 'Session builder',
    athletes: 'Athletes',
    exercise_library: 'Exercise library',
    analytics: 'Analytics',
  }
  return labels[pageKey] ?? pageKey
}
