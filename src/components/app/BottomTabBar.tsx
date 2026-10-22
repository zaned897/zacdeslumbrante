import React from 'react';
import { MessageCircle, Box, Trophy, CalendarDays } from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import { AppTab } from './tabs';

interface BottomTabBarProps {
  language: Language;
  active: AppTab;
  onSelect: (tab: AppTab) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ language, active, onSelect }) => {
  const t = TRANSLATIONS[language];
  const tabs: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: t.tabChat, icon: <MessageCircle className="w-5 h-5" /> },
    { id: '3d', label: t.tab3d, icon: <Box className="w-5 h-5" /> },
    { id: 'badges', label: t.tabBadges, icon: <Trophy className="w-5 h-5" /> },
    { id: 'plans', label: t.tabPlans, icon: <CalendarDays className="w-5 h-5" /> },
  ];

  return (
    <nav
      className="app-tabbar fixed bottom-0 inset-x-0 z-40 border-t border-linea bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label={language === 'es' ? 'Secciones' : 'Sections'}
    >
      <ul className="mx-auto max-w-lg flex justify-around h-16">
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                aria-current={on ? 'page' : undefined}
                className={`w-full h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terracota ${
                  on ? 'text-cantera' : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
