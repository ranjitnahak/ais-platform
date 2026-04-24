/** Convert watch/youtu.be URL to embed URL for iframes. */
export function getYoutubeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}
