import { useEffect, useRef } from 'react';
import { Button } from './Button';

/** Native modal <dialog>: focus trap, Escape and backdrop handled by the browser. */
export function ConfirmDialog({ open, title, children, confirmLabel, busy, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-dialog border border-rule bg-raised p-5 text-ink shadow-pop backdrop:bg-black/40"
    >
      {open && (
        <>
          <h2 id="confirm-title" className="text-base font-semibold">
            {title}
          </h2>
          <div className="mt-2 text-sm text-ink-2">{children}</div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirm} disabled={busy} autoFocus>
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
