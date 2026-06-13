# QA-07 — Pruebas de eliminación de cuenta, modal crítico y borrado físico

- **Tarea:** [QA-07 #34](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/34)
- **US:** [US-05 — Eliminar Cuenta de Usuario #30](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/30)
- **Backend:** BE-08 (`DELETE /auth/account`, re-auth + borrado físico) — en `main`.
- **Frontend:** FE-07 (modal crítico) — en `main` (`DeleteAccountModal.tsx`, `useDeleteAccount.ts`, "Zona de peligro" en `Perfil.tsx`).

## Comportamiento auditado

El borrado lo ejecuta el backend con el Admin SDK (`DELETE /auth/account`): verifica el
token, exige inicio de sesión reciente (devuelve `401 auth/requires-recent-login` si la
sesión es vieja, **antes** de borrar nada) y luego purga `users/{username}` + `uids/{uid}`
y la identidad en Firebase Auth (borrado físico, sin soft-delete). El frontend abre un modal
crítico, exige escribir "eliminar" + un countdown, maneja el `401` mostrando instrucciones
de re-autenticación, y redirige a `/login` tras el éxito.

## Casos de prueba — resultado de auditoría de código

| ID | Caso | Criterio | Resultado | Evidencia manual |
|----|------|----------|-----------|------------------|
| TC-01 | El modal de advertencia crítica aparece | C1 | ✅ PASS — `DeleteAccountModal` con ícono de alerta, intro y lista de consecuencias | Captura del modal |
| TC-02 | Cancelar/cerrar no borra nada | C1 | ✅ PASS — `closeModal`/backdrop/Escape no disparan borrado | — |
| TC-03 | Confirmación con fricción (anti-accidente) | A11y/UX | ✅ PASS — exige escribir `eliminar` + countdown antes de habilitar el botón destructivo | Captura del estado "listo para confirmar" |
| TC-04 | Eliminación exitosa: borra Firestore + Auth y redirige a login | C1 | ✅ PASS — `deleteUserAccount` → `DELETE /auth/account` (Admin SDK) → `signOut` → `navigate('/login')` | **Video** + captura Firebase (Auth + Firestore vacíos) |
| TC-05 | Re-autenticación requerida (sesión larga) | C1 | ✅ PASS — captura `REQUIRES_RECENT_LOGIN` → `phase="reauth"` → alerta `role="alert"` con instrucciones y acción de re-login; el borrado en Firestore queda bloqueado (el backend responde `401` antes de borrar) | Captura de la alerta de re-auth |
| TC-06 | Accesibilidad por teclado en el modal | A11y | ⚠️ PARCIAL — ver hallazgos F1 y F2 | Recorrido con Tab |

## Certificación de la capa de API (BE-08)

Vía Swagger (`/docs`) o curl:

1. **TC-04 — éxito:** con token **fresco** (recién logueado), `DELETE /auth/account` → `200`
   `{ "message": "Account deleted permanently" }`. Verificar en Firebase que el usuario y
   sus docs desaparecen.
2. **TC-05 — re-auth:** con token cuya sesión tenga > 5 min, `DELETE /auth/account` →
   **`401 auth/requires-recent-login`**; ningún dato se borra.

> Verificado durante la implementación de BE-08 (flujo `401` → `200` confirmado en Swagger).

## Verificación física en Firebase (C1)

Tras una eliminación exitosa:
- **Authentication → Users:** el usuario ya **no aparece**.
- **Firestore Database:** `users/{username}` y `uids/{uid}` del usuario **desaparecieron**
  (sin registros huérfanos).

## Hallazgos de accesibilidad (QA)

> El criterio de QA-07 exige que en el modal crítico **el foco quede atrapado (focus trap)**
> y que **"Cancelar" sea el foco inicial**. La auditoría de `Modal.tsx` detecta:

- **F1 — Falta focus trap:** el modal enfoca el contenedor (`dialogRef.focus()`) y usa
  `role="dialog"` + `aria-modal="true"`, pero **no cicla el Tab/Shift+Tab** dentro del
  diálogo, por lo que el foco de teclado puede salir hacia la página de fondo.
  *Recomendación:* implementar un focus trap (capturar Tab en el primer/último elemento
  focuseable del modal).
- **F2 — Foco inicial no es "Cancelar":** al abrir, el foco va al contenedor, no al botón
  "Cancelar". *Recomendación:* enfocar "Cancelar" al abrir el modal.
  *Atenuante:* el borrado accidental ya se mitiga fuertemente con el type-to-confirm
  (`eliminar`) + countdown, que el botón destructivo respeta.

*Resto de accesibilidad — OK:* `role="dialog"`, `aria-modal`, `aria-labelledby`, cierre con
Escape, bloqueo de scroll de fondo y restauración del foco al cerrar.

## Evidencia requerida por la rúbrica (C1)

1. **Video** del flujo completo: modal → confirmación → borrado → redirección a `/login`.
2. **Captura** del modal de advertencia crítica.
3. **Captura** de la alerta de re-autenticación requerida (TC-05).
4. **Captura** de Firebase Console (Authentication + Firestore) mostrando la eliminación física.

## Conclusión

US-05 está implementada end-to-end (FE-07 + BE-08) y los criterios funcionales de QA-07
(modal crítico, borrado físico, re-autenticación con instrucciones, redirección a login)
**PASAN**. Quedan **2 hallazgos de accesibilidad** (F1 focus trap, F2 foco inicial en
"Cancelar") que deben corregirse en el frontend para cumplir al 100% el criterio de
accesibilidad del modal, además de la evidencia manual (video + capturas).
