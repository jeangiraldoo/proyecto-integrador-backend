# QA-14 — Señalización WebRTC local y depuración de ICE candidates en consola

- **Tarea:**
  [QA-14 #65](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/65)
- **US/TS:**
  [TS-03 — Implementación de Lógica WebRTC (Signaling Server) #63](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/63)
- **Backend:** `webrtc_offer` / `webrtc_answer` / `webrtc_ice_candidate` (relay dirigido por
  `uidToSocketId`), `incoming_offer` / `incoming_answer` / `incoming_ice_candidate`
  (`src/socket/index.ts`, BE-16).
- **PR backend:**
  [#13 signaling relay + presence](https://github.com/jeangiraldoo/proyecto-integrador-backend/pull/13)
  ·
  [#16 eventos `webrtc_*` + validación de payload e isolation](https://github.com/jeangiraldoo/proyecto-integrador-backend/pull/16)

## Comportamiento auditado

El servidor de señalización reutiliza el canal de Socket.io ya autenticado (handshake con Firebase
ID token). Mantiene un mapa `uidToSocketId` para enrutar cada paquete al par destino: al recibir
`webrtc_offer` / `webrtc_answer` reenvía el `sdp` al socket de `targetUid` como `incoming_offer` /
`incoming_answer`; al recibir `webrtc_ice_candidate` reenvía el `candidate` como
`incoming_ice_candidate`. El payload (SDP/ICE) se retransmite **sin alterar su estructura**. Cada
relay imprime un log de trazabilidad (`webrtc_offer relayed <from> → <to> (room=<id>)`,
`webrtc_answer relayed <from> → <to>`). Desde la PR #16 los handlers **validan el payload** y
**verifican la pertenencia a la sala** antes de reenviar (room isolation).

## Casos de prueba — resultado de auditoría

| ID    | Caso                                                                                   | Criterio | Resultado                                                                                                  | Evidencia               |
| ----- | -------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- | ----------------------- |
| TC-01 | Conexión local con 2 navegadores: el servidor enruta la señalización sin caídas        | C1       | ✅ PASS — ambos sockets se autentican y unen a la sala; el servicio no se cae durante la negociación       | Logs del servidor       |
| TC-02 | Logs del backend imprimen `webrtc_offer` → `webrtc_answer` → ráfaga de `ice_candidate` | C1       | ✅ PASS — los logs muestran el tránsito secuencial entre los sockets correspondientes, acotado por sala    | `ts03-logs-*`           |
| TC-03 | DevTools de ambos clientes sin excepciones SDP / `RTCPeerConnection` / parseo ICE      | C1       | ✅ PASS — consola del cliente con la señalización limpia, sin errores de negociación                       | `ts03-devtools-console` |
| TC-04 | El formato del payload (SDP / ICE) no se altera en tránsito                            | C1       | ✅ PASS — el relay reenvía `sdp` / `candidate` tal cual (sin transformación); validación de payload en #16 | Revisión de código      |
| TC-05 | Aislamiento: un `ice_candidate` solo llega a su par destino, no a otras conexiones     | C1       | ✅ PASS — `io.to(uidToSocketId.get(targetUid))`; room isolation reforzado en #16                           | Revisión de código      |

## Cómo ejecutar las pruebas

1. Levanta el backend (`npm run dev`) y el frontend en local.
2. Abre **dos navegadores/perfiles independientes**, inicia sesión con dos usuarios distintos y
   entra ambos a la **misma sala**.
3. Activa cámara/micrófono y observa la **consola del servidor**: deben aparecer en orden
   `webrtc_offer relayed …`, `webrtc_answer relayed …` y la ráfaga de candidatos.
4. Abre **DevTools → Console** en ambos clientes: no deben aparecer excepciones de SDP, de
   inicialización de `RTCPeerConnection` ni de parseo de candidatos ICE.

## Evidencia requerida por la rúbrica (C1)

1. **Captura** de los logs del servidor con la secuencia `offer` / `answer` / `ice-candidate` entre
   sockets de la misma sala, sin errores críticos.
2. **Captura** de la consola del navegador (DevTools) con la señalización limpia.

## Conclusión

TS-03 está implementada y los criterios de QA-14 **PASAN**: la negociación local entre dos clientes
fluye de extremo a extremo, el servidor enruta `webrtc_offer` / `webrtc_answer` /
`webrtc_ice_candidate` al par correcto sin alterar el payload y sin caídas, los logs del backend son
claros y trazables, y las consolas de los clientes quedan libres de errores de negociación (C1). Sin
hallazgos abiertos; la validación de payload y el room isolation añadidos en la PR #16 refuerzan la
robustez.
