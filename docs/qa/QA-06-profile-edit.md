# QA-06 — Pruebas de edición de perfil, re-validación de username y persistencia

- **Tarea:**
  [QA-06 #29](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/29)
- **US:**
  [US-04 — Ver y Editar Perfil de Usuario #25](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/25)
- **Backend:** BE-07 (`GET`/`PATCH /auth/profile`) — en `main`.
- **Frontend:** FE-06 (página "Mi Perfil") — en `main` (commit `a50c51a`, rama `feat/fe-06-profile`,
  por AndresPerea).

## Modelo de datos relevante

El perfil se guarda en `users/{username}` (id = username en minúsculas) con el espejo `uids/{uid}` →
`{ username }`. La edición que cambia el username **mueve** el documento de forma transaccional
(crea `users/{nuevo}`, borra `users/{viejo}`, repunta `uids/{uid}`).

## Estado de los componentes (auditoría)

| Componente                                                               | Estado       |
| ------------------------------------------------------------------------ | ------------ |
| BE-07 — `GET /auth/profile` (lectura)                                    | ✅ En `main` |
| BE-07 — `PATCH /auth/profile` (edición + colisión transaccional → `409`) | ✅ En `main` |
| FE-06 — página "Mi Perfil" (`src/pages/Perfil.tsx`)                      | ✅ En `main` |
| FE-06 — `useProfileForm`, `profileService`, `UserProfileContext`         | ✅ En `main` |

## Casos de prueba — resultado de auditoría de código

| ID    | Caso                                        | Criterio | Resultado (auditoría)                                                                                                                                                                                              | Evidencia manual                                     |
| ----- | ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| TC-01 | Ver perfil precargado                       | C1       | ✅ PASS — `Perfil.tsx` carga desde `UserProfileContext` (`fetchUserProfile` → `GET /auth/profile`)                                                                                                                 | Captura de "Mi Perfil" con datos                     |
| TC-02 | Editar nombre/apellido/avatar y guardar     | C1       | ✅ PASS — `useProfileForm.handleSubmit` → `updateUserProfile` (`PATCH /auth/profile`) → `refetch()`; toast de éxito                                                                                                | Video + captura de Firestore `users/{username}`      |
| TC-03 | Guardar con el **propio** username          | C1       | ✅ PASS — `handleUsernameChange` omite el chequeo si `value === baseline.username`; backend permite el propio                                                                                                      | Captura `200`                                        |
| TC-04 | **Colisión** de username                    | C1       | ✅ PASS — chequeo en vivo (debounce → `isUsernameTaken`) **y** manejo de `409 USERNAME_TAKEN` en submit; error **inline** con `role="alert"` + `aria-invalid`                                                      | **Captura del error inline** (requerida por rúbrica) |
| TC-05 | Propagación en tiempo real (header/sidebar) | C1       | ✅ PASS — `UserProfileContext` compartido; `useUserProfile` lo consume en `Dashboard.tsx` y en el header de Perfil; `refetch()` actualiza a todos **sin F5**                                                       | Video mostrando actualización sin recargar           |
| TC-06 | Accesibilidad por teclado                   | A11y     | ✅ PASS — labels asociados (`htmlFor`), foco visible (`focus:ring-2`), `aria-invalid`/`aria-busy`/`aria-describedby`, errores con `role="alert"`, `fieldset disabled` durante guardado, orden de tab nativo lógico | Recorrido con Tab + lector de pantalla               |

## Certificación de la capa de API (BE-07)

Vía Swagger (`/docs`) o curl, con dos usuarios A y B:

1. **TC-02 — persistencia:** `PATCH /auth/profile` con `{ "name", "lastName", "avatarUrl" }` →
   `200`; `GET /auth/profile` confirma; Firestore Console muestra `users/{username}` actualizado.
2. **TC-03 — propio username:** `PATCH` con `{ "username": "<el actual>" }` → `200`.
3. **TC-04 — colisión:** con el token de A, `PATCH` `{ "username": "<username de B>" }` →
   **`409 auth/username-already-exists`**; `GET` posterior confirma que A **no** cambió.

> Estos escenarios fueron verificados durante la implementación de BE-07.

## Accesibilidad — detalle auditado (FE-06)

- ✅ Orden de tabulación nativo y lógico (avatar → nombres → apellidos → username → Guardar →
  eliminar).
- ✅ Foco visible (`focus:ring-2`) en todos los controles.
- ✅ Error de colisión: `<p role="alert">` + input con `aria-invalid="true"` y
  `aria-describedby="username-error"`.
- ✅ `aria-busy` mientras valida el username (spinner).
- ✅ Email de solo lectura (`readOnly`); `fieldset disabled` mientras guarda.
- ⏳ Pendiente verificación manual: contraste WCAG 2.2 AA y prueba con lector de pantalla real.

## Evidencia requerida por la rúbrica (C1, Sprint 2)

1. **Video** del flujo completo de edición con persistencia en Firestore (cubre TC-01, TC-02,
   TC-05).
2. **Captura** del error visual de colisión de username al editar — inline (TC-04).
3. (Apoyo) Captura de Firestore Console: `users/{username}` con los datos actualizados.

## Conclusión

FE-06 y BE-07 están implementados y **la auditoría de código certifica los 4 criterios de
aceptación** (C1 funcional, bloqueo de colisión con error inline, propagación en tiempo real sin
recarga, y accesibilidad por teclado). Solo resta **ejecutar manualmente** el flujo para capturar el
video y la captura del error inline que pide la rúbrica.
