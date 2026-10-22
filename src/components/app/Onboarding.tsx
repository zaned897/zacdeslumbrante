import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircle, Box, Trophy } from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';

const STORAGE_KEY = 'zacatecas_onboarded_v1';

export function shouldShowOnboarding(): boolean {
  try {
    return !localStorage.getItem(STORAGE_KEY) && !new URLSearchParams(window.location.search).has('sinbienvenida');
  } catch {
    return false;
  }
}

interface OnboardingProps {
  language: Language;
  onToggleLanguage: () => void;
  onDone: () => void;
}

/** Bienvenida de 3 pasos la primera vez que se abre la app. Se puede deslizar. */
export const Onboarding: React.FC<OnboardingProps> = ({ language, onToggleLanguage, onDone }) => {
  const t = TRANSLATIONS[language];
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const steps = [
    { icon: MessageCircle, title: t.onb1Title, body: t.onb1Body },
    { icon: Box, title: t.onb2Title, body: t.onb2Body },
    { icon: Trophy, title: t.onb3Title, body: t.onb3Body },
  ];
  const last = step === steps.length - 1;

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Sin almacenamiento: se volverá a mostrar la próxima vez.
    }
    onDone();
  };
  const go = (next: number) => {
    if (next < 0 || next >= steps.length) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const { icon: Icon, title, body } = steps[step];

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-papel text-carbon animate-aparece"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex items-center justify-between px-5">
        <button
          type="button"
          onClick={onToggleLanguage}
          className="h-9 px-3 rounded-full bg-caliza text-xs font-bold uppercase cursor-pointer"
          aria-label={t.toggleLanguage}
        >
          {language === 'es' ? 'EN' : 'ES'}
        </button>
        {!last && (
          <button type="button" onClick={finish} className="h-9 px-3 text-sm font-semibold text-tenue cursor-pointer">
            {t.onbSkip}
          </button>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ x: dir * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(step + 1);
              else if (info.offset.x > 60) go(step - 1);
            }}
            className="absolute inset-0 flex flex-col justify-center px-8 max-w-md mx-auto touch-pan-y"
          >
            <div className="relative w-28 h-28 mb-10">
              <span className="absolute inset-0 rounded-[36px] bg-cita rotate-6" aria-hidden="true" />
              <span className="absolute inset-0 rounded-[36px] bg-cantera grid place-items-center text-sobre-cantera">
                <Icon className="w-12 h-12" strokeWidth={1.75} />
              </span>
            </div>
            <h1 className="text-[32px] font-extrabold leading-[1.1]">{title}</h1>
            <p className="mt-3 text-base text-tenue leading-relaxed">{body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-8 max-w-md w-full mx-auto flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden="true">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-cantera' : 'w-1.5 bg-linea'}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (last ? finish() : go(step + 1))}
          className="h-12 px-6 rounded-full bg-carbon text-papel text-sm font-bold cursor-pointer active:scale-95 transition-transform"
        >
          {last ? t.onbStart : t.onbNext}
        </button>
      </div>
    </div>
  );
};
