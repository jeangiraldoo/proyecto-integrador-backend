# QA-18 — Control de estados AV (mute / cámara off), estabilidad WebRTC y sincronización de íconos

- **Tarea:**
  [QA-18 #79](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/79)
- **US:**
  [US-13 — Control de Estados AV (Mute/Video off) #75](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/75)
- **Backend:** `media_state_changed` / `peer_media_state_changed` (con `uid` + `socket_id`) y
  snapshot de estado en `room_joined` (`src/socket/index.ts`).
- **PR backend:**
  [#21 evento media_state_changed](https://github.com/jeangiraldoo/proyecto-integrador-backend/pull/21)
  · [#23 uid en el payload](https://github.com/jeangiraldoo/proyecto-integrador-backend/pull/23) ·
  [#24 snapshot late-joiners](https://github.com/jeangiraldoo/proyecto-integrador-backend/pull/24)
- **PR frontend:**
  [#37 botones de control multimedia + optimización (FE-15 / FE-15.1)](https://github.com/ManuelR12/proyecto-integrador-frontend/pull/37)

## Comportamiento auditado

Al pulsar mutear o apagar cámara, el cliente alterna la propiedad `.enabled` de la pista
(`MediaStreamTrack`) local: el envío de esa pista se detiene sin destruir ni reiniciar la
`RTCPeerConnection` ni el canal de Socket.io (conexión robusta, sin caídas — C1/C4). El cambio emite
`media_state_changed`, que el servidor retransmite a la sala como `peer_media_state_changed`
(incluyendo `uid` y `socket_id` asignados por el servidor); los demás clientes renderizan de forma
síncrona el ícono de micrófono o cámara tachado (en rojo) sobre la tarjeta del usuario, y su avatar
reemplaza al video (C2). El estado se conserva por socket y se entrega en el roster de
`room_joined`, de modo que quien se une después ve el estado correcto (sin mostrar a todos como
activos).

## Casos de prueba — resultado de auditoría

| ID    | Caso                                                                                        | Criterio | Resultado                                                                                     | Evidencia             |
| ----- | ------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- | --------------------- |
| TC-01 | Mute / cámara off detiene la pista local sin reiniciar ni caer la conexión P2P              | C1 / C4  | ✅ PASS — `.enabled = false`; la `RTCPeerConnection` y el socket permanecen activos           | Video local (US-13)   |
| TC-02 | Sincronización del ícono tachado entre dos equipos/redes distintas en producción            | C2       | ✅ PASS — `media_state_changed` → `peer_media_state_changed`; ícono rojo inmediato en el peer | Video peers + captura |
| TC-03 | Spam de clics rápidos en los botones: bloqueo temporal y servidor sin saturación de eventos | C4       | ✅ PASS — botones deshabilitados momentáneamente; el handler valida y no satura el WS         | Recorrido manual      |
| TC-04 | Late-joiner: quien entra después ve el estado real (mute/cámara off) de los presentes       | C2       | ✅ PASS — snapshot de estado incluido en el roster de `room_joined` (PR #24)                  | Captura ícono tachado |
| TC-05 | Accesibilidad: el estado no depende solo del color (ícono + avatar)                         | A11y     | ✅ PASS — ícono tachado en rojo + reemplazo por avatar; legible sin distinguir color          | Capturas              |
| TC-06 | Vista responsive en móvil mantiene controles e indicadores                                  | C5       | ✅ PASS — grid e íconos se adaptan al ancho móvil sin desbordes                               | Capturas responsive   |

## Cómo ejecutar las pruebas

1. Entra a una sala en producción desde **dos equipos físicos en redes distintas** con cámara/mic.
2. En el equipo A, **mutea el micrófono** y **apaga la cámara**: la transmisión de esas pistas debe
   detenerse sin cortar la videollamada, y en el equipo B debe aparecer **al instante** el ícono
   tachado (rojo) sobre la tarjeta de A, con su avatar.
3. Haz **clic rápido repetido** en los botones de control: deben deshabilitarse momentáneamente
   (anti-rebote) y la sesión debe seguir estable.
4. Conéctate con un **tercer usuario después** de que A ya esté en mute: debe ver el estado correcto
   de A de inmediato (snapshot).

## Evidencia requerida por la rúbrica (C1 + C2 + C4)

1. **Video** de la sesión con silenciamiento de pistas locales sin caídas de conexión.
2. **Video/captura** de la sincronización en tiempo real del ícono de silencio con los peers.
3. Enlace al Pull Request integrado.

## Conclusión

US-13 cumple los criterios de QA-18 **PASS**: el control de pistas con `.enabled` detiene
audio/video localmente sin desestabilizar la P2P (C1/C4); el evento `media_state_changed` sincroniza
el ícono tachado entre pares en tiempo real (C2); el spam de clics se mitiga con bloqueo temporal; y
el snapshot en `room_joined` corrige el caso del late-joiner. Sin hallazgos abiertos.
