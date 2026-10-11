// Thin wrappers over Nocturne's CSS classes (.seg, .dialog, .field, .tag …) — no restyling.
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';

export function Seg<T extends string | number>(p: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; small?: boolean; mono?: boolean; wrap?: boolean; disabled?: (v: T) => boolean; label?: string }) {
  const name = useId();
  return (
    <div className="seg" role="radiogroup" aria-label={p.label} style={p.wrap ? { flexWrap: 'wrap' } : undefined}>
      {p.options.map(([v, l]) => (
        <label key={String(v)} className={'seg-opt' + (p.small ? ' seg-sm' : '')} style={{ ...(p.mono ? { fontFamily: 'ui-monospace, monospace' } : {}), ...(p.disabled?.(v) ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}>
          <input type="radio" name={name} checked={p.value === v} disabled={p.disabled?.(v)} onChange={() => p.onChange(v)} />{l}
        </label>
      ))}
    </div>
  );
}

export function Dialog(p: { title: string; onClose: () => void; onSubmit?: (e: FormEvent) => void; children: ReactNode; actions: ReactNode; body?: ReactNode }) {
  useEscape(p.onClose);
  const Tag = p.onSubmit ? 'form' : 'div';
  return (
    <div className="dialog-backdrop tn-layer-dialog" onClick={p.onClose}>
      <Tag className="dialog tn-in" role="dialog" aria-modal="true" aria-label={p.title} onClick={e => e.stopPropagation()} onSubmit={p.onSubmit as never} noValidate>
        <div className="dialog-title">{p.title}</div>
        {p.body && <div className="dialog-body">{p.body}</div>}
        {p.children}
        <div className="dialog-actions">{p.actions}</div>
      </Tag>
    </div>
  );
}

export function Drawer(p: { label: string; onClose: () => void; children: ReactNode }) {
  useEscape(p.onClose);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <>
      <div className="tn-scrim" onClick={p.onClose} />
      <aside ref={ref} tabIndex={-1} className="tn-drawer tn-in" role="dialog" aria-modal="true" aria-label={p.label}>{p.children}</aside>
    </>
  );
}

export function Field(p: { label: ReactNode; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <label>{p.label}</label>
      {p.children}
      {p.error && <div className="tn-err" role="alert">{p.error}</div>}
      {p.hint && <div className="tn-hint">{p.hint}</div>}
    </div>
  );
}

export const Avatar = (p: { text: string; size?: 32 | 40 | 48 }) => <span className={`tn-avatar tn-avatar-${p.size ?? 32}`}>{p.text}</span>;
export const IconBtn = (p: { icon: string; title: string; onClick: () => void; disabled?: boolean }) => (
  <button type="button" className="btn btn-icon tn-iconbtn" onClick={p.onClick} title={p.title} aria-label={p.title} disabled={p.disabled}><i className={'ph ' + p.icon} /></button>
);
export const Dot = (p: { color: string; pulse?: 'slow' | 'fast'; size?: number }) => (
  <span className="tn-dot" style={{ background: p.color, width: p.size ?? 7, height: p.size ?? 7, animation: p.pulse ? `tn-pulse ${p.pulse === 'fast' ? '1.6s' : '2.4s'} ease-in-out infinite` : undefined }} />
);
export const Code = (p: { children: ReactNode }) => <span className="tn-code">{p.children}</span>;
export const Empty = (p: { children: ReactNode }) => <div className="tn-empty">{p.children}</div>;
export const ErrorLine = (p: { error: unknown; retry?: () => void }) => (
  <div className="tn-errline"><span>{p.error instanceof Error ? p.error.message : 'Something went wrong'}</span>{p.retry && <button className="btn btn-secondary" onClick={p.retry}>Retry</button>}</div>
);

function useEscape(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') fn(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fn]);
}
