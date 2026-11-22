import { forwardRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Inbox, Loader2, Search, X, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { STATUS_TONES, titleCase } from '../../utils/format';
import { useCopy } from '../../hooks';

export const cx = clsx;

/* --------------------------------- Buttons -------------------------------- */
export const Button = forwardRef(function Button({ variant = 'primary', size, loading, icon: Icon, children, className, ...props }, ref) {
  return (
    <button ref={ref} className={cx(`btn-${variant}`, size === 'sm' && 'btn-sm', className)} disabled={loading || props.disabled} {...props}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
});

export const Spinner = ({ className }) => <Loader2 className={cx('size-5 animate-spin text-brand', className)} />;

/* ---------------------------------- Forms --------------------------------- */
export function Field({ label, error, hint, required, children, className }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ error, className, ...props }, ref) {
  return <input ref={ref} className={cx('input', error && 'input-error', className)} aria-invalid={Boolean(error)} {...props} />;
});

/** Password field with a show / hide (eye) toggle */
export const PasswordInput = forwardRef(function PasswordInput({ error, className, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cx('input pr-11', error && 'input-error', className)}
        aria-invalid={Boolean(error)}
        autoCapitalize="off"
        spellCheck={false}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ error, className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cx('input', error && 'input-error', className)} {...props} />;
});

export const Select = forwardRef(function Select({ error, className, options = [], placeholder, ...props }, ref) {
  return (
    <select ref={ref} className={cx('input pr-8', error && 'input-error', className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand' : 'bg-slate-300')}
      >
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition', checked ? 'left-5.5' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type="search" />
    </div>
  );
}

/* --------------------------------- Display -------------------------------- */
const TONE = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  blue: 'bg-brand-50 text-brand ring-brand/20',
  purple: 'bg-purple-50 text-purple ring-purple/20',
  teal: 'bg-teal-50 text-teal ring-teal/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export function Badge({ tone = 'slate', children, className }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[tone], className)}>{children}</span>;
}

export function StatusBadge({ status, label }) {
  if (!status) return <span className="text-slate-400">—</span>;
  return <Badge tone={STATUS_TONES[status] || 'slate'}>{label || titleCase(status)}</Badge>;
}

export function StatCard({ label, value, icon: Icon, tone = 'blue', hint, loading }) {
  const tones = { blue: 'bg-brand-50 text-brand', teal: 'bg-teal-50 text-teal', purple: 'bg-purple-50 text-purple', navy: 'bg-navy text-white', amber: 'bg-amber-50 text-amber-600', green: 'bg-emerald-50 text-emerald-600' };
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          {loading ? <div className="skeleton mt-2 h-7 w-24" /> : <p className="mt-1.5 truncate font-display text-2xl font-bold text-navy">{value}</p>}
          {hint && !loading && <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && (
          <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
            <Icon className="size-5" />
          </span>
        )}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand">
        <Icon className="size-7" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertTriangle className="size-6" />
      </span>
      <p className="text-sm font-medium text-slate-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export const Skeleton = ({ className }) => <div className={cx('skeleton', className)} />;

export function CardSkeleton({ rows = 3 }) {
  return (
    <div className="card space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function Card({ title, actions, children, className, bodyClassName }) {
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-semibold text-navy">{title}</h2>
          {actions}
        </header>
      )}
      <div className={cx('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function CopyButton({ text, label = 'Copy', className, variant = 'secondary' }) {
  const { copy, copied } = useCopy();
  return (
    <Button type="button" variant={variant} size="sm" className={className} onClick={() => copy(text)} icon={copied ? Check : Copy}>
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cx('whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition', value === t.value ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- Modal --------------------------------- */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl animate-fade-up sm:rounded-2xl', widths[size])}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, title = 'Are you sure?', message, confirmLabel = 'Confirm', tone = 'primary', loading, onConfirm, onClose, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <p className="text-sm text-slate-600">{message}</p>}
      {children}
    </Modal>
  );
}

/* ---------------------------------- Table --------------------------------- */
/**
 * columns: [{ key, header, render?(row), sortable?, className? }]
 * Responsive: horizontal scroll on small screens; optional mobile card renderer.
 */
export function DataTable({ columns, rows, loading, error, onRetry, sort, onSort, empty, rowKey = '_id', selectable, selected = [], onSelect, mobileCard }) {
  const allSelected = selectable && rows?.length > 0 && rows.every((r) => selected.includes(r[rowKey]));
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  return (
    <>
      {mobileCard && (
        <div className="divide-y divide-slate-100 md:hidden">
          {loading && !rows?.length
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2 p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            : rows?.map((r) => (
                <div key={r[rowKey]} className="p-4">
                  {mobileCard(r)}
                </div>
              ))}
          {!loading && !rows?.length && (empty || <EmptyState />)}
        </div>
      )}
      <div className={cx('overflow-x-auto', mobileCard && 'hidden md:block')}>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="size-4 rounded accent-brand" checked={allSelected} onChange={() => onSelect(allSelected ? [] : rows.map((r) => r[rowKey]))} aria-label="Select all" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={cx('whitespace-nowrap px-4 py-3 font-medium', c.className)}>
                  {c.sortable && onSort ? (
                    <button type="button" className="inline-flex items-center gap-1 hover:text-slate-700" onClick={() => onSort(c.key)}>
                      {c.header}
                      {sort === c.key ? <ChevronUp className="size-3.5" /> : sort === `-${c.key}` ? <ChevronDown className="size-3.5" /> : null}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !rows?.length
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {selectable && <td className="px-4 py-3.5" />}
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-full max-w-[140px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows?.map((r) => (
                  <tr key={r[rowKey]} className={cx('transition hover:bg-slate-50/70', loading && 'opacity-60')}>
                    {selectable && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="size-4 rounded accent-brand"
                          checked={selected.includes(r[rowKey])}
                          onChange={() => onSelect(selected.includes(r[rowKey]) ? selected.filter((x) => x !== r[rowKey]) : [...selected, r[rowKey]])}
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cx('whitespace-nowrap px-4 py-3 text-slate-700', c.className)}>
                        {c.render ? c.render(r) : r[c.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && !rows?.length && (empty || <EmptyState />)}
      </div>
    </>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.total === 0) return null;
  const { page, pages, total, limit } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" icon={ChevronLeft} />
        <span className="px-2 text-xs">
          Page {page} / {pages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" icon={ChevronRight} />
      </div>
    </div>
  );
}

/** Small helper for a confirm-with-loading flow */
export function useConfirm() {
  const [state, setState] = useState({ open: false });
  const ask = (opts) => setState({ open: true, ...opts });
  const close = () => setState({ open: false });
  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      tone={state.tone}
      loading={state.loading}
      onClose={close}
      onConfirm={async () => {
        setState((s) => ({ ...s, loading: true }));
        try {
          await state.onConfirm?.();
          close();
        } catch {
          setState((s) => ({ ...s, loading: false }));
        }
      }}
    />
  );
  return { ask, dialog };
}
