import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  ))

  useEffect(() => {
    function sync() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  return isMobile
}
