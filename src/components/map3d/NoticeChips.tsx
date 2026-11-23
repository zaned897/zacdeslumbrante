import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { Camera, X } from 'lucide-react';

/**
 * Avisos en chips (#309): «Misión de hoy», la temporada o la ciudad estilizada ya no van encima de la
 * ciudad. Viven en una fila chica en el borde inferior; al tocar uno se abre su texto y, una vez
 * visto, el chip no vuelve (localStorage con try/catch). El chip de fotos cercanas va en la misma fila.
 */
const STORAGE_KEY = 'zacatecas_seen_notices_v1';

export interface Notice {
  /** Identifica el aviso para no volver a mostrarlo; cambia si el aviso cambia (p. ej. otra temporada). */
  id: string;
  icon: string;
  label: string;
  /** Color de acento del chip (borde izquierdo). */
  accent?: string;
  body: ReactNode;
}

let memory: string[] = [];
function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    // Sin almacenamiento: se recuerda solo mientras la página siga abierta.
  }
  return memory;
}
function writeSeen(ids: string[]): void {
  memory = ids;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Igual que arriba.
  }
}

export function NoticeChips({
  notices,
  photoCount,
  photoLabel,
  onOpenPhotos,
  closeLabel,
  className = '',
}: {
  notices: Notice[];
  /** Fotos cerca que no se muestran como tarjeta; 0 oculta el chip. */
  photoCount: number;
  photoLabel: string;
  onOpenPhotos: () => void;
  closeLabel: string;
  className?: string;
}) {
  const [seen, setSeen] = useState<string[]>(readSeen);
  const [open, setOpen] = useState<string | null>(null);
  const panelId = useId();
  const pending = notices.filter((n) => !seen.includes(n.id));
  const current = pending.find((n) => n.id === open) ?? null;

  const show = useCallback((id: string) => {
    setOpen((o) => (o === id ? null : id));
    // Abrirlo cuenta como verlo: al cerrarlo, el chip ya no vuelve.
    const next = readSeen();
    if (!next.includes(id)) writeSeen([...next, id]);
  }, []);
  const close = useCallback(() => {
    setOpen(null);
    setSeen(readSeen());
  }, []);

  if (!pending.length && photoCount <= 0) return null;
  return (
    <div className={`pointer-events-none absolute bottom-6 left-3 right-20 z-20 flex flex-col items-start gap-2 ${className}`}>
      {current && (
        <div id={panelId} role="region" aria-label={current.label}
          className="glass pointer-events-auto relative w-full max-w-xs rounded-2xl p-3 pr-9 text-[11px] leading-snug text-stone-800">
          {current.body}
          <button type="button" onClick={close} aria-label={closeLabel}
            className="absolute right-2 top-2 grid h-6 w-6 cursor-pointer place-items-center rounded-full text-stone-500 hover:bg-white/60">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {photoCount > 0 && (
          <button type="button" onClick={onOpenPhotos}
            className="glass jelly pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-stone-900">
            <Camera className="h-3.5 w-3.5 text-stone-600" aria-hidden="true" />
            {photoLabel.replace('{n}', String(photoCount))}
          </button>
        )}
        {pending.map((n) => (
          <button key={n.id} type="button" onClick={() => show(n.id)} aria-expanded={open === n.id} aria-controls={open === n.id ? panelId : undefined}
            className="glass jelly pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-full border-l-4 px-3 py-1.5 text-[11px] font-semibold text-stone-900"
            style={{ borderLeftColor: n.accent ?? '#9A3412' }}>
            <span aria-hidden="true">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const PHONE_QUERY = '(max-width: 639px)';
/** true en pantallas de celular (< 640 px), el mismo corte que usa el motor para las fotos. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(PHONE_QUERY).matches === true);
  useEffect(() => {
    const mq = window.matchMedia?.(PHONE_QUERY);
    if (!mq) return;
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return phone;
}
