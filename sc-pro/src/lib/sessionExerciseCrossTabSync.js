/** Same-window events + BroadcastChannel so Session Builder updates when Progression saves (incl. other tabs). */

export function emitSessionExerciseSaved({ programmeId, sessionId, sessionExerciseId, patch }) {
  window.dispatchEvent(
    new CustomEvent('sc-pro-session-exercise-patch', {
      detail: { programmeId, sessionId, sessionExerciseId, patch },
    }),
  )
  window.dispatchEvent(new CustomEvent('sc-pro-session-exercises-updated', { detail: { programmeId } }))
  try {
    const bc = new BroadcastChannel('sc-pro-session-sync')
    bc.postMessage({
      type: 'session-exercise-remote-change',
      programmeId,
      sessionId,
      sessionExerciseId,
      patch,
    })
    bc.close()
  } catch {
    /* no BroadcastChannel */
  }
}
