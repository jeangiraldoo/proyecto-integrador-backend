# proyecto-integrador-backend

Node.js + TypeScript backend with Express REST API, Firebase Auth/Firestore, and Socket.io real-time
server.

## Tech stack

| Layer       | Technology                             |
| ----------- | -------------------------------------- |
| Runtime     | Node.js 20                             |
| Language    | TypeScript 6 (strict mode)             |
| HTTP server | Express 5 + `node:http` `createServer` |
| WebSockets  | Socket.io 4                            |
| Auth/DB     | Firebase Admin SDK (Auth + Firestore)  |
| Docs        | Swagger / OpenAPI 3.0                  |

## Project structure

```text
src/
  Routes/      Express route handlers (auth, google)
  models/      TypeScript models and Firestore rules
  socket/      Socket.io server initialisation
  firebase.ts  Firebase Admin SDK bootstrap
  index.ts     Entry point – HTTP server + Socket.io mount
```

## Running locally

```bash
npm run dev     # ts-node-dev with hot reload
npm run build   # tsc → dist/
npm start       # node dist/index.js
```

## Environment variables

| Variable      | Default                 | Description              |
| ------------- | ----------------------- | ------------------------ |
| `PORT`        | `3000`                  | HTTP/WS listen port      |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed Socket.io origin |
| `apiKey`      | —                       | Firebase API key         |
| `authDomain`  | —                       | Firebase auth domain     |
| `projectId`   | —                       | Firebase project ID      |

Copy `.env.example` → `.env` and fill in values. `serviceAccount.json` must be present at the
project root (git-ignored).

## Commit conventions

- Format: `type: short description` — **no scope**, max **70 characters** total.
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`.
- Enforced by commitlint (`@commitlint/config-conventional`, header-max-length 72).

```text
feat: add socket.io dependency
fix: handle missing env var for port
docs: add handoff document
```

## Branches

Branch off `main` using `feat/<ticket>`, `fix/<ticket>`, `chore/<ticket>`, etc. Keep branches small
and focused; open a PR against `main`.

## CI checks (GitHub Actions)

| Workflow              | Trigger                   | Checks                       |
| --------------------- | ------------------------- | ---------------------------- |
| `commits.yaml`        | PR → main                 | commitlint on all PR commits |
| `markdown.yaml`       | PR → main (`**/*.md`)     | markdownlint + Prettier      |
| `quality_checks.yaml` | PR → main (`src/**/*.ts`) | ESLint + Prettier (client/)  |

> `quality_checks.yaml` targets a `client/` directory (frontend). It only affects PRs that touch
> `src/**/*.ts` files while the frontend workspace is present.

## Code conventions

- Indentation: **tabs** (all files except YAML/Markdown which use spaces).
- Line length: **100** characters (Prettier `printWidth`).
- No inline comments unless the _why_ is non-obvious.
- Export named functions over default exports in module files.
