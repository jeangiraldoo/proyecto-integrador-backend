# QA-15 — Auditoría de logs de red y despliegue del Signaling Server en producción

- **Tarea:**
  [QA-15 #66](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/66)
- **US/TS:**
  [TS-03 — Implementación de Lógica WebRTC (Signaling Server) #63](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/63)
- **Backend:** servidor Socket.io desplegado en Render; CORS restringido al dominio de Vercel; relay
  `webrtc_*` (`src/socket/index.ts`).
- **Entornos:** Backend en Render (`https://proyecto-integrador-backend-k2tf.onrender.com`),
  Frontend en Vercel (`https://proyecto-integrador-frontend-psi.vercel.app`).

## Comportamiento auditado

El servidor de señalización está desplegado de forma pública y estable en **Render** sobre
**HTTPS/WSS** (certificado SSL gestionado por la plataforma), por lo que no hay _mixed content_ al
conectar desde el frontend servido por Vercel (HTTPS). La política **CORS** de Socket.io se
restringe a los orígenes permitidos (dominio de Vercel + localhost de desarrollo). Se auditó una
sesión real con varios clientes remotos conectados por internet a la misma sala: el servidor recibe
los handshakes autenticados, registra las uniones a la sala y retransmite `webrtc_offer` /
`webrtc_answer` / `webrtc_ice_candidate` entre los pares correctos, habilitando la conexión P2P
directa de audio/video (Gating G4).

## Casos de prueba — resultado de auditoría

| ID    | Caso                                                                                    | Criterio | Resultado                                                                                           | Evidencia             |
| ----- | --------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- | --------------------- |
| TC-01 | Servidor de señalización público y estable en producción (Render) sobre WSS/HTTPS       | G4       | ✅ PASS — endpoint accesible por `wss://…onrender.com` con SSL vigente                              | URL/health de Render  |
| TC-02 | CORS restringido al dominio del frontend (Vercel); sin bloqueos de origen               | C1       | ✅ PASS — handshake aceptado desde el dominio de Vercel; orígenes no permitidos rechazados          | Config CORS + logs    |
| TC-03 | Dos+ clientes remotos en redes distintas intercambian offer/answer/ICE de forma directa | G4       | ✅ PASS — los logs de producción muestran el relay entre los pares y la conexión P2P se establece   | `ts03-logs-mesh`      |
| TC-04 | Panel de red del navegador sin errores de WebSocket, CORS ni _mixed content_            | C1       | ✅ PASS — la conexión WSS se establece y se mantiene; sin errores de conexión en consola/red        | DevTools (Network/WS) |
| TC-05 | Estabilidad de la sesión sostenida en producción                                        | G4       | ⚠️ PASS con nota — estable; en sesiones largas puede haber corte por la **capa gratuita de Render** | Observación de sesión |

## Cómo ejecutar las pruebas

1. Abre el frontend en producción (Vercel) desde **dos equipos/redes distintas**.
2. Inicia sesión con usuarios diferentes y entra a la **misma sala**.
3. En DevTools → **Network → WS**, verifica que la conexión `wss://…onrender.com` esté
   `101 Switching Protocols` y se mantenga abierta, sin errores de CORS ni _mixed content_.
4. Revisa los **logs de Render** del servicio: deben mostrar las uniones a la sala y el relay
   `webrtc_offer` / `webrtc_answer` / `ice-candidate` entre los pares.

## Evidencia requerida por la rúbrica (C1 + Gating G4)

1. **Captura/descarga** de los logs de producción (Render) con el flujo de señalización entre
   clientes remotos.
2. **Captura** del panel de red (WS) del navegador con la conexión WSS limpia, sin errores de CORS
   ni _mixed content_.

## Conclusión

El despliegue del Signaling Server en producción **PASA** los criterios de QA-15: servicio público y
estable sobre WSS/HTTPS, CORS correctamente restringido, e intercambio de señalización exitoso entre
clientes remotos en redes distintas (Gating G4), con paneles de red limpios (C1). Único punto a
considerar: la **capa gratuita de Render** puede hibernar/cortar sesiones muy largas (limitación de
infraestructura, no del código); no constituye un fallo de señalización.
