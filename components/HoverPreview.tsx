"use client"

import { useState, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { scryfallImage } from "@/lib/scryfall"

type Anchor = { x: number; y: number; w: number; h: number }

/**
 * Desktop hover-to-enlarge for small cards. `hoverProps(uri)` is spread onto a
 * card's wrapper; after a short delay it pops a large, readable `png` preview
 * anchored beside the card. The preview never captures pointer events, so it
 * can't interfere with drag/click. Call `clearHover()` when a drag starts.
 */
export function useHoverPreview(opts?: { width?: number; delay?: number }) {
  const width = opts?.width ?? 244
  const height = Math.round((width * 88) / 63)
  const delay = opts?.delay ?? 280

  const [state, setState] = useState<{ uri: string; anchor: Anchor } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHover = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setState(null)
  }, [])

  const hoverProps = useCallback(
    (uri: string | null | undefined) => {
      if (!uri) return {}
      return {
        onMouseEnter: (e: React.MouseEvent) => {
          const r = e.currentTarget.getBoundingClientRect()
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(
            () => setState({ uri, anchor: { x: r.x, y: r.y, w: r.width, h: r.height } }),
            delay
          )
        },
        onMouseLeave: clearHover,
        // A drag (mousedown) should immediately drop any pending/visible preview.
        onMouseDownCapture: clearHover,
      }
    },
    [delay, clearHover]
  )

  let preview: React.ReactNode = null
  if (state && typeof document !== "undefined") {
    const pad = 12
    const vw = window.innerWidth
    const vh = window.innerHeight
    const { anchor } = state
    // Prefer to the right of the card; flip left if it would overflow.
    let left = anchor.x + anchor.w + 16
    if (left + width + pad > vw) left = anchor.x - width - 16
    if (left < pad) left = Math.max(pad, (vw - width) / 2)
    // Vertically center on the card, then clamp into the viewport.
    let top = anchor.y + anchor.h / 2 - height / 2
    if (top < pad) top = pad
    if (top + height + pad > vh) top = vh - height - pad

    preview = createPortal(
      <div style={{ position: "fixed", left, top, width, height, zIndex: 10001, pointerEvents: "none" }}>
        <img
          src={scryfallImage(state.uri, "png")}
          alt=""
          draggable={false}
          style={{ width: "100%", height: "100%", borderRadius: 12, boxShadow: "0 24px 64px rgba(0,0,0,0.9)" }}
        />
      </div>,
      document.body
    )
  }

  return { hoverProps, preview, clearHover }
}
