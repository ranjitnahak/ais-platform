/** Title-case display strings — does not mutate stored values. */
export function toTitleCase(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .split(/[_\s]+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ');
}
