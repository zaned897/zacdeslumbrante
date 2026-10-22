import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import { AccountApiError } from './accountApi';
import { useAccount } from './useAccount';

interface AccountSheetProps {
  open: boolean;
  onClose: () => void;
  language: Language;
}

type Dict = (typeof TRANSLATIONS)['es'];

function errorText(err: unknown, t: Dict, language: Language): string {
  if (!(err instanceof AccountApiError)) return t.accountError;
  if (err.status === 0 || err.status === 503) return t.accountOffline;
  if (err.status === 401) return t.accountBadCredentials;
  if (err.status === 429) return t.accountTooMany;
  // Los mensajes del servidor vienen en español (p. ej. "ya existe una cuenta con ese correo").
  return language === 'es' && err.status < 500 ? `${err.message[0].toUpperCase()}${err.message.slice(1)}.` : t.accountError;
}

/**
 * Hoja de cuenta (#53): Google o correo y contraseña; con sesión, perfil y cerrar sesión.
 * La monta quien la abre (AppHeader); el estado de la sesión vive en useAccount.
 */
export const AccountSheet: React.FC<AccountSheetProps> = ({ open, onClose, language }) => {
  const t = TRANSLATIONS[language];
  const account = useAccount();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(errorText(err, t, language));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === 'signIn') return account.signInWithPassword(email.trim(), password);
      const { needsConfirmation } = await account.signUp(email.trim(), password);
      setCheckEmail(needsConfirmation);
    });
  };

  const user = account.user;
  const field =
    'w-full px-4 py-2.5 text-sm bg-superficie text-carbon border border-linea rounded-xl focus:outline-none focus:border-cantera placeholder:text-tenue';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-carbon/40" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t.accountTitle}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:w-96 max-h-[90vh] overflow-y-auto bg-papel rounded-t-[22px] md:rounded-[22px] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.3)] px-5 pt-3 pb-6"
      >
        <span className="block mx-auto mb-2 w-9 h-1 rounded-full bg-stone-300 md:hidden" aria-hidden="true" />
        <header className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-semibold text-carbon">{t.accountTitle}</h2>
          {account.mode === 'demo' && (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-caliza text-terracota">
              {t.demoBadge}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-1 rounded-md text-stone-400 hover:text-stone-700 cursor-pointer"
            aria-label={t.accountClose}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {account.status === 'loading' ? (
          <Loader2 className="mx-auto my-8 w-5 h-5 animate-spin text-stone-400" />
        ) : user ? (
          <div className="flex flex-col items-center text-center gap-3">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <span className="w-16 h-16 grid place-items-center rounded-full bg-caliza text-cantera text-2xl font-semibold">
                {(user.name || user.email || '?').charAt(0).toUpperCase()}
              </span>
            )}
            <div>
              {user.name && <p className="font-semibold text-carbon">{user.name}</p>}
              <p className="text-sm text-stone-500">{user.email}</p>
            </div>
            <p className="text-sm text-stone-600">{t.accountSaved}</p>
            <button
              type="button"
              onClick={() => void account.signOut()}
              className="mt-1 px-4 py-2 text-sm font-semibold text-cantera border border-linea rounded-full hover:bg-caliza cursor-pointer"
            >
              {t.accountSignOut}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-stone-600">{t.accountPitch}</p>
            {account.offline && <p className="text-sm text-terracota">{t.accountOffline}</p>}

            {account.providers.includes('google') && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(account.signInWithGoogle)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-carbon bg-superficie text-carbon border border-linea rounded-full hover:bg-caliza disabled:opacity-50 cursor-pointer"
                >
                  <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
                    <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
                    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
                  </svg>
                  {t.accountGoogle}
                </button>
                <p className="text-center text-xs text-stone-400">{t.accountOr}</p>
              </>
            )}

            {checkEmail ? (
              <p className="text-sm text-carbon bg-caliza rounded-xl px-4 py-3">{t.accountCheckEmail}</p>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-2">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.accountEmail}
                  aria-label={t.accountEmail}
                  className={field}
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.accountPassword}
                  aria-label={t.accountPassword}
                  className={field}
                />
                <button
                  type="submit"
                  disabled={busy || account.offline}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-sobre-cantera bg-cantera rounded-full disabled:opacity-50 cursor-pointer"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {mode === 'signIn' ? t.accountSignIn : t.accountSignUp}
                </button>
              </form>
            )}

            {error && (
              <p role="alert" className="text-sm text-cantera">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                setCheckEmail(false);
                setError(null);
              }}
              className="text-sm text-cantera hover:underline cursor-pointer"
            >
              {mode === 'signIn' ? t.accountToSignUp : t.accountToSignIn}
            </button>

            {account.mode === 'demo' && <p className="text-xs text-stone-500">{t.accountDemoNote}</p>}
          </div>
        )}
      </section>
    </div>
  );
};
