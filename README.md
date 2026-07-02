# Agora — Backend

> Real-time collaborative study room server built with Node.js, TypeScript, Express and Socket.io.

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socketdotio&logoColor=white)](https://socket.io)
[![Firebase](https://img.shields.io/badge/Firebase-Admin_SDK-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Deployed on Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?logo=render&logoColor=white)](https://proyecto-integrador-backend-k2tf.onrender.com)

---

## Table of contents

1. [Overview](#overview)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Getting started](#getting-started)
5. [Environment variables](#environment-variables)
6. [REST API](#rest-api)
7. [Socket.io — connection and authentication](#socketio--connection-and-authentication)
8. [Socket.io — event reference](#socketio--event-reference)
9. [WebRTC signaling architecture](#webrtc-signaling-architecture)
10. [Screen sharing — track replacement](#screen-sharing--track-replacement)
11. [Room isolation](#room-isolation)
12. [Connection lifecycle](#connection-lifecycle)

---

## Overview

Agora's backend exposes two interfaces over a single HTTP server:

- **REST API** — authentication, room management, chat history.
- **Socket.io server** — real-time presence, chat, and WebRTC signaling relay.

The server is a **pure signaling layer** for WebRTC. It never touches media streams; audio and video
flow directly peer-to-peer between browsers once the connection is negotiated.

---

## Tech stack

| Layer       | Technology                                                   |
| ----------- | ------------------------------------------------------------ |
| Runtime     | Node.js 20                                                   |
| Language    | TypeScript 6 (strict mode)                                   |
| HTTP server | Express 5 + `node:http` `createServer`                       |
| WebSockets  | Socket.io 4                                                  |
| Auth / DB   | Firebase Admin SDK (Authentication + Firestore)              |
| API docs    | Swagger / OpenAPI 3.0 (`/docs`)                              |
| CI          | GitHub Actions (commitlint, markdownlint, ESLint + Prettier) |
| Deployment  | Render                                                       |

---

## Project structure

```
src/
├── Routes/
│   ├── auth.ts        # /auth — signup, login, profile, account deletion
│   ├── google.ts      # /auth/google — OAuth complete-profile
│   └── rooms.ts       # /rooms — CRUD, messages
├── models/
│   ├── room.ts        # Room type + Firestore helpers
│   └── user.ts        # User type
├── socket/
│   └── index.ts       # Socket.io server — all events and signaling logic
├── firebase.ts        # Firebase Admin SDK bootstrap
└── index.ts           # Entry point — HTTP server + Socket.io mount
```

---

## Getting started

```bash
# 1. Clone
git clone https://github.com/jeangiraldoo/proyecto-integrador-backend.git
cd proyecto-integrador-backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# fill in .env with Firebase credentials (see table below)
# place serviceAccount.json at project root (git-ignored)

# 4. Run in development (hot reload)
npm run dev

# 5. Build for production
npm run build
npm start
```

---

## Environment variables

| Variable                               | Required | Description                                              |
| -------------------------------------- | -------- | -------------------------------------------------------- |
| `PORT`                                 | No       | HTTP/WS listen port (default `3000`)                     |
| `FRONTEND_URL`                         | Yes      | Allowed CORS origin (e.g. `https://your-app.vercel.app`) |
| `apiKey`                               | Yes      | Firebase Web API key                                     |
| `authDomain`                           | Yes      | Firebase auth domain                                     |
| `projectId`                            | Yes      | Firebase project ID                                      |
| `storageBucket`                        | Yes      | Firebase storage bucket                                  |
| `messagingSenderId`                    | Yes      | Firebase messaging sender ID                             |
| `appId`                                | Yes      | Firebase app ID                                          |
| `FIREBASE_TYPE`                        | Yes      | Firebase account type                                    |
| `FIREBASE_PRIVATE_KEY_ID`              | Yes      | Private Firebase id                                      |
| `FIREBASE_PRIVATE_KEY`                 | Yes      | Private Firebase key                                     |
| `FIREBASE_CLIENT_EMAIL`                | Yes      | Firebase client email                                    |
| `FIREBASE_CLIENT_ID`                   | Yes      | Firebase client id                                       |
| `FIREBASE_TOKEN_URI`                   | Yes      | URI Firebase token                                       |
| `FIREBASE_AUTH_URI`                    | Yes      | URI Auth Firebase token                                  |
| `FIREBASE_UNIVERSE_DOMAIN`             | Yes      | Firebase universe domain                                 |
| `FIREBASE_AUTH_PROVIDER_X509_CERT_URL` | Yes      | Firebase authentication provider certificate URL         |
| `FIREBASE_CLIENT_X509_CERT_URL`        | Yes      | Firebase client certificate URL                          |
| `APP_ENV`                              | No       | The environment the app is in. "production" or "local"   |

---

## REST API

Interactive documentation is available at
[`/docs`](https://proyecto-integrador-backend-k2tf.onrender.com/docs) (Swagger UI).

### Auth — `/auth`

| Method   | Path            | Description                                       |
| -------- | --------------- | ------------------------------------------------- |
| `POST`   | `/auth/signup`  | Register with email, password, name and username  |
| `POST`   | `/auth/google`  | Complete profile after Google OAuth sign-in       |
| `GET`    | `/auth/profile` | Get the authenticated user's profile              |
| `PATCH`  | `/auth/profile` | Update display name, avatar URL, or username      |
| `DELETE` | `/auth/account` | Permanently delete the account and Firestore data |

### Rooms — `/rooms`

| Method   | Path                      | Description                                       |
| -------- | ------------------------- | ------------------------------------------------- |
| `POST`   | `/rooms`                  | Create a study room                               |
| `GET`    | `/rooms`                  | List rooms created by the authenticated user      |
| `PATCH`  | `/rooms/:roomId`          | Rename a room (creator only)                      |
| `DELETE` | `/rooms/:roomId`          | Delete a room and all its messages (creator only) |
| `GET`    | `/rooms/:roomId/messages` | Fetch chronological chat history                  |

All endpoints require `Authorization: Bearer <Firebase ID token>`.

---

## Socket.io — connection and authentication

Every socket connection must present a valid Firebase ID token in the handshake:

```js
import { io } from "socket.io-client";

const socket = io("https://proyecto-integrador-backend-k2tf.onrender.com", {
  auth: { token: await user.getIdToken() },
});
```

The server middleware verifies the token on every new connection. Rejected connections receive a
`connect_error` event.

### Concurrent session enforcement

Only **one active socket per user** is allowed. If a second connection is attempted from another tab
or device, the handshake is rejected immediately:

```
connect_error.message → "User already connected"
connect_error.data    → { code: "auth/concurrent-session" }
```

Handle it on the client to show a blocking UI:

```js
socket.on("connect_error", (err) => {
  if (err.data?.code === "auth/concurrent-session") {
    socket.io.opts.reconnection = false;
    // render blocking modal
  }
});
```

---

## Socket.io — event reference

### Client → Server

| Event                  | Payload                            | Description                                    |
| ---------------------- | ---------------------------------- | ---------------------------------------------- |
| `join_room`            | `roomId: string`                   | Subscribe to a room channel                    |
| `leave_room`           | `roomId: string`                   | Unsubscribe from a room channel                |
| `send_message`         | `{ room_id, text }`                | Send a chat message (persisted in Firestore)   |
| `webrtc_offer`         | `{ targetUid, roomId, sdp }`       | Send SDP offer to a specific peer              |
| `webrtc_answer`        | `{ targetUid, roomId, sdp }`       | Send SDP answer back to the caller             |
| `webrtc_ice_candidate` | `{ targetUid, roomId, candidate }` | Share an ICE candidate with a specific peer    |
| `end_call`             | `{ roomId }`                       | Hang up — notifies all other peers in the room |
| `media_state_changed`  | `{ room_id, isMuted, isVideoOff }` | Broadcast mic/camera state to room             |

### Server → Client

| Event                      | Payload                                                 | Description                                      |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `room_joined`              | `{ roomId, isAdmin, participants[] }`                   | Confirmation + list of peers already in the room |
| `participant_joined`       | `{ roomId, uid, username, avatarUrl }`                  | A new peer joined the room                       |
| `participant_left`         | `{ roomId, uid, username, avatarUrl }`                  | A peer left or disconnected                      |
| `receive_message`          | `{ id, room_id, sender_id, username, text, timestamp }` | New chat message                                 |
| `incoming_offer`           | `{ fromUid, fromUsername, roomId, sdp }`                | Incoming SDP offer from a peer                   |
| `incoming_answer`          | `{ fromUid, roomId, sdp }`                              | Incoming SDP answer from a peer                  |
| `incoming_ice_candidate`   | `{ fromUid, candidate }`                                | Incoming ICE candidate from a peer               |
| `call_ended`               | `{ fromUid }`                                           | A peer hung up (sender excluded)                 |
| `peer_media_state_changed` | `{ room_id, socket_id, isMuted, isVideoOff }`           | A peer changed their mic/camera state            |
| `error`                    | `{ message }`                                           | Server-side validation or routing error          |

---

## WebRTC signaling architecture

### How it works

The server is a **signaling relay only**. It uses the existing Socket.io connection to exchange the
small negotiation messages (SDP + ICE candidates) that browsers need to discover each other and
establish a direct P2P channel. Once the `RTCPeerConnection` is established, all media flows
directly between browsers — the server is no longer involved.

### Mesh topology

With N participants in a room, every peer opens **N − 1** `RTCPeerConnection` instances (one per
remote peer). For 4 participants there are 6 connections total across the room. This scales well for
small rooms (≤ 6 people).

```
         A ──── B
         │  ╲╱  │
         │  ╱╲  │
         C ──── D
  4 participants = 6 peer connections
```

### Signaling flow — step by step

```
Peer A                    Server                    Peer B
  │                          │                          │
  │── join_room(roomId) ────►│                          │
  │◄─ room_joined({          │                          │
  │     participants: [B] }) │                          │
  │                          │                          │
  │  [A creates RTCPeerConnection for B]                │
  │  [A calls getUserMedia, addTrack]                   │
  │  [A calls createOffer()]                            │
  │                          │                          │
  │── webrtc_offer ─────────►│── incoming_offer ───────►│
  │   { targetUid: B,        │   { fromUid: A,          │
  │     roomId, sdp }        │     fromUsername,        │
  │                          │     roomId, sdp }        │
  │                          │                          │
  │                          │   [B setRemoteDescription]
  │                          │   [B createAnswer()]     │
  │                          │                          │
  │◄─ incoming_answer ───────│◄── webrtc_answer ────────│
  │   { fromUid: B, sdp }    │    { targetUid: A,       │
  │                          │      roomId, sdp }       │
  │                          │                          │
  │  [A setRemoteDescription]│                          │
  │                          │                          │
  │── webrtc_ice_candidate ─►│── incoming_ice_candidate►│
  │◄─────────────────────────│◄── webrtc_ice_candidate ─│
  │   (trickle ICE,          │   (both directions,      │
  │    multiple rounds)      │    until complete)       │
  │                          │                          │
  │◄══════════════ P2P media channel established ══════►│
```

### Payload shapes

**`webrtc_offer` / `webrtc_answer`**

```json
{
  "targetUid": "firebase-uid-of-the-remote-peer",
  "roomId": "ABC-1234",
  "sdp": {
    "type": "offer",
    "sdp": "v=0\r\no=- 46117... (full SDP string)"
  }
}
```

**`webrtc_ice_candidate`**

```json
{
  "targetUid": "firebase-uid-of-the-remote-peer",
  "roomId": "ABC-1234",
  "candidate": {
    "candidate": "candidate:1 1 UDP 2122252543 192.168.1.5 54321 typ host",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

**`media_state_changed`** (client → server)

```json
{
  "room_id": "ABC-1234",
  "isMuted": true,
  "isVideoOff": false
}
```

**`peer_media_state_changed`** (server → client)

```json
{
  "room_id": "ABC-1234",
  "socket_id": "server-assigned-socket-id",
  "isMuted": true,
  "isVideoOff": false
}
```

> `socket_id` in the outbound event is always set by the server (`socket.id`), never trusted from
> the client payload, to prevent spoofing which tile changed.

---

## Screen sharing — track replacement

Screen sharing does **not** require a new `RTCPeerConnection`. The existing video track is replaced
in-flight using `RTCRtpSender.replaceTrack()`, which avoids a full renegotiation.

### Frontend implementation

```js
// 1. Capture screen stream
const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
const screenTrack = screenStream.getVideoTracks()[0];

// 2. Replace the camera track on every active peer connection
for (const [, pc] of peerConnections) {
  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (sender) await sender.replaceTrack(screenTrack);
}

// 3. When the user stops sharing (browser stop button or programmatic)
screenTrack.onended = async () => {
  const cameraTrack = localStream.getVideoTracks()[0];
  for (const [, pc] of peerConnections) {
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (sender) await sender.replaceTrack(cameraTrack);
  }
  // notify peers that screen sharing ended
  socket.emit("media_state_changed", { room_id: currentRoomId, isMuted: false, isVideoOff: false });
};
```

### No backend changes required

`RTCRtpSender.replaceTrack()` operates entirely within the existing P2P connection. The server only
needs to relay `media_state_changed` so other participants can update their UI (e.g. show a "screen
sharing" badge). No new signaling events are needed for screen sharing itself.

---

## Room isolation

Every signaling and chat event is strictly scoped to a room. The server enforces isolation at three
levels:

**1. Socket.io room membership**

When a client emits `join_room`, the socket is subscribed to a named Socket.io room equal to the
Firestore `roomId`. All broadcasts use `socket.to(roomId)` or `io.to(roomId)`, which only reach
sockets subscribed to that specific room.

**2. Peer-level check for WebRTC signaling**

Before relaying `webrtc_offer`, `webrtc_answer`, and `webrtc_ice_candidate`, the server resolves the
target socket via `uidToSocketId` and verifies that **both** the sender and the target are in the
same room:

```ts
const targetSocketId = uidToSocketId.get(targetUid);
if (!targetSocketId) {
  socket.emit("error", { message: "Target user is not connected" });
  return;
}
const room = io.sockets.adapter.rooms.get(roomId);
if (!room?.has(socket.id) || !room.has(targetSocketId)) return;
io.to(targetSocketId).emit("incoming_offer", { fromUid: socket.data.uid, ... });
```

**3. Membership check for media state events**

Before relaying `media_state_changed`, the server verifies the sender is actually in the specified
room:

```ts
if (!socket.rooms.has(room_id)) return;
socket.to(room_id).emit("peer_media_state_changed", { ... });
```

This prevents a malicious client from pushing fake state updates into rooms they have not joined.

---

## Connection lifecycle

```
Client connects
      │
      ▼
Handshake middleware
  ├─ Verify Firebase ID token
  ├─ Check no concurrent session (connectedUids Set)
  ├─ Look up username from uids/{uid}
  └─ Attach uid, username, avatarUrl to socket.data
      │
      ▼ (connection accepted)
io.on("connection")
  ├─ connectedUids.add(uid)
  ├─ Client emits join_room(roomId)
  │     ├─ Validate room exists in Firestore
  │     ├─ Snapshot current participants
  │     ├─ socket.join(roomId)
  │     ├─ Emit room_joined to sender
  │     └─ Emit participant_joined to room
  │
  ├─ [WebRTC signaling events ↔ relayed between peers]
  ├─ [Chat messages → persisted in Firestore, broadcast to room]
  ├─ [media_state_changed → relayed to room]
  │
  ├─ Client emits leave_room(roomId)  OR  browser tab closes
  │     └─ socket.on("disconnecting")
  │           └─ Emit participant_left to all joined rooms
  │
  └─ socket.on("disconnect")
        ├─ connectedUids.delete(uid)
        └─ uidToSocketId.delete(uid)
```
