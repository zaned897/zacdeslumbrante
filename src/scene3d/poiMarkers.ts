import type { PlaceCategory, PlaceTier } from '../types';

/**
 * Marcadores por nivel (#295), como en el adelanto: nivel 1 pin grande con icono de su categoría y
 * nombre; nivel 2 punto mediano; nivel 3 punto chico. Colores con los tokens del proyecto.
 */
const TIER_COLOR: Record<PlaceTier, string> = { 1: '#9A3412', 2: '#C2410C', 3: '#D97706' };

/** Trazos de 24×24 por categoría; los que no tienen uno usan la estrella. */
const ICONS: Partial<Record<PlaceCategory, string>> = {
  temple: 'M12 2v4M10 4h4M6 21V11l6-5 6 5v10M10 21v-4h4v4',
  museum: 'M3 21h18M5 21v-9M9.7 21v-9M14.3 21v-9M19 21v-9M2.5 9 12 3l9.5 6z',
  plaza: 'M12 21v-5M6 16h12L12 4z',
  viewpoint: 'M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  market: 'M4 9h16l-2 11H6zM8 9l4-6 4 6',
  alley: 'M7 3v18M17 3v18M12 5v2M12 11v2M12 17v2',
  monument: 'M10 21V8l2-5 2 5v13M7 21h10',
  gastronomy: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 7h3v11',
};
const STAR = 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6l-5.3 2.8 1.2-6-4.5-4.1 6-.7z';

export interface TierMarker {
  root: HTMLButtonElement;
  name: HTMLElement;
  dot: HTMLElement;
  badge: HTMLElement;
}

export function makeTierMarker(title: string, tier: PlaceTier, category: PlaceCategory | undefined, color?: string): TierMarker {
  const root = document.createElement('button');
  root.type = 'button';
  root.setAttribute('aria-label', title);
  Object.assign(root.style, { pointerEvents: 'auto', background: 'none', border: 'none', padding: '0', cursor: 'pointer' });
  // CSS2DRenderer reescribe `display` del elemento raíz en cada cuadro: el acomodo va en un hijo.
  const column = document.createElement('span');
  Object.assign(column.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: tier === 1 ? '6px' : '3px' });

  const name = document.createElement('b');
  name.textContent = title;
  Object.assign(name.style, {
    font: `700 ${tier === 1 ? 12 : 11}px "Plus Jakarta Sans", sans-serif`,
    color: '#1C1917',
    background: '#fff',
    borderRadius: '7px',
    padding: '2px 7px',
    whiteSpace: 'nowrap',
    boxShadow: '0 1px 3px rgba(0,0,0,.22)',
  });

  const dot = document.createElement('span');
  const fill = color ?? TIER_COLOR[tier];
  const size = tier === 1 ? 28 : tier === 2 ? 16 : 9;
  Object.assign(dot.style, {
    position: 'relative',
    width: `${size}px`,
    height: `${size}px`,
    background: fill,
    border: `${tier === 3 ? 1.5 : 2}px solid #fff`,
    borderRadius: tier === 1 ? '50% 50% 50% 0' : '50%',
    transform: tier === 1 ? 'rotate(-45deg)' : '',
    boxShadow: tier === 3 ? '0 1px 2px rgba(0,0,0,.3)' : '0 2px 5px rgba(0,0,0,.35)',
    display: 'grid',
    placeItems: 'center',
  });
  if (tier === 1) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    Object.assign(svg.style, { width: '14px', height: '14px', transform: 'rotate(45deg)', fill: 'none', stroke: '#fff', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' });
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', (category && ICONS[category]) || STAR);
    svg.append(path);
    dot.append(svg);
  }

  // «+N»: cuántos puntos se agruparon en este (#295).
  const badge = document.createElement('i');
  Object.assign(badge.style, {
    display: 'none',
    position: 'absolute',
    top: tier === 1 ? '-10px' : '-11px',
    left: tier === 1 ? '18px' : `${size - 4}px`,
    transform: tier === 1 ? 'rotate(45deg)' : '',
    minWidth: '18px',
    padding: '1px 4px',
    borderRadius: '999px',
    background: '#1C1917',
    color: '#fff',
    font: '700 10px "Plus Jakarta Sans", sans-serif',
    fontStyle: 'normal',
    textAlign: 'center',
    border: '1.5px solid #fff',
  });
  dot.append(badge);

  column.append(name, dot);
  root.append(column);
  return { root, name, dot, badge };
}
