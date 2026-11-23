import React, { useEffect, useId, useRef, useState } from 'react';
import { Camera, ExternalLink, Info, X } from 'lucide-react';
import type { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import type { PlacePhoto } from '../../scene3d/placePhotos';

/** Arrastre horizontal (px) que pasa a la foto vecina y arrastre hacia abajo que cierra el visor. */
const SWIPE_PX = 60;
const CLOSE_DRAG_PX = 120;
const MAX_ZOOM = 4;

export interface PhotoViewerProps {
  photos: PlacePhoto[];
  startIndex: number;
  placeName: string;
  /** Con fotos de varios lugares («N fotos cerca», #309), el nombre de cada una. */
  placeNameOf?: (photo: PlacePhoto) => string;
  language: Language;
  onClose: () => void;
  /** Abre «Proponer una foto» para el lugar. */
  onPropose: (placeId: string) => void;
}

interface Gesture {
  pointers: Map<number, { x: number; y: number }>;
  startX: number;
  startY: number;
  /** Distancia y zoom al empezar a pellizcar. */
  pinchDist: number;
  pinchZoom: number;
  panX: number;
  panY: number;
  moved: boolean;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Visor de fotos a pantalla completa (#307): contador, deslizar para la siguiente, pellizcar para
 * acercar, arrastrar hacia abajo o ✕ para cerrar. Los créditos (autor, licencia, fuente) están a un
 * toque en «Créditos». Es un `<dialog>` modal: Esc lo cierra y queda debajo de «Proponer una foto».
 */
export const PhotoViewer: React.FC<PhotoViewerProps> = ({ photos, startIndex, placeName, placeNameOf, language, onClose, onPropose }) => {
  const t = TRANSLATIONS[language];
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), Math.max(photos.length - 1, 0)));
  const [credits, setCredits] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture>({ pointers: new Map(), startX: 0, startY: 0, pinchDist: 0, pinchZoom: 1, panX: 0, panY: 0, moved: false });
  const reduced = useRef(prefersReducedMotion()).current;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
      if (dialog.open) dialog.close();
    };
  }, []);

  const close = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else onClose();
  };

  const go = (delta: number) => {
    if (photos.length < 2) return;
    setIndex((i) => (i + delta + photos.length) % photos.length);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size === 1) {
      g.startX = e.clientX;
      g.startY = e.clientY;
      g.panX = pan.x;
      g.panY = pan.y;
      g.moved = false;
      setDragging(true);
    } else if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      g.pinchDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      g.pinchZoom = zoom;
      setDrag({ x: 0, y: 0 });
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size >= 2) {
      const [a, b] = [...g.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(Math.min(MAX_ZOOM, Math.max(1, (g.pinchZoom * dist) / g.pinchDist)));
      g.moved = true;
      return;
    }
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) g.moved = true;
    if (zoom > 1) {
      setPan({ x: g.panX + dx, y: g.panY + dy });
      return;
    }
    // Sin zoom: o desliza a los lados, o baja para cerrar; nunca las dos a la vez.
    if (Math.abs(dx) > Math.abs(dy)) setDrag({ x: dx, y: 0 });
    else setDrag({ x: 0, y: Math.max(0, dy) });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size > 0) return;
    setDragging(false);
    if (zoom <= 1) {
      if (drag.y > CLOSE_DRAG_PX) {
        close();
        return;
      }
      if (drag.x <= -SWIPE_PX) go(1);
      else if (drag.x >= SWIPE_PX) go(-1);
      setPan({ x: 0, y: 0 });
    }
    setDrag({ x: 0, y: 0 });
  };

  // Doble toque o doble clic: acerca al doble o regresa.
  const onDoubleClick = () => {
    setZoom((z) => (z > 1 ? 1 : 2));
    setPan({ x: 0, y: 0 });
  };

  const photo = photos[index];
  if (!photo) return null;
  const fade = drag.y > 0 ? Math.max(0.35, 1 - drag.y / (CLOSE_DRAG_PX * 2.5)) : 1;
  const transition = dragging || reduced ? 'none' : 'transform 240ms cubic-bezier(.2,.9,.3,1)';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-transparent p-0 text-white backdrop:bg-transparent"
      data-testid="photo-viewer"
    >
      <div className="absolute inset-0 bg-[#0C0A09]" style={{ opacity: fade }} aria-hidden="true" />

      <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={close}
          aria-label={t.view3dViewerClose}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <h2 id={titleId} className="truncate text-sm font-bold">{photo && placeNameOf ? placeNameOf(photo) : placeName}</h2>
          <p className="text-xs text-white/75" aria-live="polite">
            {t.view3dViewerCount.replace('{n}', String(index + 1)).replace('{total}', String(photos.length))}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCredits((v) => !v)}
          aria-expanded={credits}
          className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-bold backdrop-blur-md hover:bg-white/25 cursor-pointer"
        >
          <Info className="h-4 w-4" />
          {t.view3dViewerCredits}
        </button>
      </div>

      <div
        className="absolute inset-0 flex touch-none select-none items-center justify-center"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <img
          key={photo.id}
          src={photo.url}
          alt={photo.caption[language]}
          referrerPolicy="no-referrer"
          draggable={false}
          onError={(e) => {
            // Sin la foto grande (red lenta o Commons caído) queda la miniatura local.
            if (e.currentTarget.src !== new URL(photo.thumbUrl, window.location.href).href) e.currentTarget.src = photo.thumbUrl;
          }}
          className="max-h-[78dvh] w-full max-w-3xl object-contain"
          style={{
            transform: `translate(${drag.x + pan.x}px, ${drag.y + pan.y}px) scale(${zoom * (drag.y > 0 ? 1 - Math.min(drag.y, 300) / 1200 : 1)})`,
            transition,
          }}
        />
      </div>

      {photos.length > 1 && (
        <span className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex justify-center gap-1.5" aria-hidden="true">
          {photos.map((p, i) => (
            <i key={p.id} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/35'}`} />
          ))}
        </span>
      )}
      {!credits && (
        <p className="pointer-events-none absolute inset-x-4 bottom-6 z-10 pb-[env(safe-area-inset-bottom)] text-center text-xs text-stone-200">
          {photo.caption[language]}
        </p>
      )}

      {credits && (
        <section
          className="absolute inset-x-3 bottom-3 z-20 mx-auto flex max-w-md flex-col gap-2 rounded-[24px] border border-white/25 bg-stone-900/70 p-4 text-sm backdrop-blur-xl mb-[env(safe-area-inset-bottom)]"
          aria-label={t.view3dViewerCredits}
        >
          <b className="text-[15px]">{photo.caption[language]}</b>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-white/20 pt-2 text-xs">
            <dt className="text-white/65">{t.view3dViewerAuthor}</dt>
            <dd className="text-right font-semibold">{photo.author}</dd>
            <dt className="text-white/65">{t.view3dViewerLicense}</dt>
            <dd className="text-right font-semibold">{photo.license}</dd>
            <dt className="text-white/65">{t.view3dViewerSource}</dt>
            <dd className="text-right">
              <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline">
                Wikimedia Commons
                <ExternalLink className="h-3 w-3" />
              </a>
            </dd>
          </dl>
          <button
            type="button"
            onClick={() => onPropose(photo.placeId)}
            className="mt-1 flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-[#9A3412] hover:bg-white cursor-pointer"
          >
            <Camera className="h-4 w-4" />
            {t.view3dProposePhoto}
          </button>
        </section>
      )}
    </dialog>
  );
};
