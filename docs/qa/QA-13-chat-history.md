# QA-13 — Carga de historial, consistencia cronológica y persistencia

- **Tarea:**
  [QA-13 #62](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/62)
- **US:**
  [US-11 — Historial de Chat (Persistencia Firestore) #59](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/59)
- **Backend:** `send_message` (persistencia + serverTimestamp), `GET /rooms/:roomId/messages`
  (BE-15).
- **Frontend:** `useRoomChat`, `roomFirestoreService` (`subscribeRoomMessages`), `RoomChatPanel`,
  `ChatMessageBubble`, `ChatSkeleton`.

## Comportamiento auditado

Cada mensaje se persiste en `rooms/{roomId}/messages` con `room_id`, `sender_id`, `username`, `text`
y `timestamp` (serverTimestamp). El frontend carga el historial mediante un listener de Firestore:
`subscribeRoomMessages(roomId)` usa
`query(collection(rooms/{id}/messages), orderBy("timestamp","asc"))` + `onSnapshot`. Al entrar a la
sala o recargar (F5), el primer snapshot trae todo el historial **ordenado cronológicamente
ascendente**; el `onSnapshot` reemplaza el conjunto completo (sin duplicar) y el render usa
`key={message.id}`. Tras cargar, un `useEffect` ejecuta el **auto-scroll** al último mensaje. (El
endpoint REST `GET /rooms/:roomId/messages` de BE-15 entrega el mismo historial ordenado y queda
disponible/certificado, aunque el feed del front usa Firestore.)

## Casos de prueba — resultado de auditoría

| ID    | Caso                                                                                     | Criterio | Resultado                                                                                                  | Evidencia manual             |
| ----- | ---------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------- |
| TC-01 | Persistencia: múltiples mensajes se guardan con su estructura                            | C3       | ✅ PASS — `rooms/{id}/messages` con metadatos + `serverTimestamp`                                          | Captura Firestore            |
| TC-02 | F5 / entrar a sala con actividad → historial en orden cronológico exacto, sin duplicados | C3       | ✅ PASS — `orderBy("timestamp","asc")` + `onSnapshot` (reemplazo total) + `key={id}`                       | Captura del chat tras F5     |
| TC-03 | Auto-scroll al último mensaje tras la recarga                                            | C4       | ✅ PASS — `useEffect(scrollToBottom, [loadingHistory, messages])`                                          | Video/captura                |
| TC-04 | Accesibilidad: burbujas leídas en orden, foco no se pierde al actualizar                 | A11y     | ✅ PASS — orden del DOM = cronológico; el foco permanece en el `textarea`; estados `role="status"/"alert"` | Recorrido con lector/teclado |

## Cómo ejecutar las pruebas

1. Levanta backend (`npm run dev`) y frontend (`npm run dev`).
2. Entra a una sala y **envía varios mensajes** (mejor desde 2 usuarios).
3. **Recarga (F5):** el historial debe reaparecer **completo, en orden cronológico, sin
   duplicados**, y el scroll debe posicionarse **automáticamente** en el último mensaje.
4. Repite entrando a la sala desde otra sesión/pestaña (sala "con actividad previa").

## Certificación de la capa de API (BE-15)

`GET /rooms/{roomId}/messages` (Swagger) → `200` con los mensajes ordenados ascendentemente por
`timestamp` (estructura `id`, `room_id`, `sender_id`, `username`, `text`, `timestamp`).

## Verificación en Firebase (C3)

Firestore Console → `rooms/{roomId}/messages`: todos los mensajes emitidos quedan persistidos con
sus metadatos y `timestamp` (serverTimestamp) para la indexación horaria; el orden por `timestamp`
es consistente entre clientes/zonas horarias.

## Recomendación de accesibilidad (opcional)

Agregar `aria-live="polite"` (o `role="log"`) al contenedor de la lista de mensajes para que los
lectores de pantalla anuncien los mensajes nuevos a medida que llegan. No bloquea el criterio (las
burbujas ya son legibles en orden y el foco se conserva), es una mejora.

## Evidencia requerida por la rúbrica (Sprint 3, C3 + C4)

1. **Captura** de Firestore (`rooms/{roomId}/messages`) con los registros persistidos (C3).
2. **Captura** de la interfaz del chat tras **F5** con el historial completo en orden y sin
   duplicados (C3) y el auto-scroll activo en el último mensaje (C4).
3. Enlace al PR integrado.

## Conclusión

US-11 está implementada end-to-end y los criterios de QA-13 **PASAN**: persistencia completa de
mensajes (C3), carga del historial al entrar/F5 en orden cronológico exacto y sin duplicados (C3),
auto-scroll reactivo al último mensaje (C4) y accesibilidad por teclado/lector. Sin hallazgos
abiertos; queda una mejora opcional (`aria-live`) y la evidencia manual.
