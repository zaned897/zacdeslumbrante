import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Va fijo abajo (botones de acción). */
  footer?: React.ReactNode;
  closeLabel: string;
  children: React.ReactNode;
}

/** Hoja inferior en celular y diálogo centrado en pantallas anchas. Cierra con Esc o tocando fuera. */
export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, subtitle, footer, closeLabel, children }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="presentation">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-aparece" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative w-full md:max-w-xl max-h-[88dvh] flex flex-col bg-papel tinte-temporada text-carbon rounded-t-[28px] md:rounded-[28px] shadow-2xl outline-none animate-sube"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <span className="self-center mt-2.5 w-10 h-1 rounded-full bg-linea md:hidden" aria-hidden="true" />
        <header className="flex items-start gap-3 px-5 pt-3 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-snug">{title}</h2>
            {subtitle && <p className="text-xs text-tenue mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="w-9 h-9 -mr-1 grid place-items-center rounded-full bg-caliza text-tenue hover:text-carbon cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="px-5 pt-3 pb-4 border-t border-linea">{footer}</div>}
      </div>
    </div>
  );
};
