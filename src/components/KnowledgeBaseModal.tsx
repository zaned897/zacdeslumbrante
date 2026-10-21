import React, { useState } from 'react';
import { X, Search, RotateCcw, Plus, ExternalLink, Check, ShieldCheck } from 'lucide-react';
import { KnowledgeBaseURL, KnowledgeCategory, Language } from '../types';
import { TRANSLATIONS } from '../data/i18n';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  knowledgeBase: KnowledgeBaseURL[];
  onToggleUrl: (id: string) => void;
  onAddCustomUrl: (title: string, url: string) => void;
  onResetDefault: () => void;
}

export const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({
  isOpen,
  onClose,
  language,
  knowledgeBase,
  onToggleUrl,
  onAddCustomUrl,
  onResetDefault,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [customTitle, setCustomTitle] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const t = TRANSLATIONS[language];

  const filteredList = knowledgeBase.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim() || !customTitle.trim()) return;
    onAddCustomUrl(customTitle.trim(), customUrl.trim());
    setCustomTitle('');
    setCustomUrl('');
    setIsAdding(false);
  };

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: t.sourceCategoryAll },
    { id: 'tourism', label: t.sourceCategoryTourism },
    { id: 'unesco', label: t.sourceCategoryUnesco },
    { id: 'museums', label: t.sourceCategoryMuseums },
    { id: 'archaeology', label: t.sourceCategoryArchaeology },
    { id: 'archives', label: t.sourceCategoryArchives },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FBF9F5] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-stone-300 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#9A3412]/10 text-[#9A3412] rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-stone-900 leading-snug">
                {t.knowledgeBaseTitle}
              </h2>
              <p className="text-xs text-stone-500">
                {knowledgeBase.filter((k) => k.isEnabled).length} {t.sourcesActiveCount.replace('{count}', '')}
                · UNESCO, INAH, SECTUR, Archivos y Portales del Estado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search, Filters & Reset */}
        <div className="px-6 py-3.5 bg-[#F7F4EE] border-b border-stone-200 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder={language === 'es' ? 'Buscar fuente por título o URL...' : 'Search source by name or URL...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9A3412]/30"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-[#9A3412] text-white'
                    : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#9A3412]" />
              <span>{t.addCustomSource}</span>
            </button>
            <button
              onClick={onResetDefault}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg transition-colors cursor-pointer"
              title={t.resetDefaultSources}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{language === 'es' ? 'Restablecer' : 'Reset'}</span>
            </button>
          </div>
        </div>

        {/* Add custom source drawer */}
        {isAdding && (
          <form onSubmit={handleAddSubmit} className="p-4 bg-white border-b border-stone-200 space-y-3">
            <p className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              {t.addCustomSource}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder={language === 'es' ? 'Título o Dependencia' : 'Title or Agency'}
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                required
                className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
              />
              <input
                type="url"
                placeholder={t.addUrlPlaceholder}
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                required
                className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#9A3412] hover:bg-[#78350F] rounded-lg transition-colors cursor-pointer"
              >
                Guardar Fuente
              </button>
            </div>
          </form>
        )}

        {/* Scrollable Sources List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 divide-y divide-stone-200/60">
          {filteredList.map((source) => (
            <div
              key={source.id}
              className={`pt-3 first:pt-0 flex items-start justify-between gap-4 p-3 rounded-xl transition-colors ${
                source.isEnabled ? 'bg-white' : 'bg-stone-100/60 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs font-bold text-stone-900 leading-snug">
                    {source.title}
                  </h3>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                    {source.category}
                  </span>
                  <span className="text-[10px] text-stone-500">
                    · {t.verifiedOn}: {source.lastVerified}
                  </span>
                </div>

                <p className="text-xs text-stone-600 line-clamp-2">
                  {source.description}
                </p>

                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-[#9A3412] hover:underline"
                >
                  <span className="truncate max-w-md">{source.url}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>

              {/* Toggle Enable Switch */}
              <button
                onClick={() => onToggleUrl(source.id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#9A3412] focus:ring-offset-2 ${
                  source.isEnabled ? 'bg-[#9A3412]' : 'bg-stone-300'
                }`}
                role="switch"
                aria-checked={source.isEnabled}
                title={source.isEnabled ? 'Desactivar fuente' : 'Activar fuente'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                    source.isEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                >
                  {source.isEnabled && <Check className="w-3 h-3 text-[#9A3412]" />}
                </span>
              </button>
            </div>
          ))}

          {filteredList.length === 0 && (
            <div className="text-center py-12 text-stone-500 text-xs">
              {language === 'es' ? 'No se encontraron fuentes con el criterio de búsqueda.' : 'No sources found matching search criteria.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-200 bg-white flex items-center justify-between text-xs text-stone-600">
          <span>
            {knowledgeBase.filter((k) => k.isEnabled).length} de {knowledgeBase.length} fuentes activas para consulta en tiempo real.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            {t.closeModal}
          </button>
        </div>
      </div>
    </div>
  );
};
