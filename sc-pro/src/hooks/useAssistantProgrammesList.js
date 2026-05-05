import { useEffect } from 'react'
import { registerPageContext, unregisterPageContext } from '../lib/assistantContext.js'
import { getCurrentUser } from '../lib/auth.js'

export function useAssistantProgrammesList({ programmes }) {
  useEffect(() => {
    const user = getCurrentUser()
    registerPageContext('programmes', () => ({
      orgId: user.orgId,
      programmes: (programmes ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        sport: p.sport,
        phase_type: p.phase_type,
      })),
      availableActions: [],
    }))
    return () => unregisterPageContext('programmes')
  }, [programmes])
}
