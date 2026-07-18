import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, LoaderCircle, SearchX, X } from 'lucide-react'

export function Button({ className = '', variant = 'primary', loading = false, children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  return (
    <button className={`button button-${variant} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <LoaderCircle className="spin" size={16} /> : null}
      {children}
    </button>
  )
}

export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state" role="status">
      <SearchX size={28} />
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function ErrorState({ title = '暂时无法完成操作', description, action }: { title?: string; description: string; action?: ReactNode }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={22} />
      <div><strong>{title}</strong><p>{description}</p></div>
      {action}
    </div>
  )
}

export function SkeletonLines({ rows = 4 }: { rows?: number }) {
  return <div className="skeleton-lines" aria-label="正在加载">{Array.from({ length: rows }).map((_, index) => <span key={index} />)}</div>
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  testId,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  testId?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="dialog-layer" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby={`${testId || 'dialog'}-title`} data-testid={testId}>
        <header className="dialog-header">
          <div><h2 id={`${testId || 'dialog'}-title`}>{title}</h2>{description ? <p>{description}</p> : null}</div>
          <button className="icon-button" onClick={onClose} aria-label="关闭对话框"><X size={18} /></button>
        </header>
        <div className="dialog-content">{children}</div>
        {footer ? <footer className="dialog-footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
