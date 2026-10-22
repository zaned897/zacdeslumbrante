import React from 'react';
import type { PetColor, PetMood } from '../../pet/petEngine';

// Pepita de mineral con cara: plata como las minas, cantera rosa como la Catedral, bronce como las campanas.
const PALETTE: Record<PetColor, { body: string; shade: string; shine: string }> = {
  plata: { body: '#CBD5E1', shade: '#94A3B8', shine: '#F8FAFC' },
  cantera: { body: '#F2B8A2', shade: '#D9826A', shine: '#FDE7DD' },
  bronce: { body: '#E0A458', shade: '#B4742E', shine: '#FBE3B8' },
};

const MOUTHS: Record<PetMood, string> = {
  feliz: 'M44 66 Q60 82 76 66',
  contento: 'M47 68 Q60 76 73 68',
  aburrido: 'M48 71 L72 71',
  triste: 'M47 74 Q60 64 73 74',
};

interface PetSpriteProps {
  color: PetColor;
  mood: PetMood;
  tired: boolean;
  walking?: boolean;
  size?: number;
  title?: string;
}

export const PetSprite: React.FC<PetSpriteProps> = ({ color, mood, tired, walking = false, size = 160, title }) => {
  const c = PALETTE[color];
  const bounce = !tired && (mood === 'feliz' || mood === 'contento' || walking);
  const eyeRy = mood === 'triste' ? 4 : 6;
  const bobSpeed = walking ? '0.5s' : mood === 'feliz' ? '0.9s' : '1.6s';

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={title}>
      {title && <title>{title}</title>}
      <ellipse cx="60" cy="108" rx="30" ry="5" fill="#1C1917" opacity="0.12" />
      <g>
        {bounce && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -5; 0 0"
            dur={bobSpeed}
            repeatCount="indefinite"
          />
        )}
        {/* patas */}
        <g fill={c.shade}>
          <ellipse cx="45" cy="100" rx="9" ry="6">
            {walking && <animate attributeName="cy" values="100;96;100" dur="0.5s" repeatCount="indefinite" />}
          </ellipse>
          <ellipse cx="75" cy="100" rx="9" ry="6">
            {walking && <animate attributeName="cy" values="96;100;96" dur="0.5s" repeatCount="indefinite" />}
          </ellipse>
        </g>
        {/* cuerpo facetado */}
        <path d="M60 14 L92 30 L102 62 L88 94 L32 94 L18 62 L28 30 Z" fill={c.body} stroke={c.shade} strokeWidth="3" strokeLinejoin="round" />
        <path d="M60 14 L74 36 L60 46 L46 36 Z" fill={c.shine} opacity="0.8" />
        <path d="M28 30 L46 36 L18 62 Z" fill={c.shine} opacity="0.35" />
        <path d="M92 30 L74 36 L102 62 Z" fill={c.shade} opacity="0.35" />

        {/* ojos */}
        {tired ? (
          <g stroke="#1C1917" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M40 54 Q46 58 52 54" />
            <path d="M68 54 Q74 58 80 54" />
          </g>
        ) : (
          <g fill="#1C1917">
            {[46, 74].map((cx) => (
              <ellipse key={cx} cx={cx} cy="54" rx="5" ry={eyeRy}>
                <animate attributeName="ry" values={`${eyeRy};${eyeRy};0.6;${eyeRy}`} keyTimes="0;0.92;0.96;1" dur="4s" repeatCount="indefinite" />
              </ellipse>
            ))}
            <circle cx="48" cy="51" r="1.6" fill="#fff" />
            <circle cx="76" cy="51" r="1.6" fill="#fff" />
          </g>
        )}
        {/* mejillas */}
        {(mood === 'feliz' || mood === 'contento') && (
          <g fill="#E4007C" opacity="0.25">
            <ellipse cx="36" cy="66" rx="6" ry="3.5" />
            <ellipse cx="84" cy="66" rx="6" ry="3.5" />
          </g>
        )}
        <path d={MOUTHS[mood]} stroke="#1C1917" strokeWidth="3" strokeLinecap="round" fill="none" />
        {mood === 'triste' && <path d="M82 58 q3 6 0 9 q-3 -3 0 -9" fill="#38BDF8" />}
      </g>
      {tired && (
        <text x="92" y="24" fontSize="14" fontWeight="700" fill="#78716C">
          z
          <tspan dx="2" dy="-6" fontSize="10">z</tspan>
          <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite" />
        </text>
      )}
    </svg>
  );
};
