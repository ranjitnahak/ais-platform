export function filterReportContext(context, user) {
  if (!context) return null
  const filtered = { ...context }

  // Injury filtering placeholder for injury_surveillance once that section exists.
  // filtered.injury = canSync(user, 'injury_surveillance', 'view') ? context.injury : null

  if (context.staffNotes) {
    const isAdminLevel = ['admin', 'superuser', 'head coach'].includes(user?.role)
    if (isAdminLevel) {
      filtered.staffNotes = context.staffNotes
    } else {
      const userDomain = getRoleDomain(user?.role)
      filtered.staffNotes = userDomain && context.staffNotes[userDomain]
        ? { [userDomain]: context.staffNotes[userDomain] }
        : null
    }
  }

  return filtered
}

function getRoleDomain(roleName) {
  const map = {
    's&c coach': 's_and_c',
    physio: 'physio',
    analyst: 'analysis',
    nutritionist: 'nutrition',
    'head coach': 'coaching',
  }
  return map[roleName] ?? null
}
