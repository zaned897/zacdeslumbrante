import React, { useState } from 'react';
import { BookOpen, Sparkles, Compass, MapPin, Copy, Check, AlertTriangle, Box } from 'lucide-react';
import { ChatMessage, KnowledgeBaseURL, Language, Place, SourceCitation } from '../types';
import { TRANSLATIONS } from '../data/i18n';
import { ZACATECAS_PLACES } from '../data/places';

interface ChatMessageItemProps {
  message: ChatMessage;
  language: Language;
  onPlaceClick: (place: Place) => void;
  onOpen3d?: () => void;
  knowledgeBase?: KnowledgeBaseURL[];
}

const URL_RE = /https?:\/\/[^\s)\],·]+/g;

/** Chip de cita numerada, como en el adelanto: [1] [2]… */
const Cite: React.FC<{ n: number; url?: string }> = ({ n, url }) => {
  const cls =
    'inline-grid place-items-center min-w-[1.15rem] h-[1.15rem] px-1 mx-0.5 rounded bg-[#FDEBD8] text-cantera font-mono text-[10px] font-semibold align-[1px] no-underline';
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cls} title={url}>
      {n}
    </a>
  ) : (
    <span className={cls}>{n}</span>
  );
};

/** Resuelve las fuentes de una respuesta: las que mandó el servidor o, si no, las URL del texto. */
function resolveSources(message: ChatMessage, text: string, kb: KnowledgeBaseURL[]): SourceCitation[] {
  if (message.citations && message.citations.length > 0) return message.citations;
  const urls = Array.from(new Set(text.match(URL_RE) ?? []));
  return urls.map((url) => {
    const host = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    const known = kb.find((k) => k.url.replace(/\/$/, '') === url.replace(/\/$/, ''));
    return { title: known?.title ?? host, url, verificationDate: '' };
  });
}

/** Texto en línea: **negritas**, [n] y URL sueltas se vuelven chips de cita. */
function renderInline(text: string, sources: SourceCitation[], keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[(\d{1,2})\]|(https?:\/\/[^\s)\],·]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[1]) {
      out.push(<strong key={key} className="font-semibold text-carbon">{m[1]}</strong>);
    } else if (m[2]) {
      const n = Number(m[2]);
      out.push(<Cite key={key} n={n} url={sources[n - 1]?.url} />);
    } else if (m[3]) {
      // La puntuación final no es parte de la URL
      const url = m[3].replace(/[.;:!?]+$/, '');
      const idx = sources.findIndex((s) => s.url === url);
      out.push(
        idx >= 0 ? (
          <Cite key={key} n={idx + 1} url={url} />
        ) : (
          <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="text-cantera underline break-all">
            {url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
          </a>
        ),
      );
      re.lastIndex = m.index + url.length;
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const SECTION_STYLES = {
  history: { icon: BookOpen, cls: 'text-amber-800 bg-amber-50 border-amber-200' },
  legend: { icon: Sparkles, cls: 'text-purple-800 bg-purple-50 border-purple-200' },
  recommendation: { icon: Compass, cls: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
} as const;

type SectionKind = keyof typeof SECTION_STYLES;

function sectionOf(paragraph: string): { kind: SectionKind; rest: string } | null {
  const tests: [SectionKind, RegExp][] = [
    ['history', /^(?:\[HISTORIA(?: DOCUMENTADA)?\]|#{2,3} .*Historia[^\n]*)\s*/i],
    ['legend', /^(?:\[LEYENDA(?: CULTURAL)?\]|#{2,3} .*Leyenda[^\n]*)\s*/i],
    ['recommendation', /^(?:\[RECOMENDACI[ÓO]N(?: PR[ÁA]CTICA)?\]|#{2,3} .*Recomendaci[^\n]*)\s*/i],
  ];
  for (const [kind, re] of tests) {
    if (re.test(paragraph)) return { kind, rest: paragraph.replace(re, '') };
  }
  return null;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  language,
  onPlaceClick,
  onOpen3d,
  knowledgeBase = [],
}) => {
  const [copied, setCopied] = useState(false);
  const t = TRANSLATIONS[language];

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[82%] px-3.5 py-2.5 bg-cantera text-white rounded-[18px] rounded-br-[5px] text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  const rawText = message.content;

  // Lugares: etiqueta explícita [LUGARES: …] o, si no hay, nombres conocidos en el texto
  const placesMatch = rawText.match(/\[LUGARES(?:_MENCIONADOS)?:\s*([^\]]+)\]/i);
  let placeIds = placesMatch?.[1]
    ? placesMatch[1].split(',').map((p) => p.trim()).filter(Boolean)
    : [];
  if (placeIds.length === 0) {
    const lower = rawText.toLowerCase();
    placeIds = ZACATECAS_PLACES.filter(
      (p) =>
        lower.includes(p.nameEs.toLowerCase()) ||
        lower.includes(p.name.toLowerCase()) ||
        (p.puebloMagico && lower.includes(p.puebloMagico.toLowerCase())),
    ).map((p) => p.id);
  }
  const matchedPlaces = ZACATECAS_PLACES.filter((p) => placeIds.includes(p.id));

  const hasDataGap = /\[GAP_DECLARADO:[^\]]+\]|Dato no disponible en los registros oficiales/i.test(rawText);

  const sources = resolveSources(message, rawText, knowledgeBase);

  // Quita metadatos y líneas de fuente (se muestran abajo como lista numerada)
  const cleaned = rawText
    .replace(/\[LUGARES(?:_MENCIONADOS)?:[^\]]+\]/gi, '')
    .replace(/\[GAP_DECLARADO:[^\]]+\]/gi, '')
    .replace(/\[FUENTES?:[^\]]*\]/gi, '')
    // "[1] (https://…)": la URL ya está en la lista de fuentes
    .replace(/(\[\d{1,2}\])\s*\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\((https?:\/\/[^\s)]+)\)/g, '$1')
    .trim();

  const paragraphs = cleaned.split(/\n{2,}/).filter((p) => p.trim());

  const renderParagraph = (p: string, idx: number) => {
    const lines = p.split('\n');
    const isList = lines.every((l) => /^\s*(?:[-•*]|\d+\.)\s+/.test(l));
    if (isList) {
      return (
        <ul key={idx} className="space-y-1 pl-1">
          {lines.map((l, j) => (
            <li key={j} className="flex gap-2">
              <span className="text-cantera shrink-0">•</span>
              <span>{renderInline(l.replace(/^\s*(?:[-•*]|\d+\.)\s+/, ''), sources, `${idx}-${j}`)}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={idx} className="whitespace-pre-wrap">
        {renderInline(p.replace(/^#{1,4}\s+/, ''), sources, String(idx))}
      </p>
    );
  };

  return (
    <div className="flex flex-col items-start mb-4 gap-2">
      <div className="max-w-[94%] sm:max-w-[85%] px-3.5 py-3 bg-white border border-linea rounded-[18px] rounded-bl-[5px] text-sm leading-relaxed text-stone-800 space-y-2.5 break-words">
        {paragraphs.map((p, idx) => {
          const section = sectionOf(p);
          if (!section) return renderParagraph(p, idx);
          const { icon: Icon, cls } = SECTION_STYLES[section.kind];
          const label =
            section.kind === 'history' ? t.tagHistory : section.kind === 'legend' ? t.tagLegend : t.tagRecommendation;
          return (
            <div key={idx} className="space-y-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${cls}`}>
                <Icon className="w-3 h-3" />
                {label}
              </span>
              {section.rest.trim() &&
                section.rest
                  .split(/\n{2,}/)
                  .map((sub, j) => (
                    <div key={j} className={section.kind === 'legend' ? 'italic' : undefined}>
                      {renderParagraph(sub, idx * 100 + j)}
                    </div>
                  ))}
            </div>
          );
        })}

        {message.isStreaming && !rawText && (
          <span className="inline-flex gap-1 py-1" aria-label="…">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </span>
        )}

        {hasDataGap && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{t.dataGapTitle}</p>
              <p className="text-[11px]">{t.dataGapNotice}</p>
            </div>
          </div>
        )}

        {sources.length > 0 && !message.isStreaming && (
          <ol className="pt-2 border-t border-dashed border-[#E7DCCB] space-y-1">
            {sources.slice(0, 6).map((s, i) => (
              <li key={s.url + i} className="flex items-start gap-1.5 text-[11px] text-stone-600">
                <Cite n={i + 1} />
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-cantera hover:underline min-w-0">
                  <span className="block line-clamp-1">{s.title}</span>
                  {s.verificationDate && (
                    <span className="block font-mono text-[10px] text-stone-400">{s.verificationDate}</span>
                  )}
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>

      {!message.isStreaming && (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          {matchedPlaces.slice(0, 4).map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => onPlaceClick(place)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-cantera bg-white border border-[#E7DCCB] rounded-full hover:bg-caliza cursor-pointer"
            >
              <MapPin className="w-3 h-3" />
              {language === 'es' ? place.nameEs : place.name}
            </button>
          ))}
          {matchedPlaces.length > 0 && onOpen3d && (
            <button
              type="button"
              onClick={onOpen3d}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-cantera border border-cantera rounded-full hover:bg-[#7C2D12] cursor-pointer"
            >
              <Box className="w-3 h-3" />
              {t.chatSee3d}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? t.copiedText : t.copyText}
          </button>
        </div>
      )}
    </div>
  );
};
