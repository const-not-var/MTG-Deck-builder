"use client"

import { useRef } from "react"

interface Props {
  src: string
  alt: string
  className?: string
  imgStyle?: React.CSSProperties
  imgClassName?: string
  foil?: boolean
}

export function HoloCard({ src, alt, className = "", imgStyle, imgClassName = "", foil = true }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const foilRef = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const wrap = wrapRef.current
    if (!wrap) return

    const rect = wrap.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top)  / rect.height

    const rx = (0.5 - y) * 12
    const ry = (x - 0.5) * 12
    wrap.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`

    if (!foil) return
    const foilEl = foilRef.current
    if (!foilEl) return

    const hue = Math.round((x + y) * 180)
    const px  = Math.round(x * 100)
    const py  = Math.round(y * 100)

    foilEl.style.opacity = "1"
    foilEl.style.backgroundImage = [
      `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 35%, transparent 65%)`,
      `linear-gradient(${hue}deg,
        hsla(${hue +   0}, 100%, 60%, 0.2),
        hsla(${hue +  60}, 100%, 60%, 0.2),
        hsla(${hue + 120}, 100%, 60%, 0.2),
        hsla(${hue + 180}, 100%, 60%, 0.2),
        hsla(${hue + 240}, 100%, 60%, 0.2),
        hsla(${hue + 300}, 100%, 60%, 0.2),
        hsla(${hue + 360}, 100%, 60%, 0.2)
      )`,
    ].join(",")
  }

  function onLeave() {
    const wrap = wrapRef.current
    if (wrap) wrap.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg)"
    const foilEl = foilRef.current
    if (foilEl) foilEl.style.opacity = "0"
  }

  const radius = (imgStyle?.borderRadius as string) ?? "5%"

  return (
    <div
      ref={wrapRef}
      className={`relative ${className}`}
      style={{ transition: "transform 0.25s ease", transformStyle: "preserve-3d" }}
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
            transition: "opacity 0.35s ease",
            mixBlendMode: "color-dodge",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  )
}
