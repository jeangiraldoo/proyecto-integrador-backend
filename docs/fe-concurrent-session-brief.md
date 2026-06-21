# Concurrent Session Block — Frontend Integration Brief

## What the backend enforces

The server tracks every authenticated socket connection in memory. If the **same user** tries to
open a second socket (e.g. a second browser tab), the handshake is rejected before the connection is
established. The socket never connects — `join_room` is never reached.

The rejection carries a structured error code so the frontend can distinguish it from other
connection failures:

```
connect_error.message  → "User already connected"
connect_error.data     → { code: "auth/concurrent-session" }
```

---

## What the frontend must implement

### 1 — Intercept the connection error

Listen for `connect_error` on the socket instance **before** mounting any room or WebRTC components:

```js
socket.on("connect_error", (err) => {
  if (err.data?.code === "auth/concurrent-session") {
    showConcurrentSessionBlock();
  }
});
```

### 2 — Show a blocking UI

When `auth/concurrent-session` is received, render a full-screen (or modal) blocking view that
prevents the user from interacting with the room. The user must not be able to dismiss it — the
session is already active elsewhere.

Suggested copy:

> **Already connected in another tab** Your account is active in another tab or window. Close it
> before joining here.

Do **not** attempt to reconnect automatically — the server will keep rejecting until the other tab
closes and the socket disconnects.

### 3 — Disable socket auto-reconnect for this error

Socket.io retries connections by default. Disable it when this specific error is detected to avoid a
reconnect loop:

```js
socket.on("connect_error", (err) => {
  if (err.data?.code === "auth/concurrent-session") {
    socket.io.opts.reconnection = false;
    showConcurrentSessionBlock();
  }
});
```

### 4 — Recovery (optional)

If you want to allow the user to retry (e.g. after they manually closed the other tab), add a "Try
again" button that re-enables reconnection and reconnects:

```js
function retryConnection() {
  socket.io.opts.reconnection = true;
  socket.connect();
}
```

---

## Notes

- The block fires at the **socket handshake level**, not at `join_room`. The component that
  initialises the socket connection should own this listener — not the room component.
- There is no grace period — the second connection is rejected immediately.
- If the first tab closes cleanly, the server releases the UID from memory on `disconnect` and the
  second tab can connect normally on retry.
