import { useSyncExternalStore } from 'react';
import { createLocalProgressStore, setProgressStore } from '../../progress/progressStore';
import { AccountApiError, AccountSession, AccountUser, AuthProvider, accountApi } from './accountApi';
import { createRemoteProgressStore } from './remoteProgressStore';

const STORAGE_KEY = 'zacatecas_session_v1';

export interface AccountState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AccountUser | null;
  /** `demo`: cuentas en memoria del servidor, sin llaves (badge "Demo"). */
  mode: 'supabase' | 'demo';
  providers: AuthProvider[];
  /** La API de cuentas no respondió (Python dormido u offline). */
  offline: boolean;
}

let session: AccountSession | null = readSession();
let state: AccountState = {
  status: 'loading',
  user: session?.user ?? null,
  mode: 'demo',
  providers: [],
  offline: false,
};
const listeners = new Set<() => void>();

function readSession(): AccountSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AccountSession) : null;
  } catch {
    return null;
  }
}

// Una sola instancia local: cada createLocalProgressStore() agrega un listener de 'storage'.
const localProgress = createLocalProgressStore();

/** Con sesión, el progreso (mascota, visitas, colección) se sincroniza con la cuenta. */
function syncProgressStore(prev: AccountState['status'], next: AccountState['status']) {
  if (prev === next) return;
  if (next === 'signedIn') {
    const remote = createRemoteProgressStore(localProgress, getAccessToken);
    setProgressStore(remote);
    remote.hydrate().catch(() => undefined); // sin red: sigue con lo local y sube en la próxima escritura
  } else if (prev === 'signedIn') {
    setProgressStore(localProgress);
  }
}

function setState(patch: Partial<AccountState>) {
  const prev = state.status;
  state = { ...state, ...patch };
  syncProgressStore(prev, state.status);
  listeners.forEach((l) => l());
}

function setSession(next: AccountSession | null) {
  session = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento (modo privado): la sesión dura lo que la pestaña.
  }
  setState({ status: next ? 'signedIn' : 'signedOut', user: next?.user ?? null });
}

let refreshing: Promise<string | null> | null = null;

/**
 * Token vigente para llamar a /api/py/me*; lo renueva si vence en menos de un minuto.
 * `null` si no hay sesión o ya no se pudo renovar.
 */
export function getAccessToken(): Promise<string | null> {
  if (!session) return Promise.resolve(null);
  if (session.expiresAt - Date.now() / 1000 > 60) return Promise.resolve(session.accessToken);
  refreshing ??= accountApi
    .refresh(session.refreshToken)
    .then((next) => {
      setSession(next);
      return next.accessToken;
    })
    .catch((err: unknown) => {
      // Sin red se conserva la sesión para reintentar; un 401 la cierra.
      if (err instanceof AccountApiError && err.status === 401) setSession(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Vuelta de Google: Supabase deja los tokens en el hash (#access_token=…&refresh_token=…). */
async function consumeOAuthRedirect(): Promise<void> {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (!accessToken && !hash.get('error')) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (!accessToken || !refreshToken) return;
  const expiresAt = Number(hash.get('expires_at')) || Math.floor(Date.now() / 1000) + 3600;
  const user = await accountApi.me(accessToken);
  setSession({ accessToken, refreshToken, expiresAt, user });
}

async function init() {
  try {
    const config = await accountApi.config();
    setState({ mode: config.mode, providers: config.providers, offline: false });
  } catch {
    setState({ offline: true });
  }
  try {
    await consumeOAuthRedirect();
  } catch {
    // Token de Google inválido: se queda sin sesión.
  }
  if (!session) return setState({ status: 'signedOut' });
  await getAccessToken(); // renueva si hace falta; un 401 cierra la sesión
  setState({ status: session ? 'signedIn' : 'signedOut' });
}

if (typeof window !== 'undefined') void init();

export function subscribeAccount(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccountState(): AccountState {
  return state;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  setSession(await accountApi.signIn(email, password));
}

/** `needsConfirmation`: Supabase mandó un correo y la sesión empieza al confirmarlo. */
export async function signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const result = await accountApi.signUp(email, password);
  if (result.session) setSession(result.session);
  return { needsConfirmation: result.needsConfirmation };
}

export async function signInWithGoogle(): Promise<void> {
  const { url } = await accountApi.googleUrl(window.location.origin + window.location.pathname);
  window.location.assign(url);
}

export async function signOut(): Promise<void> {
  const token = session?.accessToken;
  setSession(null);
  if (token) await accountApi.signOut(token).catch(() => undefined);
}

/** Estado de la cuenta y acciones. Sin provider: el estado vive a nivel de módulo. */
export function useAccount() {
  const current = useSyncExternalStore(subscribeAccount, getAccountState, getAccountState);
  return { ...current, signInWithGoogle, signInWithPassword, signUp, signOut };
}
