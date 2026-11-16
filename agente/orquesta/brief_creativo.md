# Brief creativo — "La orquesta de bloques: Rush E 3"

## Qué es
Un TikTok vertical (1080×1920, 30 fps) de **169.45 s**: la canción **Rush E 3** (Sheet Music Boss) tocada entera con
**los sonidos reales de los bloques musicales de Minecraft**. Son **34.961 notas** y cada una cae en su cuadro exacto (99 % a menos
de medio cuadro). El canal es de **LTezla** (el personaje de Leo; Minecraft es el estilo).

**Objetivo (palabras de Leo):** que sea IMPRESIONANTE, todo el video. Quien lo vea tiene que pensar "esto a mano
tomaría meses", porque cada nota tiene una causa que se ve, a una escala que una persona no puede animar. No es un video
"humano vs IA": el video se luce solo y al final revela la escala (contadores).

## La música (el audio ya está hecho: `agente/orquesta/rush_e3.wav`)
Tres "instrumentos" del juego por registro: **bajo** (fa#1–fa3), **arpa** (fa#3–fa#5) y **campana** (sol5–fa#7). Cada
nota tiene un `clics` 0–24 (tono dentro del bloque). Eventos con tiempo y cuadro: `agente/orquesta/rush_e3_eventos.json`.

Densidad medida (notas por segundo; bajo / arpa / campana por tramo de 5 s):
| s | notas/s | qué pasa (por los datos) |
|---|---|---|
| 0–1.9 | 0 | silencio antes de la primera nota (1.88 s) |
| 1.9–15 | 11–31 | **entrada de Rush E**: mi5/mi4 alternados, después mi6/mi7 y mi2/mi1 (las octavas se abren) |
| 15–30 | 17–28 | sin campana: bajo + arpa. Hay silencios cortos en 20–21 y 26–27.5 |
| 30–55 | 53–97 | **primer gran tema**: entra la campana fuerte (35–45 s) |
| 55–56 | — | respiro (silencio de 0.5 s en 55.2) |
| 56–125 | 29–51 | largo cuerpo medio, parejo. 75–80 casi sin bajo (campana sola) |
| 116–124 | ~43 | parte más lenta y espaciada (silencios en 116.5–118.7 y 119.3–123.6) |
| 125–131.7 | 84–160 | primera explosión |
| **131.73–136.63** | 0 | **PAUSA DE 4.9 s**: silencio total antes del final |
| 136.6–145 | 192–338 | arranca el clímax |
| 145–165 | **709 → 1.768** | **CLÍMAX "black MIDI"**: miles de notas por segundo, los tres registros al máximo |
| 165–169 | ~14 | últimas notas y cola |

## Qué puede hacer el motor (medido; ver `AGENTE.md` y `js/efectos.js`)
- Mundo de bloques con Bare Bones (texturas simples, hojas de un color). Escenarios: aldea, noche, nieve, agua, cerezos,
  nether, aldea_frente, calle, cresta, pradera, pista, montaña, cordillera. Se pueden poner y quitar bloques por toma
  (miles: el terreno es una malla y no cuesta).
- **Bloque musical** (`musical`) + efecto **`notas`**: en cada golpe el bloque destella y sale la corchea de Minecraft
  del color del tono. Aguanta miles por cuadro.
- **92 mobs** con Fresh Animations (caminar, correr, quieto, caer, flotar, saltitos, pastar, aullar, atacar, embestir…),
  con `ruta`, `rumbo` y acciones con tiempo. **600 mobs en una toma se renderizan bien** (≈ 40 s de render por 1 s de video).
- LTezla (el personaje): poses, expresiones, objetos en la mano.
- Efectos: partículas (gas, chispas, polvo, humo, destellos), flechas, trayectorias, rejillas, barras, **texto 3D Minecraft
  Ten con contadores** (`{v}` que sube), destellos con bloom, cámara lenta, `voxel` (objetos hechos de bloques).
- Cámaras por toma con recorrido (az, el, dist, fov ≤ 42°, pan/tilt), cortes en cualquier cuadro.
- Lo que NO hay: física real de bloques (caída de arena, TNT real), agua animada compleja, miles de mobs individuales
  distintos a la vez (600 sí).

## Reglas de la casa (CLAUDE.md)
- Todo lo que se escribe en pantalla sale de un dato verificado (`facts.json`). Los contadores salen de la partitura
  (exactos). Si se cita "≈ X meses a mano", va con fuente: un animador 3D termina ~3 s de animación por semana.
- Sin voz (la música manda); el texto en pantalla es corto (Minecraft Ten, sin "≈", "→" ni "ª").
- Activar la etiqueta de "contenido generado por IA" al publicar. No monetizado.
- Cortes en beats/notas. Imagen quieta ≤ 1 s cada 30 s. ≤ 3 destellos por segundo en una zona grande (fotosensibilidad):
  ojo en el clímax.
