import React from 'react';
import { UserRound } from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import { useAccount } from './useAccount';

interface AccountAvatarButtonProps {
  language: Language;
  onClick: () => void;
}

/** Botón redondo para el encabezado: foto de Google, inicial del correo o ícono si no hay sesión. */
export const AccountAvatarButton: React.FC<AccountAvatarButtonProps> = ({ language, onClick }) => {
  const t = TRANSLATIONS[language];
  const { user } = useAccount();
  const initial = (user?.name || user?.email || '').trim().charAt(0).toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t.accountOpen}
      title={user?.email ?? t.accountOpen}
      className="w-9 h-9 grid place-items-center rounded-full overflow-hidden border border-linea bg-superficie text-cantera text-sm font-semibold hover:bg-caliza cursor-pointer shrink-0"
    >
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : initial ? (
        initial
      ) : (
        <UserRound className="w-4 h-4" />
      )}
    </button>
  );
};
