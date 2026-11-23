import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** Small anchored popover: click-outside and Escape close it; focus returns to the trigger. */
export function Popover({
  label,
  button,
  children,
  width = 300,
  active = false,
}: {
  label: string;
  button: ReactNode;
  children: (close: () => void) => ReactNode;
  width?: number;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={root}>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-control border px-2.5 text-[13px] font-medium ${
          open || active ? 'border-accent-border bg-accent-soft text-accent-text' : 'border-line bg-surface-2 text-fg hover:border-subtle'
        }`}
      >
        {button}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          style={{ ['--pw' as string]: `${width}px` }}
          className="fixed inset-x-2 bottom-2 z-[60] max-h-[75dvh] overflow-y-auto rounded-panel border border-line bg-surface p-3 shadow-float md:absolute md:inset-x-auto md:top-full md:right-2 md:bottom-auto md:mt-1.5 md:w-[var(--pw)]"
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
