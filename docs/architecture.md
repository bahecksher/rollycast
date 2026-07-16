# Architecture

## Runtime

RollyCast deploys as one Cloudflare Worker serving the built React SPA, HTTP room creation, and PartyServer
WebSockets. Each room maps to one Durable Object. Vite proxies `/api/*` and `/parties/*` to Wrangler during
local development, matching the production single-origin layout.

The landing page does not load Three.js or Rapier. The room lazy-loads the 3D scene after entry; if WebGL or
the physics bundle is unavailable, the DOM controls, player list, authoritative history, inspection, die
actions, and reactions remain usable.

## Authority and synchronization

- The server creates room, player, session, roll, die, and grab-lock identifiers.
- The server generates official die results with Web Crypto rejection sampling. Clients never submit results.
- Only the acting client simulates a roll and streams bounded transforms. Other clients interpolate them.
- At settlement, every client rotates the visual die to the official face using a minimal-arc quaternion.
- Roll history is immutable and capped at 100 records; visible dice are separate, temporary table state.
- Ownership, shared-reroll mode, kept protection, host settings, capacity, schemas, and rate limits are all
  enforced in the room Durable Object.

## Persistence and recovery

Room state, hashed credentials, immutable rolls, visible dice, and settings live in Durable Object storage.
Local storage retains a player's room-specific session credential for reconnecting with the same identity.
Disconnected players have a 60-second grace period. An unfinished roll is finalized from its last accepted
transforms if its acting browser disappears. Unkept dice expire after 30 seconds and fade during the final
second; kept dice do not expire.

## Security and privacy assumptions

Inbound WebSocket messages are size-limited and runtime-validated. Session and host tokens are random and
stored only as hashes server-side. The six-character room code is intentionally the shared access credential,
so rooms are private-by-link but are not suitable for sensitive information. The app collects no accounts,
email, location, contacts, advertising identifiers, or chat content.

## Performance defaults

Physics transforms stay outside React's per-frame state path and stream at no more than 12 per second per
active roll or grab. Settled dice sleep and expire. Low-memory or low-core devices reduce device-pixel ratio
and disable shadows. Reduced-motion users get a short roll and immediate face reconciliation.
