export function filterReportContext(context, user) {
  if (!context) return null
  const filtered = { ...context }

  // Injury filtering placeholder for injury_surveillance once that section exists.
  // filtered.injury = canSync(user, 'injury_surveillance', 'view') ? context.injury : null

  if (context.staffNotes) {
    const isAdminLevel = ['Admin', 'Superuser', 'Head Coach'].includes(user?.role)
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
    'S&C Coach': 's_and_c',
    Physio: 'physio',
    Analyst: 'analysis',
    Nutritionist: 'nutrition',
    'Head Coach': 'coaching',
  }
  return map[roleName] ?? null
}
