# Tráiler Benly × Bobicraft con LTezla: estado, cómo funciona y pendientes

Documento de traspaso. Resume cómo está hecha la réplica de
<https://x.com/benlyanimations/status/2035469539861750084> con LTezla, cómo se trabaja, qué se cambió en la
ronda 4–6 (Bare Bones + Fresh Animations) y qué falta.

Leer también: `analisis/analisis_trailer_emociones.md` (el original toma por toma),
`analisis/comparacion_trailer_original_vs_replica.md` (datos original vs réplica, todas las rondas) y
`analisis/investigacion_estilo_mojang.md` (investigación con fuentes).

---

## 1. Qué es el original

Tráiler de 40.85 s para la MINECRAFT LIVE de Bobicraft, 21 cortes + 2 fundidos, música electrónica de
127.7 BPM, sin diálogo. Casi todo son mobs; LTezla hace los papeles de jugador: jinete de la cabra (8.5–11 s),
el que cruza corriendo con pollitos (24.2–25.9 s), el primer plano que voltea (27.9–29.7 s) y el grupo de espaldas
en el atardecer (31.4–33.3 s).

El original para analizar NO va en el proyecto: se baja con la API pública de sindicación
`curl "https://cdn.syndication.twimg.com/tweet-result?id=2035469539861750084&token=4"` → variante
`.../vid/avc1/1280x720/sWPcv7yMK-031H-p.mp4`, a la carpeta temporal de cada sesión.

## 2. Entregables actuales

| Archivo | Qué es |
|---|---|
| `Videos/LTezla_trailer_replica_Benly_Bobicraft.mp4` | Réplica final = ronda 10 (1280×720, 24 fps, 980 cuadros, 40.85 s) |
| `Videos/comparativa_original_vs_trailer_LTezla.mp4` | Original arriba / réplica abajo, reloj al centro, audio original oído izq. / réplica der. |
| `Videos/LTezla_trailer_v4..v10.mp4` | Rondas (v7–v10 = sesión de correcciones de octubre, ver §7 y §8) |
| `analisis/comparacion_trailer_v4` … `_v9` (+ `_v6_global`) | `tomas.json/png` por ronda y `comparacion.json/png` de `comparar.py` |

## 3. Cómo está hecho

### 3.1 Texturas: Bare Bones (ronda 4)
- `herramientas/packs.py` lee TUS zips de Descargas (`Bare Bones 1.21.11.zip`, `FreshAnimations_v1.10.5.zip`) y copia a
  `texturas_mc/packs/`: `barebones/block` (1110 texturas, resolviendo sus carpetas `overlay_1_21_*` como el juego),
  `barebones/environment` (luna, nubes), `fresh/cem` (modelos y animaciones) y `mezcla/entity` (textura de cada mob =
  Bare Bones encima y, donde Bare Bones está vacío, los pixeles extra que pide Fresh Animations, igual que con los dos
  packs puestos en el juego).
- Panel Escena → Texturas: nueva opción **"Bare Bones (como los tráileres)"** (`escena.texturas = "barebones"`); la
  plantilla del tráiler la usa. Lo que Bare Bones no trae (p. ej. `warped_nylium_side`) se toma de tu `.jar`.
- Pasto, hojas y plantas se siguen tiñendo con el color de bioma (Bare Bones las trae en gris, como vanilla).

### 3.2 Mobs: modelos y animaciones de Fresh Animations (ronda 4)
- `js/cem.js` es un intérprete de **OptiFine CEM / EMF**: lee `.jem` (geometría) y `.jpm` (animaciones), traduce cada
  expresión (`if`, `clamp`, `torad`, `sin`, `random(id)`, `between`…) a una función de JavaScript y la evalúa paso a
  paso con el estado de la entidad (`limb_swing`, `limb_speed`, `head_yaw/pitch`, `is_on_ground`, `is_child`, `age`,
  `frame_time`…). Las variables `var.*` persisten de cuadro a cuadro como en el juego.
- Reglas verificadas en el código de EMF (Traben-0/Entity_Model_Features: `EMFPartData`, `EMFModelPartCustom`,
  `EMFModelPartRoot`, `ModelPartVariableFactory`) y en el importador de Blockbench (`optifine_jem.js`):
  cada parte del `.jem` se cuelga como hija de la parte vanilla del mismo nombre (que conserva su pose vanilla,
  p. ej. el cuerpo del lobo a 90°); pivote = `translate` invertido en x,y; cajas invertidas; `body.rx` apunta a la
  parte vanilla si el `.jem` la nombra. La pose vanilla de cada parte está en `cem.js → VANILLA`.
- Lo que el `setupAnim` vanilla escribe y Fresh Animations LEE se emula antes de cada paso: inclinación de la cabeza
  (`head_pitch`), la embestida de la cabra (cabeza vanilla más baja que la mirada → `var.ramA`), la oveja que come
  (`head.ty`) y el ángulo de los tentáculos del calamar (empuja su nado).
- Mobs con Fresh Animations: lobo (+ armadura con el tinte en el *overlay*, como en el juego), oveja/cordero (+ lana),
  cabra/cabrito, aldeano/granjero/aldeanito, calamar brillante, strider, llama (con baúl), cría de happy ghast.
- **Pollito: NO** usa Fresh Animations. Bare Bones 1.21.11 no trae el pollito bebé nuevo (el cubito amarillo que sale
  en el original); sus crías son gallinas blancas chiquitas. Se dejó el modelo bebé de tu `.jar` con animación propia.
- **Los "mobs morado/verde con arnés rojo" (tomas 13–14) son crías de happy ghast teñidas.** Se usa el modelo de FA
  de la cría, teñido verde/morado/rosa, con la correa roja y el control de botones del original pintados encima (el
  arnés de Bare Bones es una montura grande con gafas, que no es lo que se ve en el original). Los "cubitos rosas"
  del Nether son la misma cría teñida de rosa.

### 3.3 Física, terreno y acciones (`js/mobs.js`)
Cada mob se **simula una vez por toma a 60 Hz** (determinista: igual en la vista previa y al exportar):
- Velocidad con aceleración y frenado (`arranque`, `parar`); el cuerpo se inclina con la aceleración (se sienta al
  arrancar, se va de nariz al frenar) con los mismos resortes masa-resorte de `motor.js` (`RESORTES`).
- **Terreno real**: lee los bloques del escenario bajo toda la huella del mob; sube escalones de 1 bloque, baja con
  gravedad, no atraviesa hojas, troncos, paredes ni hongos; si algo estorba, gira a un lado (rutas con `ruta: [[x,z]]`).
  Si nace dentro de un bloque, busca el lugar libre más cercano.
- Acciones: `aullar` (se detiene, baja tantito la cabeza y la levanta con el hocico arriba, vibrato al aullar, cola
  quieta), `embestir` (cabra: agacharse, embestida y rebote), `rodar` (cabritos ruedan de lado pataleando),
  `saltitos` (pollitos y corderos; Fresh Animations reacciona solo al despegar y aterrizar), `picotear`, `pastar`,
  `sacudirse`; miradas con "holds"; `cabezaYaw` para voltear a la cámara (aldeano).
- `animador.revisarFisica()` (consola) recorre todo el tráiler y lista mobs metidos en bloques, flotando o hundidos.
  Ronda 6: **0 casos** (1 pollito parado en la orilla de un bloque, que sí lo sostiene).
- LTezla: matiz nuevo `montar` (vaivén con la respiración de la cabra) y el **cuerno de cabra en la mano** (ítem 3D con un
  cubito por pixel de `texturas_mc/item/goat_horn.png`, campo `objeto` de la toma).

### 3.4 Escenarios por toma (`js/mundo.js`)
Nuevos bloques: escalón de roble, antorcha (de pie y en la pared, inclinada 22.5°), pétalos rosas, nylium distorsionado,
tallo distorsionado, terracotas (franjas), magma, lava que cae, ventana encendida, hojas de azalea.
Nuevos escenarios: `aldea_frente` (dos casas de frente, escalón y antorcha en cada puerta, hueco de 4 bloques con
colinas), `calle` (callejón entre dos casas con ventanas encendidas), `cresta` (cresta baja con cielo + promontorio
para el acantilado de la toma 4), `pradera` (cielo rosa liso y atardecer), y fondos lejanos escalados `montana`
(nevada con franjas de terracota) y `cordillera` (atardecer). El Nether se rehízo (lago de lava, escalones con tapa
turquesa, columnas de lava, hongos distorsionados).
Campos nuevos de la toma: `fondo` + `fondoCfg`, `niebla`, `sol` (dirección), `dof`, `obturador`, `muestras`,
`focoMob`, `objeto`, y etalonaje `exp`, `sat`, `calidez`.

### 3.5 Desenfoques
- Con LTezla oculto (o `focoMob`), el autofoco enfoca la **cabeza del mob protagonista** (`foco: true` en el grupo).
- Desenfoque de fondo por toma (`dof`); global bajado de 0.45 a 0.36.
- Desenfoque de movimiento: 9 muestras (antes 5, salían "dobles") y obturador corto (`obturador: 0.22`) en la
  estampida, 0.35 en la cabra.
- Bloom de noche más bajo y halo de la luna más chico; nieve y ovejas ya no se lavan (exposición por toma).

## 4. Cómo trabajar (lo que funcionó)
- Servidor: preview `animator-8791` (en esta sesión 8790 lo tenía otro proceso).
- Cargar la plantilla: `[...document.querySelectorAll('.plantilla')].find(x => x.textContent.includes('Tráiler')).click()`
  (esperar ~6 s; detener la reproducción con `#b-play`).
- Cuadros de prueba: `await animador.guardarCuadros(["1.4", "9.77"])` → `Videos/_p_1.4.png`… (moverlos fuera de
  `Videos/` en cuanto se usan).
- Exportar: `animador.proy.nombre = "..."; animador.exportar({ tipo: "mp4", fps: 24, escala: 1 })` (~100 s) y esperar
  a que termine. **El panel del navegador debe estar visible**: oculto, la página se frena ~15× (se cambió la espera
  del exportador a `MessageChannel`, pero el render igual se frena).
- Análisis: `python analisis/analisis_tomas.py <original> <réplica> analisis/comparacion_trailer_<ronda>`,
  `python analisis/comparar.py ...`, `python herramientas/escuchar.py <réplica> salida.json`.

## 5. Lo que todavía no coincide (honesto)
- **Movimiento en cuadro 5.1 vs 6.6** (antes 3.9). La cabra corriendo sigue lejos del original (37 vs 7.5): en el
  original la cabra galopa enorme y el fondo se barre a 80 % del ancho/s.
- **Toma 6–7 (jinete)**: la montaña nevada con franjas se ve poca (el bosque cercano la tapa) y el encuadre es más
  cercano que el original; el cuerno en la mano casi no se distingue.
- **Pollitos**: modelo bebé del `.jar` (no Bare Bones / Fresh Animations), por la razón de §3.2.
- **Crías de happy ghast**: forma y correa correctas, pero la cara y los tonos exactos del original son otros (el
  original parece usar texturas propias de Bobicraft).
- **Toma 16 (cenital)**: los mobs quedan más chicos que en el original.
- **Calle (17–18)**: resuelto en las rondas 7–8 (ver §7).
- **Toma 21**: arbustos/árboles detrás de LTezla en vez de solo arbustos lima abajo.
- **Temperatura** 1.40 vs 1.31 y **luminancia** 105 vs 101: cerca, no igual.
- **Audio**: sin cambios en esta sesión (música ElevenLabs con el mismo tempo; correlación de volumen 0.21).
- **Títulos**: resuelto en la ronda 7 (Minecraft Ten real, texto 3D extruido; ver §7).
- Se dejó una carpeta `C:\c\` creada por error al extraer los zips (contiene solo una copia de los dos packs en una
  ruta temporal); la herramienta de seguridad no me dejó borrarla: se puede borrar a mano.

## 6. Investigación
Ver `analisis/investigacion_estilo_mojang.md` (estudios de los tráileres oficiales, charla de Eric Luhta, rigs y packs,
patrones de Fresh Animations / Actions & Stuff / vanilla, y el análisis de textura del original con cuadros).

## 7. Rondas 7–8: correcciones tras revisar el video (octubre 2026)

Pedido: aldeano del callejón que "desaparece", doble uniceja y sombrero transparente en los aldeanos, fuente exacta de los
títulos, aullido más épico, animales saltando del risco en MARZO 21, cabritos que se embisten en vez de rodar y un Nether
más lleno. Final = ronda 8 (`Videos/LTezla_trailer_v8.mp4` = `LTezla_trailer_replica_Benly_Bobicraft.mp4`).

### 7.1 Aldeano del callejón (22.3–24.2 s)
- Causa: no lo tapaba nada ni se teletransportaba; corría tan lento (5 bloques/s, desde los 0.25 s) que **al llegar el
  corte seguía a media pantalla** y desaparecía con el corte; además el pasto del primer plano, al centro, le pasaba por
  delante. En el original sale por la derecha hacia 23.8 s, antes del corte.
- Arreglo: cruza sobre el camino (z −2.5) a 8 bloques/s desde 22.4 s y sale por detrás de la pared derecha a ~23.8 s; la
  cámara de las dos mitades de la toma (17 y 18 son una sola toma del original) se acercó e inclinó (`dist 7.3`, `tilt 11`)
  para que el aldeano se vea más grande y por debajo del título; el pasto del primer plano quedó solo en las esquinas.

### 7.2 Aldeanos de Fresh Animations con texturas de Bare Bones
- **Doble uniceja**: Bare Bones pinta uniceja, ojos y boca en la cara (`villager.png`, cara 8..16 × 8..18) y Fresh Animations
  los vuelve a dibujar como partes móviles (`brow`, ojos, boca; textura en 13..21 × 19..24) porque su propia cara viene lisa.
  En el aldeanito FA baja las cejas (`is_child`) y se veían dos. `herramientas/packs.py → limpiar_cara_aldeano()` deja lisa
  la cara de Bare Bones en la textura mezclada (conserva las patillas).
- **Sombrero de paja transparente**: el `.jem` de FA trae siempre la corona (`headwear`, 8×10×8) y el ala (`rotation`,
  16×16×1) del sombrero. En los aldeanos sin profesión esa zona de la textura es 100 % transparente y el material la
  descarta con `alphaTest`… pero las pasadas de **profundidad del desenfoque (BokehPass) y de la oclusión ambiental (GTAO)**
  dibujan con su propio material, sin `alphaTest`, y el ala salía como un "sombrero fantasma". `js/mobs.js →
  podarTransparentes()` quita de la malla las caras cuya zona de textura es totalmente transparente (vale para todos los
  mobs con FA). El granjero conserva su sombrero sólido.

### 7.3 Títulos: la fuente exacta y el estilo
- **La fuente es "Minecraft Ten" de Mojang** (metadatos del archivo: "(c) 2015-2017 Mojang AB. All rights reserved").
  Viene dentro de Minecraft Bedrock, que ya tienes instalado:
  `C:\XboxGames\Minecraft for Windows\Content\data\resource_packs\vanilla\font\minecraft-ten.ttf` (trae acentos, ¡ y ¿).
  No hace falta bajarla: `herramientas/packs.py` la copia de TU juego a `texturas_mc/packs/fuentes/` (solo para tu PC; es de
  Mojang, no se redistribuye). En la web circulan "Minecraft Ten" de terceros con licencias contradictorias (FontSpace
  "personal use", una versión de FontStruct CC BY-SA): se descartaron porque la de tu juego es la original.
- **Estilo medido cuadro a cuadro**: en el original los títulos son **texto 3D extruido dentro del cuadro**: cara plana y muy
  saturada (casi sin degradado), extrusión más oscura que se ve hacia el centro de la imagen por la perspectiva, letras muy
  juntas, renglones casi pegados (≈1.04 em) y aparecen de golpe, sin animación. En "NUEVOS DROPS" los calamares pasan por
  delante de las letras; "ESTAN LISTOS?" está girado (lado izquierdo más cerca) y va sin ¿ ni acento, como en el original.
- Implementación: `js/titulos3d.js` (TTFLoader + ExtrudeGeometry, letra por letra) los pone frente a la cámara con su
  perspectiva real y los dibuja encima del cuadro ya procesado (colores exactos, sin desenfoque); con `enEscena` van dentro
  de la escena (oclusión y brillo). Campos nuevos del título: `prof`, `sombra2`, `espaciado`, `interlinea`, `lineasX`,
  `giro`, `dist`, `enEscena`, `halo`. Si falta la fuente, se usa el dibujo 2D anterior (Jersey 10).
- Medidas (1280×720): COSAS SECRETAS mayúsculas de 83 px, centro (0.51, 0.45); MARZO 21 ~128 px, centro (0.76, 0.45);
  BOBI/LTEZLA VOTE ~110 px centrado; NUEVOS DROPS 91 px; tarjeta: logo 0.12, caja LIVE 0.24, MARZO 21 0.48, hora 0.56, con
  halo rojo detrás.

### 7.4 Luna y lobo (3.75–7.33 s)
- Toma 3: cámara baja en contrapicado (lente 34°) y luna enorme justo detrás. El lobo llega, frena, **se sienta** (pose
  `is_sitting` de FA; como en el juego es instantánea, aquí se mezcla en 0.3 s) y aúlla 1.25 s: baja la cabeza
  (anticipación), sube el hocico ~77°, pecho arriba y vibrato de 7.5 Hz; los pollitos ya no le tapan la cabeza.
  Acción: `{ tipo: "aullar", sentarse: true, fuerza: 1.35 }`.
- Toma 4: la meseta del escenario `cresta` tiene ahora el borde cortado a pico; la luna (`luna: [tamaño, halo]`, campo nuevo
  de la toma) queda pegada a la orilla, nítida y con poco halo, y en silueta chiquita los dos lobos y cinco pollitos corren
  por la meseta y **saltan al vacío** delante de la luna (`saltaBorde`: impulso al llegar a una orilla alta).
- La textura de la luna de Bare Bones solo ocupa ~¼ del cuadro: por eso los tamaños son grandes (330 y 165).

### 7.5 Cabritos (8.54–11.0 s)
- Nueva acción `chocar` (`js/mobs.js`): dos cabritos frente a frente con el mismo punto y tiempos. Cada ciclo: paso atrás,
  carga acelerando, **choque de cabezas** en el punto medio (cada centro se detiene a la distancia de contacto: nunca se
  atraviesan), rebote hacia atrás con saltito y sacudida, y regreso; en los ciclos impares uno **empuja** al otro sin
  separarse. La cabeza baja va como embestida de FA (`var.ramA`). Ya no ruedan.

### 7.6 Nether (25.88–27.92 s)
- `mundo.js → netherFondo()`: terrazas escalonadas de netherrack con tapa de nylium distorsionado a los lados y al fondo,
  seis pilares hasta el techo con vetas de magma, cinco hongos gigantes (tallo 2×2, sombrero con brillohongos) y paredes y
  techo lejanos con brillohongos (la niebla morada los vuelve silueta). Ocho cubitos rosas más sobre las terrazas en las dos
  tomas (`CUBITOS_NETHER`).

### 7.7 Datos (ronda 8 vs ronda 6, `analisis/comparacion_trailer_v8`)
| Métrica (por toma) | Original | v6 | **v8** |
|---|---|---|---|
| Cortes a ≤ 2 cuadros | — | 22/25 | 21/25 (mismos cortes; el detector ubica 0.1 s después la entrada de la tarjeta, que ahora es un fundido de opacidad) |
| Movimiento en cuadro | 6.58 | 5.05 | 5.00 |
| Cámara (% ancho/s) | 7.33 | 5.34 | 5.34 |
| Luminancia | 100.8 | 105.4 | 109.5 (luna enorme y títulos planos muy claros) |
| Saturación | 0.577 | 0.571 | **0.576** |
| Temperatura R/B | 1.313 | 1.396 | 1.48 |
| Contraste | 50.8 | 48.7 | **51.4** |
| Nitidez | 146 | 170 | 167 |

### 7.8 Lo que todavía no coincide
- La toma del aullido no existe así en el original (allí el lobo solo camina): se hizo como pediste, más heroica.
- En la toma 4 la luna sale algo más azulada y el risco más plano y oscuro que en el original (allí hay una ladera
  iluminada y abetos en silueta).
- Los cabritos del original se ven más grandes en cuadro; la cámara de esa toma no se cambió.
- El Nether del original es más oscuro y con estructuras grandes cerca de la cámara; el fondo nuevo llena el cuadro pero es
  más "ordenado".
- La tarjeta final dice "LTEZLA" en Minecraft Ten (el logo de Minecraft es otra tipografía y marca de Mojang).
- Un pollito de la estampida (16.6 s) queda en la orilla de una paca de paja, igual que en la v6 (la paca lo sostiene).

## 8. Ronda 9: fundidos, inicio desde negro y easter egg

Final = ronda 9 (`Videos/LTezla_trailer_v9.mp4` = `LTezla_trailer_replica_Benly_Bobicraft.mp4`; comparativa rehecha).

- **"LTEZLA" se deformaba al entrar y al salir la tarjeta**: en los fundidos las letras 3D se vuelven semitransparentes y
  se veían a través de la cara los costados y el fondo de la extrusión. `titulos3d.js → dibujar()` ahora hace dos pasadas:
  primero solo la profundidad y luego el color de la superficie más cercana, así la letra se desvanece entera y sólida.
- **El video no empezaba desde negro como el original**: (1) el primer cuadro salía con destello: en la ronda 7 la capa
  negra dejó de taparse en cualquier toma "toda negra" (para que se vieran los títulos 3D de la tarjeta), lo que también
  quitó el negro del primer cuadro del fundido; ahora solo se omite en las tarjetas negras (`clip.negro`). (2) El fundido
  duraba 0.6 s; medido en el original sube de negro a imagen completa de forma lineal en ~2.1 s → `fundido: { entra: 2.1 }`.
- **Easter egg: Clawd**, la mascota de Claude Code (el bichito naranja de la pantalla de bienvenida), hecho en voxel
  (`mobs.js → MODELOS.clawd`, textura `PINTAR.clawd`: cuerpo terracota #d97757, dos ojitos negros, bracitos y cuatro
  patitas). Es el "pollito líder": en las tomas 1–2 va al frente de la fila guiando a los pollitos con saltitos y, en la
  toma 2, se sale de la fila hacia la cámara, frena, voltea al lente (campo nuevo `rumbo: [[t, grados]]`) y salta mientras
  los pollitos pasan por detrás (~3.4–3.75 s).

## 9. Ronda 10: cejas del aldeano y oveja del atardecer

Final = ronda 10 (`Videos/LTezla_trailer_v10.mp4` = `LTezla_trailer_replica_Benly_Bobicraft.mp4`; comparativa rehecha).

- **Algo transparente sobre las cejas (13 s, primer plano del aldeano)**: la ceja de Fresh Animations es un plano de 8×2 px
  cuya fila de arriba está vacía en la textura. El material la descarta con `alphaTest`, pero las pasadas de profundidad del
  desenfoque y de la oclusión ambiental (que no usan `alphaTest`, ver §7.2) la dibujaban: salía una franja borrosa encima de
  la ceja. `podarTransparentes()` ahora también **recorta** cada cara al rectángulo de pixeles opacos de su textura (posición
  y UV juntas), no solo quita las caras vacías por completo.
- **La oveja se tambaleaba (31.4–33.3 s, de espaldas mirando el sol)**: en modo "quieto" se le sumaban eventos de idle
  (bajar a pastar, sacudidas, miradas al azar) y el reposo de Fresh Animations (cambios de peso y "mirar alrededor"); vista
  de espaldas, todo eso parecía un tambaleo raro. Nuevo campo de mob `calmo: true` (puesto en los seis mobs de esa toma):
  sin pastar ni sacudirse, miradas casi nulas y el reloj de reposo de FA a 30 %, así que solo respiran.
