# QA-25 — Extracción manual de métricas UX desde grabaciones de User Testing

- **Tarea:**
  [QA-25 #116](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/116)
- **Historia técnica:**
  [TS-05 #90 — Integración final, despliegues y cierre de producto](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/90)
- **Tipo:** extracción **manual** de métricas UX (sin automatización E2E: no Cypress/Playwright).
- **Fuente:** 5 grabaciones del User Testing del Sprint 6 (Entrevistas N.º 1 a N.º 5). — [Carpeta de grabaciones (Drive)](https://drive.google.com/drive/folders/12OXYh3g86ZxFYYOW44mRGsMopGkw7SHX?usp=drive_link)

## Objetivo

Consolidar los datos cuantitativos y cualitativos que respaldan el Informe Final de Pruebas (QA-24),
revisando fotograma a fotograma las grabaciones de las sesiones de User Testing y extrayendo
métricas de desempeño en las tareas núcleo directamente del comportamiento de los usuarios reales.

## Método de extracción

1. **Tiempo en tarea:** marcado de inicio/fin de cada tarea núcleo por participante (mm:ss).
2. **Clics:** conteo de interacciones reales vs. la ruta ideal por tarea.
3. **Éxito y ayuda:** registro de completitud (Sí / Parcial / No) y de intervenciones del moderador.
4. **Evidencia cualitativa:** fricciones con su marca de tiempo y la cita del usuario (think-aloud).

## Métricas seleccionadas (NNGroup)

| Categoría    | Métrica                                 | Resultado consolidado                                |
| ------------ | --------------------------------------- | ---------------------------------------------------- |
| Eficiencia   | Tiempo en tarea (total T1–T6)           | ≈ 15:12 min                                          |
| Eficiencia   | Clics reales vs. ideales (total)        | 24.8 vs. 18                                          |
| Efectividad  | Tasa de éxito global (T1–T6)            | ≈ 83 %                                               |
| Efectividad  | Éxito por tarea                         | T1 100 · T2 100 · T3 80 · T4 60 · T5 60 · T6 100 (%) |
| Satisfacción | Facilidad de uso general                | 6.2 / 7.0                                            |
| Satisfacción | Control de audio/video (punto más bajo) | 5.4 / 7.0                                            |
| Satisfacción | Lealtad del usuario (NPS)               | 66 %                                                 |

## Hallazgos cualitativos (Top 5 por severidad)

| ID   | Hallazgo                                                                | Severidad | Recurrencia          |
| ---- | ----------------------------------------------------------------------- | --------- | -------------------- |
| H-01 | El audio no se transmite al hablar; sin feedback ni configuración de AV | Alta      | P1, P2               |
| H-02 | Iconos e indicadores solo-icono ambiguos                                | Alta      | P1, P3, P4, P5 (5/5) |
| H-03 | El campo de los modales pierde el foco al escribir                      | Alta      | P1, P3, P4, P5 (4/5) |
| H-04 | Gestión de sala confusa (salir vs. eliminar) y «Zona de peligro»        | Media     | P2, P5               |
| H-05 | Fricciones de confianza en el acceso (foto, accesos duplicados, datos)  | Media     | P1, P5               |

## Conclusiones

- La **efectividad** es plena en acceso, salas y chat (100 %) y cae en el control AV (T4) y la sala
  en vivo (T5, 60 %), donde se concentran H-01 (audio) y H-02 (iconos).
- La **eficiencia** más baja es T5 (≈ 4:12 y clics por encima de la ruta ideal); el chat (T6) es la
  más eficiente.
- La **satisfacción** global es alta (facilidad 6.2/7, NPS 66 %), con el control de audio/video como
  punto más bajo (5.4/7), coherente con las fricciones observadas.
- Las mejoras de mayor impacto (avisos de estado con `aria-live`, iconografía con etiquetas, foco en
  modales, toast de «código copiado») ya fueron implementadas en el frontend y verificadas en el
  repositorio.

> Entregable detallado (datos crudos por participante y tablas completas): documento Word «Reporte
> QA-25 - Metricas UX desde User Testing.docx». Estas métricas alimentan el Informe Final de Pruebas
> (QA-24).
