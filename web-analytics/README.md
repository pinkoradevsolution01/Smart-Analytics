# Smart Monitoring Web Analytics

React/Vite dashboard for the Smart Monitoring System's existing Express/MySQL API. It is a second client only: the browser never chooses a business ID, connects to MySQL, or creates a separate subscriber account.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` to the complete existing API base ending in `/api`.
3. Run `npm install` and `npm run dev`.

Set `VITE_USE_MOCK_DATA=true` only for local UI development. The mock uses the `GET /analytics/overview` response shape and is deliberately isolated in `src/api/analytics.ts`; it must be disabled for deployments.

## Server contract and security

The production API must provide the protected analytics routes in the build specification. The client sends the current session token as `Authorization: Bearer <token>`, but all role and business scoping must be derived from the verified JWT by the server. Never trust browser query parameters or client storage for tenant scope.

The current UI has a development-only login interaction so it can be previewed before the existing backend is available. Replace that handler with `POST /auth/login` plus `GET /auth/me` session restoration when mounting this project beside the source backend.

## Shared Google sign-in

The **Continue with Google** button delegates to the existing Smart Monitoring backend; the web app does not configure a Google client, keep a client secret, create users, or accept a business ID. By default it starts at `GET /api/auth/google?client=web-analytics&returnTo=<web callback>` and receives a one-time `code` at `/auth/google/callback`. The callback exchanges it with `POST /api/auth/google/exchange` and stores the returned shared JWT in the current browser session. Set the optional Google route variables in `.env` if the existing routes differ.

The backend implementation (not included in this repository) must keep the current Google token verification flow, then find the pre-existing active `users` record by the verified Google provider subject (or verified email), join its active `businesses` record using `users.business_id`, and reject an unlinked, inactive, or ambiguous account. It must issue the normal signed JWT with exactly the tenant context needed by the API: `userId`, `role`, and `businessId`. The `returnTo` value must be allow-listed, and the browser callback should receive only a short-lived, single-use code--not the JWT in the URL.
