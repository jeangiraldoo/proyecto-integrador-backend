# QA-10 — Unión por ID, validación de errores y visualización por rol

- **Tarea:** [QA-10 #48](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/48)
- **US:** [US-08 — Unirse a una Sala #44](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/44)
- **Backend:** `PATCH`/`DELETE /rooms/:roomId` (validación de dueño), `firestore.rules`.
- **Frontend:** `JoinRoomSection` + `useJoinRoom`, `RoomHeader` + `useRoom`.

## Comportamiento auditado

La unión valida el ID en el formulario (requerido → formato `ABC-1234` → existencia en
Firestore); si no existe, muestra error inline y **mantiene el input** para reintentar; si
existe, redirige a `/sala/:id`. Dentro de la sala, el rol se calcula como
`isAdmin = room.ownerId === userId` (es decir, `created_by == uid`). Los controles *Editar
sala* / *Eliminar sala* se renderizan **solo si `isAdmin`** (no existen en el DOM para el
Invitado). Defensa en profundidad: el backend responde `403` y las reglas de Firestore
deniegan `update`/`delete` a quien no sea el creador.

## Casos de prueba — resultado de auditoría

| ID | Caso | Criterio | Resultado | Evidencia manual |
|----|------|----------|-----------|------------------|
| TC-01 | Unión con ID válido → redirige a la sala | C1 | ✅ PASS — `useJoinRoom` → `navigate('/sala/:id')` | Video del flujo |
| TC-02 | **Invitado** no ve Editar/Eliminar | C1 | ✅ PASS — `{isAdmin && (...)}` en `RoomHeader`; `isAdmin=false` si `ownerId != uid` | Captura sala como Invitado |
| TC-03 | **Anfitrión** sí ve Editar/Eliminar (control) | C1 | ✅ PASS — `isAdmin=true` si `ownerId == uid` | Captura sala como Anfitrión |
| TC-04 | ID inexistente → error inline, sin redirección, input retenido | — | ✅ PASS — `fetchRoomById` null → `errorNotFound`; no se limpia el input | Captura del error |
| TC-05 | ID mal formado → error de formato, bloquea | — | ✅ PASS — `isValidRoomIdFormat` → `errorFormat` | Captura del error |
| TC-06 | Seguridad: Invitado fuerza edit/delete → denegado | C1 | ✅ PASS — backend `403 Forbidden` + reglas Firestore `update/delete if uid == created_by` | Captura consola/Simulador |
| TC-07 | Accesibilidad por teclado del formulario de unión | A11y | ✅ PASS — `aria-invalid`, `aria-describedby`, error con `role="alert"` + ícono (no solo color), foco visible | Recorrido con Tab |

## Certificación de la capa de API (BE — salas)

Vía Swagger (`/docs`), con un usuario que **no** es el creador de la sala:
- `PATCH /rooms/{roomId}` con `{ "name": "x" }` → **`403`** (no es el creador).
- `DELETE /rooms/{roomId}` → **`403`**. (El creador sí obtiene `200`.)
- `PATCH`/`DELETE` con un `roomId` inexistente → **`404`**.

## Verificación de seguridad en Firebase (C1)

En el **Simulador de Reglas** (Firestore → Reglas), o forzando desde la consola del
navegador como Invitado:
- `update` / `delete` sobre `/rooms/{roomId}` con un UID **distinto** de `created_by` →
  **Denegada** (`allow update, delete: if request.auth.uid == resource.data.created_by`).
- La misma operación con el UID del creador → Permitida.

## Evidencia requerida por la rúbrica (Sprint 3, C1)

1. **Capturas** de la sala con los botones de administración **visibles para el Anfitrión**
   y **ocultos para el Invitado** (antes/después).
2. **Captura** del error inline al ingresar un ID inexistente o mal formado.
3. **Video** del flujo de unión por ID (válido → redirección).
4. (Apoyo) Captura del Simulador de Reglas / consola denegando edit/delete al Invitado.
5. Enlace al PR integrado.

## Conclusión

US-08 está implementada end-to-end y los criterios de QA-10 **PASAN**: unión por ID con
manejo de errores (inexistente/mal formado, input retenido), ocultamiento de controles de
administración para el Invitado (C1) reforzado por `403` del backend y reglas de Firestore,
y accesibilidad del formulario. Resta la evidencia manual (capturas + video).
