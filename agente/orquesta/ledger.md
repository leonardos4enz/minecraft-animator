# Ledger — La orquesta de bloques (TikTok vertical 1080×1920, 60–75 s)

Idea: `agente/humano-vs-ia/idea.md`.

## Paso 1 — Prueba de carga del motor (18 oct 2026)
Proyecto `agente-orquesta-carga` (pradera, vacas caminando, `exportar` de 1 s a 30 fps, `calidad: "alta"`). Los videos
y el cuadro quedaron en `agente/humano-vs-ia/prueba_carga/`.

| Escena | Formato | Segundos de render por 1 s de video |
|---|---|---|
| vacía | 1080×1080 | 4 |
| 50 mobs | 1080×1080 | 4 |
| 150 mobs | 1080×1080 | 14 |
| 300 mobs | 1080×1080 | 29 |
| 600 mobs | 1080×1080 | 58 |
| 100 mobs | **1080×1920** | 15 |
| 300 mobs | **1080×1920** | 26 |
| 600 mobs | **1080×1920** | 42 |
| 600 mobs + 2.000 bloques | **1080×1920** | 39 (los bloques no cuestan: el terreno es una sola malla) |

El render sale a 1620×2880 (supermuestreo 1.5×), con 30/30 cuadros.

**Conclusión:** el coro con 600 mobs es viable. 12 s del coro ≈ 8 min de render, y el video entero ≈ 20–30 min.
No hace falta simplificar los mobs lejanos.

Lo que aprendí:
- `agregarMob` deja `fijo: true` aunque `n` > 1: los 300 salían en el mismo punto. Hay que mandar
  `"fijo": null` para que se repartan en `ancho`/`prof`.
- **No existe el bloque musical en el mundo** (hay 82 bloques; `note_block.png` sí está en `texturas_mc/biblioteca/block/`).
  Hay que agregarlo a `js/mundo.js` (id 83), con un efecto para que se encienda en cada nota.
- `abrir` vuelve a la instantánea de `agente/proyectos/<nombre>.json` y borra lo que se hizo después. Después de
  `bloques` sólo se usa `recargar`.
- Con 600 mobs y 2.000 ediciones, la página dejó de responder después de `recargar` + `abrir`; `--reiniciar` la arregló.
- Incidente: la vista previa `animator` que abrí en el panel del navegador es la página **del humano**, y tomó el
  primer comando (`nuevoProyecto`) porque la del agente todavía no estaba abierta. Se cerró enseguida. De eso quedó un proyecto
  vacío `mi-animacion-3` (0 tomas, se creó al abrir el hub) que no pude mandar a la papelera: el permiso fue denegado.
  **Regla:** para el agente, primero `agente.py --sin-ventana`, y nunca `preview_start` mientras se trabaja.

## Paso 2 — Motor de la partitura (`partitura.py`)
- Los sonidos son los `.ogg` reales de los bloques musicales (`texturas_mc/sonidos/note/`). La nota base de cada uno se midió
  con librosa.pyin: arpa, banjo, bit, pling y vibráfono en fa#4; bajo y didgeridoo en fa#2; guitarra en fa#3; flauta y
  cencerro en fa#5; campana y xilófono en fa#6. Es lo mismo que dice minecraft.wiki. El carillón dio si4 por un armónico;
  se usa fa#6, como en el juego.
- La afinación es la del juego: cambia la velocidad, con 25 clics (pitch 0.5–2.0). Una nota fuera de rango da error.
- Con bpm 112.5 a 30 fps, la semicorchea dura 4 cuadros: **cada nota cae en un cuadro exacto**. Si no, da error.
- Prueba con el Himno de la alegría (dominio público, **no es la canción final**), `prueba_himno.json`:
  - 17.07 s y 142 eventos (melodía 30, bajo 16, bombo 16, caja 16, platillo 64);
  - ataques: **142/142 a menos de medio cuadro**, con error mediano de 1.3 ms y máximo de 4.0 ms (librosa, pista por pista);
  - afinación: **46/46 notas en su semitono** (pyin);
  - el WAV sale con pico −1.0 dBFS y −19.7 LUFS. La sonoridad final la pone `mezcla.py`.
- Primer intento: 4 notas "fallaban". Eran las del instante 0, porque el detector necesita silencio antes. La comprobación ahora
  agrega 0.5 s de silencio y lo descuenta.

## Paso 3 — Canción: Rush E, y lector de MIDI (`midi.py`)
- Leo eligió **Rush E** (Sheet Music Boss, 2021). Tiene derechos; Leo dice que la cuenta no está monetizada ni lo
  estará. Queda un riesgo: TikTok puede silenciar o bajar el video.
- `midi.py` lee el MIDI sin dependencias y aplica el mapa de tempo (Rush E acelera muchísimo). Cuantiza cada ataque al
  cuadro más cercano y reparte las notas por registro: bajo fa#1–fa#3 (gólem), arpa fa#3–fa#5 (bloques),
  flauta sol5–fa#6 (aldeanos), campana sol6–fa#7 (allays). Lo que se sale de todos baja o sube de octava. La fuerza
  de cada nota (velocity) pasa al volumen.
- Prueba con un MIDI sintético que imita Rush E: mi5 en semicorcheas acelerando de 120 a 360 bpm, acordes de
  bajo y do8 fuera de rango (`prueba_acelerando.json`). Resultado: 256 notas, 8.90 s; las 32 notas fuera de rango
  cambiaron de octava.
- **La comprobación con `onset_detect` falló en lo rápido**: 25 de 128 notas del arpa (la misma nota cada 1–2 cuadros:
  el detector junta los golpes). Se cambió por máximos locales del flujo espectral alrededor de cada nota.
  → acelerando: **254/256 a menos de medio cuadro** y las 256 a ≤ 17.3 ms (0.52 cuadros), con mediana de 5.3 ms;
  himno: 142/142, con máximo de 10.7 ms.

## Paso 4 — El MIDI real: Rush E 3 (oficial, comprado por Leo en Gumroad)
- Archivo: `C:\Users\Leo\Downloads\Rush E 3.mid` (1.7 MB), copiado a `agente/orquesta/rush_e3.mid`. **Es Rush E 3**, no el
  Rush E original. Los términos del vendedor permiten un remix original "con aporte creativo significativo"; prohíben
  subir tal cual el MIDI o una visualización tipo Synthesia. El arreglo para bloques y la coreografía son el aporte.
- Tiene 38 pistas, 118 cambios de tempo, **267.580 notas** (do-1 a sol9) y dura 165.1 s. La densidad, en notas por segundo
  y por tramos de 5 s, va de 11 a 100 durante 2 min y en el final sube: 237 → 1.036 → 10.821 → **36.999**.
- Estructura medida por los silencios: entrada 0–12.08 s · parte lenta 116.45–124 s · **pausa de 4.9 s**
  (131.73–136.63) · clímax hasta el final.
- **Corte del TikTok** (`rush_e3_tiktok.json`, `--tramos 0-12.08,116.45-132.73,136.63-170`): entrada + parte lenta +
  pausa acortada a 1 s + clímax completo → **61.15 s y 30.850 eventos**. Son 262.807 notas del MIDI, juntando la
  misma nota en el mismo cuadro. Por instrumento: bajo 9.789, arpa 10.136, flauta 5.322 y campana 5.603. 108.533 notas
  cambiaron de octava para entrar en el rango del juego.
- Comprobación: **99.2 % a menos de medio cuadro**, con mediana de 8.0 ms y máximo de 22.7 ms (0.68 cuadros).
- Para escuchar: `rush_e3_tiktok_escuchar.mp3`, con loudnorm de una pasada, −13.7 LUFS y pico −1.6 dBFS. La mezcla final
  la hace `mezcla.py`.
- Versión completa: `rush_e3.json/.wav` (169.45 s, 35.474 eventos, 98.9 % a menos de medio cuadro).

## Paso 5 — Leo: "no suena como Rush E". Diagnóstico y arreglos
| # | Causa (medida) | Antes (v1) | Arreglo → ahora |
|---|---|---|---|
| 1 | **El corte sacaba el tema principal** | 0–12.08 s + parte lenta + clímax | queda la versión completa (169 s) para que Leo elija los minutos de oído |
| 2 | El MIDI es para visualización (pistas con nombre de color; 30 de 37 usan las 128 teclas). **76.620 notas (29 %) fuera del piano** (la0–do8), todas del clímax: son dibujos que no suenan | cambiadas de octava y metidas en el rango → ruido | se quitan (`PIANO` en `midi.py`); sólo se cambian de octava las 32.482 que son del piano y salen del juego |
| 3 | La flauta (sol5–fa#6) es un sonido sostenido y no suena a piano | bajo / arpa / flauta / campana | bajo fa#1–fa3 · arpa fa#3–fa#5 · campana sol5–fa#7 |

- La entrada sí es la de Rush E (mi5/mi4 alternados desde 1.88 s, después mi6/mi7 y mi2/mi1).
- Nueva versión completa: 169.45 s, 34.961 eventos (bajo 10.142, arpa 12.327, campana 12.492), **98.9 % a menos de
  medio cuadro** y máximo de 21.3 ms.
- **Referencia de piano** (`referencia_piano.py` → `rush_e3_piano_escuchar.mp3`): el mismo MIDI con un piano
  sintético, sólo la0–do8 (39.716 notas). Si la referencia suena a Rush E 3 y los bloques no, el problema es el sonido
  de los bloques. Si la referencia tampoco suena, el problema es el MIDI.
- El corte v1 quedó como `v1_rush_e3_tiktok*` (con "MAL" en el mp3).

## Paso 6 — Decisión y bloque musical en el motor
- A Leo le gustó la versión en bloques. **Va la canción completa (169.45 s, 34.961 notas)**, porque el objetivo es
  impresionar.
- `js/mundo.js`: bloque `musical` (id 83, textura `note_block` de Bare Bones o del .jar; si no hay, una pintada).
- `js/efectos.js`: efecto `notas` (documentado en AGENTE.md). En cada golpe, el bloque destella y sale la corchea de
  Minecraft con el color de su tono (fórmula de NoteParticle). Usa búsqueda binaria e instancias: hasta 12.000 partículas
  y 8.000 destellos por cuadro.
- Prueba (`orquesta-prueba-notas`): 25 bloques en fila (uno por clic) con 122 golpes de la entrada, de 1.5 a 7.5 s.
  El destello cae exacto sobre el bloque (ya está claro cómo van las coordenadas).
  - El primer destello era una caja rosa sólida. Se bajó a 0.42 × k² con 35 % de blanco y ahora se lee como un golpe de luz.
  - En la entrada se enciende un solo bloque: mi2, mi4 y mi6 son el mismo clic (10). **Cada instrumento necesita su
    propia fila o zona.**

## Paso 7 — Concepto (3 subagentes nuevos) y el rollo v0
- Director creativo, espectáculo y TikTok → `concepto.md` (con quién propuso qué y cómo se resolvieron los choques).
  Leo lo aprobó.
- Conteo exacto para los textos: 6.475 notas antes de la pausa, 21 dentro de ella, 28.465 después y 25.736 entre 145 y 165 s.
- Motor:
  - `notas` con `construye` (el bloque queda puesto desde su cuadro), `archivo` (golpes en un json) y `desfase`;
  - escenario `llano`.
- **Error que costó una vuelta:** el efecto usa el tiempo de la toma y los golpes, el de la canción. De la toma 2 en
  adelante no se veía nada. Se arregló con `desfase` = inicio de la toma.
- `rollo.py`:
  - 34.961 golpes, z = 4 bloques/s hasta 136.63 y 1 bloque/s después; 579 bloques de largo; torres de hasta 30;
  - 13 tomas de previsualización que siguen al frente (el ancla se mueve para que el frente quede en el centro del mundo de 128×128);
  - proyecto `agente-orquesta` (19 KB; los golpes van en `rollo.json`, de 0.9 MB).
- Render: 20 s de la entrada en 92 s; el clímax, con 35.000 bloques, 2 s en 8 s.
- Clip con sonido: `salida/entrada_v0_con_sonido.mp4` (0–20 s, audio de `rush_e3.wav`).
- **Lo que se ve mal en v0** (hojas de 25–168 s):
  - el clímax es una pared oscura que no brilla;
  - el suelo verde brillante choca con la noche (toma 10–11);
  - las cámaras quedan lejos y sin intención;
  - el borde del mundo se ve arriba (70 s);
  - todavía no están LTezla, los mobs, el contador ni los capítulos del concepto.

## Pendiente
- `coreografo.py`: `eventos.json` → zonas por instrumento (filas de bloques, mobs por pista), golpes de `notas` y
  cortes de cámara en los cambios de sección. En el clímax (miles de notas por segundo) los mobs reaccionan por acorde,
  no por nota.
- Storyboard por secciones de la canción (entrada · tema · parte lenta · pausa · clímax) y contadores al final.
- Bloque musical en `js/mundo.js` y el efecto de encenderse.
- `coreografo.py`: `eventos.json` → acciones de los mobs y cortes. Con 30.850 eventos, en el clímax no todos pueden ser
  un mob distinto: hay que agrupar (p. ej. una ola de bloques que se encienden por acorde).
- Bloque musical en `js/mundo.js` + el efecto de encenderse.
- `coreografo.py`: `eventos.json` → acciones de los mobs y cortes en el cuadro exacto.

## Paso 8 — Leo: "veo mucho verde, se ve algo aburrido"
- `llano`: el campo del rollo (|x| ≤ 43) pasa a piedra oscura (`oscuro`), con vetas raras de adoquín (v > 0.8) y grava
  (v < 0.17). El pasto queda sólo en las lomas de los lados.
- Primera versión con vetas en v > 0.68 / < 0.3: manchas claras grandes que distraían. Con 0.8 / 0.17 quedan sólo detalles.
- Hoja: `salida/hoja_v0b_piso_oscuro.jpg`. Ahora la luz sale de los bloques y las corcheas resaltan.

## Paso 9 — Leo: "parece vacío, estaba bien el verde; quizá flores o vegetación"
- Se deshizo el piso oscuro (paso 8). `llano` vuelve al pasto:
  - en el campo (|x| ≤ 41): pasto corto 14 %, flores 22 % (diente de león, amapola, margarita, aciano y allium). Todo de
    un bloque de alto: si cae un bloque musical encima, lo tapa;
  - a los lados: 260 árboles, 160 arbustos y pasto alto.
- Primera prueba con 30 % de pasto corto: matas oscuras que competían con los bloques. Con 14 % y más flores, el campo se ve vivo
  y los bloques siguen mandando (`salida/hoja_v0d_flores.jpg`).

## Paso 10 — "¿por qué de noche?" y "shaders súper premium"
- La noche venía del concepto (la luz sale de los bloques). Leo eligió **atardecer** y el modo premium.
- Los shader packs (BSL, Complementary) no corren en este motor, así que no se descargó nada: se programaron los 6 efectos
  (ver AGENTE.md, "Modo premium"). Se suma el ambiente `dorado`.
- **Error:** un `\n` mal escapado en el shader del viento rompió `mundo.js` y la página dejó de responder durante 10 min.
  Se encontró con `node --check` sobre una copia `.mjs`. **Regla:** después de editar `js/`, `node --check` antes de `recargar`.
- Rondas de ajuste (hojas en `salida/hoja_premium_v1..v3.jpg`, `hoja_premium_sol*.jpg`):
  | # | Problema | Antes | Después |
  |---|---|---|---|
  | 1 | Todo amarillo y sobreexpuesto; las notas no se leían | neblina 0.0065 × 0.6, exp 1.08, sol 3.3, tenue 0.22 | neblina 0.0028 × 0.38, exp 0.9, sol 2.7, hemi 0.95, tenue 0.04, luces del etalonaje menos cálidas |
  | 2 | A ras del suelo el sol era una mancha blanca enorme | halo 0.32 × 0.18, rayos 1.6, bloom del ambiente 0.6 | halo 0.16 × 0.07, rayos 1.05 (caída en 0.4), **bloom 0.3**: el bloom era la causa principal |
  | 3 | Nubes casi invisibles | umbral 0.48 | 0.42 |
- Muestra con sonido: `salida/premium_muestra_v1.mp4` (17 s: entrada 2–8 s, parte lenta a ras del suelo 117–122 s y
  clímax a contraluz 146–152 s). Render: 6 s de clímax en 24 s.
- Ojo: las cámaras de las tomas 7 y 11 se cambiaron a mano para la prueba; `rollo.py` las pisa al regenerar. Las cámaras
  definitivas van en la siguiente pasada.

## Paso 11 — Cámaras v1, contador, LTezla y el borde del mundo
- Leo, sobre el bosque de torres: "tapan más que mostrar lo que pasa" → cámaras v1 siempre afuera, mirando el frente
  y con el sol detrás. Las tomas del medio se acercaron (dist 40–72 → 24–48), y en el clímax notas y destellos más grandes
  (`tam` 1.7, `pulso` 0.3) para que se vea dónde suena.
- Adelanto: toma 0–0.9 s que muestra el estado de 156 s (`tc`) en silencio.
- `textos.py`: capa de textos Minecraft Ten cuadro por cuadro, con contorno oscuro:
  - "NOTA n / DE 34.961" (exacto, desde rollo.json);
  - gancho "RUSH E / EN BLOQUES";
  - "FALTAN n" a los 110 s y en la pausa;
  - final "34.961 NOTAS" y "A MANO: 42 A 56 SEMANAS".
- `facts.json`: el "56 semanas" de los críticos no tenía fuente. La única fuente verificable (Animator Island) dice "3-4 seconds
  of animation per week" → 169.47 s = **42 a 56 semanas** (se escribe el rango). Va con su `no_se_afirma`.
- LTezla: camina por el pasillo arpa|campana (x 13.5) en el frente durante la entrada (matiz `caminar`, avance lineal) y
  se queda en la orilla durante la pausa.
- Leo: "veo chunks vacíos, como un mundo que no carga" → primero suelo lejano + bosque lejano + lomas que bajan
  (sirvió a medias: la cordillera de fondo era un muro gris y el horizonte seguía siendo una llanura). Leo propuso usar
  **un mundo real de Minecraft**.

## Paso 12 — Mundo real (servidor oficial 26.3)
- `server.jar` oficial (piston-data.mojang.com, 62.294.556 bytes, sha1 33680f5f…, el mismo que registra el juego de Leo),
  en `agente/mundo_real/servidor/`. Leo aceptó el EULA en el chat. El servidor escucha sólo en 127.0.0.1, con RCON
  (`herramientas/rcon.py`); ya está apagado.
- Semilla 8966625098790227075. `/locate`: bosque de flores (-160, 864) junto a una pradera de girasoles (-96, 864).
  `forceload` de 1.536 chunks (x −384…127, z 512…1279) → 1.536 en estado `full`.
- `herramientas/mundo_real.py`: lector propio de NBT y Anvil. Errores del formato 26.x que hubo que resolver:
  - la paleta llega envuelta en `{"": valor}` (listas mixtas);
  - las entradas usan `{id, properties}` en lugar de `{Name, Properties}`.
  Se importó la zona en 512×73×768 (4 min).
- Vista desde arriba (`agente/mundo_real/vista_zona.png`): **archipiélago**. Mejor pasillo: x 256 ± 38, z 20–605, con
  19 % de agua. Pasa por el bosque de flores y el rollo cruza tres brazos de agua como un puente (era el capítulo "puente sobre agua"
  del director). La pausa (z 527) cae en la orilla y el clímax en la costa.
- `pasillo`: piso plano, árboles quitados en una banda de 8 bloques y rampa del terreno; 177.010 bloques cambiados →
  `texturas_mc/mundos/orquesta`.
- Motor:
  - set `real:<n>` con su propio tamaño (precarga con los mobs);
  - bloque `agua` (id 84, textura real `water_still` teñida);
  - `sueloInfinito: "agua"` = mar abierto más allá del borde.
  - Abrir el proyecto tarda 4 s.
- `rollo.py`: el ancla queda fija (−364) porque el rollo entero cabe en el mundo.
- Hojas: `salida/hoja_mundo_real_v1.jpg` (agua azul plana) → `v2` (agua con textura y oleaje).

## Pendiente
- Mobs músicos con acción en su nota exacta (`accion` con lista de tiempos).
- Render completo v1 (`ensamblar` por tramos + capa de textos + `rush_e3.wav`) y ronda de críticos.

## Paso 13 — Leo: "¿el agua tiene animación? se ve como un bloque sólido"
- No tenía animación: era la textura quieta. Ahora el agua es un tipo propio (`agua`), con su malla y su material:
  - olas animadas en la normal (con el tiempo de la toma), que reflejan el sol;
  - oleaje en el color y transparencia 0.84;
  - reflejo del cielo según el ángulo (fresnel, color `AGUA.cielo` del ambiente);
  - superficie 2/16 más baja, como en el juego; no proyecta sombra.
- **Error:** al bajar la superficie a −0.125, el plano del "mar abierto" (−0.12) quedó encima del agua real y peleaban
  cuadro a cuadro (en 42.0 y 90.0 s salía azul plano y en 42.5 s, el agua nueva). El plano se bajó a −0.3.
  Hojas: `salida/hoja_agua_v1.jpg` (con el error), `hoja_agua_orden.jpg` (cambiar el orden no cambia nada: depende del cuadro), `hoja_agua_v2.jpg` (bien).
- Borrador completo en calidad baja (`borrador.py`): tramos de 20 s, calidad normal, escala 0.75 → 540×960, con la capa
  de textos y `rush_e3.wav`.

## Paso 14 — Agua v2 (Leo mandó de referencia una imagen de agua con shaders tipo SEUS)
- Borrador v1 (`salida/borrador_v1.mp4`, 540×960, 5.084 cuadros, 169.47 s): 9 tramos de 20 s, de 16 a 43 s de render
  cada uno, sin cuelgues. Problema visto: entre 12 y 30 s la cámara mira donde hay pocos bloques (casi puro pasto).
- Agua v2 (mundo.js `olasDeAgua` + escena.js `reflejarAgua`):
  - **profundidad por columna** (atributo `viento` en las caras de agua): turquesa y alfa 0.38 en la orilla → azul
    marino y 0.95 a 6 bloques o más;
  - **reflejo planar**: la escena reflejada en y = −0.125 a media resolución, con plano de recorte global, sin las mallas
    de agua y sin sombras nuevas; el shader lo lee con la matriz del reflejo y lo deforma con las olas;
  - olas en la rejilla de 1/8 de bloque y roughness 0.05 → destellos del sol nítidos;
  - fresnel entre 0.1 y 1.
- Hoja `salida/hoja_agua_v3.jpg`: reflejos de costa, lomas y nubes en 42 y 67 s; orilla turquesa; cielo reflejado desde arriba en 160 s.

## Paso 15 — Comentarios de Leo sobre el borrador v1 → v2
| Leo | Antes (v1) | Arreglo (v2) |
|---|---|---|
| "No quiero que el video informe que es mejor que hacerlo a mano" | final con "A MANO: 42 A 56 SEMANAS" | se quitó; el final dice sólo "34.961 NOTAS" (facts: `semanas_a_mano` → NO SE USA) |
| LTezla "no camina natural" y "camina sobre agua" | caminar en el sitio a 1.6 Hz, desplazándose a 4 b/s; el pasillo cruzaba agua | pose y matiz `correr` (2.6 pasos/s); 89 tablones en su pasillo donde hay agua |
| "Escenas aburridas: no sale nada o salen poquitos bloques cuando suena mucho"; "la cámara puede moverse mejor, como un dron" | 14 cámaras fijas, desde atrás del frente mirando adelante (al pasto vacío) | motor: `ruta` de cámara y `actorRuta` (Catmull-Rom). `rollo.py`: un dron por sección que **mira al centro de las notas que suenan** (suavizado) y ajusta la distancia a cuánto se reparten; va **adelante del frente mirando hacia atrás** (el río y las notas nuevas, con el sol de frente) |
| "Al final se ven muchos bloques saturando la pantalla" | torres hasta 30 → pared | desde la pausa, las notas no se construyen: **ecualizador** de 73 columnas que sube y baja (efecto `ecualizador`). Ganancia: la mitad más activa de las columnas ronda un objetivo que crece con la intensidad; en el pico, **ola de estadio** que recorre las columnas |
| (pendiente) mobs músicos | — | motor: `accion.tiempos` (el salto aterriza en la nota). Lobos (bajo) y zorros (campana) ×1.8 corren a 4 b/s por las orillas (873 tablones donde cruzan agua) y allays vuelan sobre el arpa. "primer tema" y "cuerpo 1" con la cámara pegada a ellos |

Rondas del ecualizador (hojas `salida/hoja_v2_climax_b…e.jpg`):
1. Con la ventana y la escala fijas: pared.
2. Con escala menor a más densidad: columnas de 1 bloque.
3. Ganancia por el promedio de todas las columnas: torres al máximo (las notas se concentran en pocas columnas).
4. Ganancia por la mitad activa: bien hasta 152 s, pero en el pico seguía siendo pared (ahí suenan las 73 columnas igual).
5. **Ola de estadio** (amplitud según la densidad > 500 notas/s): la silueta se mueve como un mar de bloques.

Errores:
- El ecualizador se dibujaba al inicio del río porque faltaba `z`.
- El dron veía el ecualizador de canto.
- El lobo corría sobre el agua (de ahí los tablones en las orillas).

## Ronda 1 de críticos (subagentes nuevos sobre borrador_v2) — los tres: "one more pass"
- **Sin sonido:** entendió el punto en un 75 %. Lo peor: 80–116 s, 36 s seguidos de la misma vista cenital; LTezla
  desaparece a los 15 s; el contador "congelado" en la pausa; "DE 34.961" y el cierre chicos y lavados.
- **Técnico** (medido):
  - 5.084 cuadros, cuadro 0 no negro;
  - −14.7 LUFS, TP −1.0 dBTP, LRA 4.4;
  - imagen quieta 0.13 s;
  - sincronía: 0 cuadros de desfase (pico de brillo en el cuadro de la nota en 30 de 65 notas aisladas y a +1 en 11; audio +0.4 ms);
  - destellos ≤ 1/s (clímax: dif. media 14.4, ningún cambio pasa del 41 % del área);
  - cortes 13/13 dentro de ±1;
  - contraste del contador: mediana 4.7:1, pero ~1.000 de 4.900 cuadros por debajo de 3:1.
  **Bloqueante:** cuadros 1097–1101 (36.57–36.73 s) en verde liso: la cámara está dentro de un bloque de pasto.
- **Director:** los textos tienen todos fuente y no aparece nada de "a mano". Momento firma real: la ola (152–163 s).
  Pidió:
  1. que la cámara no entre en bloques (36.5, 50, 131.5, 142–149);
  2. 80–131 s más cerca (frente ≥ 40 % del cuadro) y cortes cada 1–2 s en la explosión;
  3. 30–35 s: encuadrar la campana;
  4. columnas del ecualizador con brillo propio, y la cámara más lejos en 145–151;
  5. gancho con el cuadro de la ola (~158 s);
  6. LTezla de vuelta (lento, pausa grande, final);
  7. músicos al 15–25 % del alto, no enormes;
  8. capítulos distinguibles por la luz (de la tarde hacia el anochecer) y final que haga bucle.

| # | Problema | Antes (v2) | Arreglo → v3 |
|---|---|---|---|
| 1 | Cámara dentro de bloques o pasto (verde liso 36.57 s, 50, 131.5, 142–149) | sin colisión | `rollo.py`: altura del mundo + río + ecualizador; la cámara sube hasta tener línea de vista libre y ≥ 3 bloques sobre el terreno |
| 2 | 80–131 s lejos y cenital: "no se ve lo que suena" | dist 18–60, el 38–55 | dist 14–26, el 26–32; explosión en 4 cortes de ~1.7 s con empuje |
| 3 | Campana fuera de cuadro en 30–35 s | mira x 30, notas en el 20 % de arriba | mira x 24, el 26 |
| 4 | Ecualizador marrón oscuro | brillo propio 0.04 | material propio con brillo 0.3; dist 58–66 en 145–151 |
| 5 | Gancho oscuro | adelanto de 156 s | adelanto de 158.5 s (la ola) |
| 6 | Sin LTezla durante 2 min | sólo en 0.9–15 s y como un punto en la pausa | también en la toma lenta, en la pausa de cerca (2 s antes de la grúa) y en el final, frente al ecualizador |
| 7 | Músicos enormes en primer plano | la cámara mira a x ±30 | mira a su propia x (±39.5) y dist 18–22 |
| 8 | Capítulos iguales | misma luz | `exp`/`calidez` que bajan y se calientan de 55 a 125 s |
| 9 | "FALTAN" dos veces, contador chico | 110 s y pausa | sólo en la pausa; contador con banda oscura detrás y "DE" más grande; cierre más grande |
| 10 | Sonoridad −14.7 | — | −14.0 en la entrega |

### Arreglos de la ronda 1 + comentarios de Leo sobre v2 (→ v3)
- Colisión de cámara en `rollo.py` (`sin_choque`): mapa de alturas del mundo real (terreno, plantas y agua), del río y del
  ecualizador. La cámara sube de a 2.5° hasta quedar ≥ 3 bloques sobre el suelo y con línea de vista libre al centro de las
  notas y a ±8 bloques a los costados (Leo: "algunas escenas se ven obstruidas por árboles"). Hoja: 36.6 s ya no sale verde.
- Leo: "el zorro no tiene la animación correcta" → **gatos** (Fresh Animations: siamés, atigrado y negro).
- Leo: "animales sincronizados como soldados" → cada músico tiene su franja de tonos, su separación entre saltos
  (0.30–0.55 s), su altura de salto, su lugar (Δz −3.5…+5.2, Δx ±1.3) y su zigzag (un punto cada 2.4–4 s, ±1.4).
- Leo: "LTezla corre muy raro" → la pose `correr` + el matiz `correr` se sumaban. Ahora pose neutra + matiz (hoja 2.0/2.15/2.3 s: piernas alternadas).
- Leo: "aburrido al principio" y "drones con más perspectivas, giros…" → `giro` (órbita continua, °/s) y más subida/bajada.
  La entrada rodea a LTezla (11 °/s, de frente a un costado y arriba).
- Ecualizador: probé el emisivo con su textura (sigue oscuro) y un emisivo cálido de 0.22 (naranja parejo); quedó en
  0.08 cálido. Gancho: el adelanto muestra 158.5 s (la ola).
- Final: LTezla celebra frente al ecualizador **congelado** en 160.4 s (un pico de la ola) y la grúa sube detrás de él.
  Primer intento: con la cámara adelante del ecualizador, la colisión la subía por encima y LTezla quedaba diminuto.
- Textos: "FALTAN" sólo en la pausa; banda oscura (alfa 70) detrás de los textos; "DE 34.961" 52 → 62; cierre "34.961" a 190 + "NOTAS".
- Luz por capítulos (`exp`/`calidez` de 0.98/1 a 0.88/4 entre 55 y 131 s).
- La explosión va en 4 cortes de ~1.7 s con empuje.
- Las tomas pasaron de 14 a 18.

## Ronda 2 de críticos (subagentes nuevos sobre borrador_v3)
- **Sin sonido:** entiende un 85 % (antes 75 %). "One more pass":
  - el primer segundo se ve volteado (el reflejo del agua en el adelanto);
  - 15–116 s repetitivo;
  - desenfoque fuerte;
  - verde chillón;
  - "DE 34.961" chico;
  - pide un "FALTAN" intermedio → **no se aplica**: la ronda 1 pidió lo contrario ("sale dos veces y nunca más").
- **Técnico: SHIP.**
  - Revisó los 5.084 cuadros: el máximo de "un solo color" es 27 % (umbral 70 %) y no hay cuadros verdes.
  - 0 tramos quietos.
  - Sincronía: audio +19 ms (dentro de 1 cuadro); contador en el cuadro de la nota o 1 después.
  - Destellos ≤ 2/s.
  - −14.7 LUFS / −1.0 dBTP (se ajusta en la entrega).
  - Nota: la banda del contador oscurecía sólo al 0.70 → por debajo de 3:1 en 116–125 s, 142–145 s y 155–159 s.
- **Director:** "one more pass". Bloqueantes: los lobos sobre agua en 64–70 s (el zigzag los sacaba del muelle de 3 de ancho),
  el clímax recortado o atravesado en 141–150 s y ~60 s de cámara cenital.

| # | Problema | Antes (v3) | Arreglo → v4 (medido) |
|---|---|---|---|
| 1 | Mobs sobre agua | muelles de 3 bloques; zigzag ±1.4 | muelles de 8 (±37…44, 1.591 tablones); el zigzag no sale de \|x\| 38–43 → **0 de 323 puntos de ruta sobre agua** (control automático) |
| 2 | Cámara cenital | la colisión sólo subía la cámara, contaba bloques del río que aún no existían y flores como sólidos | prueba giros (±12/25/40°) antes de subir; alturas **en el instante t**; las plantas no cortan la línea de vista. Elevación media por toma: entrada 42 → **13°**, pausa 61 → **13°**, explosión 60–80 → **20–36°**, resto 14–36° |
| 3 | Clímax recortado / atraviesa columnas | dist 44–66; sin margen lateral | dist 60–78; la cámara no puede pasar a menos de 1.5 bloques de nada |
| 4 | Gancho corto y tapado | 0.9 s; título en el centro | 1.6 s; título en y 1060/1190 |
| 5 | Pausa con LTezla como un punto | cámara detrás, sobre el río | cámara a la altura de los ojos (6 bloques), con LTezla mirando el río que construyó; después, grúa. **Error:** la cámara del motor suma el giro del actor; se compensó (`rot`) |
| 6 | Músicos 25 s en primer plano | dos tomas largas sobre músicos | gatos 35.2–44 s y lobos 55.2–63 s; el resto, drones generales con giro |
| 7 | Desenfoque y verde | dof de la plantilla; saturación 1 | dof 0.08; saturación 0.9 |
| 8 | Lento: columna tapando | az 188–194 | az 214–222 |
| 9 | Final | LTezla de espaldas pegado a la pared | de tres cuartos (az 115) y después la grúa |
| 10 | Contraste del contador | banda alfa 70; "DE" 62 | alfa 125; "DE" 74 |

## Paso 16 — Comentarios de Leo sobre la v3/v4 → v5
- Leo: "las escenas duran mucho en la misma posición", "el dron no se siente como dron; que vuele entre los bloques que
  se generan, alternando", "la cámara marea (sube y baja)", "faltan cambios de perspectiva", "¿tienes algo que te diga si
  un bloque sale en la escena vertical o no?" y "agrégame mi capa" (NameMC b169480d76031eb0). Pidió renders sólo en baja
  hasta que confirme el completo.
- El borrador v4 se detuvo a la mitad (ya no servía).
- **Medidor de visibilidad** (`camaras.py`): proyecta las notas que suenan (las que sonaron en los últimos 0.35 s) con la
  misma cámara del motor (fov 38°, 9:16) y cuenta cuántas caen en el cuadro, sin la franja del contador.
- **Planificador** (`rollo.py`):
  - las secciones `plan` se parten en tomas de 3–5.5 s (1.5–2.2 s en la explosión), con cortes en notas reales;
  - estilos que se alternan: órbita, lateral, alto, a ras y **FPV** (cerca, rápido, con ladeo, entre los bloques);
  - cada toma prueba 12 az × 2 sentidos × elevaciones × distancias, y se queda con la que más notas muestra sin chocar y distinta de la anterior;
  - si queda < 45 %, se replanea como órbita;
  - sin sube y baja: elevación fija y órbita lineal.
- Rondas del planificador:
  1. media 77 %, mínima 14 % (FPV y clímax);
  2. FPV menos pegado, sin FPV en el clímax y respaldo en órbita → media 79 %;
  3. zoom ×1.5 en el clímax → **media 84 %, mínima 51 %, clímax 81 %**, 5 de 38 tomas < 60 % (FPV, cerca por naturaleza).
  Informe por toma: `critica/visibilidad.json`. Hay 42 tomas en total.
- Entrada: con distancia según las notas, LTezla salía chico → `base_fija` = 11 y LTezla pesa en la visibilidad. Hoja `salida/hoja_v5_entrada.jpg`.
- **Capa:** textura de 64×32 (MCC 15th Year). NameMC devuelve 403 al descargarla directo; se tomó desde el navegador integrado
  (la imagen abierta en su propia pestaña, a través de un canvas) → `skins/capa_mcc15.png`.
  - `personaje.js`: caja de 10×16×1 colgada del torso, con UV por cara y el diseño hacia afuera;
  - `motor.js`: ángulo según los matices (correr ≈ 0.95 rad con aleteo, caminar ≈ 0.42, quieto ≈ 0.1);
  - `main.js`: carga `personaje.capa`.

## Paso 17 — Leo sobre la v5: "te quedó increíble"; ojos de estrella, loros y "el cielo se ve café gris feo"
- **Cielo café gris:** era la **banda oscura detrás del contador** (alfa 125, pedida por el técnico de la ronda 2), que sobre
  cielo claro se veía como una franja. Ahora un halo oscuro difuminado sólo alrededor de las letras (`halo()` en textos.py,
  desenfoque y alfa 0.6). Prueba `salida/prueba_halo.jpg`: cielo limpio y texto legible.
- **Ojos:** Leo pidió ver las caras antes de cambiarlas (`salida/caras_ltezla_opciones.jpg`, 6 expresiones). Después: "me gustan
  las estrellas, pero rojas y con volumen". La cara la dibuja `js/rostro-suave.js` (no rostro.js: el primer cambio no se veía).
  `estrella()`: sombra, degradado radial (#ff9a9a → #e8213a → #8e0c1c), contorno #4e0610, bisel interior, brillo y
  destello (`salida/estrellas_rojas.jpg`). En rostro.js también quedó una estrella de 7×7 con volumen para el modo de pixeles.
- **Loros:** bandada de 5 (rojo, azul, verde, cian, gris) ×1.6, a 6–10 bloques de altura, cada uno con su zigzag (un
  punto cada 1.4–3.2 s, x ±28) y su velocidad (4.2–5.2 b/s); en todas las tomas antes del clímax (`salida/hoja_v6_loros.jpg`).
- Leo: renders completos sólo en baja hasta que confirme el final.

## Entrega v6 (calidad alta; Leo la pidió después de ver la v5 y las estrellas rojas)
- `final.py`: 17 tramos de 10 s en calidad alta (supermuestreo 1.5 → 1620×2880, reducido con lanczos a 1080×1920). La página
  se reinicia antes de cada tramo: **0 cuelgues** (en los borradores se colgó un tramo en v2, v3, v4 y v5), de 48 a 88 s por tramo.
  El render es con la GPU (RTX 4070 SUPER al 100 % durante cada tramo; Edge sin ventana con ANGLE/D3D11).
- Primera unión: 5.082 cuadros (`-shortest` cortó con el audio) y pico −0.7 dBFS (el AAC sube los picos). Arreglo: `apad` + `-t`
  exacto, y TP de loudnorm a −1.5.
- **Final medido:** `Videos/Rush E en bloques (LTezla).mp4`
  - 1080×1920, 30 fps, **5.084 cuadros**, 169.467 s;
  - H.264 crf 16 (17.6 Mbps), AAC de 320 kbps a 48 kHz;
  - **−14.4 LUFS**, LRA 5.7, **pico −1.2 dBTP**.
  - Es sólo música, así que vale como la versión "sólo música".
- Faltó hacer con esta versión la ronda de críticos de CLAUDE.md: la última completa fue sobre v3 (técnico: ship).

## Documentación (19 oct)
- `agente/orquesta/README.md`: paso a paso, qué cambiar para otra canción, mundo real, cámaras y lecciones.
- AGENTE.md: sección "Videos musicales con bloques musicales" con las funciones nuevas del motor.
- CLAUDE.md: enlace a la guía y la regla de Leo de borradores en baja.

## Plantilla general: video.json (19 oct)
- Lo propio de Rush E (duración, MIDI, proyecto, destino, mundo, río, ecualizador, textos y las 14 secciones) pasó de las
  constantes de rollo.py, textos.py, borrador.py y final.py a `video.json`, que leen todos a través de `video.py`
  (CUADROS = round(duracion·30)). `midi.py` y `partitura.py` sin argumentos usan la canción de `video.json`.
- Comprobación: `rollo.py` da `agente/proyectos/orquesta.json`, `rollo.json`, `climax.json` y `critica/visibilidad.json`
  **idénticos byte a byte** a los de antes (ids incluidos); `midi.py` da el mismo `rush_e3.json`; `textos.py` dibuja lo mismo
  en los 5.084 cuadros (comparado sin escribir PNG). Visibilidad que imprime: media 82 %, mínima 39 %, 7 de 38 tomas < 60 %.
- `secciones.py` propone las secciones desde `<base>_eventos.json`. Para Rush E coincide con lo hecho a mano en la pausa
  131.73–136.63, el ecualizador 136.63, la parte lenta (116.43), el final 165.07 y los textos (FALTAN 132.0–136.4, cierre 165.5).
  Los cortes del cuerpo caen distinto (14.30 / 34.97 / 55.23 / 67.60 / 80.00 / 98.23 contra 15.06 / 35.2 / 44 / 55.23 / 63 / 80 / 100).
  Con la propuesta, rollo.py arma 44 tomas, media de visibilidad 81 % (prueba en seco, no guardada).
