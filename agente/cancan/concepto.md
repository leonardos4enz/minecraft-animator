# Can-can en bloques: concepto (borrador, sin video todavía)

## Audio (paso 4, hecho el 19 oct 2026)
- MIDI: `cancan_completo.mid` (118,4 s, 148 compases de 2/4 a 150 bpm, 734 notas de melodía + 1.184 de acompañamiento).
- `midi.py` → 1.918 notas (bajo 387 · arpa 1.159 · campana 372), 0 fuera del piano.
- `partitura.py --comprobar` → error mediano 5,3 ms, máximo 16,0 ms, **100,0 % a menos de medio cuadro**.
- Para escuchar: `cancan_escuchar.mp3` (bloques) y `cancan_piano_escuchar.mp3` (piano de referencia).

## Forma (compases de 0,8 s; sale de la melodía del MIDI)
| Compases | Segundos | Parte |
|---|---|---|
| 1–16 | 0,0–12,8 | Galop (p) |
| 17–31 | 12,8–24,8 | Parte ff en octavas |
| 32–39 | 24,8–31,2 | re–la alternados + redoble |
| 40–71 | 31,2–56,8 | **Coro en sol** ("Ce bal est original") |
| 72–83 | 56,8–66,4 | Galop otra vez |
| 84–93 | 66,4–75,2 | Subida si–la–la (crescendo) |
| 94–123 | 75,2–98,4 | **Coro en re (ff)** |
| 124–135 | 98,4–108,0 | "hop, hop" |
| 136–140 | 108,0–112,0 | Nota larga (fa#) |
| 141–148 | 112,0–118,4 (cola del acorde hasta 119,9) | Acordes finales |

## Qué hacen las referencias (medido cuadro por cuadro)
Técnica: una sola decodificación a 160×90 con ffmpeg → por cada cuadro luma, movimiento (diferencia con el anterior),
"negativo" (correlación con el cuadro anterior invertido), masa blanco/negro, saturación, bordes y onsets del audio con
librosa. Salen un **mosaico con todos los cuadros** (24 por fila = 1 s), un slit-scan y las señales en el mismo eje.
Está en `referencias/` (script `cuadros.py`). Tarda segundos y cubre el 100 % de los cuadros sin mirar capturas sueltas.

**aicreataro** (24,25 s, 582 cuadros a 24 fps, música a 120 bpm = un pulso cada 12,25 cuadros):
- **Impact frame = 2 cuadros (83 ms) que terminan justo en el pulso**: cuadro 1 silueta oscura sobre blanco con líneas de
  velocidad radiales; cuadro 2 la misma silueta invertida (color sólido sobre negro). 22 impactos en 24 s.
- No golpea todos los pulsos: al principio cada 2–3 pulsos (cuadros 9, 46, 70, 107…), al final cada medio pulso
  (456, 462, 475, 481). La densidad **acelera** hacia el clímax.
- **Después de cada impacto cambia todo el mundo**: paleta (azul → salmón → verde → rosa → amarillo), fondo (tablero,
  rayos, anillos concéntricos, rejilla) y luz. Cada mundo dura 1–3 pulsos.
- Entre impactos el personaje **se deshace en partículas** (cubos y triángulos) que vuelan con el golpe y se vuelven a
  juntar. Ecualizador de barras al pie y un anillo de onda en el golpe. Al final, 16 cuadros a negro.

**tinynocky** (8,1 s, 195 cuadros, sin audio):
- 26 cuadros de 3D normal → corte seco a **tinta blanco y negro** durante 74 cuadros.
- Alterna blanco sobre negro / negro sobre blanco **cada 2 cuadros** (12 Hz), con espirales de velocidad y una **cruz de
  luz** en el golpe del puño (cuadros 82–87 y 182–194).
- Ojo: 12 Hz supera el límite de fotosensibilidad del programa (≤ 3 destellos/s). Lo usamos en ráfagas cortas
  (2 cuadros) y nunca en serie.

## Propuesta de estilo: "filtros de Minecraft" (dentro del juego, no de video)
Nada de LUTs ni efectos de editor: cada filtro es algo que existe en Minecraft.
1. **Super Secret Settings** (los shaders de la versión 1.8): `invert` (visión de enderman), `creeper` (verde
   pixelado), `spider` (8 ojos), `sobel`/`pencil` (dibujo), `bits` (paleta de 8 bits), `deconverge` (RGB separado),
   `wobble`, `phosphor`, `ntsc`, `flip`. Un filtro por "mundo" y se cambia en cada impacto.
2. **Estados del juego**: náusea (el bamboleo del portal), oscuridad del warden (pulso negro en el bajo), visión
   nocturna, nieve en polvo (marco helado), calabaza en la cabeza, catalejo, bajo el agua.
3. **Cambio de paleta del mundo**: en el impacto todos los bloques del mundo pasan a una familia (concreto, lana,
   terracota, bloques del Nether, del End). Es el "cambio de espacio" de aicreataro hecho con bloques.
4. **Impact frames de 2 cuadros** (67 ms a 30 fps), terminando en la nota: cuadro 1 silueta negra de LTezla y los
   bloques sobre blanco con líneas radiales de píxeles; cuadro 2 invertido con el color del mundo que entra.
5. **Partículas de Minecraft**: notas ♪ de colores (las del bloque musical, una por nota que suena), fragmentos de
   bloque al romperse (los bloques "se deshacen" como el personaje de aicreataro), tótem de la inmortalidad, cohetes,
   críticos, encantamiento, varas del End.

## Mapa al can-can (cuánto golpea cada parte)
| Parte | Impactos | Filtro / mundo | Partículas |
|---|---|---|---|
| Galop (p) | ninguno; termina con 1 | normal → `bits` | notas ♪ suaves |
| Octavas ff | 1 cada 2 compases | `deconverge`, paleta Nether | fragmentos de bloque |
| re–la + redoble | ráfaga final de 3 (≤ 3/s) | `wobble` + náusea | críticos |
| Coro en sol | 1 por frase (cada 2 compases) con cambio de paleta | rota: `invert`, `creeper`, `spider`, `pencil` | notas ♪ + lana de colores |
| Galop otra vez | ninguno (respiro) | normal, de noche | varas del End |
| Subida | se aceleran: 4 → 2 → 1 compás | oscuridad del warden en cada si–la–la | encantamiento hacia arriba |
| Coro en re (ff) | 1 por compás; congelado + cámara que rodea en los fuertes | todos los filtros, paleta End/concreto | cohetes + bloques que estallan |
| "hop, hop" | 2 exactos por "hop" | `sobel` (tinta, como tinynocky) | cruz de luz |
| Nota larga | congelado y la cámara da la vuelta (bullet time) | visión nocturna | tótem |
| Acordes finales | 1 por acorde, el último queda en blanco | `invert` → normal | lluvia de notas ♪ |

Pendiente para decidir con Leo antes de tocar el motor: qué de esto ya existe (hay `particulas` y `destello`; no hay
filtros tipo Super Secret Settings, cambio de paleta ni impact frames) y en qué orden se programa.
