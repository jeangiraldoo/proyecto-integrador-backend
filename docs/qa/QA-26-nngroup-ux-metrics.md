# QA-26 — Informe de Métricas UX basado en estándares NNGroup

- **Tarea:**
  [QA-26 #117](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/117)
- **Historia técnica:**
  [TS-05 #90 — Integración final, despliegues y cierre de producto](https://tree.taiga.io/project/santi4914-miniproyecto-2-proyecto-integrador/task/90)
- **Criterio de rúbrica:** C5 (documento formal del Informe Final de Pruebas).
- **Fuente:** 5 grabaciones del User Testing del Sprint 6 + encuesta de cierre (escala 1–7).

## Objetivo

Documento formal de métricas UX bajo los estándares del **Nielsen Norman Group (NN/g)**,
fundamentado estrictamente en datos numéricos extraídos de las grabaciones y encuestas. Evalúa las
tareas núcleo (T1–T6) en tres categorías: **Eficiencia**, **Efectividad** y **Satisfacción**. Sin
texto de relleno sin respaldo estadístico.

## Categorías y métricas (NN/g)

| Categoría    | Métrica                                    | Resultado global                       |
| ------------ | ------------------------------------------ | -------------------------------------- |
| Eficiencia   | Tiempo en tarea (Time on Task)             | ≈ 2:32 min/tarea (flujo T1–T6 ≈ 15:10) |
| Eficiencia   | Interacciones por tarea (Clicks)           | 4.1 clics                              |
| Efectividad  | Tasa de éxito global (Success Rate)        | ≈ 83 % (25/30 ejecuciones)             |
| Satisfacción | Facilidad de uso (Ease-of-use, escala 1–7) | 6.1 / 7.0                              |
| Satisfacción | Recomendación (NPS)                        | 66 %                                   |
| —            | Tasa de retención (Retention Rate)         | No aplica (proyecto académico)         |

## Efectividad por tarea (Success rate)

| Tarea                           | Éxito (n/5) | Ayuda       | Tasa de éxito |
| ------------------------------- | ----------- | ----------- | ------------- |
| T1 · Registro / Login           | 5/5         | No          | 100 %         |
| T2 · Perfil                     | 5/5         | No          | 100 %         |
| T3 · Crear / unir sala          | 4/5         | Sí (P2)     | 80 %          |
| T4 · Presala / control AV       | 3/5         | Sí (P4)     | 60 %          |
| T5 · Sala en vivo (audio/video) | 3/5         | Sí (P1, P2) | 60 %          |
| T6 · Compartir pantalla + chat  | 5/5         | No          | 100 %         |

## Facilidad de uso (Ease-of-use, escala 1–7)

| Criterio                                  | Promedio  |
| ----------------------------------------- | --------- |
| Gestión de identidad y registro           | 5.8 / 7.0 |
| Creación y gestión de salas               | 6.4 / 7.0 |
| Unirse a una sala por código              | 6.2 / 7.0 |
| Panel de control multimedia (audio/video) | 5.4 / 7.0 |
| Chat e historial en tiempo real           | 6.6 / 7.0 |

## Conclusiones

- **Eficiencia:** T5 (sala en vivo) es la tarea más costosa (4:12 min, clics sobre la ruta ideal)
  por el tanteo con el estado del audio y los iconos; T6 (chat) es la más eficiente.
- **Efectividad:** 83 % global sin caídas críticas; la efectividad cae en T4/T5 (60 %) por H-01
  (audio) y H-02 (iconos), corregidos e implementados en el frontend.
- **Satisfacción:** 6.1/7 de facilidad de uso (NPS 66 %); el punto más bajo es el control multimedia
  (5.4/7), coherente con los hallazgos objetivos.
- **Limitaciones:** muestra n = 5, red controlada y sin datos de uso prolongado; la retención se
  reporta como «No aplica».

> Entregable formal completo (con matriz de tareas, cuadros por participante y análisis): documento
> Word «Informe de Metricas UX (NNGroup) - Agora.docx». Complementa el Informe Final de Pruebas
> (QA-24) y la extracción de métricas (QA-25).
