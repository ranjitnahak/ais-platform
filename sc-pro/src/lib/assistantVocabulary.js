/**
 * Coaching / S&C Pro glossary for the assistant system prompt.
 * Append terms here as the platform grows — no other files need to change.
 */
export function getVocabulary() {
  return `
- SAQ: Speed, Agility, Quickness — a session category
- MAS Runs: Maximum Aerobic Speed conditioning sessions
- MAS: Maximum Aerobic Speed
- Phase I / Accumulation: early-season high volume block
- Intensification: mid-season block, reduced volume, higher intensity
- Realisation / Peaking: competition prep block
- AR Week: Active Recovery week — reduced load across all sessions
- ACWR: Acute:Chronic Workload Ratio — injury risk indicator
- 1RM: One Rep Maximum — maximum weight for a single repetition
- %1RM: Percentage of 1RM used to prescribe load
- RPE: Rate of Perceived Exertion — scale 1-10
- RIR: Reps in Reserve — how many reps left before failure
- VBT: Velocity Based Training
- Superset: Two exercises performed back to back
- EMOM: Every Minute on the Minute
- AMRAP: As Many Reps/Rounds as Possible
- Bilateral: Both limbs together (e.g. Back Squat)
- Unilateral: Single limb (e.g. Bulgarian Split Squat)
- Block A/B/C: Labelled exercise groups within a session
  `.trim()
}
