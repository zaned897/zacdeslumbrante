import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Compass,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { ChatMessage, Language, Place } from '../types';
import { TRANSLATIONS } from '../data/i18n';
import { ZACATECAS_PLACES } from '../data/places';

interface ChatMessageItemProps {
  message: ChatMessage;
  language: Language;
  onPlaceClick: (place: Place) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  language,
  onPlaceClick,
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
      <div className="flex justify-end mb-4 animate-in fade-in duration-150">
        <div className="max-w-[85%] sm:max-w-[75%] px-4 py-3 bg-[#9A3412] text-white rounded-2xl rounded-tr-xs shadow-xs">
          <p className="text-sm font-sans leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
          <span className="block text-[10px] text-stone-300 font-mono mt-1 text-right">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  // Assistant Message Processing
  const rawText = message.content;

  // Extract explicit spatial tags: [LUGARES: place1, place2]
  const placesMatch = rawText.match(/\[LUGARES(?:_MENCIONADOS)?:\s*([^\]]+)\]/i);
  let placeIds: string[] = [];
  if (placesMatch && placesMatch[1]) {
    placeIds = placesMatch[1]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  // Also check if any known place name is present in the text if no explicit tag
  if (placeIds.length === 0) {
    placeIds = ZACATECAS_PLACES.filter(
      (p) =>
        rawText.toLowerCase().includes(p.nameEs.toLowerCase()) ||
        rawText.toLowerCase().includes(p.name.toLowerCase()) ||
        (p.puebloMagico && rawText.toLowerCase().includes(p.puebloMagico.toLowerCase()))
    ).map((p) => p.id);
  }

  // Distinct unique places
  const matchedPlaces = ZACATECAS_PLACES.filter((p) => placeIds.includes(p.id));

  // Check for data gap declaration
  const gapMatch = rawText.match(/\[GAP_DECLARADO:\s*([^\]]+)\]/i);
  const hasDataGap = Boolean(gapMatch || rawText.includes('Dato no disponible en los registros oficiales'));

  // Clean raw text by removing raw bracket metadata tags from main view
  const cleanedContent = rawText
    .replace(/\[LUGARES(?:_MENCIONADOS)?:[^\]]+\]/gi, '')
    .replace(/\[GAP_DECLARADO:[^\]]+\]/gi, '')
    .trim();

  // Detect distinction sections if present in text
  const hasHistory = /\[HISTORIA(?: DOCUMENTADA)?\]|Historia Documentada/i.test(cleanedContent);
  const hasLegend = /\[LEYENDA(?: CULTURAL)?\]|Leyenda Cultural/i.test(cleanedContent);
  const hasRecommendation = /\[RECOMENDACI[ÓO]N(?: PR[ÁA]CTICA)?\]|Recomendaci[oó]n Pr[aá]ctica/i.test(cleanedContent);

  // Extract URLs from text or citations
  const urlRegex = /(https?:\/\/[^\s\)\],]+)/g;
  const urlsInText = Array.from(new Set(cleanedContent.match(urlRegex) || []));

  return (
    <div className="flex flex-col mb-6 animate-in fade-in duration-200">
      <div className="flex items-start gap-3">
        {/* Assistant Avatar */}
        <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white shrink-0 shadow-xs mt-1">
          <span className="font-serif font-bold text-xs tracking-tight text-amber-300">ZD</span>
        </div>

        {/* Message Container */}
        <div className="flex-1 max-w-[95%] sm:max-w-[88%] space-y-3">
          {/* Main Bubble */}
          <div className="p-4 sm:p-5 bg-white border border-stone-200/90 rounded-2xl rounded-tl-xs shadow-2xs text-stone-900 space-y-3">
            {/* Distinction Pills Header if detected */}
            {(hasHistory || hasLegend || hasRecommendation) && (
              <div className="flex items-center gap-2 pb-2.5 border-b border-stone-100 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  {language === 'es' ? 'Distinción de Contenido:' : 'Content Delineation:'}
                </span>
                {hasHistory && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                    <BookOpen className="w-3 h-3 text-amber-700" />
                    <span>{t.tagHistory}</span>
                  </span>
                )}
                {hasLegend && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-900 border border-purple-200">
                    <Sparkles className="w-3 h-3 text-purple-700" />
                    <span>{t.tagLegend}</span>
                  </span>
                )}
                {hasRecommendation && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
                    <Compass className="w-3 h-3 text-emerald-700" />
                    <span>{t.tagRecommendation}</span>
                  </span>
                )}
              </div>
            )}

            {/* Markdown Text Body */}
            <div className="text-sm font-sans leading-relaxed text-stone-800 space-y-3 prose prose-stone max-w-none">
              {cleanedContent.split('\n\n').map((paragraph, idx) => {
                // Check if paragraph is a distinction header
                if (/^\[HISTORIA(?: DOCUMENTADA)?\]|^###? .*Historia/i.test(paragraph)) {
                  return (
                    <div key={idx} className="pt-2">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-100/70 border border-amber-300 rounded text-xs font-bold text-amber-950 mb-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-amber-800" />
                        <span>{t.tagHistory}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-stone-800">
                        {paragraph.replace(/^\[HISTORIA(?: DOCUMENTADA)?\]/i, '').trim()}
                      </p>
                    </div>
                  );
                }
                if (/^\[LEYENDA(?: CULTURAL)?\]|^###? .*Leyenda/i.test(paragraph)) {
                  return (
                    <div key={idx} className="pt-2">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-purple-100/70 border border-purple-300 rounded text-xs font-bold text-purple-950 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-800" />
                        <span>{t.tagLegend}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-stone-800 italic">
                        {paragraph.replace(/^\[LEYENDA(?: CULTURAL)?\]/i, '').trim()}
                      </p>
                    </div>
                  );
                }
                if (/^\[RECOMENDACI[ÓO]N(?: PR[ÁA]CTICA)?\]|^###? .*Recomendaci/i.test(paragraph)) {
                  return (
                    <div key={idx} className="pt-2">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100/70 border border-emerald-300 rounded text-xs font-bold text-emerald-950 mb-1.5">
                        <Compass className="w-3.5 h-3.5 text-emerald-800" />
                        <span>{t.tagRecommendation}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-stone-800">
                        {paragraph.replace(/^\[RECOMENDACI[ÓO]N(?: PR[ÁA]CTICA)?\]/i, '').trim()}
                      </p>
                    </div>
                  );
                }

                return (
                  <p key={idx} className="whitespace-pre-wrap text-stone-800">
                    {paragraph}
                  </p>
                );
              })}
            </div>

            {/* Missing Data Protocol Alert if triggered */}
            {hasDataGap && (
              <div className="p-3 bg-amber-50/80 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">{t.dataGapTitle}</p>
                  <p className="text-amber-900 text-[11px] leading-relaxed">
                    {t.dataGapNotice}
                  </p>
                </div>
              </div>
            )}

            {/* Mentioned Places Spatial Badges (Click to View on Google Maps) */}
            {matchedPlaces.length > 0 && (
              <div className="pt-3 border-t border-stone-100 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  {language === 'es' ? 'Ubicaciones en el Mapa:' : 'Discussed on Map:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {matchedPlaces.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => onPlaceClick(place)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-stone-100 hover:bg-[#9A3412] hover:text-white text-stone-800 border border-stone-300 rounded-lg transition-colors cursor-pointer group"
                    >
                      <MapPin className="w-3 h-3 text-[#9A3412] group-hover:text-white transition-colors" />
                      <span>{language === 'es' ? place.nameEs : place.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Inline Citations & Verification Timestamps */}
            {urlsInText.length > 0 && (
              <div className="pt-2.5 border-t border-stone-100 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium">
                  <span>{t.sourceVerification}</span>
                  <div className="flex items-center gap-1 text-stone-500 font-mono">
                    <Clock className="w-3 h-3 text-stone-400" />
                    <span>{t.lastChecked} Octubre 2026</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {urlsInText.slice(0, 4).map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-[#9A3412] bg-[#9A3412]/5 hover:bg-[#9A3412]/10 border border-[#9A3412]/20 rounded transition-colors"
                    >
                      <span className="truncate max-w-[200px]">{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between px-2 text-xs text-stone-400">
            <span className="font-mono text-[11px]">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 hover:text-stone-700 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? t.copiedText : t.copyText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
