# RollyCast

RollyCast is a mobile-first shared 3D dice table. A host creates a private room, shares its six-character
code, and everyone sees the same server-authoritative rolls without accounts.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The command starts Vite on port 5173 and a local Cloudflare Worker on port 8787. No Cloudflare account is required for local development.

## Verify

```bash
npm run typecheck
npm test
npm run lint
npm run format:check
npm run build
npm run test:e2e
```

Browser tests use desktop Chrome and a phone-portrait profile. Install their browser runtime once with
`npm run test:e2e:install`.

## Deploy

The production Worker serves both the SPA and the room API/WebSockets from one origin:

```bash
npx wrangler login
npm run deploy
```

See [docs/deployment.md](docs/deployment.md) for configuration, verification, rollback, and security notes.
The room code is a shared private credential, not protection for sensitive information.

## Project map

- `apps/web` — React, React Three Fiber, Rapier, and Zustand client.
- `apps/worker` — PartyServer Worker and one Durable Object per room.
- `packages/shared` — protocol schemas, dice rules, permissions, IDs, RNG, and rate limits.
- `e2e` — isolated multi-browser Playwright flows.
- `docs` — spec, decisions, plans, state, architecture, deployment, and session logs.

Architecture and authority boundaries are described in [docs/architecture.md](docs/architecture.md).
