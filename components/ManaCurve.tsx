"use client"

import { useMemo, useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { CardInDeck } from "@/types"

interface Props {
  cards: CardInDeck[]
}

export function ManaCurve({ cards }: Props) {
  const { data, max } = useMemo(() => {
    const buckets: number[] = Array(8).fill(0)
    for (const card of cards) {
      if (card.typeLine.includes("Land")) continue
      buckets[Math.min(Math.floor(card.cmc), 7)] += card.quantity
    }
    const d = buckets.map((count, i) => ({ cmc: i === 7 ? "7+" : String(i), count }))
    return { data: d, max: Math.max(...d.map((d) => d.count), 1) }
  }, [cards])

  // Only render the chart after mount, so Recharts never measures a 0-size
  // container during SSR/first paint (the source of its width(-1) warning).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="w-full h-28">
      {mounted && (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barCategoryGap="22%">
          <XAxis
            dataKey="cmc"
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            domain={[0, max]}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#111118",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#e4e4e7",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}
            formatter={(val) => [Number(val), "Cards"]}
            labelFormatter={(l) => `CMC ${l}`}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.count === max && entry.count > 0 ? "#f59e0b" : "rgba(255,255,255,0.1)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}
