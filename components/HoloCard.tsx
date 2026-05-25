"use client"

import { useRef } from "react"

interface Props {
  src: string
  alt: string
  className?: string
  imgStyle?: React.CSSProperties
  imgClassName?: string
}

export function HoloCard({ src, alt, className = "", imgStyle, imgClassName = "" }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const foilRef = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const wrap = wrapRef.current
    const foil = foilRef.current
    if (!wrap || !foil) return

    const rect = wrap.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width   // 0..1
    const y = (e.clientY - rect.top)  / rect.height  // 0..1

    // 3-D tilt toward the cursor
    const rx = (0.5 - y) * 24
    const ry = (x - 0.5) * 24
    wrap.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`

    // Shift the hue so the rainbow rotates as you move
    const hue = Math.round((x + y) * 180)
    const px  = Math.round(x * 100)
    const py  = Math.round(y * 100)

    foil.style.opacity = "1"
    foil.style.backgroundImage = [
      // specular glare follows cursor
      `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.1) 30%, transparent 60%)`,
      // rotating rainbow bands
      `linear-gradient(${hue}deg,
        hsla(${hue +   0}, 100%, 60%, 0.5),
        hsla(${hue +  60}, 100%, 60%, 0.5),
        hsla(${hue + 120}, 100%, 60%, 0.5),
        hsla(${hue + 180}, 100%, 60%, 0.5),
        hsla(${hue + 240}, 100%, 60%, 0.5),
        hsla(${hue + 300}, 100%, 60%, 0.5),
        hsla(${hue + 360}, 100%, 60%, 0.5)
      )`,
    ].join(",")
  }

  function onLeave() {
    const wrap = wrapRef.current
    const foil = foilRef.current
    if (!wrap || !foil) return
    wrap.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg)"
    foil.style.opacity = "0"
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
      {/* foil overlay — color-dodge only lights up the bright parts of the card */}
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
    </div>
  )
}
