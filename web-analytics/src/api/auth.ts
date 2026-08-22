const base = import.meta.env.VITE_API_BASE_URL;

type TokenResponse = { data?: { token?: string; accessToken?: string }; token?: string; accessToken?: string };

function tokenFrom(body: TokenResponse): string | undefined {
  const payload = body.data ?? body;
  return payload.token ?? payload.accessToken;
}

async function readToken(response: Response, fallbackMessage: string): Promise<string> {
  const body = await response.json().catch(() => ({} as TokenResponse)) as TokenResponse & { message?: string };
  if (!response.ok) throw new Error(body.message || fallbackMessage);
  const token = tokenFrom(body);
  if (!token) throw new Error('The API did not return an access token.');
  return token;
}

/** Authenticates against the existing Smart Monitoring account endpoint. */
export async function signIn(email: string, password: string): Promise<string> {
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') return 'development-session';
  if (!base) throw new Error('The dashboard API URL has not been configured.');
  const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return readToken(response, 'Sign-in failed. Check your email and password.');
}

/**
 * Sends the user through Smart Monitoring's existing Google OAuth entry point.
 * The backend must allow-list returnTo and redirect there with a one-time code.
 */
export function startGoogleSignIn(): void {
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
    sessionStorage.setItem('analytics_token', 'development-session');
    window.location.assign('/');
    return;
  }
  const configuredUrl = import.meta.env.VITE_GOOGLE_AUTH_START_URL;
  if (!configuredUrl && !base) throw new Error('The dashboard API URL has not been configured.');
  const url = new URL(configuredUrl || `${base}/auth/google`);
  url.searchParams.set('returnTo', returnTo);
  url.searchParams.set('client', 'web-analytics');
  window.location.assign(url.toString());
}

/** Exchanges the one-time Google callback code for the shared API JWT. */
export async function completeGoogleSignIn(code: string): Promise<string> {
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') return 'development-session';
  const configuredUrl = import.meta.env.VITE_GOOGLE_AUTH_EXCHANGE_URL;
  if (!configuredUrl && !base) throw new Error('The dashboard API URL has not been configured.');
  const response = await fetch(configuredUrl || `${base}/auth/google/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return readToken(response, 'Google sign-in could not be completed. Please try again.');
}
