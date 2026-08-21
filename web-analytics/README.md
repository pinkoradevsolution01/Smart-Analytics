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
