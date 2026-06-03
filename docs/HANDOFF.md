# Handoff — Real-time WebSocket server

Branch: `feat/realtime-websocket-server`

## What was done

Added Socket.io 4 to the existing Express backend so both REST and WebSocket traffic share a single
HTTP server and port.

### Files changed

| File                  | Change                                                        |
| --------------------- | ------------------------------------------------------------- |
| `package.json`        | Added `socket.io ^4.8.1` to dependencies                      |
| `src/socket/index.ts` | New — Socket.io init module (`initSocket`)                    |
| `src/index.ts`        | Replaced `app.listen` with `http.createServer` + `initSocket` |

### Architecture decision

`http.createServer(app)` wraps the Express app so Socket.io can attach to the same server instance.
This avoids opening a second port and keeps CORS config in one place per transport layer.

## How to test it locally

### 1. Start the server

```bash
cp .env.example .env   # fill in Firebase values
npm run dev
# → Server listening on port 3000
```

### 2. Connect a Socket.io client from the React SPA

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");
socket.on("connect", () => console.log("connected:", socket.id));
```

### 3. Expected console output on the server

```text
Server listening on port 3000
Client connected: <socket.id>
```

### 4. Override port or CORS origin

```bash
PORT=4000 CORS_ORIGIN=http://localhost:3000 npm run dev
```

## Environment variables required

| Variable      | Description                                                          |
| ------------- | -------------------------------------------------------------------- |
| `PORT`        | Listen port (default `3000`)                                         |
| `CORS_ORIGIN` | React dev origin Socket.io accepts (default `http://localhost:5173`) |

## Acceptance criteria status

| Criterion                                               | Status |
| ------------------------------------------------------- | ------ |
| Compiles and runs without TypeScript errors             | Done   |
| Socket.io CORS restricted to local React dev port       | Done   |
| Port configurable via `PORT` env var                    | Done   |
| `connection` event logs `Client connected: <socket.id>` | Done   |

## Next steps

- Add application-level socket events (e.g. `chat:message`, `room:join`) inside
  `src/socket/index.ts`.
- Emit events from Express routes via the shared `io` instance if needed (pass `io` as a dependency
  or use a module-level singleton).
- Add `CORS_ORIGIN` to the production environment variables on the hosting platform.
