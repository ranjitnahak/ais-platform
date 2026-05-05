/**
 * Convert a public YouTube or Vimeo URL to an iframe-safe embed URL.
 * (Name kept for callers: getYoutubeEmbedUrl.)
 */
export function getYoutubeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()

  const yt = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}`

  const vimeoPlayer = trimmed.match(/player\.vimeo\.com\/video\/(\d+)/)
  if (vimeoPlayer?.[1]) return `https://player.vimeo.com/video/${vimeoPlayer[1]}`

  const vimeoPath = trimmed.match(/vimeo\.com\/(?:.*\/)?(\d+)(?:\/|\?|#|$)/)
  if (vimeoPath?.[1]) return `https://player.vimeo.com/video/${vimeoPath[1]}`

  return null
}
