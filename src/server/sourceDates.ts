import { INITIAL_KNOWLEDGE_BASE } from '../data/knowledgeBase.ts';

// Fecha de última revisión de cada fuente curada (#83). Sale de `lastVerified` en
// src/data/knowledgeBase.ts; las URL que agrega el usuario no tienen fecha conocida.

function key(url: string): string {
  return url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
}

const BY_URL = new Map(INITIAL_KNOWLEDGE_BASE.map((s) => [key(s.url), s]));

export interface SourceInfo {
  title: string;
  reviewedAt: string | null;
}

/** Nombre y fecha de revisión (AAAA-MM-DD) de una fuente curada, o null si no se conoce. */
export function sourceInfo(url: string): SourceInfo | null {
  const s = BY_URL.get(key(url));
  return s ? { title: s.title, reviewedAt: s.lastVerified ?? null } : null;
}

/** Línea de una fuente activa para el modelo: nombre, URL y fecha de revisión. */
export function sourceLine(url: string): string {
  const info = sourceInfo(url);
  if (!info) return `• ${url} · sin fecha de revisión`;
  return `• ${info.title} — ${url} · Revisado ${info.reviewedAt ?? 'sin fecha'}`;
}
