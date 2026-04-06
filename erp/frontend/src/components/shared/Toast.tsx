import { useEffect, useState } from 'react'
import { cn } from '@mashora/design-system'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  title: string
  message?: string
  duration?: number
}

// Simple global state
let _toasts: ToastItem[] = []
let _listeners: Set<() => void> = new Set()
let _nextId = 0

function notify(listeners: Set<() => void>) {
  listeners.forEach(fn => fn())
}

export function toast(type: ToastType, title: string, message?: string, duration = 4000) {
  const id = ++_nextId
  _toasts = [..._toasts, { id, type, title, message, duration }]
  notify(_listeners)
  if (duration > 0) {
    setTimeout(() => { dismissToast(id) }, duration)
  }
}

export function dismissToast(id: number) {
  _toasts = _toasts.filter(t => t.id !== id)
  notify(_listeners)
}

// Convenience helpers
toast.success = (title: string, message?: string) => toast('success', title, message)
toast.error = (title: string, message?: string) => toast('error', title, message, 6000)
toast.warning = (title: string, message?: string) => toast('warning', title, message)
toast.info = (title: string, message?: string) => toast('info', title, message)

function useToasts() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const fn = () => setTick(t => t + 1)
    _listeners.add(fn)
    return () => { _listeners.delete(fn) }
  }, [])
  return _toasts
}

const ICONS = {
  success: <CheckCircle className="h-5 w-5 text-emerald-400" />,
  error: <XCircle className="h-5 w-5 text-red-400" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-400" />,
  info: <Info className="h-5 w-5 text-blue-400" />,
}

const BG = {
  success: 'border-emerald-500/20',
  error: 'border-red-500/20',
  warning: 'border-amber-500/20',
  info: 'border-blue-500/20',
}

export function ToastContainer() {
  const toasts = useToasts()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 rounded-xl border bg-card/95 backdrop-blur-sm p-3 shadow-lg animate-in slide-in-from-right-5 fade-in duration-200',
            BG[t.type],
          )}
        >
          <div className="shrink-0 mt-0.5">{ICONS[t.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t.title}</p>
            {t.message && <p className="text-xs text-muted-foreground mt-0.5">{t.message}</p>}
          </div>
          <button onClick={() => dismissToast(t.id)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
