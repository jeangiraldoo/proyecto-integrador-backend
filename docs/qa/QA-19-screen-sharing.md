# QA-19 — Compartición de pantalla, estabilidad WebRTC y visualización remota en el Grid

- **Tarea:**
  [QA-19 #84](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/84)
- **US:**
  [US-14 — Compartir Pantalla (Screen Sharing) #80](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/80)
- **Frontend:** `getDisplayMedia`, `RTCRtpSender.replaceTrack`, `onended`, reordenamiento del grid
  (modo "cinema").
- **Backend:** control de un solo expositor por sala (`screen_share_started` /
  `peer_screen_share_changed` / `screen_share_denied`, `activeScreenShareUid` en `room_joined`) y
  documentación del protocolo en el README.
- **PR frontend:**
  [#38 screen sharing (FE-16 / FE-16.1)](https://github.com/ManuelR12/proyecto-integrador-frontend/pull/38)
  · [#39 cinema layout](https://github.com/ManuelR12/proyecto-integrador-frontend/pull/39) ·
  [#40 contrato de socket](https://github.com/ManuelR12/proyecto-integrador-frontend/pull/40)
- **PR backend:**
  [#22 README del protocolo](https://github.com/jeangiraldoo/proyecto-integrador-backend/pull/22) ·
  [#25 un solo expositor por sala](https://github.com/jeangiraldoo/proyecto-integrador-backend/pull/25)

## Comportamiento auditado

El expositor captura su pantalla con `getDisplayMedia` y reemplaza en caliente la pista de la cámara
por la de la pantalla mediante `RTCRtpSender.replaceTrack` en todas las conexiones activas, **sin
renegociación de SDP** ni desconexiones (C4). La pantalla se transmite a todos los participantes en
tiempo real y el grid se reordena en modo "cinema" dando prioridad al recuadro del expositor (C3 /
Gating G5). Al detener la compartición desde la barra nativa del navegador, la pista dispara
`onended` y el frontend restituye automáticamente la cámara con otro `replaceTrack`. A nivel de
servidor, un bloqueo por sala garantiza **un solo expositor a la vez**: el segundo intento recibe
`screen_share_denied`, y el estado se propaga con `peer_screen_share_changed` y
`activeScreenShareUid` (también en el roster de `room_joined` para late-joiners).

## Casos de prueba — resultado de auditoría

| ID    | Caso                                                                                    | Criterio | Resultado                                                                       | Evidencia                  |
| ----- | --------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- | -------------------------- |
| TC-01 | E2E en producción: la pantalla compartida se ve fluida y síncrona en todos los clientes | C3 / G5  | ✅ PASS — stream del escritorio visible en tiempo real para los participantes   | Video (compartir pantalla) |
| TC-02 | Detener desde la barra nativa ("Dejar de compartir") → `onended` restablece la cámara   | C4       | ✅ PASS — retorno automático a la cámara sin colgar ni desestabilizar la P2P    | Video (retorno a cámara)   |
| TC-03 | `replaceTrack` intercambia cámara ↔ pantalla sin renegociación; WS sin desconexiones   | C4       | ✅ PASS — intercambio en caliente; los canales de Socket.io permanecen estables | Revisión de código + video |
| TC-04 | Un solo expositor por sala: un segundo intento simultáneo es rechazado                  | C4       | ✅ PASS — bloqueo por sala; el segundo recibe `screen_share_denied` (PR #25)    | Revisión de código (#25)   |
| TC-05 | Reordenamiento del grid (modo "cinema") prioriza el recuadro del expositor              | C3 / C5  | ✅ PASS — el grid destaca al expositor y deja a los demás en una tira inferior  | Captura screenshare        |
| TC-06 | Vista responsive en móvil de la compartición de pantalla                                | C5       | ✅ PASS — el modo cinema se adapta al ancho móvil sin desbordamientos           | Captura responsive         |

## Cómo ejecutar las pruebas

1. Entra a una sala en producción desde **dos equipos físicos en redes distintas**.
2. En el equipo A pulsa **"Compartir Pantalla"** y acepta el diálogo nativo: en el equipo B la
   pantalla de A debe verse **fluida y en tiempo real**, con el grid reordenado (cinema).
3. Mientras A comparte, intenta **compartir desde B**: el sistema debe **rechazarlo** (un solo
   expositor por sala).
4. En A, pulsa **"Dejar de compartir"** desde la barra nativa: la cámara de A debe **restablecerse
   automáticamente** y B debe volver a verla, sin que la conexión se cuelgue.
5. Repite la prueba en un teléfono para validar la **vista responsive**.

## Evidencia requerida por la rúbrica (C3 + Gating G5 + C4)

1. **Video demostrativo** con dos computadoras en redes distintas: compartición fluida, reajuste del
   grid y retorno automático de la cámara.
2. Enlace al Pull Request integrado y al README con el protocolo (C5).

## Conclusión

US-14 cumple los criterios de QA-19 **PASS**: compartición de pantalla visible y fluida en
producción con el grid reordenado (C3 / Gating G5), reemplazo de pistas en caliente con
`replaceTrack` sin renegociación ni desconexiones (C4), retorno automático a la cámara vía `onended`
(C4), y control de **un solo expositor por sala** en el backend (PR #25). Sin hallazgos abiertos;
persiste la nota de la capa gratuita de Render para sesiones muy largas (infraestructura, no del
código).
