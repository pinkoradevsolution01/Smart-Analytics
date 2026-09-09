# Smart Monitoring Web Analytics

React/Vite dashboard for the Smart Monitoring System's existing Express/MySQL API. It is a second client only: the browser never chooses a business ID, connects to MySQL, or creates a separate subscriber account.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` to the complete existing API base ending in `/api`.
3. Run `npm install` and `npm run dev`.

Set `VITE_USE_MOCK_DATA=true` only for local UI development. The mock uses the `GET /analytics/overview` response shape and is deliberately isolated in `src/api/analytics.ts`; it must be disabled for deployments.

## Server contract and security

The production API must provide the protected analytics routes in the build specification. The client sends the current session token as `Authorization: Bearer <token>`, but all role and business scoping must be derived from the verified JWT by the server. Never trust browser query parameters or client storage for tenant scope.

The dashboard sends the JWT returned by `POST /auth/login` or the Google exchange as `Authorization: Bearer <token>` on every analytics request. The server, not the browser, derives the business scope from the verified token. A `401` or `403` removes the dashboard token and requires a new sign-in.

## CSV exports

The **Export CSV** control downloads the report for the current page and selected date range through `GET /api/analytics/export`. It sends the same bearer token as the on-screen report, and the browser does not provide a business ID. Supported reports are `overview`, `sales`, `inventory`, `customers`, `operations`, and `cctv-events`.

## Production configuration

Configure these values in Vercel for `analytics.smartmonitoringsystem.store`:

```env
VITE_API_BASE_URL=https://api.smartmonitoringsystem.store/api
VITE_USE_MOCK_DATA=false
```

Configure these values in the Node.js backend environment, then restart the backend:

```env
NODE_ENV=production
CORS_ORIGINS=https://analytics.smartmonitoringsystem.store
WEB_ANALYTICS_URL=https://analytics.smartmonitoringsystem.store
GOOGLE_CALLBACK_URL=https://api.smartmonitoringsystem.store/api/auth/google/callback
GOOGLE_CLIENT_ID=<Google OAuth web client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth web client secret>
JWT_SECRET=<long-random-private-secret>
```

In Google Cloud Console, the authorized redirect URI must be exactly `https://api.smartmonitoringsystem.store/api/auth/google/callback`. The Vercel site callback is `https://analytics.smartmonitoringsystem.store/auth/google/callback`; it receives only a short-lived single-use code, never the JWT.

## Shared Google sign-in

The **Continue with Google** button delegates to the existing Smart Monitoring backend; the web app does not configure a Google client, keep a client secret, create users, or accept a business ID. By default it starts at `GET /api/auth/google` and receives a one-time `code` at `/auth/google/callback`. The callback sends `{ "code": "<one-time-code>" }` to `POST /api/auth/google/exchange`, then stores the returned shared JWT in the current browser session. Set the optional Google route variables in `.env` if the existing routes differ.

The backend implementation (not included in this repository) must keep the current Google token verification flow, then find the pre-existing active `users` record by the verified Google provider subject (or verified email), join its active `businesses` record using `users.business_id`, and reject an unlinked, inactive, or ambiguous account. It must issue the normal signed JWT with exactly the tenant context needed by the API: `userId`, `role`, and `businessId`. The API callback URL must be configured and allow-listed, and the browser callback should receive only a short-lived, single-use code--not the JWT in the URL.
