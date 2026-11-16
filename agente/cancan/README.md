# Videos musicales con bloques musicales ("La orquesta de bloques")

Así se hizo **"Rush E en bloques"** (`Videos/Rush E en bloques (LTezla).mp4`, 2:49, 1080×1920, entregado el 19 oct 2026).
Esta carpeta es la plantilla para hacer otro: copia a `agente/<video>/` los `.py`, `video.json` y este README (el audio, los
JSON de Rush E y `salida/` no hacen falta) y **cambia sólo `video.json`** (ver "Qué cambiar" abajo).
Lo que salió mal en cada vuelta (y su arreglo, con números) está en [`ledger.md`](ledger.md): léelo antes de empezar.
Antes de elegir la canción y el gancho, lee [`investigacion_viral.md`](investigacion_viral.md): qué tienen los videos de este tipo que pasan de 1 M.
**Regla de Leo:** sólo canciones **sin derechos de autor** (dominio público o tradicionales), con un MIDI o una partitura libre, o escrita por nosotros.

## La idea
Cada nota de la canción suena con el `.ogg` real del bloque musical de Minecraft y **pone su bloque en el cuadro exacto**
(99 % a menos de medio cuadro). Las notas construyen un "río" de bloques sobre un mundo real de Minecraft. Desde una
sección elegida (en Rush E 3, el clímax tras la pausa) las notas mueven un **ecualizador** de 73 columnas con una ola. Encima va un
contador "NOTA n DE total". LTezla (con su capa) corre al principio, mira el río en la pausa y celebra al final. Lobos, gatos y
allays saltan en sus notas y una bandada de loros vuela sobre el río.

## Paso a paso (con los tiempos que tardó)

| # | Comando | Qué hace | Tiempo |
|---|---|---|---|
| 1 | Conseguir el **MIDI** (el oficial si la canción tiene dueño; Rush E 3 se compró en Gumroad) y dejarlo en la carpeta. En `video.json`: `titulo`, `cancion`, `base` (nombre de los archivos), `midi`, `proyecto` y `destino` | — | — |
| 2 | `python midi.py` | Sin argumentos usa `video.json` (`midi.archivo`, `midi.tramos`, `midi.velocidad` → `<base>.json`). Lee el MIDI con su mapa de tempo, **quita las notas fuera del piano** (la0–do8: los MIDI "de visualización" traen dibujos), reparte por registro (bajo fa#1–fa3, arpa fa#3–fa#5, campana sol5–fa#7) y cuantiza a cuadros. Sigue sirviendo `python midi.py otra.mid --salida x.json --tramos a-b,c-d` | s |
| 3 | `python partitura.py --comprobar` | WAV con los sonidos reales (afinados como en el juego) + `<base>_eventos.json` + comprobación con librosa | ~30 s |
| 4 | `python referencia_piano.py cancion.mid ref.wav` | Opcional: el MIDI con un piano sintético para comparar de oído con los bloques | s |
| 5 | `python secciones.py` | **Propone las secciones**: densidad de notas cada 5 s (por registro), silencios, pausa, partes lentas, explosión y desde dónde va el ecualizador. `--json` da el bloque para `video.json` (`secciones`, `ecualizador`, `textos`); `--guardar` lo deja en `secciones_propuestas.json`. Es un punto de partida: escucha y ajusta | s |
| 6 | `python video.py` | Resumen de `video.json` y comprobación de que las secciones van de 0 a la duración sin huecos (rollo.py no corre si fallan) | s |
| 7 | Mundo real: ver "Mundo real" abajo | Terreno de verdad (Leo: "los chunks vacíos se ven feos") | ~10 min |
| 8 | `python rollo.py` | **El video como código**: golpes del río (`rollo.json`) y del ecualizador (`climax.json`), tomas con el planificador de cámaras, músicos, loros y el proyecto `agente/proyectos/<proyecto>.json`. Imprime la **visibilidad** (cuánto de lo que suena se ve en el cuadro) | ~3 s |
| 9 | `python ../../herramientas/agente.py abrir '{"nombre":"<proyecto>"}'` y después `python rollo.py personajes` → un `personaje @archivo` por línea | Abre el proyecto y le pone poses y caras a LTezla | ~10 s |
| 10 | `agente.py hoja '{"ts":[…]}'` | **Mirar** antes de renderizar | 1–2 min |
| 11 | `python textos.py` | Capa de textos (Minecraft Ten, con halo) cuadro por cuadro | ~2 min |
| 12 | `python borrador.py vN` | Borrador **en calidad baja** (540×960) por tramos de 20 s. **Leo: renders completos en baja hasta que él confirme el final** | ~8 min |
| 13 | Ronda de críticos con subagentes nuevos (sin sonido, técnico, director) → `ledger.md` | CLAUDE.md | ~5 min |
| 14 | `python final.py vN` | **Final**: 17 tramos de 10 s en alta (supermuestreo 1.5×) **reiniciando la página antes de cada tramo** (sin eso se colgaba un tramo por render), loudnorm de dos pasadas (−14 LUFS, TP −1.5 → −1.2 tras el AAC), el `destino` de `video.json` | ~20 min, en la GPU |
| 15 | Entrega en el panel: carpeta `Videos/TikTok/NNN_<slug>/` (video, `portada.jpg`, `publicar.txt` con la descripción en la línea 2), fila en `tiktok/publicaciones.csv` y `tiktok/videos/<slug>/guion.json` mínimo | Sale como video "suelto" en el panel (ver ledger, paso final) | s |

## Qué cambiar para otra canción: `video.json`
Todo lo propio del video está en **`video.json`** y lo leen todos los scripts a través de `video.py` (las rutas son relativas
a la carpeta del video). Ya no hay que tocar constantes en los `.py`:

| Clave | Qué es | Rush E 3 |
|---|---|---|
| `titulo`, `cancion` | Nombre del video y de la canción (sale en el proyecto y en el audio) | "Rush E en bloques", "Rush E 3" |
| `duracion` | Segundos en la rejilla de 30 fps; **`CUADROS` = round(duracion·30)** en textos, borrador y final. Sin la clave, sale de `<base>_eventos.json` redondeada al cuadro de arriba (en Rush E da lo mismo) | 169.4667 (5.084 cuadros) |
| `base` | Nombre de los archivos de la canción: `<base>.json`, `.wav`, `_eventos.json`, `_escuchar.mp3` | "rush_e3" |
| `midi` | `archivo`, `tramos` (`null`, `[[0, 12.08], [116.45, 132.73]]` o `"0-12.08,116.45-132.73"`) y `velocidad` | rush_e3.mid, completo |
| `proyecto` | `archivo` (→ `agente/proyectos/<archivo>.json` y el `abrir`) y `nombre` | "orquesta" |
| `destino` | El MP4 final, relativo a la raíz del programa | `Videos/Rush E en bloques (LTezla).mp4` |
| `mundo` | `set` (`real:<nombre>` → `texturas_mc/mundos/<nombre>.json/.bin`) y `ancla_z` | real:orquesta, −364 |
| `rio` | `vel` (bloques/s), `x0` (primera columna de cada registro) y `pasillo` (x de LTezla) | 4, −37/−12/13, 13.5 |
| `ecualizador` | `desde` (segundo en que las notas dejan de construir y mueven el ecualizador), `z` (≈ vel·desde + 5, después de la orilla), `alto_medio`, `max` y `congelar` (la ola quieta del final) | 136.63, 552, 9, 26, 160.4 |
| `textos` | `gancho` (`hasta`, `lineas`), `contador.hasta`, `faltan` (`desde`/`hasta`, o `null` sin pausa) y `cierre` (`desde`, `palabra`) | 1.8 · 165.5 · 132.0–136.4 · 165.5 |
| `secciones` | Las tomas, de 0 a `"fin"`: `camara` = `plan` (el planificador la parte en tomas de 3–5.5 s con sus estilos), `dron`, `fija` o `claves`; y `tc`, `ltezla` (corre, mira, orilla, final), `musicos`, `climax`, `luz` | 14 secciones (ver el archivo) |

Las propone `secciones.py` (ver el paso 5). Fuera de `video.json` quedan las decisiones de estilo, no de la canción:
`MUSICOS` y `LOROS` en `rollo.py` (otros mobs), `REGISTROS` en `midi.py` (otro rango: cada instrumento del juego cubre sólo
2 octavas; si cambian los registros, cambia también `rio.x0`) y **`facts.json`** (lo que se afirma: total de notas,
crédito de la canción; lo que no tiene fuente no va en pantalla).

Comprobado al pasar a `video.json` (19 oct): con el `video.json` de Rush E, `rollo.py` produce `agente/proyectos/orquesta.json`,
`rollo.json`, `climax.json` y `critica/visibilidad.json` idénticos byte a byte (ids incluidos); `midi.py` sin argumentos da el mismo
`rush_e3.json` y `textos.py` dibuja los mismos textos en los mismos 5.084 cuadros. La propuesta de `secciones.py` para Rush E
coincide con la hecha a mano en la pausa (131.73–136.63), el ecualizador (136.63), la parte lenta (116.43), el final (165.07) y los
textos (FALTAN 132.0–136.4, cierre 165.5); los cortes del cuerpo caen distinto (p. ej. 34.97 en vez de 35.2).

## Mundo real (herramientas/mundo_real.py)
1. Servidor oficial en `agente/mundo_real/servidor/` (sólo local, puerto 25599, RCON 25598; ya tiene el EULA aceptado por Leo).
   Arrancar: `java -Xms2G -Xmx4G -jar server.jar nogui` en esa carpeta. Para otro mundo, cambia `level-name` en `server.properties`.
2. `python herramientas/rcon.py "locate biome minecraft:flower_forest"` → `forceload add x0 z0 x1 z1` (≤ 256 chunks por comando)
   → esperar → `save-all flush` → `stop`.
3. `python herramientas/mundo_real.py importar <…/dimensions/minecraft/overworld/region> x0 z0 ancho largo <nombre>` y
   `… pasillo <nombre> x0 x1 z0 z1 <salida>` (aplana el pasillo del río, quita árboles del borde y siembra flores).
4. Muelles de tablones donde los mobs o LTezla cruzan agua (ver ledger: "nada camina sobre agua"; hay un control automático).
El de Rush E es un archipiélago con bosque de flores (semilla 8966625098790227075). El pasillo es x 256 ± 38, z 20–605.

## Cámaras (camaras.py + planificador en rollo.py)
- **Visibilidad**: cada nota que suena se proyecta con la cámara del motor (fov 38°, 9:16, sin la franja del contador). Rush E: media
  84 %. El informe por toma queda en `critica/visibilidad.json`.
- Tomas de 3–5.5 s con cortes en notas reales. Estilos: órbita, lateral, alto, a ras y **FPV** (vuela entre los bloques).
  Cada toma prueba ángulos y se queda con el que más notas muestra sin chocar y distinto de la anterior.
- **Colisión**: alturas del mundo + río **en ese instante** + ecualizador; las plantas no cortan la vista; primero gira y después sube.
  Sin sube y baja (Leo: "marea"): elevación fija y órbita lineal.
- Tomas con LTezla: `base_fija` (cerca) y LTezla pesa en la visibilidad. Ojo: la cámara del motor **suma el giro del actor**;
  `"rot"` en las claves lo compensa.

## Lecciones que costaron una vuelta (resumen; el detalle está en ledger.md)
- MIDI de visualización: 29 % de notas fuera del piano = ruido. Quitarlas, no moverlas de octava.
- Un corte de la canción puede dejar fuera el tema principal: escuchar antes de cortar (Leo prefirió la canción completa).
- El clímax construido en torres satura la pantalla → ecualizador; si todas las columnas suenan igual, ola de estadio.
- Leo: "no se ve lo que suena" → medir la visibilidad, no adivinar.
- Banda oscura detrás del texto = "cielo café gris feo" → halo en las letras.
- Después de editar `js/`: `node --check` sobre una copia `.mjs` antes de `recargar` (un `\n` mal escapado colgó la página 10 min).
- Las expresiones de LTezla se dibujan en `js/rostro-suave.js` (no en rostro.js).
- Pídele a Leo que elija las caras viendo una imagen antes de cambiarlas.
