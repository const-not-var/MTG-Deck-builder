"use client"

const SYMBOL_STYLES: Record<string, string> = {
  W: "bg-yellow-50 text-yellow-900 border border-yellow-300",
  U: "bg-blue-600 text-white",
  B: "bg-zinc-900 text-zinc-100 border border-zinc-600",
  R: "bg-red-600 text-white",
  G: "bg-green-600 text-white",
  C: "bg-zinc-400 text-zinc-900",
}

function symbolStyle(sym: string): string {
  if (SYMBOL_STYLES[sym]) return SYMBOL_STYLES[sym]
  if (/^\d+$/.test(sym)) return "bg-zinc-600 text-zinc-100"
  if (sym === "X" || sym === "Y" || sym === "Z") return "bg-zinc-500 text-zinc-100 italic"
  if (sym.includes("/")) {
    const [a] = sym.split("/")
    return SYMBOL_STYLES[a] ?? "bg-zinc-600 text-zinc-100"
  }
  return "bg-zinc-600 text-zinc-100"
}

export function ManaSymbol({ symbol }: { symbol: string }) {
  const inner = symbol.replace(/[{}]/g, "")
  const display = inner.length > 3 ? inner.slice(0, 3) : inner
  return (
    <span
      className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[10px] font-bold leading-none flex-shrink-0 ${symbolStyle(inner)}`}
      title={symbol}
    >
      {display}
    </span>
  )
}

export function ManaCost({ cost }: { cost: string }) {
  const symbols = cost.match(/\{[^}]+\}/g) ?? []
  if (!symbols.length && !cost) return null
  return (
    <span className="inline-flex items-center gap-[2px] flex-wrap">
      {symbols.map((s, i) => (
        <ManaSymbol key={i} symbol={s} />
      ))}
    </span>
  )
}

export function ColorPip({ color }: { color: string }) {
  const styles: Record<string, string> = {
    W: "bg-yellow-50 border-yellow-300 text-yellow-900",
    U: "bg-blue-600 border-blue-700 text-white",
    B: "bg-zinc-900 border-zinc-600 text-zinc-100",
    R: "bg-red-600 border-red-700 text-white",
    G: "bg-green-600 border-green-700 text-white",
    C: "bg-zinc-400 border-zinc-500 text-zinc-900",
  }
  const cls = styles[color] ?? "bg-zinc-600 text-zinc-100"
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${cls}`}
      title={colorName(color)}
    >
      {color}
    </span>
  )
}

function colorName(c: string): string {
  const names: Record<string, string> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", C: "Colorless" }
  return names[c] ?? c
}
