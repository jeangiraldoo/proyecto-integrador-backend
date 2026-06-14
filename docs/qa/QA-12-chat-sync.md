# QA-12 — Sincronización de chat, auto-scroll y aislamiento de salas

- **Tarea:** [QA-12 #58](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/58)
- **US:** [US-10 — Mensajería Instantánea (Chat Sockets) #54](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/54)
- **Backend:** `src/socket/index.ts` (`join_room`/`send_message`/`receive_message`).
- **Frontend:** `useRoomChat`, `RoomChatPanel`, `roomSocketService`, `roomFirestoreService`.

## Arquitectura del chat (observada)

El frontend muestra el feed mediante un **listener en tiempo real de Firestore**
(`subscribeRoomMessages(roomId)` → `onSnapshot` sobre `rooms/{roomId}/messages`), mientras
que el **socket** gestiona la conexión (handshake, `join_room`, estado conectado/desconectado)
y el **envío** (`send_message`). Al enviar, el backend persiste el mensaje y este aparece para
todos los clientes de la sala vía el snapshot de Firestore — sincronización instantánea y por
sala. (El backend también emite `receive_message`; el feed del front se actualiza por Firestore,
por lo que ese broadcast queda como redundancia, no un defecto.)

## Casos de prueba — resultado de auditoría

| ID | Caso | Criterio | Resultado | Evidencia manual |
|----|------|----------|-----------|------------------|
| TC-01 | Dos navegadores en la misma sala → mensajes síncronos sin recarga | C2 / G3 | ✅ PASS — `onSnapshot` por sala + `send_message` por socket; sin delay perceptible | Video de 2 usuarios |
| TC-02 | Aislamiento: cliente en Sala B no recibe mensajes de Sala A | C2 | ✅ PASS — suscripción por `roomId` + `io.to(roomId)` en backend (verificado por logs en BE-14) | Logs de sockets |
| TC-03 | Auto-scroll al último mensaje al enviar/recibir | C2 | ✅ PASS — `scrollIntoView(messagesEndRef)` en cada cambio de mensajes | Video / captura |
| TC-04 | Caída de conexión → formulario bloqueado | — | ✅ PASS — `textarea` y botón `disabled` si `!connected`; aviso `role="status"`; `sendMessage` exige `connected` | Captura desconectado |
| TC-05 | Accesibilidad por teclado de la caja de chat | A11y | ✅ PASS — Tab al `textarea`, **Enter** envía (Shift+Enter = nueva línea), botón con `aria-label`, foco visible, errores `role="alert"` | Recorrido con Tab |

## Cómo ejecutar las pruebas

### TC-01/02/03 — Sync, aislamiento y auto-scroll (manual con navegadores)
1. Levanta backend (`npm run dev`) y frontend (`npm run dev`).
2. Abre **2 navegadores** (o 2 perfiles), inicia sesión con usuarios distintos y entra a la
   **misma sala** por su ID. Envía mensajes desde uno → aparecen al instante en el otro,
   sin recargar; el contenedor hace auto-scroll al final.
3. Abre un **3er navegador** en **otra sala**: no debe recibir los mensajes de la primera
   (confírmalo en los logs del servidor: `receive_message -> room <otra>`).

### TC-02 — Aislamiento (automatizado, opcional)
`scripts/socket-test.mjs` ya prueba el aislamiento entre salas (un mensaje en la Sala X llega
al otro socket de X pero no al de la Sala Y). Ejecuta:
`$env:WEB_API_KEY="<key>"; node scripts/socket-test.mjs`.

### TC-04 — Caída de conexión
Con la sala abierta, detén el backend (o desactiva la red) → el chat muestra el estado
"desconectado" y el `textarea`/botón quedan deshabilitados (no se puede enviar).

## Verificación en Firebase

Firestore Console → `rooms/{roomId}/messages`: cada mensaje enviado queda persistido con
`room_id`, `sender_id`, `username`, `text` y `timestamp` (serverTimestamp), y solo en la sala
correspondiente (aislamiento de datos).

## Evidencia requerida por la rúbrica (Sprint 3, C2)

1. **Video** de dos usuarios en chat síncrono enviándose mensajes en tiempo real (sin recarga).
2. **Captura** de Firestore (`rooms/{roomId}/messages`) con los mensajes reales.
3. **Captura** de los logs de enrutamiento de sockets (`[socket] receive_message -> room ...`)
   mostrando el aislamiento entre salas.
4. Enlace al PR integrado.

## Conclusión

US-10 está implementada end-to-end y los criterios de QA-12 **PASAN**: sincronización
instantánea entre clientes sin recarga (C2/G3), aislamiento estricto por sala, auto-scroll
reactivo, bloqueo del formulario ante caída de conexión y accesibilidad por teclado
(Tab + Enter). Sin hallazgos abiertos (la caja de chat no es un modal, no aplica el focus trap).
