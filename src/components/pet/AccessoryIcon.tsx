import React from 'react';
import type { AccessoryId } from '../../data/placePrizes';

/** Dibujo simple de cada accesorio de premio (#313), en un cuadro de 64×64. */
export const AccessoryIcon: React.FC<{ id: AccessoryId; size?: number; title?: string }> = ({ id, size = 64, title }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
    {id === 'casco-minero' && (
      <g>
        <path d="M10 40 Q10 16 32 14 Q54 16 54 40 Z" fill="#F59E0B" stroke="#78350F" strokeWidth="2.5" />
        <rect x="6" y="38" width="52" height="8" rx="4" fill="#D97706" stroke="#78350F" strokeWidth="2.5" />
        <rect x="26" y="20" width="12" height="10" rx="3" fill="#FEF3C7" stroke="#78350F" strokeWidth="2" />
        <path d="M32 20 L32 8" stroke="#FDE68A" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      </g>
    )}
    {id === 'farol' && (
      <g>
        <path d="M32 6 v6" stroke="#44403C" strokeWidth="3" strokeLinecap="round" />
        <path d="M20 18 h24 l-4 -6 h-16 z" fill="#57534E" />
        <rect x="21" y="18" width="22" height="28" rx="3" fill="#FDE68A" stroke="#57534E" strokeWidth="3" />
        <path d="M32 24 q5 6 0 14 q-5 -8 0 -14z" fill="#F97316" />
        <rect x="18" y="46" width="28" height="6" rx="2" fill="#E8907A" stroke="#57534E" strokeWidth="2" />
      </g>
    )}
    {id === 'mascara-morisma' && (
      <g>
        <path d="M14 16 Q32 6 50 16 Q54 40 32 56 Q10 40 14 16 Z" fill="#FBF9F5" stroke="#7C2D12" strokeWidth="2.5" />
        <path d="M20 26 q5 -4 10 0 M34 26 q5 -4 10 0" stroke="#1C1917" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M24 40 q8 6 16 0" stroke="#B91C1C" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M18 34 l-2 6 M46 34 l2 6" stroke="#B91C1C" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28 12 q4 -6 8 0" stroke="#EAB308" strokeWidth="3" fill="none" />
      </g>
    )}
    {id === 'mono-gala' && (
      <g>
        <path d="M32 32 L10 20 Q6 32 10 44 Z" fill="#7C3AED" stroke="#3B0764" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M32 32 L54 20 Q58 32 54 44 Z" fill="#7C3AED" stroke="#3B0764" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="26" y="26" width="12" height="12" rx="3" fill="#A78BFA" stroke="#3B0764" strokeWidth="2.5" />
      </g>
    )}
    {id === 'sombrero-palma' && (
      <g>
        <ellipse cx="32" cy="42" rx="28" ry="9" fill="#EAB308" stroke="#854D0E" strokeWidth="2.5" />
        <path d="M18 42 Q18 18 32 16 Q46 18 46 42 Z" fill="#FACC15" stroke="#854D0E" strokeWidth="2.5" />
        <path d="M19 36 h26" stroke="#B91C1C" strokeWidth="4" />
      </g>
    )}
    {id === 'paliacate-rojo' && (
      <g>
        <path d="M8 18 H56 L32 54 Z" fill="#DC2626" stroke="#7F1D1D" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="24" cy="26" r="2.5" fill="#FBF9F5" />
        <circle cx="40" cy="26" r="2.5" fill="#FBF9F5" />
        <circle cx="32" cy="36" r="2.5" fill="#FBF9F5" />
        <path d="M14 22 q18 6 36 0" stroke="#FBF9F5" strokeWidth="1.5" fill="none" strokeDasharray="2 3" />
      </g>
    )}
  </svg>
);
