import fs from 'fs';
import path from 'path';

// Búsqueda BM25 sobre el corpus que genera `services/kb` (python -m kb.ingest).
// PROTO: port directo de services/kb/kb/search.py para no levantar Python en cada consulta;
// si cambias la tokenización, cámbiala en los dos lados.

export interface KnowledgeChunk {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  url: string;
  pageTitle: string;
  category: string;
  fetchedAt: string;
  text: string;
}

export interface KnowledgeHit {
  score: number;
  chunk: KnowledgeChunk;
}

const CORPUS_PATH = process.env.KB_CORPUS_PATH || path.resolve('services/kb/data/corpus.jsonl');

const STOP = new Set(
  `a al algo como con cual cuales cuando de del desde donde el ella en entre es esta este esto
  fue ha hay la las le lo los mas me mi muy no o para pero por que quien se ser si sin sobre su
  sus tambien te un una uno unos y ya
  an and are as at be by can do for from how i in is it of on or the to was what when where which
  who why with you your`.split(/\s+/)
);

export function tokenize(text: string): string[] {
  const folded = text.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
  const out: string[] = [];
  for (let t of folded.match(/[a-z0-9]+/g) ?? []) {
    if (STOP.has(t) || t.length < 2) continue;
    if (t.length > 4 && t.endsWith('es')) t = t.slice(0, -2);
    else if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1);
    out.push(t);
  }
  return out;
}

class Index {
  private docs: Map<string, number>[];
  private lens: number[];
  private avg: number;
  private idf = new Map<string, number>();

  constructor(readonly chunks: KnowledgeChunk[], private k1 = 1.5, private b = 0.75) {
    this.docs = chunks.map((c) => {
      const tf = new Map<string, number>();
      for (const t of tokenize(`${c.pageTitle} ${c.text}`)) tf.set(t, (tf.get(t) ?? 0) + 1);
      return tf;
    });
    this.lens = this.docs.map((d) => [...d.values()].reduce((a, n) => a + n, 0));
    this.avg = this.lens.length ? this.lens.reduce((a, n) => a + n, 0) / this.lens.length : 0;
    const df = new Map<string, number>();
    for (const d of this.docs) for (const t of d.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    const n = chunks.length;
    for (const [t, f] of df) this.idf.set(t, Math.log(1 + (n - f + 0.5) / (f + 0.5)));
  }

  search(query: string, k = 3, sourceUrls?: Set<string>, perSource = 2): KnowledgeHit[] {
    const terms = tokenize(query);
    const scored: KnowledgeHit[] = [];
    this.docs.forEach((d, i) => {
      if (sourceUrls && !sourceUrls.has(this.chunks[i].sourceUrl)) return;
      let s = 0;
      for (const t of terms) {
        const tf = d.get(t);
        if (!tf) continue;
        const norm = 1 - this.b + (this.b * this.lens[i]) / (this.avg || 1);
        s += ((this.idf.get(t) ?? 0) * tf * (this.k1 + 1)) / (tf + this.k1 * norm);
      }
      if (s > 0) scored.push({ score: s, chunk: this.chunks[i] });
    });
    scored.sort((a, b) => b.score - a.score);
    const out: KnowledgeHit[] = [];
    const seen = new Map<string, number>();
    for (const h of scored) {
      const n = seen.get(h.chunk.sourceId) ?? 0;
      if (n < perSource) {
        out.push(h);
        seen.set(h.chunk.sourceId, n + 1);
      }
      if (out.length === k) break;
    }
    return out;
  }
}

let cached: { mtimeMs: number; index: Index } | null = null;

// Relee el corpus solo si cambió en disco; sin corpus, el chat sigue como antes.
function loadIndex(): Index | null {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(CORPUS_PATH);
  } catch {
    return null;
  }
  if (cached?.mtimeMs !== stat.mtimeMs) {
    const chunks = fs
      .readFileSync(CORPUS_PATH, 'utf8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as KnowledgeChunk);
    cached = { mtimeMs: stat.mtimeMs, index: new Index(chunks) };
  }
  return cached.index;
}

export function searchKnowledge(query: string, k = 4, activeUrls: string[] = []): KnowledgeHit[] {
  const index = loadIndex();
  if (!index) return [];
  return index.search(query, k, activeUrls.length ? new Set(activeUrls) : undefined);
}

export function citation(c: KnowledgeChunk): string {
  return `${c.sourceTitle} · ${c.url} · consultado ${c.fetchedAt.slice(0, 10)}`;
}

export function promptContext(hits: KnowledgeHit[]): string {
  return hits.map((h, i) => `[${i + 1}] ${h.chunk.text}\n(Fuente: ${citation(h.chunk)})`).join('\n\n');
}
