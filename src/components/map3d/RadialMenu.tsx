import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronRight, X, type LucideIcon } from 'lucide-react';

/** Una opción del menú: abre otro anillo (`children`), muestra una tarjeta (`card`) o hace algo (`action`). */
export interface RadialNode {
  id: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  /** Texto para lectores de pantalla y `title` cuando la opción está apagada (p. ej. «solo de noche»). */
  hint?: string;
  children?: RadialNode[];
  /** Tarjeta chica al elegir la opción; recibe `close` para cerrar el menú tras actuar. */
  card?: (close: () => void) => React.ReactNode;
  action?: () => void;
}

/** Radio (px) del primer y segundo anillo, medido desde el centro del botón. */
const RING1_PX = 172;
const RING2_PX = 250;

/**
 * Posiciones en abanico de 90° hacia arriba y a la izquierda del botón: la primera opción arriba,
 * la última a la izquierda. El segundo anillo va más lejos y más cerrado (de 95° a 135°), arriba de
 * la tarjeta, que sale a la izquierda del botón.
 */
function fan(n: number, radius: number, from: number, to: number): Array<{ dx: number; dy: number }> {
  return Array.from({ length: n }, (_, i) => {
    const deg = n === 1 ? (from + to) / 2 : from + (i * (to - from)) / (n - 1);
    const rad = (deg * Math.PI) / 180;
    return { dx: Math.round(radius * Math.cos(rad)), dy: Math.round(-radius * Math.sin(rad)) };
  });
}

/**
 * Ícono del botón (#330, Propuesta P1): puntos sobre un arco que abre hacia arriba y a la izquierda,
 * como el abanico del menú. Lucide no trae uno igual.
 */
const FanIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={className} aria-hidden="true">
    <path d="M18.5 7.5A11 11 0 0 0 7.5 18.5" strokeWidth={1.5} opacity={0.55} />
    <circle cx="18.5" cy="18.5" r="2.6" fill="currentColor" />
    <circle cx="18.5" cy="4.5" r="2.5" />
    <circle cx="8.6" cy="8.6" r="2.5" />
    <circle cx="4.5" cy="18.5" r="2.5" />
  </svg>
);

export interface RadialMenuProps {
  items: RadialNode[];
  /** Textos ya traducidos. */
  labels: { open: string; close: string; menu: string; back: string };
  className?: string;
}

/**
 * Menú radial de la ciudad 3D (#310, Propuesta O4): un botón abajo a la derecha que abre en abanico
 * las acciones sueltas, con un segundo anillo y una tarjeta chica al final del camino.
 * Teclado: flechas para recorrer, Enter para elegir, Esc para cerrar; roles ARIA de menú.
 */
export const RadialMenu: React.FC<RadialMenuProps> = ({ items, labels, className = '' }) => {
  const [open, setOpen] = useState(false);
  /** Camino elegido: ids desde el primer anillo. */
  const [path, setPath] = useState<string[]>([]);
  const reduced = useReducedMotion();
  const menuId = useId();
  const fabRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const first = items.find((n) => n.id === path[0]);
  const second = first?.children?.find((n) => n.id === path[1]);
  const cardNode = second?.card ? second : !first?.children && first?.card ? first : null;
  // El anillo que tiene el foco: el segundo si hay una opción del primero con hijos.
  const ring = first?.children && !cardNode ? first.children : cardNode ? [] : items;

  const close = () => {
    setOpen(false);
    setPath([]);
    fabRef.current?.focus();
  };

  // Al abrir o cambiar de anillo, el foco va a su primera opción.
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      const target = itemRefs.current.find((el) => el && !el.disabled) ?? null;
      (target ?? document.getElementById(`${menuId}-card`))?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, path, menuId]);

  const choose = (node: RadialNode, depth: number) => {
    if (node.disabled) return;
    if (node.children || node.card) {
      setPath((p) => [...p.slice(0, depth), node.id]);
      return;
    }
    node.action?.();
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const els = itemRefs.current.filter((el): el is HTMLButtonElement => Boolean(el));
    if (!els.length) return;
    e.preventDefault();
    const at = els.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? els.length - 1 : (at + step + els.length) % els.length;
    els[next]?.focus();
  };

  const renderRing = (nodes: RadialNode[], depth: number, focusable: boolean) => {
    const spots = depth === 0 ? fan(nodes.length, RING1_PX, 90, 180) : fan(nodes.length, RING2_PX, 95, 135);
    return nodes.map((node, i) => {
      const { dx, dy } = spots[i] ?? { dx: 0, dy: 0 };
      const chosen = path[depth] === node.id;
      const dim = !focusable && !chosen;
      // En el segundo nivel, del primer anillo solo queda la opción elegida (como en el diseño).
      const gone = depth === 0 && path.length > 0 && !chosen;
      const Icon = node.icon;
      return (
        <motion.button
          key={node.id}
          ref={focusable ? (el: HTMLButtonElement | null) => { itemRefs.current[i] = el; } : undefined}
          type="button"
          role="menuitem"
          aria-haspopup={node.children ? 'menu' : undefined}
          aria-disabled={node.disabled || undefined}
          aria-current={chosen || undefined}
          aria-label={node.hint ? `${node.label}. ${node.hint}` : node.label}
          title={node.hint}
          tabIndex={focusable ? 0 : -1}
          onClick={() => choose(node, depth)}
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: -dx, y: -dy, scale: 0.3 }}
          animate={{ opacity: gone ? 0 : dim ? 0.45 : node.disabled ? 0.6 : 1, x: 0, y: 0, scale: 1 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 24, delay: i * 0.04 }}
          className={`absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 outline-none ${
            (focusable || chosen) && !gone ? '' : 'pointer-events-none'
          } ${node.disabled ? 'cursor-not-allowed' : 'cursor-pointer'} group`}
          style={{ left: `calc(50% + ${dx}px)`, top: `calc(50% + ${dy}px)` }}
        >
          <span
            className={`grid place-items-center rounded-full border shadow-lg transition-colors group-focus-visible:ring-2 group-focus-visible:ring-white ${
              depth === 0 ? 'h-12 w-12' : 'h-10 w-10'
            } ${chosen ? 'border-[#9A3412] bg-[#9A3412] text-white' : 'border-white/70 bg-[#FBF9F5]/90 text-[#7C2D12] backdrop-blur-md'}`}
          >
            <Icon className={depth === 0 ? 'h-5 w-5' : 'h-[18px] w-[18px]'} aria-hidden="true" />
          </span>
          <b
            className={`text-center text-[11px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.75)] ${
              depth === 0 ? 'whitespace-nowrap leading-none' : 'w-24 leading-tight'
            }`}
          >
            {node.label}
          </b>
        </motion.button>
      );
    });
  };

  itemRefs.current = [];
  const crumbs = [first, second].filter((n): n is RadialNode => Boolean(n));

  return (
    <>
      {open && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 z-30 bg-stone-900/30 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          onClick={close}
        />
      )}

      {open && crumbs.length > 0 && (
        <nav aria-label={labels.back} className="absolute left-3 top-16 z-30 flex items-center gap-1 text-[11px] font-semibold text-white">
          <button
            type="button"
            onClick={() => setPath([])}
            className="rounded-full bg-stone-900/45 px-2.5 py-1.5 backdrop-blur-md hover:bg-stone-900/60 cursor-pointer"
          >
            {labels.menu}
          </button>
          {crumbs.map((n, i) => (
            <React.Fragment key={n.id}>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <button
                type="button"
                aria-current={i === crumbs.length - 1 ? 'step' : undefined}
                onClick={() => setPath((p) => p.slice(0, i + 1))}
                className="rounded-full bg-stone-900/45 px-2.5 py-1.5 backdrop-blur-md hover:bg-stone-900/60 cursor-pointer"
              >
                {n.label}
              </button>
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className={`absolute bottom-5 right-4 z-30 h-14 w-14 ${className}`} onKeyDown={open ? onKeyDown : undefined}>
        {open && (
          <div id={menuId} role="menu" aria-label={labels.menu} className="absolute inset-0">
            {renderRing(items, 0, ring === items)}
            {first?.children && renderRing(first.children, 1, ring === first.children)}
          </div>
        )}
        {open && cardNode?.card && (
          <motion.section
            id={`${menuId}-card`}
            tabIndex={-1}
            aria-label={cardNode.label}
            className="absolute bottom-0 right-[4.25rem] z-10 w-[min(18rem,calc(100vw-6.5rem))] rounded-[22px] border border-stone-200 bg-[#FBF9F5] p-3.5 text-stone-900 shadow-xl outline-none"
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 16, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 28 }}
          >
            {cardNode.card(close)}
          </motion.section>
        )}
        <button
          ref={fabRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={open ? labels.close : labels.open}
          onClick={() => (open ? close() : setOpen(true))}
          className={`jelly relative grid h-14 w-14 place-items-center rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
            open
              ? 'border border-white/30 bg-stone-900/45 text-white shadow-[0_8px_24px_-10px_rgba(40,20,5,.45)] backdrop-blur-md'
              : 'glass text-stone-900'
          }`}
        >
          {open ? <X className="h-6 w-6" aria-hidden="true" /> : <FanIcon className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
};
