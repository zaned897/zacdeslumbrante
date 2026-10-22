import React from 'react';
import { motion } from 'motion/react';
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
      className="app-tabbar fixed bottom-0 inset-x-0 z-40 border-t border-linea bg-papel/90 backdrop-blur-xl"
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
                className={`group w-full h-full flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-none ${
                  on ? 'text-carbon' : 'text-tenue hover:text-carbon'
                }`}
              >
                <span className="relative grid place-items-center w-14 h-8 rounded-full group-focus-visible:ring-2 group-focus-visible:ring-cantera">
                  {on && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-full bg-cita"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <motion.span
                    className={`relative ${on ? 'text-cantera' : ''}`}
                    animate={on ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {tab.icon}
                  </motion.span>
                </span>
                <span>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
