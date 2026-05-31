"use client"

import { useRef, useCallback } from "react"

interface Props {
  src: string
  alt: string
  className?: string
  imgStyle?: React.CSSProperties
  imgClassName?: string
  foil?: boolean
}

export function HoloCard({ src, alt, className = "", imgStyle, imgClassName = "", foil = true }: Props) {
  const wrapRef  = useRef<HTMLDivElement>(null)
  const foilRef  = useRef<HTMLDivElement>(null)
  const rafRef   = useRef<number | null>(null)

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    const cx = e.clientX, cy = e.clientY
    rafRef.current = requestAnimationFrame(() => {
      const wrap = wrapRef.current
      if (!wrap) return
      const rect = wrap.getBoundingClientRect()
      const x = (cx - rect.left)  / rect.width
      const y = (cy - rect.top)   / rect.height
      const rx = (0.5 - y) * 14
      const ry = (x - 0.5) * 14
      wrap.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`

      if (!foil) return
      const foilEl = foilRef.current
      if (!foilEl) return
      const hue = Math.round((x + y) * 180)
      const px  = Math.round(x * 100)
      const py  = Math.round(y * 100)
      foilEl.style.opacity = "1"
      foilEl.style.backgroundImage = [
        `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 38%, transparent 68%)`,
        `linear-gradient(${hue}deg,
          hsla(${hue +   0},100%,65%,0.18),
          hsla(${hue +  51},100%,65%,0.18),
          hsla(${hue + 102},100%,65%,0.18),
          hsla(${hue + 153},100%,65%,0.18),
          hsla(${hue + 204},100%,65%,0.18),
          hsla(${hue + 255},100%,65%,0.18),
          hsla(${hue + 306},100%,65%,0.18)
        )`,
      ].join(",")
    })
  }, [foil])

  const onLeave = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    const wrap = wrapRef.current
    if (wrap) wrap.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg)"
    const foilEl = foilRef.current
    if (foilEl) foilEl.style.opacity = "0"
  }, [])

  const radius = (imgStyle?.borderRadius as string) ?? "5%"

  return (
    <div
      ref={wrapRef}
      className={`relative ${className}`}
      style={{ transition: "transform 0.2s ease", transformStyle: "preserve-3d" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <img
        src={src}
        alt={alt}
        className={`block w-full h-full object-contain ${imgClassName}`}
        style={imgStyle}
      />
      {foil && (
        <div
          ref={foilRef}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            opacity: 0,
            transition: "opacity 0.3s ease",
            mixBlendMode: "color-dodge",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  )
}
