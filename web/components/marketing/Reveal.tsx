'use client'
import { useEffect, useRef, type ReactNode } from 'react'

/** Fades and lifts its children in once, the first time they scroll into view. */
export default function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' | 'figure' }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.setAttribute('data-in', ''); io.disconnect() } }, { rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <Tag ref={ref as never} className={`reveal ${className}`} style={{ ['--reveal-delay' as string]: `${delay}ms` }}>{children}</Tag>
}
