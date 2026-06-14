# QA-09 — Pruebas de creación de salas, listado y estados del Dashboard

- **Tarea:**
  [QA-09 #43](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/43)
- **US:**
  [US-06 — Crear y Visualizar Salas Propias #39](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/39)
- **Backend:** `POST /rooms`, `GET /rooms` (BE-11). **Frontend:** Dashboard (FE-08).

## Comportamiento auditado

`POST /rooms` genera un **código único** de sala (`ABC-1234`) usado como ID de documento (con
reintentos ante colisión — Gating G2), guarda `created_by` (UID), `members: []` y `created_at`
(serverTimestamp). El frontend (`useCreateRoom`) llama al servicio y, al crear, **redirige a
`/sala/:id`** (entrar como administrador). `GET /rooms` devuelve solo las salas del UID autenticado.
El Dashboard renderiza condicionalmente: estado vacío (ilustración + CTA) o cuadrícula de tarjetas,
con estados de carga (skeleton) y error.

## Casos de prueba — resultado de auditoría

| ID    | Caso                                            | Criterio | Resultado                                                                                                                        | Evidencia manual                |
| ----- | ----------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| TC-01 | Crear sala → ID único + redirección al interior | G2       | ✅ PASS — `POST /rooms` `201` con id `ABC-1234`, `created_by=uid`; `navigate('/sala/:id')`                                       | Video del flujo + Firestore     |
| TC-02 | Estado vacío (0 salas)                          | C2       | ✅ PASS — `DashboardEmptyState` con ilustración SVG, mensaje amigable y botón CTA "Crear sala"                                   | Captura del dashboard vacío     |
| TC-03 | Cuadrícula de tarjetas con salas                | C2       | ✅ PASS — `rooms.map` → `RoomCard` en grid responsivo                                                                            | Captura del dashboard con salas |
| TC-04 | Reactividad sin F5                              | C2       | ✅ PASS — `useRooms` re-consulta al montar/volver; el borrado refresca vía `location.state` (navegación SPA, sin recarga física) | Video sin F5                    |
| TC-05 | `GET /rooms` filtra por el UID autenticado      | G2       | ✅ PASS — `where("created_by","==",uid)`                                                                                         | Captura Swagger `200`           |
| TC-06 | Estados de carga y error                        | C2       | ✅ PASS — `RoomCardSkeleton` (`aria-busy`/`aria-live`) y error con `role="alert"`                                                | —                               |
| TC-07 | Accesibilidad por teclado en el Dashboard       | A11y     | ✅ PASS (dashboard) · ⚠️ ver hallazgo F1 (modal)                                                                                 | Recorrido con Tab               |

## Certificación de la capa de API (BE-11)

Vía Swagger (`/docs`):

1. **TC-01 — creación:** `POST /rooms` con `{ "name": "Sala de Cálculo" }` → `201` con `id` (código
   único), `created_by` = UID, `members: []`. (Verificar en Firestore.)
2. **TC-05 — listado:** `GET /rooms` → `200` con **solo** las salas del UID autenticado.

## Verificación en Firebase (Gating G2)

Firestore Console → colección `rooms`: cada documento tiene un **ID único** (`ABC-1234`),
`created_by` igual al UID del creador, `members` (array) y `created_at` (serverTimestamp). No se
generan IDs duplicados (el backend reintenta ante colisión).

## Hallazgo de accesibilidad (QA)

- **F1 (heredado de QA-07) — `CreateRoomModal` sin focus trap:** el modal de creación usa el
  componente compartido `Modal.tsx`, que tiene `role="dialog"` + `aria-modal` pero **no atrapa el
  Tab** dentro del diálogo. _Recomendación:_ implementar el focus trap en `Modal.tsx` (beneficia a
  todos los modales: crear sala, editar/eliminar, eliminar cuenta).

_Resto de accesibilidad del Dashboard — OK:_ orden de tabulación nativo y lógico, foco visible,
botones operables, skeleton/errores anunciables (`aria-busy`, `role="alert"`), estado vacío con
`aria-labelledby`.

## Evidencia requerida por la rúbrica (C2)

1. **Captura** del Dashboard en **estado vacío** (ilustración + mensaje + CTA).
2. **Captura** del Dashboard con la **cuadrícula de salas** llena.
3. **Video** del flujo completo de creación de una sala (modal → `201` → redirección a la sala).
4. (Apoyo) Captura de Firestore: colección `rooms` con `created_by` = UID y el ID único.

## Conclusión

US-06 está implementada end-to-end (FE-08 Dashboard + BE-11) y los criterios funcionales de QA-09
(creación con ID único y redirección — G2; estado vacío con ilustración y CTA — C2; cuadrícula de
salas; reactividad sin F5; filtrado por UID) **PASAN**. Queda el hallazgo de accesibilidad **F1**
(focus trap del modal compartido) y la evidencia manual (capturas + video).
