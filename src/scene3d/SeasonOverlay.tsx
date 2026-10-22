import { useEffect, useRef } from 'react';
import type { Season } from '../data/seasons';

const PICADO_COLORS = ['#E4007C', '#FACC15', '#22C55E', '#F97316', '#38BDF8'];
const FIREWORK_COLORS = ['#F472B6', '#FDE047', '#60A5FA', '#F97316', '#A78BFA', '#FFFFFF'];

/** Banderitas de papel picado colgadas de un hilo, como en la pantalla de Día de Muertos (#73). */
function PapelPicado() {
  return (
    <div className="absolute top-14 md:top-16 -inset-x-2 h-7 z-[5] flex justify-between pointer-events-none" aria-hidden="true">
      <span className="absolute top-0.5 inset-x-0 h-px bg-white/60" />
      {Array.from({ length: 24 }, (_, i) => (
        <i
          key={i}
          className="block w-6 h-6 mt-0.5 opacity-90"
          style={{
            background: PICADO_COLORS[i % PICADO_COLORS.length],
            clipPath: 'polygon(0 0, 100% 0, 100% 70%, 85% 100%, 70% 72%, 50% 100%, 30% 72%, 15% 100%, 0 70%)',
          }}
        />
      ))}
    </div>
  );
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

/** Cohetes de la feria (#74) en un canvas 2D sobre el cielo; sirve igual con cualquier motor. */
function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sparks: Spark[] = [];
    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    };
    resize();
    const burst = (x: number, y: number) => {
      const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      for (let i = 0; i < 70; i++) {
        const a = (i / 70) * Math.PI * 2;
        const v = 1.6 + Math.random() * 2.2;
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color });
      }
    };
    const randomBurst = () =>
      burst(canvas.width * (0.15 + Math.random() * 0.7), canvas.height * (0.15 + Math.random() * 0.45));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of sparks) {
        ctx.globalAlpha = Math.max(s.life, 0);
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8 * devicePixelRatio;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.6 * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    if (reduced) {
      // Sin movimiento: tres estallidos quietos.
      for (let i = 0; i < 3; i++) randomBurst();
      for (const s of sparks) {
        s.x += s.vx * 22 * devicePixelRatio;
        s.y += s.vy * 22 * devicePixelRatio;
        s.life = 0.85;
      }
      draw();
      return;
    }

    let frame = 0;
    let last = performance.now();
    let nextBurst = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 16.7, 3);
      last = now;
      if (now > nextBurst) {
        randomBurst();
        nextBurst = now + 700 + Math.random() * 900;
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt * devicePixelRatio;
        s.y += s.vy * dt * devicePixelRatio;
        s.vy += 0.03 * dt;
        s.vx *= 0.985;
        s.life -= 0.012 * dt;
        if (s.life <= 0) sparks.splice(i, 1);
      }
      draw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-x-0 top-0 h-1/2 w-full z-[5] pointer-events-none" aria-hidden="true" />;
}

/**
 * Lo que la temporada pinta encima de cualquier motor: papel picado, cohetes y,
 * con Google o Cesium (que no tienen noche propia), un velo nocturno.
 */
export function SeasonOverlay({ season, tintNight }: { season: Season; tintNight: boolean }) {
  return (
    <>
      {tintNight && season.night && (
        <div
          className="absolute inset-0 z-[4] pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(30,27,75,.65), rgba(76,29,149,.25) 55%, rgba(15,23,42,.2))' }}
          aria-hidden="true"
        />
      )}
      {season.fireworks && <Fireworks />}
      {season.papelPicado && <PapelPicado />}
    </>
  );
}
