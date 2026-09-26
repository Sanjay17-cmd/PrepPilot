import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message, duration }])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
  }, [dismiss])

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast])
  const error   = useCallback((msg: string) => toast(msg, 'error', 5000), [toast])
  const warning = useCallback((msg: string) => toast(msg, 'warning'), [toast])

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={16} color="var(--color-success-600)" />,
    error:   <AlertCircle size={16} color="var(--color-danger-600)" />,
    warning: <AlertTriangle size={16} color="var(--color-warning-600)" />,
    info:    <Info size={16} color="var(--color-accent-600)" />,
  }

  return (
    <ToastContext.Provider value={{ toast, success, error, warning }}>
      {children}
      <div className="toast-container" role="log" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {icons[t.type]}
            <span className="toast__message">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '0 0 0 8px', lineHeight: 1 }}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
