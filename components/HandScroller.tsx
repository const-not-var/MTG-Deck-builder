"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Click-and-hold horizontal scrolling for an overflowing hand. The arrows only
// appear when the hand is actually wider than its container, and holding one
// scrolls continuously until release. Kept separate from card-drag (which lives
// on the cards) so the two never conflict.
export function useHandScroll(itemCount: number) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [overflow, setOverflow] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 4)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [itemCount])

  const stop = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null }
  }, [])

  const start = useCallback((dir: -1 | 1) => {
    stop()
    const step = () => { if (ref.current) ref.current.scrollLeft += dir * 22 }
    step()
    timer.current = setInterval(step, 16)
  }, [stop])

  useEffect(() => stop, [stop])

  return { ref, overflow, start, stop }
}

export function HandScrollButtons({ overflow, start, stop }: {
  overflow: boolean
  start: (dir: -1 | 1) => void
  stop: () => void
}) {
  if (!overflow) return null
  const base = "absolute top-1/2 -translate-y-1/2 z-30 w-7 h-14 flex items-center justify-center rounded-lg text-zinc-200 select-none transition-colors"
  const style = { background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,255,255,0.15)" } as const
  return (
    <>
      <button aria-label="Scroll hand left" className={`${base} left-1`} style={style}
        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); start(-1) }}
        onMouseUp={stop} onMouseLeave={stop}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button aria-label="Scroll hand right" className={`${base} right-1`} style={style}
        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); start(1) }}
        onMouseUp={stop} onMouseLeave={stop}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </>
  )
}
