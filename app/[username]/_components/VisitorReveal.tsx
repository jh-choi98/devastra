'use client'
import { useEffect, useState } from 'react'

export function VisitorReveal({ username }: { username: string }): JSX.Element | null {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const key = `visitor_reveal_${username}`
    if (!sessionStorage.getItem(key)) {
      setShow(true)
      sessionStorage.setItem(key, '1')
      const t = setTimeout(() => setShow(false), 4000)
      return () => clearTimeout(t)
    }
  }, [username])

  if (!show) return null

  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(11,16,32,0.92) 0%, rgba(2,6,23,0.6) 100%)',
        animation: 'visitor-reveal-fade 4s ease-in-out forwards',
      }}
    >
      <style>{`
        @keyframes visitor-reveal-fade {
          0% { opacity: 1; }
          65% { opacity: 0.3; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
