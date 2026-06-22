# QA-17 — Transmisión multimedia, permisos de hardware y conexión P2P

- **Tarea:**
  [QA-17 #74](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/74)
- **US:**
  [US-12 — Transmisión de Audio y Video (WebRTC) #71](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/71)
- **Frontend:** captura local (`getUserMedia`), `RTCPeerConnection` por par, pre-sala (gate de
  autoplay), manejo de permisos y avatar fallback.
- **PR frontend:**
  [#27 captura P2P + grid remoto (FE-14)](https://github.com/ManuelR12/proyecto-integrador-frontend/pull/27)
  ·
  [#36 pre-sala con preview y permisos](https://github.com/ManuelR12/proyecto-integrador-frontend/pull/36)
  ·
  [#30 avatar fallback cámara off](https://github.com/ManuelR12/proyecto-integrador-frontend/pull/30)
  · [#31 servidores TURN ICE](https://github.com/ManuelR12/proyecto-integrador-frontend/pull/31)
- **PR backend:**
  [#17 media toggle + bloqueo de sesión concurrente](https://github.com/jeangiraldoo/proyecto-integrador-backend/pull/17)

## Comportamiento auditado

El cliente captura cámara/micrófono con `getUserMedia({ video: true, audio: true })` (dispositivos
predeterminados) y acopla los `MediaStream` a una `RTCPeerConnection` por cada par; la negociación
SDP/ICE viaja por el Signaling Server (TS-03) y se establece la conexión P2P directa. Existe una
**pre-sala** con botón "Entrar a sala" que actúa como gesto de usuario para habilitar el autoplay de
Chrome. El **manejo de permisos** es controlado: si el navegador/usuario deniega cámara o micrófono,
la app no se rompe ni muestra pantalla en negro, sino que despliega un **mensaje/modal instructivo**
("Recuerda activar los permisos…") y un toast dentro de la sala; el usuario sin video se representa
con su **avatar**. Para mejorar la conectividad P2P entre redes se configuran **servidores
TURN/ICE** (PR #31).

## Casos de prueba — resultado de auditoría

| ID    | Caso                                                                                 | Criterio | Resultado                                                                                 | Evidencia                   |
| ----- | ------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------- | --------------------------- |
| TC-01 | E2E en producción: dos usuarios remotos se ven y escuchan por el grid en tiempo real | C2 / G4  | ✅ PASS — sesión A/V activa con varios participantes; transmisión fluida                  | Video demostrativo          |
| TC-02 | Permisos bloqueados: la UI no se rompe y muestra el mensaje instructivo              | C4       | ✅ PASS — pre-sala muestra "Recuerda activar los permisos…"; sin pantalla en blanco       | `us12-permisos-denegados`   |
| TC-03 | Solicitud de permisos: diálogo nativo del navegador antes de entrar                  | C4       | ✅ PASS — estado "Solicitando permisos" + diálogo nativo (cámara/mic)                     | `us12-permisos-dialogo`     |
| TC-04 | Retroalimentación de permisos dentro de la sala (toast) sin bloquear la interfaz     | C4       | ✅ PASS — toast "Tienes que activar los permisos…"; el chat y la sala siguen operando     | `us12-permisos-toast`       |
| TC-05 | Avatar fallback cuando la cámara está apagada / sin permiso (no pantalla en negro)   | C4       | ✅ PASS — la tarjeta muestra avatar/iniciales                                             | `us12-transmision`          |
| TC-06 | Autoplay: al entrar por URL no se reproduce hasta pulsar "Entrar a sala"             | —        | ✅ PASS — pre-sala como gesto habilitador (FE-18); evita el bloqueo de autoplay de Chrome | Pre-sala                    |
| TC-07 | Estabilidad de la conexión P2P (ICE) y estado "connected"                            | C2 / G4  | ✅ PASS — candidatos ICE resueltos; TURN/ICE configurado para cruce de redes              | DevTools / `ts03-logs-mesh` |

## Cómo ejecutar las pruebas

1. Abre el frontend en producción desde **dos equipos/redes distintas**, inicia sesión con usuarios
   diferentes y entra a la misma sala pulsando **"Entrar a sala"**.
2. Concede permisos: ambos deben **verse y escucharse** en el grid en tiempo real.
3. Repite **bloqueando** la cámara/micrófono en el navegador: debe aparecer el **mensaje
   instructivo** (sin pantalla en negro) y el usuario se muestra con **avatar**.
4. En DevTools verifica que el estado de la `RTCPeerConnection` llegue a **`connected`** y que los
   candidatos ICE se resuelvan.

## Evidencia requerida por la rúbrica (C2 + C4 + Gating G4)

1. **Grabación en video** de la sesión A/V activa con dos o más usuarios (C2).
2. **Captura** del mensaje de error visual por permisos bloqueados (C4).

## Conclusión

US-12 cumple los criterios de QA-17 **PASS**: transmisión A/V P2P entre usuarios remotos en tiempo
real (C2 / Gating G4), manejo de permisos controlado con mensaje instructivo y avatar fallback sin
romper la UI (C4), pre-sala como gesto para el autoplay, y conexión P2P estable con candidatos ICE
resueltos (TURN/ICE configurado). Sin hallazgos abiertos; persiste la limitación de infraestructura
de la capa gratuita de Render para sesiones muy largas (no afecta el flujo A/V auditado).
