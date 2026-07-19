import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  AlertCircle,
  ChevronDown,
  LoaderCircle,
  MoreHorizontal,
  SearchX,
  X,
} from "lucide-react";
import { statusLabel, statusTone } from "../display";

export type StatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "demo";
export function Button({
  className = "",
  variant = "primary",
  loading = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      className={`button button-${variant} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="spin" size={16} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      className={`icon-button ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
export function StatusBadge({
  children,
  tone,
  className = "",
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  const raw = typeof children === "string" ? children : undefined;
  const resolvedTone = tone || statusTone(raw);
  const label = raw ? statusLabel(raw) : children;
  return (
    <span className={`status-pill status-${resolvedTone} ${className}`.trim()}>
      {label}
    </span>
  );
}
export const StatusPill = StatusBadge;
export function SourceBadge({ children }: { children: ReactNode }) {
  return <span className="source-badge">{children}</span>;
}
export function DemoBadge({ children = "Demo" }: { children?: ReactNode }) {
  return <span className="demo-badge">{children}</span>;
}
export function Tabs({
  value,
  items,
  onChange,
  label,
}: {
  value: string;
  items: Array<{ value: string; label: string; count?: number }>;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          aria-selected={value === item.value}
          className={value === item.value ? "active" : ""}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {typeof item.count === "number" ? <span>{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field-label ${className}`.trim()}>
      <span className="field-heading">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={`ui-input ${props.className || ""}`.trim()} {...props} />
  );
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`ui-textarea ${props.className || ""}`.trim()}
      {...props}
    />
  );
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`ui-select ${props.className || ""}`.trim()}
      {...props}
    />
  );
}
export function SplitPane({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`split-pane ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
export function ListPane({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <aside className={`list-pane ${className}`.trim()} {...props}>
      {children}
    </aside>
  );
}
export function DetailPane({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <main className={`detail-pane ${className}`.trim()} {...props}>
      {children}
    </main>
  );
}
export function ContextRail({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <aside className={`context-rail ${className}`.trim()} {...props}>
      {children}
    </aside>
  );
}
export function StickyCommandBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sticky-command-bar ${className}`.trim()}>{children}</div>
  );
}
export function ActionMenu({
  label = "更多操作",
  children,
  align = "right",
}: {
  label?: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className={`action-menu align-${align}`} ref={ref}>
      <IconButton
        label={label}
        className={open ? "active" : ""}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={17} />
      </IconButton>
      {open ? (
        <div
          className="action-menu-popover"
          role="menu"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <SearchX size={28} />
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  title = "暂时无法完成操作",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={22} />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function LoadingSkeleton({
  rows = 4,
  compact = false,
}: {
  rows?: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`skeleton-lines ${compact ? "compact" : ""}`}
      aria-label="正在加载"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}
export const SkeletonLines = LoadingSkeleton;
export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  testId,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) || [],
      );
    requestAnimationFrame(() => focusable()[0]?.focus());
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="dialog-layer"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
      >
        <header className="dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <IconButton label="关闭对话框" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="dialog-content">{children}</div>
        {footer ? <footer className="dialog-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  danger = false,
  loading = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      请确认当前操作仅影响当前工作区。
    </Dialog>
  );
}
export function AuditTrail({
  items,
}: {
  items: Array<{ id?: string; title: string; meta: string; detail?: string }>;
}) {
  return (
    <ol className="audit-trail">
      {items.map((item, i) => (
        <li key={item.id || `${item.title}-${i}`}>
          <span />
          <div>
            <strong>{item.title}</strong>
            <small>{item.meta}</small>
            {item.detail ? <p>{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
export function Disclosure({
  title,
  meta,
  children,
  defaultOpen = false,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="ui-disclosure" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {meta}
        <ChevronDown size={15} />
      </summary>
      <div>{children}</div>
    </details>
  );
}
