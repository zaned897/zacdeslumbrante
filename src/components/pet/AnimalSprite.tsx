import React from 'react';
import type { Design, PetMood, Species } from '../../pet/petEngine';
import type { UpgradeId } from '../../pet/resources';

// Dibujos de la propuesta A aprobada (#67): https://claude.ai/artifact/6hZzQuFhqKU9qJmpXsirzp
// Mismo lienzo 100×100 y misma cara para todos; cambia el pelaje según el diseño.

interface Fur {
  fur: string;
  accent: string;
  light: string;
}

const BASE: Record<Species, Fur> = {
  gatito: { fur: '#F6B26B', accent: '#D9822B', light: '#FBD3B0' },
  perrito: { fur: '#E8C9A0', accent: '#8B5A2B', light: '#F7E6CF' },
  burrito: { fur: '#A8A29E', accent: '#57534E', light: '#E7E5E4' },
  coyote: { fur: '#D6A86A', accent: '#C08A4A', light: '#F7EBDD' },
  // Ratón de campo (#118): quinto animal, orejas grandes y redondas, pelaje café y panza crema.
  raton: { fur: '#A47148', accent: '#8B5E3C', light: '#F5E6D3' },
  // Liebre del semidesierto (#71): sexto animal, se gana en un Pueblo Mágico.
  liebre: { fur: '#B8977A', accent: '#8A6A4F', light: '#F3E9DC' },
};

// Diseños 1–3, iguales para todos: carbón, caliza y cantera.
const ALT: Fur[] = [
  { fur: '#57534E', accent: '#292524', light: '#A8A29E' },
  { fur: '#F5F5F4', accent: '#D6D3D1', light: '#FFFFFF' },
  { fur: '#9A3412', accent: '#7C2D12', light: '#FDBA74' },
];

export function furOf(species: Species, design: Design): Fur {
  return design === 0 ? BASE[species] : ALT[design - 1];
}

/** Color de la muestra en la fila "Diseños". */
export function swatchOf(species: Species, design: Design) {
  return furOf(species, design).fur;
}

const DARK = new Set(['#57534E', '#9A3412']);

const MOUTH: Record<PetMood, string> = {
  feliz: 'M44 66 Q47 70 50 66 Q53 70 56 66',
  contento: 'M44 66 Q47 70 50 66 Q53 70 56 66',
  aburrido: 'M45 68 L55 68',
  triste: 'M44 70 Q50 64 56 70',
};

function Ears({ species, f }: { species: Species; f: Fur }) {
  switch (species) {
    case 'gatito':
      return (
        <>
          <polygon points="24,44 30,14 46,32" fill={f.fur} />
          <polygon points="76,44 70,14 54,32" fill={f.fur} />
          <polygon points="29,36 32,22 40,31" fill={f.light} />
          <polygon points="71,36 68,22 60,31" fill={f.light} />
        </>
      );
    case 'perrito':
      return (
        <>
          <ellipse cx="24" cy="50" rx="10" ry="20" fill={f.accent} transform="rotate(18 24 50)" />
          <ellipse cx="76" cy="50" rx="10" ry="20" fill={f.accent} transform="rotate(-18 76 50)" />
        </>
      );
    case 'burrito':
      return (
        <>
          <ellipse cx="34" cy="20" rx="7" ry="20" fill={f.fur} transform="rotate(-12 34 20)" />
          <ellipse cx="66" cy="20" rx="7" ry="20" fill={f.fur} transform="rotate(12 66 20)" />
          <ellipse cx="34" cy="20" rx="3.5" ry="14" fill="#E7C6C1" transform="rotate(-12 34 20)" />
          <ellipse cx="66" cy="20" rx="3.5" ry="14" fill="#E7C6C1" transform="rotate(12 66 20)" />
        </>
      );
    case 'coyote':
      return (
        <>
          <polygon points="26,46 26,10 46,34" fill={f.accent} />
          <polygon points="74,46 74,10 54,34" fill={f.accent} />
          <polygon points="30,38 30,20 40,32" fill={f.light} />
          <polygon points="70,38 70,20 60,32" fill={f.light} />
        </>
      );
    case 'raton':
      return (
        <>
          <circle cx="24" cy="31" r="17" fill={f.accent} />
          <circle cx="76" cy="31" r="17" fill={f.accent} />
          <circle cx="24" cy="31" r="10" fill="#F9A8D4" />
          <circle cx="76" cy="31" r="10" fill="#F9A8D4" />
        </>
      );
    case 'liebre':
      return (
        <>
          <ellipse cx="38" cy="22" rx="6" ry="20" fill={f.fur} transform="rotate(-8 38 22)" />
          <ellipse cx="62" cy="22" rx="6" ry="20" fill={f.fur} transform="rotate(8 62 22)" />
          <ellipse cx="38" cy="25" rx="3" ry="13" fill="#F5D0C5" transform="rotate(-8 38 25)" />
          <ellipse cx="62" cy="25" rx="3" ry="13" fill="#F5D0C5" transform="rotate(8 62 25)" />
          {/* punta negra de las orejas, como la liebre de cola negra del semidesierto */}
          <path d="M33.2 8 Q38 -2 42.8 8 Q38 6 33.2 8Z" fill="#1C1917" transform="rotate(-8 38 22)" />
          <path d="M57.2 8 Q62 -2 66.8 8 Q62 6 57.2 8Z" fill="#1C1917" transform="rotate(8 62 22)" />
        </>
      );
  }
}

function Markings({ species, f }: { species: Species; f: Fur }) {
  switch (species) {
    case 'gatito':
      return (
        <>
          <path d="M38 30 l4 8 M50 27 v9 M62 30 l-4 8" stroke={f.accent} strokeWidth="3" strokeLinecap="round" />
          <path d="M22 60 h12 M22 66 h12 M66 60 h12 M66 66 h12" stroke="#7C4A1E" strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
    case 'perrito':
      return (
        <>
          <ellipse cx="62" cy="48" rx="10" ry="9" fill={f.accent} opacity=".45" />
          <ellipse cx="50" cy="66" rx="11" ry="8" fill={f.light} />
        </>
      );
    case 'burrito':
      return (
        <>
          <ellipse cx="50" cy="68" rx="15" ry="11" fill={f.light} />
          <path d="M44 28 q6 -6 12 0" fill={f.accent} />
        </>
      );
    case 'coyote':
      return <path d="M28 62 Q50 92 72 62 Q50 74 28 62Z" fill={f.light} />;
    case 'raton':
      return (
        <>
          <path d="M50 32 Q46 40 50 48 Q54 40 50 32Z" fill={f.accent} opacity=".55" />
          <ellipse cx="50" cy="71" rx="17" ry="12" fill={f.light} />
          <path d="M39 67 L23 64 M39 70 L24 72.5 M61 67 L77 64 M61 70 L76 72.5" stroke="#57534E" strokeWidth="1.2" strokeLinecap="round" />
        </>
      );
    case 'liebre':
      return (
        <>
          <ellipse cx="50" cy="69" rx="14" ry="10" fill={f.light} />
          <path d="M37 47 q2 -3 5 -1 M63 47 q-2 -3 -5 -1" stroke={f.light} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M40 66 L26 63 M40 69 L27 71 M60 66 L74 63 M60 69 L73 71" stroke={f.accent} strokeWidth="1.2" strokeLinecap="round" />
        </>
      );
  }
}

interface AnimalSpriteProps {
  species: Species;
  design: Design;
  mood?: PetMood;
  tired?: boolean;
  walking?: boolean;
  upgrades?: Set<UpgradeId>;
  size?: number;
  title?: string;
  animate?: boolean;
}

export const AnimalSprite: React.FC<AnimalSpriteProps> = ({
  species,
  design,
  mood = 'contento',
  tired = false,
  walking = false,
  upgrades,
  size = 120,
  title,
  animate = true,
}) => {
  const f = furOf(species, design);
  const ink = species === 'raton' || species === 'liebre' ? '#BE185D' : '#3B1D12';
  const darkFur = DARK.has(f.fur);
  const bounce = animate && !tired && (mood === 'feliz' || mood === 'contento' || walking);
  const bobSpeed = walking ? '0.5s' : mood === 'feliz' ? '0.9s' : '1.6s';
  const has = (u: UpgradeId) => upgrades?.has(u) ?? false;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {/* estela de estrellas (meteorito) */}
      {has('estela') && (
        <g fill="#C4B5FD">
          {[
            [12, 30, 2.6],
            [86, 24, 2],
            [90, 70, 2.4],
            [8, 74, 1.8],
          ].map(([x, y, r]) => (
            <path key={`${x}-${y}`} d={`M${x} ${y - r * 2} L${x + r * 0.6} ${y - r * 0.6} L${x + r * 2} ${y} L${x + r * 0.6} ${y + r * 0.6} L${x} ${y + r * 2} L${x - r * 0.6} ${y + r * 0.6} L${x - r * 2} ${y} L${x - r * 0.6} ${y - r * 0.6}Z`}>
              {animate && <animate attributeName="opacity" values="1;.3;1" dur="1.8s" repeatCount="indefinite" />}
            </path>
          ))}
        </g>
      )}
      <g>
        {bounce && (
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 -4; 0 0" dur={bobSpeed} repeatCount="indefinite" />
        )}
        <Ears species={species} f={f} />
        <circle cx="50" cy="56" r="30" fill={f.fur} />
        <Markings species={species} f={f} />

        {/* ojos */}
        {tired ? (
          <g stroke="#2A1A12" strokeWidth="2.6" strokeLinecap="round" fill="none">
            <path d="M35 55 Q39 58 43 55" />
            <path d="M57 55 Q61 58 65 55" />
          </g>
        ) : (
          <g>
            {[39, 61].map((cx) => (
              <g key={cx}>
                {darkFur && <circle cx={cx} cy="54" r="5.8" fill="#fff" />}
                <ellipse cx={cx} cy="54" rx="4.2" ry={mood === 'triste' ? 3.2 : 4.2} fill="#2A1A12">
                  {animate && (
                    <animate attributeName="ry" values="4.2;4.2;0.5;4.2" keyTimes="0;0.92;0.96;1" dur="4s" repeatCount="indefinite" />
                  )}
                </ellipse>
                <circle cx={cx + 1.4} cy="52.6" r="1.4" fill="#fff" />
              </g>
            ))}
          </g>
        )}
        {(mood === 'feliz' || mood === 'contento') && (
          <g fill="#F472B6" opacity=".45">
            <ellipse cx="31" cy="64" rx="5" ry="3" />
            <ellipse cx="69" cy="64" rx="5" ry="3" />
          </g>
        )}
        <path d="M50 62 l-3.5 -3 h7z" fill={ink} />
        <path d={MOUTH[mood]} fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        {mood === 'triste' && <path d="M68 58 q2.5 5 0 7.5 q-2.5 -2.5 0 -7.5" fill="#38BDF8" />}

        {/* mejoras: collar de cantera, cascabel de cobre, dije de plata, corona */}
        {has('collar') && <path d="M28 80 Q50 92 72 80" fill="none" stroke="#E8907A" strokeWidth="6" strokeLinecap="round" />}
        {has('cascabel') && (
          <g transform={has('dije') ? 'translate(-12 -2)' : undefined}>
            <circle cx="50" cy="88" r="4.5" fill="#B45309" stroke="#fff" strokeWidth="1.2" />
            <path d="M47 89 h6" stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )}
        {has('dije') && <polygon points="50,82 56,88 50,95 44,88" fill="#CBD5E1" stroke="#fff" strokeWidth="1.5" />}
        {has('estela') && (
          <path d="M38 30 L40 20 L45 26 L50 16 L55 26 L60 20 L62 30 Z" fill="#EAB308" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
        )}
      </g>
      {tired && (
        <text x="80" y="22" fontSize="12" fontWeight="700" fill="#78716C">
          z<tspan dx="2" dy="-5" fontSize="9">z</tspan>
        </text>
      )}
    </svg>
  );
};
