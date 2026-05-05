export const SESSION_DEFAULT_CUES = {
  strength: `• Prioritise movement quality over load ,technique 
  first, weight second
- Rest fully between sets - do not cut rest periods short
- Log your actual weights so we can track progress week 
  to week
- Warm up the specific movement pattern before working sets`,

  speed: `• Full recovery between reps — quality over quantity
- Focus on acceleration mechanics in the first 10m
- Do not train speed when fatigued - reschedule if needed
- Note any tightness or discomfort in hip flexors or 
  hamstrings before starting`,

  conditioning: `• Maintain the prescribed pace - do not go out too hard
- Hydrate before, during, and after this session
- Cool down with 5 min easy movement after the main work`,
}

export const DEFAULT_CUES_FALLBACK = `• Warm up thoroughly before 
  beginning - prepare the body for the specific demands 
  of this session
- Execute each exercise with intent - quality of movement 
  is non-negotiable
- If something feels wrong - pain, sharp discomfort, or 
  unusual fatigue - stop and inform the appropriate person in charge
- Cool down and mobilise after the session - recovery 
  starts here`

export function getDefaultCues(category) {
  if (!category) return DEFAULT_CUES_FALLBACK
  const key = category.toLowerCase().trim()
  return SESSION_DEFAULT_CUES[key] ?? DEFAULT_CUES_FALLBACK
}
