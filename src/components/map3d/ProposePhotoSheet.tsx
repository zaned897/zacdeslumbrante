import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import { proposePhoto } from '../../scene3d/placePhotos';

const LICENSE_OPTIONS = ['CC BY 4.0', 'CC BY-SA 4.0', 'CC0'] as const;

interface PhotoDraft {
  url: string;
  author: string;
  license: string;
  sourceUrl: string;
  comment: string;
}

const EMPTY_DRAFT: PhotoDraft = {
  url: '',
  author: '',
  license: '',
  sourceUrl: '',
  comment: '',
};

const DRAFT_STORAGE_PREFIX = 'zacatecas_photo_draft:';
const memoryDrafts = new Map<string, PhotoDraft>();

function readDraft(placeId: string): PhotoDraft {
  try {
    const raw = sessionStorage.getItem(`${DRAFT_STORAGE_PREFIX}${placeId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PhotoDraft>;
      return {
        url: typeof parsed.url === 'string' ? parsed.url : '',
        author: typeof parsed.author === 'string' ? parsed.author : '',
        license: typeof parsed.license === 'string' ? parsed.license : '',
        sourceUrl: typeof parsed.sourceUrl === 'string' ? parsed.sourceUrl : '',
        comment: typeof parsed.comment === 'string' ? parsed.comment : '',
      };
    }
  } catch {
    // Sin sessionStorage: se conserva en memoria durante la sesión.
  }
  return memoryDrafts.get(placeId) ?? EMPTY_DRAFT;
}

function writeDraft(placeId: string, draft: PhotoDraft): void {
  memoryDrafts.set(placeId, draft);
  try {
    sessionStorage.setItem(`${DRAFT_STORAGE_PREFIX}${placeId}`, JSON.stringify(draft));
  } catch {
    // Sin sessionStorage: el borrador sigue en memoria.
  }
}

function clearDraft(placeId: string): void {
  memoryDrafts.delete(placeId);
  try {
    sessionStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${placeId}`);
  } catch {
    // Ignorar si sessionStorage no está disponible.
  }
}

export interface ProposePhotoSheetProps {
  placeId: string;
  placeName?: string;
  language: Language;
  onClose: () => void;
}

/**
 * Hoja modal nativa (`<dialog>`) para proponer una foto de un lugar (#232).
 * PROTO: las propuestas se guardan en memoria del servidor con status "pending".
 */
export const ProposePhotoSheet: React.FC<ProposePhotoSheetProps> = ({
  placeId,
  placeName,
  language,
  onClose,
}) => {
  const t = TRANSLATIONS[language];
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const datalistId = `${baseId}-licenses`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [draft, setDraft] = useState<PhotoDraft>(() => readDraft(placeId));
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<'thanks' | 'offline' | 'invalid' | null>(null);

  useEffect(() => {
    setDraft(readDraft(placeId));
    setFeedback(null);
  }, [placeId]);

  // onClose cambia en cada render del padre: en un ref, para no cerrar y reabrir el diálogo
  // (ni abortar un envío en curso) cada vez que la vista 3D se repinta.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
      abortRef.current?.abort();
      if (dialog.open) dialog.close();
    };
  }, []);

  const updateField = <K extends keyof PhotoDraft>(field: K, value: PhotoDraft[K]) => {
    setDraft((prev) => {
      const next = { ...prev, [field]: value };
      writeDraft(placeId, next);
      return next;
    });
    if (feedback === 'thanks') setFeedback(null);
  };

  const handleCloseClick = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else onClose();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setFeedback(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const comment = draft.comment.trim();
    const result = await proposePhoto(
      {
        placeId,
        url: draft.url.trim(),
        author: draft.author.trim(),
        license: draft.license.trim(),
        sourceUrl: draft.sourceUrl.trim(),
        ...(comment ? { comment } : {}),
      },
      controller.signal,
    );
    if (controller.signal.aborted) return;
    setSending(false);
    if (result.ok) {
      clearDraft(placeId);
      setDraft(EMPTY_DRAFT);
      setFeedback('thanks');
      return;
    }
    setFeedback(result.reason);
  };

  const inputClass =
    'mt-1 w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#9A3412] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9A3412]';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-24px)] max-w-[420px] max-h-[90dvh] overflow-y-auto rounded-2xl border border-[#E7DCCB] bg-[#FBF9F5] p-4 text-stone-900 shadow-xl backdrop:bg-stone-950/55"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {placeName && (
            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-[#9A3412]">
              {placeName}
            </p>
          )}
          <h2 id={titleId} className="font-serif text-base font-bold leading-snug text-stone-900">
            {t.view3dProposeTitle}
          </h2>
        </div>
        <button
          type="button"
          onClick={handleCloseClick}
          aria-label={t.view3dProposeClose}
          className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl text-stone-600 hover:bg-stone-200/70 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A3412] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 rounded-xl border border-[#E7DCCB] bg-[#F2EEE8] px-3 py-2 text-xs leading-snug text-stone-700">
        <p className="font-semibold text-stone-900">{t.view3dProposeReview}</p>
        <p className="mt-1">{t.view3dProposeRules}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label htmlFor={`${baseId}-url`} className="block text-xs font-semibold text-stone-800">
            {t.view3dProposeUrl}
          </label>
          <input
            id={`${baseId}-url`}
            type="url"
            required
            maxLength={2000}
            value={draft.url}
            onChange={(e) => updateField('url', e.target.value)}
            placeholder="https://upload.wikimedia.org/..."
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-author`} className="block text-xs font-semibold text-stone-800">
            {t.view3dProposeAuthor}
          </label>
          <input
            id={`${baseId}-author`}
            type="text"
            required
            maxLength={200}
            value={draft.author}
            onChange={(e) => updateField('author', e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-license`} className="block text-xs font-semibold text-stone-800">
            {t.view3dProposeLicense}
          </label>
          <input
            id={`${baseId}-license`}
            type="text"
            list={datalistId}
            required
            maxLength={80}
            value={draft.license}
            onChange={(e) => updateField('license', e.target.value)}
            className={inputClass}
          />
          <datalist id={datalistId}>
            {[...LICENSE_OPTIONS, t.view3dProposePublicDomain, t.view3dProposePermission].map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor={`${baseId}-source`} className="block text-xs font-semibold text-stone-800">
            {t.view3dProposeSource}
          </label>
          <input
            id={`${baseId}-source`}
            type="url"
            required
            maxLength={2000}
            value={draft.sourceUrl}
            onChange={(e) => updateField('sourceUrl', e.target.value)}
            placeholder="https://commons.wikimedia.org/wiki/File:..."
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-comment`} className="block text-xs font-semibold text-stone-800">
            {t.view3dProposeComment}
          </label>
          <textarea
            id={`${baseId}-comment`}
            rows={2}
            maxLength={1000}
            value={draft.comment}
            onChange={(e) => updateField('comment', e.target.value)}
            className={inputClass}
          />
        </div>

        {feedback === 'thanks' && (
          <p
            role="status"
            className="rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-xs font-semibold text-green-900"
          >
            {t.view3dProposeThanks}
          </p>
        )}

        {(feedback === 'offline' || feedback === 'invalid') && (
          <p
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900"
          >
            {feedback === 'offline' ? t.view3dProposeOffline : t.view3dProposeInvalid}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="flex w-full min-h-11 items-center justify-center rounded-full bg-[#9A3412] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#78350F] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A3412] cursor-pointer"
        >
          {sending ? t.view3dProposeSending : t.view3dProposeSend}
        </button>
      </form>
    </dialog>
  );
};
