# Deployment

RollyCast uses Cloudflare Workers Static Assets plus a Durable Object-backed PartyServer room. The production
configuration is `apps/worker/wrangler.jsonc`; it serves `apps/web/dist` as a single-page application and
runs `/api/*` and `/parties/*` through the Worker first.

## Prerequisites

- Node.js 20 or newer and npm.
- A Cloudflare account with Workers enabled.
- Wrangler authentication (`npx wrangler login`) or an appropriate `CLOUDFLARE_API_TOKEN` in CI.

## First deployment

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run format:check
npm run build
npm run deploy
```

`npm run deploy` rebuilds the web app, then runs `wrangler deploy` in `apps/worker`. Wrangler applies the `v1`
SQLite Durable Object migration on the first deployment and uploads the SPA assets with the Worker.

## Verify production

1. Open the `workers.dev` URL printed by Wrangler and create a room.
2. Open the share link in a separate browser profile or private window.
3. Join both players, roll, inspect, reroll, keep/release, react, and reload one client.
4. Confirm `/room/{code}` loads directly, not only after client-side navigation.
5. Inspect live errors with `npx wrangler tail --config apps/worker/wrangler.jsonc` if needed.

Run the full Playwright matrix against local Worker emulation before a release with `npm run test:e2e`.
Manual testing remains required on Mobile Safari, Mobile Chrome, Firefox, and Safari or Edge for pointer and
WebGL behavior.

## Rollback

Use the Cloudflare dashboard's Worker version history to redeploy the previous known-good version. Do not
delete or rename the `RoomServer` Durable Object class or alter its migration without a deliberate data
migration. Existing rooms expire after 24 hours of inactivity.

## Custom domains and CI

The default `workers.dev` hostname needs no route configuration. A custom domain can be attached in the
Cloudflare dashboard without changing client URLs because the app uses same-origin API and WebSocket paths.
In CI, keep the Cloudflare API token in the provider's secret store; never commit it or put it in client-side
Vite environment variables.

Room codes grant access to a table. Treat share links as private, but do not use a room for sensitive data.
