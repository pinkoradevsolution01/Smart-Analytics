const base = import.meta.env.VITE_API_BASE_URL;

/** Authenticates against the existing Smart Monitoring account endpoint. */
export async function signIn(email: string, password: string): Promise<string> {
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') return 'development-session';
  if (!base) throw new Error('The dashboard API URL has not been configured.');
  const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Sign-in failed. Check your email and password.');
  const token = (body.data ?? body).token ?? (body.data ?? body).accessToken;
  if (!token) throw new Error('The API did not return an access token.');
  return token;
}
