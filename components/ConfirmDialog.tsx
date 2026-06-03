"use client"

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger, onConfirm, onCancel }: {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
      onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: "#0d0e20", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-zinc-100">{title}</h2>
        {message && <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{message}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm text-zinc-300 border border-zinc-700/60 hover:bg-zinc-800 transition-colors">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} autoFocus
            className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-950 transition-colors"
            style={{ background: danger ? "#ef4444" : "#f59e0b" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
