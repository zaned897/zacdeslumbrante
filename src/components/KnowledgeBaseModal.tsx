import React, { useState } from 'react';
import { Search, RotateCcw, Plus, ExternalLink } from 'lucide-react';
import { KnowledgeBaseURL, Language } from '../types';
import { TRANSLATIONS } from '../data/i18n';
import { Sheet } from './app/Sheet';

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

  const t = TRANSLATIONS[language];
  const es = language === 'es';
  const activeCount = knowledgeBase.filter((k) => k.isEnabled).length;

  const q = searchTerm.toLowerCase();
  const filteredList = knowledgeBase.filter(
    (item) =>
      (categoryFilter === 'all' || item.category === categoryFilter) &&
      (item.title.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)),
  );

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

  const field =
    'w-full h-10 px-3.5 text-sm bg-superficie border border-linea rounded-full focus:outline-none focus:border-cantera placeholder:text-tenue';

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      closeLabel={t.closeModal}
      title={t.knowledgeBaseTitle}
      subtitle={t.plansSourcesBody.replace('{count}', `${activeCount}/${knowledgeBase.length}`)}
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tenue" />
          <input
            type="search"
            placeholder={es ? 'Buscar fuente' : 'Search sources'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${field} pl-10`}
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              aria-pressed={categoryFilter === cat.id}
              className={`px-3.5 h-8 text-xs font-semibold rounded-full whitespace-nowrap cursor-pointer transition-colors ${
                categoryFilter === cat.id ? 'bg-carbon text-papel' : 'bg-caliza text-tenue hover:text-carbon'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {isAdding ? (
          <form onSubmit={handleAddSubmit} className="p-3 bg-caliza rounded-2xl space-y-2 animate-sube">
            <input
              type="text"
              placeholder={es ? 'Título o dependencia' : 'Title or agency'}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              required
              className={field}
            />
            <input
              type="url"
              placeholder={t.addUrlPlaceholder}
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              required
              className={field}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 h-9 text-sm text-tenue cursor-pointer">
                {es ? 'Cancelar' : 'Cancel'}
              </button>
              <button type="submit" className="px-4 h-9 text-sm font-semibold text-sobre-cantera bg-cantera rounded-full cursor-pointer">
                {es ? 'Guardar' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1.5 px-3.5 h-9 text-xs font-semibold text-cantera bg-caliza rounded-full cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.addCustomSource}
            </button>
            <button
              type="button"
              onClick={onResetDefault}
              title={t.resetDefaultSources}
              className="flex items-center gap-1.5 px-3.5 h-9 text-xs font-semibold text-tenue bg-caliza rounded-full cursor-pointer hover:text-carbon"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {es ? 'Restablecer' : 'Reset'}
            </button>
          </div>
        )}

        <ul className="divide-y divide-linea">
          {filteredList.map((source) => (
            <li key={source.id} className={`flex items-start gap-3 py-3 transition-opacity ${source.isEnabled ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-0">
                <b className="block text-sm leading-snug">{source.title}</b>
                <p className="text-xs text-tenue line-clamp-2 mt-0.5">{source.description}</p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 font-mono text-[11px] text-cantera hover:underline max-w-full"
                >
                  <span className="truncate">{source.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={source.isEnabled}
                aria-label={source.title}
                onClick={() => onToggleUrl(source.id)}
                className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full cursor-pointer transition-colors ${
                  source.isEnabled ? 'bg-cantera' : 'bg-linea'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    source.isEnabled ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </li>
          ))}
          {filteredList.length === 0 && (
            <li className="py-10 text-center text-sm text-tenue">
              {es ? 'Ninguna fuente coincide con la búsqueda.' : 'No sources match your search.'}
            </li>
          )}
        </ul>
      </div>
    </Sheet>
  );
};
