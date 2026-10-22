// Contrato: /api/py/auth/* y /api/py/me* (docs/API.md, #53). Se tipa aquí para no tocar src/types.

export interface AccountUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface AccountSession {
  accessToken: string;
  refreshToken: string;
  /** Segundos Unix. */
  expiresAt: number;
  user: AccountUser;
  _mock?: boolean;
}

export type AuthProvider = 'google' | 'password';

export interface AuthConfig {
  mode: 'supabase' | 'demo';
  providers: AuthProvider[];
  _mock: boolean;
}

export type ProgressKey = 'pet' | 'visits' | 'collection';
export const PROGRESS_KEYS: ProgressKey[] = ['pet', 'visits', 'collection'];

/** Valor guardado por clave; el backend no mira su forma salvo `updatedAt`. */
export type ProgressValue = { updatedAt?: string; version?: number } & Record<string, unknown>;

export type RemoteProgress = Record<ProgressKey, ProgressValue | null> & {
  updatedAt: string | null;
  _mock: boolean;
};

export class AccountApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api/py${path}`, {
      ...rest,
      headers: {
        ...(rest.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      signal: rest.signal ?? AbortSignal.timeout(10000),
    });
  } catch {
    throw new AccountApiError(0, 'offline');
  }
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    throw new AccountApiError(res.status, typeof detail === 'string' ? detail : `HTTP ${res.status}`);
  }
  return body as T;
}

const json = (data: unknown) => JSON.stringify(data);

export const accountApi = {
  config: () => call<AuthConfig>('/auth/config'),
  signUp: (email: string, password: string) =>
    call<{ session: AccountSession | null; needsConfirmation: boolean }>('/auth/signup', {
      method: 'POST',
      body: json({ email, password }),
    }),
  signIn: (email: string, password: string) =>
    call<AccountSession>('/auth/login', { method: 'POST', body: json({ email, password }) }),
  refresh: (refreshToken: string) =>
    call<AccountSession>('/auth/refresh', { method: 'POST', body: json({ refreshToken }) }),
  signOut: (token: string) => call<void>('/auth/logout', { method: 'POST', token }),
  googleUrl: (redirectTo: string) =>
    call<{ url: string }>(`/auth/google?redirectTo=${encodeURIComponent(redirectTo)}`),
  me: (token: string) => call<AccountUser>('/me', { token }),
  readProgress: (token: string) => call<RemoteProgress>('/me/progress', { token }),
  writeProgress: (token: string, key: ProgressKey, value: ProgressValue) =>
    call<ProgressValue>(`/me/progress/${key}`, { method: 'PUT', token, body: json(value) }),
};
