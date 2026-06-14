# QA-08 — Auditoría de conexión WebSockets y reglas de seguridad de salas/chat

- **Tarea:**
  [QA-08 #38](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/38)
- **TS:**
  [TS-02 — Infraestructura Back Sockets y Modelado de Salas/Chat #35](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/35)
- **Backend:** `src/socket/index.ts` (Socket.io + handshake auth), `firestore.rules`.

## Alcance

1. **C3 — WebSockets:** el servidor Node/Socket.io acepta y registra el handshake del cliente React,
   asigna un `socket.id` único por pestaña y libera la conexión al desconectar.
2. **C4 — Reglas:** el acceso **anónimo** (sin login) a las colecciones `rooms` y `messages` es
   rechazado por Firestore.

## Auditoría de código

### C3 — Handshake y estabilidad (`src/socket/index.ts`)

- ✅ **Handshake autenticado:** `io.use(...)` exige `socket.handshake.auth.token`; sin token →
  `Missing auth token`; token inválido/expirado → `Invalid or expired token`; usuario sin perfil →
  `User not found`.
- ✅ **Registro del handshake:** al conectar,
  `console.log("[socket] connected " + socket.id + " (uid=" + uid + ")")`.
- ✅ **socket.id único por pestaña:** Socket.io asigna un ID único a cada conexión; cada pestaña del
  navegador genera un socket distinto.
- ✅ **Conexión única por usuario:** `connectedUids` (Set) rechaza una segunda conexión simultánea
  del mismo UID (`User already connected`).
- ✅ **Liberación en desconexión:** `socket.on("disconnect")` hace `connectedUids.delete(uid)` y
  registra `[socket] disconnected <id> (uid=...)`.

### C4 — Reglas de seguridad (`firestore.rules`)

- ✅ `match /rooms/{roomId}`: `allow read/create: if request.auth != null` → anónimo **denegado**.
- ✅ `match /rooms/{roomId}/messages/{messageId}`: `allow read: if request.auth != null`;
  `allow create: if request.auth != null && request.auth.uid == request.resource.data.sender_id` →
  anónimo **denegado** y suplantación de `sender_id` **denegada**.

## Casos de prueba

| ID    | Caso                                                              | Criterio | Resultado | Evidencia                                            |
| ----- | ----------------------------------------------------------------- | -------- | --------- | ---------------------------------------------------- |
| TC-01 | Handshake con token válido → aceptado y logueado                  | C3       | ✅ PASS   | Captura del log `[socket] connected <id> (uid=...)`  |
| TC-02 | Handshake sin token / token inválido → rechazado                  | C3       | ✅ PASS   | `connect_error` en cliente / sin log de conexión     |
| TC-03 | Cada pestaña obtiene un `socket.id` único; al cerrar, se libera   | C3       | ✅ PASS   | Logs de `connected`/`disconnected` con IDs distintos |
| TC-04 | Lectura anónima de `rooms` → denegada                             | C4       | ✅ PASS   | Captura del Simulador: "Simulación denegada"         |
| TC-05 | Lectura anónima de `messages` → denegada                          | C4       | ✅ PASS   | Captura del Simulador: "Simulación denegada"         |
| TC-06 | Escritura anónima en `messages` → denegada                        | C4       | ✅ PASS   | Captura del Simulador: "Simulación denegada"         |
| TC-07 | Lectura **autenticada** de `rooms` → permitida (control positivo) | C4       | ✅ PASS   | Captura del Simulador: "Simulación permitida"        |

## Cómo ejecutar las pruebas

### C3 — Handshake (logs del servidor)

1. Levanta el backend: `npm run dev` (deja la terminal visible).
2. **Opción A (cliente real):** abre el frontend, inicia sesión y entra a una sala (`/sala/:id`). En
   la terminal del backend aparece `[socket] connected <socket.id> (uid=...)`.
3. **Opción B (script):** `scripts/socket-test.mjs` conecta sockets con token válido:
   `$env:WEB_API_KEY="<key>"; node scripts/socket-test.mjs`.
4. Abre **2 pestañas** → verás 2 logs `connected` con `socket.id` distintos. Cierra una → aparece
   `[socket] disconnected ...` (TC-03).
5. Sin token (o token inválido) el servidor rechaza el handshake y **no** registra conexión (TC-02).

### C4 — Simulador de Reglas de Firebase (anónimo bloqueado)

En Firebase Console → **Firestore Database → Reglas → "Simulador de reglas"** (Rules Playground):

| Simulación | Tipo     | Ubicación                       | Autenticado             | Esperado     |
| ---------- | -------- | ------------------------------- | ----------------------- | ------------ |
| TC-04      | `get`    | `/rooms/ABC-1234`               | **OFF**                 | 🔴 Denegada  |
| TC-05      | `get`    | `/rooms/ABC-1234/messages/MSG1` | **OFF**                 | 🔴 Denegada  |
| TC-06      | `create` | `/rooms/ABC-1234/messages/MSG1` | **OFF**                 | 🔴 Denegada  |
| TC-07      | `get`    | `/rooms/ABC-1234`               | **ON** (UID cualquiera) | 🟢 Permitida |

Captura cada resultado del simulador (denegado para anónimo, permitido para autenticado).

## Evidencia requerida (rúbrica C3 + C4)

1. **C3:** captura de la consola del servidor con handshakes exitosos (`[socket] connected ...`) y,
   si es posible, el `disconnected` al cerrar pestaña.
2. **C4:** capturas del Simulador de Reglas mostrando el **bloqueo** del acceso anónimo a `rooms` y
   `messages` (TC-04/05/06) y, como control, el acceso **permitido** autenticado (TC-07).

## Conclusión

La infraestructura de WebSockets (handshake autenticado, `socket.id` único, liberación en
desconexión) y las reglas de seguridad de `rooms`/`messages` (bloqueo de acceso anónimo) **cumplen
los criterios C3 y C4** a nivel de auditoría de código. Resta adjuntar la evidencia manual (logs del
servidor + capturas del Simulador de Reglas) en el documento único.
