# QA-23 — Pruebas de integración manual E2E en producción

- **Tarea:**
  [QA-23 #94](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/94)
- **Historia técnica:**
  [TS-05 #90 — Integración final, despliegues en producción y cierre de producto](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/90)
- **Tipo:** Integración funcional **manual** de extremo a extremo (E2E). Se descarta la
  automatización (Cypress/Playwright) por decisión de la tarea.
- **Entorno:** **producción**.
  - Frontend (Vercel): https://proyecto-integrador-frontend-psi.vercel.app
  - Backend / Signaling (Render): https://proyecto-integrador-backend-k2tf.onrender.com
- **Objetivo:** certificar que la solución completa es operable y **libre de fallas críticas
  impeditivas** bajo uso real, recorriendo el flujo completo del estudiante con **dos usuarios
  remotos en redes distintas** (C1 y **Gating G7**).

## Nota de tolerancia (según la tarea)

Se asume como **comportamiento aceptable y no penalizable** cualquier _lag_, lentitud o interacción
imperfecta que derive de la saturación de CPU al procesar transmisiones WebRTC en simultáneo con
lectores de pantalla sobre infraestructura de **capa gratuita** (Render/Vercel). Lo que se certifica
es la **ausencia de fallas críticas**: caídas del sistema, pantallas en blanco, desconexiones de la
llamada o excepciones no controladas.

## Precondiciones

- Dos personas (o dos cuentas) en **equipos y redes diferentes**, cada una con cámara y micrófono.
- Navegador moderno (Chrome/Edge recomendados) con permisos de cámara/micrófono.
- Grabación de pantalla **con audio** lista para capturar la sesión (evidencia obligatoria).
- Consola del navegador (DevTools) abierta en al menos un equipo para vigilar excepciones.

## Casos de prueba

Marca el resultado durante la ejecución en producción.

| ID    | Caso                                                                                                                     | Criterio | Resultado (Sí/No) | Observaciones |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------- | ------------- |
| TC-01 | Registro/Login de **dos usuarios remotos** en producción                                                                 | C1       |                   |               |
| TC-02 | El usuario A **crea una sala de estudio privada** y comparte enlace/código                                               | C1       |                   |               |
| TC-03 | El usuario B **se une** a la sala desde otra cuenta/red                                                                  | C1 / G7  |                   |               |
| TC-04 | **Chat en tiempo real** bidireccional; el historial (Firestore) se carga íntegro y oportuno                              | C1       |                   |               |
| TC-05 | **Activación mutua de audio y video** (WebRTC P2P) entre redes distintas                                                 | C1 / G7  |                   |               |
| TC-06 | El expositor **comparte pantalla** y el otro la ve; retorno automático a la cámara al detener                            | C1 / G7  |                   |               |
| TC-07 | **Robustez multimedia:** alternar repetidamente mute / cámara / compartir pantalla no cae WebRTC ni desconecta Socket.io | C1       |                   |               |
| TC-08 | **Integridad de Firestore** (perfiles y mensajes) sin excepciones no controladas en consola                              | C1       |                   |               |
| TC-09 | **Estabilidad general:** sesión completa sin caídas del sistema ni bloqueos de red                                       | G7       |                   |               |

## Cómo ejecutar las pruebas

1. Coordina a **dos participantes en equipos/redes distintas** y **empieza a grabar** la pantalla
   (con audio) de al menos el expositor; idealmente ambas pantallas.
2. **TC-01 — Acceso:** cada usuario abre la URL de producción y hace **login o registro**. Verifica
   que cada uno solo ve sus propios datos.
3. **TC-02/03 — Sala:** el usuario A **crea una sala privada**, copia el enlace/código y el usuario
   B **se une**. Confirma que ambos aparecen en la sala.
4. **TC-04 — Chat:** intercambien varios mensajes en ambos sentidos. Recarga/re-ingresa para
   comprobar que el **historial persiste** (Firestore).
5. **TC-05 — Audio/Video:** ambos **activan cámara y micrófono**; confirmen que se ven y escuchan
   (video P2P por WebRTC entre redes distintas).
6. **TC-06 — Compartir pantalla:** el expositor **comparte pantalla**, el otro la ve; al
   **detener**, la cámara se restablece sola.
7. **TC-07 — Robustez:** durante la llamada, **alterna repetidamente** mute/unmute, cámara on/off y
   compartir/detener pantalla. La llamada **no debe caerse** ni desconectarse el socket.
8. **TC-08 — Firestore:** revisa la **consola del navegador**: no debe haber excepciones no
   controladas al cargar perfiles ni mensajes.
9. **TC-09 — Cierre:** completa la sesión sin recargar por fallo; **detén la grabación** y guarda el
   video.

## Evidencia requerida (rúbrica — C1 / Gating G7)

1. **Video definitivo** de la sesión interactiva E2E de usuarios reales en **producción**, mostrando
   el flujo completo (Login → Crear Sala → Chat → Video → Compartir pantalla) sin caídas ni
   bloqueos.
2. (Opcional) Captura de la consola del navegador sin excepciones no controladas.

> **Enlace al video E2E (producción):** [Video E2E en producción (Drive)](https://drive.google.com/drive/folders/12BlkFwimjQRMCgRs77d4V3jOwjCf7MDw?usp=sharing)
>
> **Grabaciones del User Testing (5 sesiones):** [Carpeta de grabaciones (Drive)](https://drive.google.com/drive/folders/12OXYh3g86ZxFYYOW44mRGsMopGkw7SHX?usp=drive_link)

## Conclusión

Al completar los casos TC-01 a TC-09 **sin fallas críticas impeditivas** —tolerando el _lag_ propio
de la capa gratuita— se certifica el **Gating G7**: la solución completa es operable y estable en
producción con usuarios remotos reales. El video de la sesión es la evidencia definitiva del cierre.
