# QA-16 — Grid de videos dinámico, responsivo y disposición espacial

- **Tarea:**
  [QA-16 #70](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/70)
- **US:**
  [US-09 — Visualizar Entorno de Sala (Grid dinámico) #67](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/us/67)
- **Frontend:** componente de Grid de videos (React + Tailwind), render condicional por estado de
  cámara, aislamiento de estado Chat ↔ Video (Zustand).
- **PR frontend:**
  [#21 grid de videos responsivo (FE-13)](https://github.com/ManuelR12/proyecto-integrador-frontend/pull/21)
  ·
  [#22 aislamiento Chat ↔ Video (Zustand)](https://github.com/ManuelR12/proyecto-integrador-frontend/pull/22)
  ·
  [#26 viewport-safe grid (FE-13.2)](https://github.com/ManuelR12/proyecto-integrador-frontend/pull/26)
- **Soporte backend:**
  [#16 presencia de participantes + avatar](https://github.com/jeangiraldoo/proyecto-integrador-backend/pull/16)

## Comportamiento auditado

El Grid calcula filas/columnas de forma dinámica según el número de participantes presentes en la
sala (alimentados por los eventos de presencia del servidor: `room_joined` con el roster,
`participant_joined`, `participant_left`). Al unirse o salir un participante, la cuadrícula se
reorganiza de forma reactiva sin recargar la página. Cada tarjeta muestra el nombre del usuario y,
cuando la cámara está apagada o sin permiso, su **avatar/iniciales** (fallback) en lugar de pantalla
en negro. El estado del Chat está **aislado** del estado de video (store de Zustand), de modo que la
llegada de mensajes no re-renderiza ni reinicia las etiquetas `<video>` del grid (sin parpadeos).

## Casos de prueba — resultado de auditoría

| ID    | Caso                                                                                    | Criterio | Resultado                                                                                         | Evidencia          |
| ----- | --------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- | ------------------ |
| TC-01 | El grid se reestructura de forma reactiva al unirse/salir flujos remotos (1 → N)        | C3       | ✅ PASS — capturas con 1, 4 y 5 participantes; reorganización automática sin recargar             | `us09-grid-1/2/3`  |
| TC-02 | Cada recuadro muestra nombre legible y estado de cámara (video / avatar fallback)       | C3       | ✅ PASS — tarjetas con nombre; cámara apagada → avatar/iniciales                                  | `us09-grid-2/3`    |
| TC-03 | Soporte de ≥4 participantes concurrentes sin romper el layout (ajuste del docente)      | C3       | ✅ PASS — cuadrícula 2×2 (4) y multi-columna (5) sin desbordamiento                               | `us09-grid-2/3`    |
| TC-04 | Responsividad en móvil / tablet / escritorio sin desbordamientos ni superposición       | C5       | ✅ PASS — layout viewport-safe (FE-13.2); el grid se adapta a distintos anchos                    | Captura responsive |
| TC-05 | Aislamiento Chat ↔ Video: enviar/recibir mensajes no reinicia ni parpadea el `<video>` | C3       | ✅ PASS — estado separado con Zustand (FE-13.1); el chat opera en paralelo sin re-render del grid | Recorrido manual   |
| TC-06 | Disposición espacial coherente (heurísticas de Nielsen) y nombres siempre legibles      | C5       | ✅ PASS — jerarquía clara, recuadros uniformes, etiquetas legibles                                | Bitácora UX        |

## Cómo ejecutar las pruebas

1. Entra a una sala desde **1, luego 2, 4 y 5 navegadores/usuarios** y observa cómo el grid pasa de
   tarjeta única → 2×2 → multi-columna **sin recargar**.
2. Apaga la cámara en un cliente: su tarjeta debe mostrar el **avatar** (no pantalla en negro).
3. Redimensiona la ventana / usa DevTools (móvil/tablet/escritorio): el grid debe adaptarse **sin
   desbordamientos ni cámaras superpuestas**.
4. Mientras hay video activo, **envía mensajes en el chat**: los `<video>` no deben parpadear ni
   reiniciarse.

## Evidencia requerida por la rúbrica (C3 + C5)

1. **Capturas** del Grid adaptándose según el número de participantes (1, 2 y más).
2. Enlace a la **Bitácora UX/HCI** con la evaluación de la disposición espacial del salón.

## Conclusión

US-09 cumple los criterios de QA-16 **PASS**: el grid se reorganiza de forma reactiva al variar los
participantes (C3), soporta ≥4 concurrentes sin romper el layout, muestra nombre + estado de cámara
por tarjeta (avatar fallback), es responsivo sin desbordamientos (C5) y mantiene el `<video>`
estable gracias al aislamiento de estado Chat ↔ Video. Sin hallazgos abiertos.
