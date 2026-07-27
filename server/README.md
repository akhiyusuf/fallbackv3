# server/

M6 owns this directory: the thin managed-assistant backend (F16/F17).
It holds no accounts and stores no user data. Contract: docs/API.md §4.

## Stack

Plain Node.js (`node:http`, global `fetch`), zero npm dependencies — nothing is added to
`docs/ARCHITECTURE.md`'s dependency list. This is a separate deployable from the Expo app;
it is never bundled into the client and never imports from `src/**`.

- `src/guardrails.js` — the R15 system prompt + best-effort classifier. Deliberately
  duplicated (not imported) from `src/services/ai/guardrails.ts` — see that file's header.
- `src/receipt.js` — receipt verification against Apple/Google, per-request, never persisted.
- `src/groq.js` — the Groq chat/STT client (pinned vendor, docs/API.md §4).
- `src/routes.js` — pure, unit-testable route handlers (no `node:http` in this file).
- `src/index.js` — the `node:http` wiring: parses the request, calls `routes.js`, streams
  the SSE response back. The ONLY logging call in this directory (`logAccess`) logs
  method/path/status — never message content, never a receipt.

## Run

```
cd server
npm test         # node --test src/*.test.js
GROQ_API_KEY=... PORT=8787 npm start
```

## Endpoints (docs/API.md §4)

- `GET /v1/health` → `{ "status": "ok" }`
- `POST /v1/chat` → streams `text/event-stream`, one `AssistantEvent` JSON per `data:` line.
- `POST /v1/transcribe` → multipart wiring is deploy-specific (real deploys front this with
  their own multipart parser or a platform function trigger); `handleTranscribe` in
  `routes.js` is the tested, deploy-agnostic contract — parse the upload however your host
  requires, then call it with a `Blob`.

## What is NOT here

- No database, no ORM, no user table.
- No receipt caching — every request re-verifies.
- No log line ever contains a message's `content` or a raw receipt value.
