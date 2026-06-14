# QA-11 — Edición/eliminación de salas y restricciones por rol

- **Tarea:**
  [QA-11 #53](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/53)
- **US:**
  [US-07 — Editar y Eliminar Salas #49](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/49)
- **Backend:** `PATCH`/`DELETE /rooms/:roomId` (dueño-only), `firestore.rules`.
- **Frontend:** `RoomConfigModal` + `useUpdateRoom`, `DeleteRoomModal` + `useDeleteRoom`,
  `RoomHeader`.

## Comportamiento auditado

Solo el Anfitrión (`isAdmin = room.ownerId === uid`, es decir `created_by == uid`) ve los botones
_Editar_/_Eliminar_ en `RoomHeader`. Al **renombrar**, `useUpdateRoom` llama `PATCH /rooms/:id` y en
`onSuccess` actualiza el estado local (`setRoom(prev => ({...prev, title: name}))`), por lo que el
encabezado de la sala cambia **en tiempo real, sin recarga**. Al **eliminar**, el modal crítico
exige escribir la palabra de confirmación; luego `DELETE /rooms/:id` borra físicamente el documento
de la sala (y su subcolección `messages` por lotes) y redirige a `/dashboard` (navegación SPA +
refetch). Defensa en profundidad: el backend responde `403` y las reglas de Firestore deniegan
`update`/`delete` salvo que `uid == created_by`.

## Casos de prueba — resultado de auditoría

| ID    | Caso                                                                   | Criterio | Resultado                                                                                     | Evidencia manual                |
| ----- | ---------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- | ------------------------------- |
| TC-01 | Anfitrión renombra → persiste y se refleja en tiempo real en el header | C1       | ✅ PASS — `PATCH /rooms/:id` + `setRoom` (sin recarga)                                        | Capturas antes/después          |
| TC-02 | Eliminación: modal crítico → borrado físico → redirección al Dashboard | C1       | ✅ PASS — type-to-confirm → `DELETE /rooms/:id` (doc + `messages`) → `navigate('/dashboard')` | Modal + Firestore + redirección |
| TC-03 | Solo el Anfitrión tiene los controles (Invitado no)                    | C1       | ✅ PASS — `{isAdmin && (...)}` en `RoomHeader`                                                | Captura Invitado sin botones    |
| TC-04 | Invitado fuerza edit/delete desde consola → denegado                   | C1       | ✅ PASS — reglas Firestore `update/delete if uid == created_by` + backend `403`               | Captura consola/Simulador       |
| TC-05 | Accesibilidad por teclado del modal de configuración                   | A11y     | ⚠️ PARCIAL — ver hallazgo F1                                                                  | Recorrido con Tab               |

## Certificación de la capa de API (BE — salas)

Vía Swagger (`/docs`):

- **Como creador:** `PATCH /rooms/{roomId}` `{ "name": "Nuevo" }` → `200`; `DELETE /rooms/{roomId}`
  → `200` (el documento desaparece de Firestore).
- **Como no-creador (Invitado):** `PATCH`/`DELETE /rooms/{roomId}` → **`403 Forbidden`**.
- `roomId` inexistente → **`404`**.

## Verificación de seguridad en Firebase (C1)

En el **Simulador de Reglas** (Firestore → Reglas) o forzando desde la consola del navegador como
Invitado:

- `update` / `delete` sobre `/rooms/{roomId}` con UID **distinto** de `created_by` → **Denegada**
  (permisos insuficientes).
- Borrado físico: tras `DELETE`, el documento `rooms/{roomId}` ya **no aparece** en Firestore.

## Hallazgo de accesibilidad (QA)

- **F1 (recurrente) — modales sin focus trap:** `RoomConfigModal` y `DeleteRoomModal` usan el
  componente compartido `Modal.tsx`, que tiene `role="dialog"` + `aria-modal` y errores con
  `aria-invalid`/`role="alert"`, pero **no atrapa el Tab** dentro del diálogo. _Recomendación:_
  implementar el focus trap en `Modal.tsx` (resuelve de una vez todos los modales: editar/eliminar
  sala, crear sala, eliminar cuenta).

## Evidencia requerida por la rúbrica (Sprint 3, C1)

1. **Capturas antes/después** de renombrar la sala (cambio en la barra de título).
2. **Captura** del modal de borrado crítico y la **redirección** posterior al Dashboard.
3. **Captura** de Firestore mostrando que el documento de la sala fue removido.
4. (Apoyo) Captura del Simulador de Reglas / consola denegando edit/delete al Invitado.
5. Enlace al PR integrado.

## Conclusión

US-07 está implementada end-to-end y los criterios de QA-11 **PASAN**: renombrado con reflejo en
tiempo real (C1), eliminación física con modal crítico y redirección, y restricción por rol
reforzada por `403` del backend y reglas de Firestore. Queda el hallazgo de accesibilidad **F1**
(focus trap del modal compartido) y la evidencia manual.
