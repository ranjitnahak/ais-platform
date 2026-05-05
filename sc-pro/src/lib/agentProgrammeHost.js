/**
 * Runtime bridge: Programme detail page sets host context so the floating assistant
 * can build sessions/blocks/exercises against the open programme.
 */

let host = null

/** @param {object | null} h */
export function setProgrammeAgentHost(h) {
  host = h
}

export function getProgrammeAgentHost() {
  return host
}
