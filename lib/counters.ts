// Counter detection + planeswalker loyalty parsing, shared by the single-player
// playtester (components/PlaytestView.tsx) and the multiplayer game
// (app/game/[code]/GameClient.tsx) so the two can't drift apart.

// ── Counter definitions ───────────────────────────────────────────────────────
// Ordered: common ones first so context menu groups naturally
export const COUNTER_DEFS: { pattern: RegExp; name: string; color: string; abbr: string }[] = [
  { pattern: /\+1\/\+1 counter/i,                    name: "+1/+1",       color: "#22c55e", abbr: "+1/+1" },
  { pattern: /-1\/-1 counter/i,                       name: "-1/-1",       color: "#ef4444", abbr: "-1/-1" },
  { pattern: /\+2\/\+2 counter/i,                     name: "+2/+2",       color: "#4ade80", abbr: "+2/+2" },
  { pattern: /charge counter/i,                       name: "charge",      color: "#60a5fa", abbr: "⚡"    },
  { pattern: /\{e\}|energy counter/i,                 name: "energy",      color: "#facc15", abbr: "⟨E⟩"  },
  { pattern: /experience counter/i,                   name: "experience",  color: "#a78bfa", abbr: "EXP"  },
  { pattern: /shield counter/i,                       name: "shield",      color: "#67e8f9", abbr: "🛡"   },
  { pattern: /oil counter/i,                          name: "oil",         color: "#86efac", abbr: "OIL"  },
  { pattern: /stun counter/i,                         name: "stun",        color: "#fb923c", abbr: "STN"  },
  { pattern: /time counter/i,                         name: "time",        color: "#c084fc", abbr: "⏱"   },
  { pattern: /spore counter/i,                        name: "spore",       color: "#a3e635", abbr: "SPR"  },
  { pattern: /ki counter/i,                           name: "ki",          color: "#f9a8d4", abbr: "KI"   },
  { pattern: /lore counter/i,                         name: "lore",        color: "#d97706", abbr: "I"    },
  { pattern: /quest counter/i,                        name: "quest",       color: "#34d399", abbr: "QST"  },
  { pattern: /age counter/i,                          name: "age",         color: "#94a3b8", abbr: "AGE"  },
  { pattern: /bounty counter/i,                       name: "bounty",      color: "#fbbf24", abbr: "$"    },
  { pattern: /level counter|level up/i,               name: "level",       color: "#818cf8", abbr: "LVL"  },
  { pattern: /training counter/i,                     name: "training",    color: "#4ade80", abbr: "TRN"  },
  { pattern: /growth counter/i,                       name: "growth",      color: "#16a34a", abbr: "GRW"  },
  { pattern: /flood counter/i,                        name: "flood",       color: "#38bdf8", abbr: "FLD"  },
  { pattern: /fade counter/i,                         name: "fade",        color: "#6b7280", abbr: "FDE"  },
  { pattern: /depletion counter/i,                    name: "depletion",   color: "#78716c", abbr: "DEP"  },
  { pattern: /verse counter/i,                        name: "verse",       color: "#f472b6", abbr: "VRS"  },
  { pattern: /luck counter/i,                         name: "luck",        color: "#fde68a", abbr: "LCK"  },
  { pattern: /study counter/i,                        name: "study",       color: "#93c5fd", abbr: "STD"  },
  { pattern: /aegis counter/i,                        name: "aegis",       color: "#7dd3fc", abbr: "AGS"  },
  { pattern: /blood counter/i,                        name: "blood",       color: "#dc2626", abbr: "BLD"  },
  { pattern: /poison counter/i,                       name: "poison",      color: "#4d7c0f", abbr: "☠"   },
  { pattern: /blaze counter/i,                        name: "blaze",       color: "#f97316", abbr: "BLZ"  },
  { pattern: /doom counter/i,                         name: "doom",        color: "#7f1d1d", abbr: "DOOM" },
  { pattern: /finality counter/i,                     name: "finality",    color: "#581c87", abbr: "FIN"  },
  { pattern: /hatchling counter/i,                    name: "hatchling",   color: "#fef08a", abbr: "HAT"  },
  { pattern: /hoofprint counter/i,                    name: "hoofprint",   color: "#d4a574", abbr: "HFP"  },
  { pattern: /ice counter/i,                          name: "ice",         color: "#bae6fd", abbr: "ICE"  },
  { pattern: /hunger counter/i,                       name: "hunger",      color: "#92400e", abbr: "HNG"  },
  { pattern: /landmark counter/i,                     name: "landmark",    color: "#a16207", abbr: "LMK"  },
  { pattern: /manifestation counter/i,                name: "manifestation",color: "#7e22ce",abbr: "MNF"  },
  { pattern: /muster counter/i,                       name: "muster",      color: "#15803d", abbr: "MST"  },
  { pattern: /page counter/i,                         name: "page",        color: "#e2e8f0", abbr: "PG"   },
  { pattern: /plague counter/i,                       name: "plague",      color: "#365314", abbr: "PLG"  },
  { pattern: /plot counter/i,                         name: "plot",        color: "#d8b4fe", abbr: "PLT"  },
  { pattern: /pressure counter/i,                     name: "pressure",    color: "#f43f5e", abbr: "PRS"  },
  { pattern: /rust counter/i,                         name: "rust",        color: "#b45309", abbr: "RST"  },
  { pattern: /slime counter/i,                        name: "slime",       color: "#84cc16", abbr: "SLM"  },
  { pattern: /slumber counter/i,                      name: "slumber",     color: "#1e40af", abbr: "SLB"  },
  { pattern: /soot counter/i,                         name: "soot",        color: "#374151", abbr: "SOT"  },
  { pattern: /storage counter/i,                      name: "storage",     color: "#6b7280", abbr: "STG"  },
  { pattern: /trap counter/i,                         name: "trap",        color: "#b91c1c", abbr: "TRP"  },
  { pattern: /wish counter/i,                         name: "wish",        color: "#fbcfe8", abbr: "WSH"  },
  { pattern: /wound counter/i,                        name: "wound",       color: "#991b1b", abbr: "WND"  },
]

export interface LoyaltyAbility { label: string; delta: number }

export interface ParsedAbilities {
  counterNames: string[]         // counter types detected in oracle text
  loyaltyAbilities: LoyaltyAbility[]
  isSaga: boolean
  isPlaneswalker: boolean
}

// Counters that track player state — they go on players, not permanents
const PLAYER_COUNTERS = new Set(["energy", "experience", "poison", "rad", "ticket"])

// Sentence places counter on self (this card)
function onSelf(s: string): boolean {
  return (
    /enters?(?:\s+the\s+battlefield)?\s+with[^.]*?counter/i.test(s) ||
    /\bput\b[^.]*?\bcounters?\b[^.]*?\bon\s+(?:it|this)\b/i.test(s) ||
    /\b(?:it|this\s+\w+)\s+(?:gets?|gains?)\s+[^.]*?\bcounters?\b/i.test(s)
  )
}

// Sentence places counter on another permanent or player (not self)
function onOther(s: string): boolean {
  return /\bput\b[^.]*?\bcounters?\b[^.]*?\bon\s+(?:target\b|each\b|another\b|an?\s+opponent|players?)\b/i.test(s)
}

export function parseCardAbilities(oracleText: string, typeLine: string): ParsedAbilities {
  const text = oracleText ?? ""
  const type = typeLine ?? ""
  const isPlaneswalker = /planeswalker/i.test(type)
  const isSaga = /saga/i.test(type)

  const counterNames: string[] = []
  for (const def of COUNTER_DEFS) {
    if (!def.pattern.test(text)) continue
    // Player counters never go on permanents
    if (PLAYER_COUNTERS.has(def.name)) continue

    // Analyse each sentence that mentions this counter type
    const sentences = text.split(/\. |\n/).filter(s => def.pattern.test(s))
    // Only consider sentences that actually place a counter (contain "put" or a self-placement verb)
    const placementSentences = sentences.filter(s => /\bput\b[^.]*?\bcounters?\b/i.test(s) || onSelf(s))

    if (placementSentences.some(s => onSelf(s))) {
      // Explicitly placed on self — include
      counterNames.push(def.name)
    } else if (placementSentences.length > 0 && placementSentences.every(s => onOther(s))) {
      // Every placement puts the counter on another permanent/player — skip
      continue
    } else {
      // Mentioned in a triggered/static context without clear placement target (level up,
      // keyword reminder, proliferate, etc.) — include so the player can track it
      counterNames.push(def.name)
    }
  }

  if (isSaga && !counterNames.includes("lore")) counterNames.unshift("lore")
  if (isPlaneswalker && !counterNames.includes("loyalty")) counterNames.unshift("loyalty" as never)

  // Parse planeswalker loyalty ability costs: lines like "+2: …", "-3: …", "0: …"
  const loyaltyAbilities: LoyaltyAbility[] = []
  if (isPlaneswalker) {
    for (const line of text.split(/\n/)) {
      const m = line.trim().match(/^([+\-−]?\d+)\s*:(.+)/)
      if (!m) continue
      const delta = parseInt(m[1].replace("−", "-"))
      if (isNaN(delta)) continue
      const preview = m[2].trim().replace(/\{[^}]+\}/g, "").trim().slice(0, 48)
      loyaltyAbilities.push({
        delta,
        label: `${delta > 0 ? `+${delta}` : delta}: ${preview}${preview.length >= 48 ? "…" : ""}`,
      })
    }
  }

  return { counterNames, loyaltyAbilities, isSaga, isPlaneswalker }
}

export function counterColor(name: string): string {
  return COUNTER_DEFS.find(d => d.name === name)?.color ?? "#6b7280"
}

export function counterAbbr(name: string): string {
  return COUNTER_DEFS.find(d => d.name === name)?.abbr ?? name.slice(0, 3).toUpperCase()
}
