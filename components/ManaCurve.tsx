"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { CardInDeck } from "@/types"

interface Props {
  cards: CardInDeck[]
}

export function ManaCurve({ cards }: Props) {
  const buckets: Record<number, number> = {}
  for (let i = 0; i <= 7; i++) buckets[i] = 0

  for (const card of cards) {
    if (card.typeLine.includes("Land")) continue
    const cmc = Math.min(card.cmc, 7)
    buckets[cmc] = (buckets[cmc] ?? 0) + card.quantity
  }

  const data = Object.entries(buckets).map(([cmc, count]) => ({
    cmc: cmc === "7" ? "7+" : cmc,
    count,
  }))

  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="w-full h-28">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barCategoryGap="20%">
          <XAxis
            dataKey="cmc"
            tick={{ fill: "#71717a", fontSize: 11 }}
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
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#e4e4e7",
            }}
            formatter={(val) => [Number(val), "Cards"]}
            labelFormatter={(l) => `CMC ${l}`}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.count === max && entry.count > 0 ? "#f59e0b" : "#3f3f46"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
