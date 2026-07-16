# 2026-07-15 1821 Local test server

## TL;DR

- What changed: Added ignored local runtime/server directories and launched the complete Vite + Wrangler stack.
- Why: Provide an immediately usable test server despite Node/npm not being installed system-wide.
- What didn't work: The first sandboxed launch could not let Vite's resolver inspect parent directories.
- Next: Review room `TQCCK5`, then run Worker and Playwright verification with the portable runtime.

---

## Full notes

- Downloaded the official Node.js 22.23.1 Windows x64 archive into `.tools/` and verified its SHA-256 value
  against Node.js's official `SHASUMS256.txt` before extraction.
- Added `.tools/` and `.dev-server/` to `.gitignore`; no system files or global runtime configuration changed.
- Launched `npm run dev` outside the restricted filesystem sandbox because Vite/esbuild module resolution was
  denied when it tried to inspect parent directories inside the sandbox.
- Confirmed Vite HTTP 200 on port 5173 and Wrangler HTTP 200 on port 8787.
- Created room `TQCCK5` through `http://127.0.0.1:5173/api/rooms` and confirmed the local Durable Object reports
  that it exists.
- Test URL: http://127.0.0.1:5173/room/TQCCK5
- Logs: `.dev-server/server.stdout.log` and `.dev-server/server.stderr.log`.
