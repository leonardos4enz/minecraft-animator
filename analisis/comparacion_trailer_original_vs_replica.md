# Comparación con datos: tráiler original (Benly para Bobicraft) vs réplica con LTezla

- Réplica: `Videos/LTezla_trailer_replica_Benly_Bobicraft.mp4` (1280×720, 24 fps, 980 cuadros, 40.85 s,
  igual que el original descargable).
- Lado a lado: `Videos/comparativa_original_vs_trailer_LTezla.mp4`. Arriba el original, abajo la réplica,
  reloj al centro, audio original en el oído **izquierdo** y el de la réplica en el **derecho**.
- Datos por toma: `analisis/comparacion_trailer_final/` (`analisis/analisis_tomas.py`, herramienta nueva
  para videos con cortes). Datos globales: `analisis/comparacion_trailer_final_global/` (`comparar.py`).
- Análisis del original: `analisis/analisis_trailer_emociones.md`.

## Resultado final

| Perspectiva | Métrica | Original | Réplica |
|---|---|---|---|
| Ritmo | Cortes a ≤ 2 cuadros del corte del original | — | **22 de 25** (los otros 3 son los fundidos de la tarjeta final, que el detector ubica distinto) |
| Ritmo | Duración / cuadros | 40.85 s / 980 | 40.85 s / 980 |
| Cámara | Velocidad media (% del ancho/s) | 7.3 | 5.8 |
| Cámara | Correlación por toma | — | **0.74** |
| Movimiento | Energía media en cuadro (por toma) | 6.6 | 3.9 |
| Movimiento | Correlación de la curva de movimiento (`comparar.py`) | — | **0.73** |
| Movimiento | Tiempo "quieto" | 24 % | 26 % |
| Imagen | Luminancia | 100.8 | **100.6** |
| Imagen | Saturación | 0.58 | **0.56** (correlación por toma 0.95) |
| Imagen | Temperatura R/B | 1.31 | 1.49 por toma / 1.38 global |
| Imagen | Contraste | 50.8 | 46.5 |
| Imagen | Nitidez | 146 | **147** |
| Audio | Tempo | 127.7 BPM | **127.7 BPM** |
| Audio | Primer golpe de bajo | 2.41 s | 2.41 s (la pista se recortó para que caiga ahí) |
| Audio | Volumen medio (RMS) | 0.253 | **0.264** |
| Audio | Cortes sobre un golpe (< 0.1 s) | 10 | 12 |
| Audio | "Music" (AST) en ventanas de 0.5 s | 82 / 82 | **82 / 82** |
| Audio | CLAP "music" medio | 0.90 | 0.95 |
| Audio | Diálogo | ninguno | ninguno (Whisper alucina «¡Suscríbete!» sobre la música en los dos) |

## Rondas: qué mostraron los datos y qué se cambió

1. **v1** (primer render): LTezla en todas las tomas con mobs de cubos inventados. Tú notaste — y tenías
   razón — que los animales no eran fieles ni en textura ni en tamaño, que faltaban los aldeanos, que el lobo
   de la luna no estaba y que el terreno no parecía generación natural.
2. **Mobs reales**: modelos de Java Edition con el mapeo de UV de Minecraft y las texturas de tu `.jar`
   (aldeano y granjero con sombrero de paja, aldeanito, pollito bebé del modelo nuevo de 4 px, oveja, cordero,
   cabra, cabrito, lobo con armadura de escamas de armadillo teñida, calamar brillante, strider, llama).
   El pollito pasó de 0.55 a 0.47 bloques (relación con el aldeano medida en el original: ~0.14–0.18).
3. **Réplica fiel del reparto**: los mobs y aldeanos donde están en el original; LTezla solo donde hay
   jugadores (monta la cabra, cruza corriendo con los pollitos, el primer plano que voltea, el grupo del
   atardecer).
4. **Terreno**: mundos de 128×128 por escenario (ya no se ve el borde), relieve con ruido fractal, robles y
   abedules, abetos con capa de nieve delgada (antes eran cubos de nieve flotando), cerezos grandes, hongos
   carmesí, pasto y flores en cruz con texturas reales, algas y pasto marino.
5. **Look**: bloom (luna, sol, calamares), contraste y balance de blancos más frío; luna de tu Minecraft
   con mezcla aditiva (antes salía un cuadro oscuro); la oclusión ambiental ya no oscurece el cielo.
6. **v2 → v3 (datos)**: la cámara se movía la mitad (4.0 vs 7.3 %/s, correlación 0.13) → paneos laterales en
   la estampida y el atardecer, travelling de la cabra con retraso; correlación subió a 0.74. Imagen muy
   cálida (R/B 1.66) → balance frío y Nether más morado (1.49). Contraste y nitidez subidos (nitidez igual al
   original). Fundido inicial de 0.3 → 0.6 s (el original arranca más oscuro).
7. **Audio**: los impactos estaban a 0.32 de volumen y AST casi no los oía → 0.75 y colocados también donde
   AST oyó "Bang" en el original (2.0, 4.5, 6.2, 8.0, 12.2, 14.5, 15.5, 21, 23, 24.5, 29.5 s).
8. **Grano**: `comparar.py` marca 2.13 vs 1.11. Bajar el grano del render de 0.06 a 0.02 no movió el número:
   esa métrica mide detalle fino en la franja de arriba (nubes cuadradas y bloques), no ruido de película.

## Lo que todavía no coincide (dicho con honestidad)

- **Hay menos movimiento dentro del cuadro (3.9 vs 6.6).** Sobre todo en la cabra corriendo (el original
  barre el fondo a 80 % del ancho/s con la cabra enorme en cuadro), la estampida y el atardecer: en el original
  hay más animales, más grandes y más cerca de la lente.
- **Las tomas 13 y 14 (cerezos) usan otros mobs.** En el original aparecen unos mobs morados y verdes con
  arnés rojo que no identifiqué con certeza; puse ovejas, corderos y pollitos.
- **Strider y llama** son aproximaciones de su modelo (los pelos del strider y el baúl de la llama no están).
- **El jugador‑gato del primer plano** es LTezla (era la idea), así que la cara, los ojos (rojos con pupila
  cuadrada, estilo masculino) y la paleta de esa toma son distintos.
- **Cielo rosa del primer plano**: el original es un cielo rosa liso con arbustos lima; en la réplica se ven
  cerezos rosados detrás (luminancia 116 vs 176).
- **Vista del atardecer**: el original ve montañas moradas inmensas; la réplica ve un bosque de cerezos con
  el sol detrás (el mundo de bloques mide 128×128).
- **Temperatura** sigue un poco más cálida (1.49 vs 1.31 por toma), sobre todo en la aldea y el Nether.
- **Impactos**: AST clasifica mis golpes como "latido"/"efecto" y no como "Bang" (3 vs 16 ventanas): suenan
  más suaves que los del original.
- **Música**: es otra pieza (ElevenLabs, generada con la descripción del original): mismo tempo, misma forma
  y brillo parecido (centroide 2035 vs 1753 Hz), pero no es la misma melodía. La correlación de volumen
  segundo a segundo es baja (0.21) porque las dinámicas internas de cada pista son distintas.
- **Títulos** (rondas 1–6): Jersey 10. Desde la ronda 7 usan la letra exacta del original, "Minecraft Ten" de
  Mojang (de tu Bedrock), como texto 3D extruido (ver abajo). "BOBI VOTE" pasó a "LTEZLA VOTE" y la tarjeta dice "LTEZLA LIVE" sin copiar
  el logo de Minecraft Live.

---

## Rondas 4–6 (esta sesión): Bare Bones + Fresh Animations, escenas cuadro a cuadro

Réplica final = ronda 6 (`Videos/LTezla_trailer_v6.mp4`, copiada a `LTezla_trailer_replica_Benly_Bobicraft.mp4`).
Datos: `analisis/comparacion_trailer_v4`, `_v5`, `_v6` (`analisis_tomas.py`), `_v6_global` (`comparar.py`) y
`comparacion_trailer_v6/escuchar.json` (`escuchar.py`).

| Métrica (por toma) | Original | v3 (antes) | v4 | v5 | **v6 (final)** |
|---|---|---|---|---|---|
| Cortes a ≤ 2 cuadros | — | 22/25 | 22/25 | 22/25 | **22/25** |
| Movimiento en cuadro | 6.58 | 3.92 | 4.99 | 4.96 | **5.05** |
| Cámara (% ancho/s) | 7.33 | 5.77 | 5.63 | 5.48 | 5.34 |
| Luminancia | 100.8 | 100.6 | 110.2 | 105.9 | **105.4** (corr. 0.96) |
| Saturación | 0.577 | 0.560 | 0.518 | 0.545 | **0.571** (corr. 0.96) |
| Temperatura R/B | 1.313 | 1.485 | 1.288 | 1.424 | **1.396** (corr. 0.87; antes 0.78) |
| Contraste | 50.8 | 46.5 | 48.6 | 47.6 | **48.7** |
| Nitidez | 146 | 147 | 142 | 112 | 170 |
| Correlación curva de movimiento (`comparar.py`) | — | 0.73 | — | — | 0.70 |
| Audio: tempo / "Music" AST / correlación de volumen | 127.7 | igual | — | — | igual (no se tocó) |

Qué mostraron los datos y qué se cambió:
- **v4** (primera con Bare Bones, Fresh Animations y escenas nuevas): el movimiento subió de 3.9 a 5.0 y la temperatura
  quedó casi igual (1.29 vs 1.31), pero la imagen salió 9 % más brillante y menos saturada. Por toma: la aldea inicial
  muy clara (133 vs 82), bajo el agua 2.5× más claro (85 vs 33), cenital lavada (202 vs 137, contraste 29 vs 53),
  calle y Nether menos cálidos (1.51 vs 2.20; 0.96 vs 1.33).
- **v5**: etalonaje por toma (`exp`, `sat`, `calidez`) con esos números → luminancia 106, saturación con correlación
  0.97, temperatura con correlación 0.89; pero quedó algo cálida (1.42) y más borrosa (nitidez 112) por el desenfoque.
- **v6**: balance global más frío, +5 % de saturación y menos desenfoque de fondo → saturación 0.571 (casi igual),
  temperatura 1.40, nitidez de vuelta (más alta que el original: 170).
- Visual (manda sobre los números): ver las hojas lado a lado en la carpeta temporal de la sesión; los cambios
  principales por toma están en `TRAILER_estado_y_pendientes.md` §3–§5.

---

## Rondas 7–8 (octubre 2026): correcciones pedidas tras revisar el video

Réplica final = ronda 8 (`Videos/LTezla_trailer_v8.mp4`, copiada a `LTezla_trailer_replica_Benly_Bobicraft.mp4`;
comparativa rehecha en `Videos/comparativa_original_vs_trailer_LTezla.mp4`). Datos: `analisis/comparacion_trailer_v7`,
`_v8` (`analisis_tomas.py`). Detalle de cada arreglo: `TRAILER_estado_y_pendientes.md` §7.

| Métrica (por toma) | Original | v6 | v7 | **v8 (final)** |
|---|---|---|---|---|
| Cortes a ≤ 2 cuadros | — | 22/25 | 21/25 | 21/25 (mismos cortes de edición; cambia solo la detección de la entrada de la tarjeta) |
| Movimiento en cuadro | 6.58 | 5.05 | 5.00 | 5.00 |
| Cámara (% ancho/s) | 7.33 | 5.34 | 5.34 | 5.34 |
| Luminancia | 100.8 | 105.4 | 109.7 | 109.5 |
| Saturación | 0.577 | 0.571 | 0.577 | 0.576 |
| Temperatura R/B | 1.313 | 1.396 | 1.50 | 1.48 |
| Contraste | 50.8 | 48.7 | 51.3 | 51.4 |
| Nitidez | 146 | 170 | 166 | 167 |
| Audio (tempo / cortes sobre golpe) | 127.7 / 10 | igual | 127.7 / 14 | 127.7 / 14 |

Qué mostraron las hojas lado a lado y qué se cambió:
- **v7**: todo lo pedido (aldeano del callejón, cara y sombrero de los aldeanos, títulos 3D con Minecraft Ten, aullido,
  saltos del risco, cabritos que chocan, Nether lleno). En el video el aldeano del callejón ya cruzaba y salía antes del
  corte, pero su cabeza pasaba detrás de "SECRETAS".
- **v8**: cámara de la calle más cerca e inclinada: el aldeano cruza completo, más grande y por debajo del título, como en
  el original.
- Los números casi no se movieron (el cambio es de contenido, no de ritmo ni color); la luminancia y la temperatura subieron
  un poco por la luna enorme del aullido y los títulos planos amarillos/verdes.

### Ronda 9
Arreglos de la tarjeta (letras sólidas en los fundidos), inicio desde negro con el fundido lineal de ~2.1 s del original y
el easter egg de Clawd con los pollitos. Datos en `analisis/comparacion_trailer_v9`. Luminancia de los primeros cuadros
(0 → 1 s, cada 1/24 s): original 0, 2, 4, 7 … 56; réplica v8 108 (destello), 7, 16 … 121; réplica v9 0, 5, 13, 21 … 120 a los 2.1 s (original 0, 7, 14, 22 … 122).

| Métrica (por toma) | Original | v8 | **v9 (final)** |
|---|---|---|---|
| Cortes a ≤ 2 cuadros | — | 21/25 | 21/25 |
| Movimiento en cuadro | 6.58 | 5.00 | 4.98 |
| Luminancia | 100.8 | 109.5 | **106.5** |
| Saturación | 0.577 | 0.576 | 0.569 |
| Temperatura R/B | 1.313 | 1.48 | **1.45** |
| Contraste | 50.8 | 51.4 | **50.1** |
| Nitidez | 146 | 167 | **162** |
