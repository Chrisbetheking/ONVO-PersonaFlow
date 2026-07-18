import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AlertCircle, LoaderCircle, SearchX } from 'lucide-react'

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
