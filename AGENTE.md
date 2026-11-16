# Minecraft Animator para agentes de IA

El programa se puede manejar entero con comandos JSON. La interfaz sigue ahí para que el humano **mire** (el cabezal,
la vista previa y un indicador abajo a la derecha: "🤖 agente: hoja…") y para retocar a mano si quiere.

## Arranque

1. `python servidor.py` (o el acceso directo). El servidor solo escucha en 127.0.0.1.
2. **Nada más.** El primer comando de `agente.py` abre solo la **página del agente SIN ventana** (Edge/Chrome headless
   con GPU, perfil propio `agente/navegador/`): no aparece nada en la pantalla del humano ni le roba el foco, y renderiza
   igual que con ventana (medido: diferencia media 0.54/255 = ruido del códec) y a la misma velocidad. Mientras está
   viva, **solo ella** recibe comandos: la página del humano nunca la maneja el agente.
   - `--sin-ventana` / `--reiniciar` la abren (o reinician) a mano; `--cerrar` la cierra. Las tres tocan **solo** el
     navegador con el perfil del agente, nunca las ventanas de Edge del humano.
   - `--ventana` = lo mismo **con** ventana visible. **No la uses** salvo que el humano pida mirar: aparece encima de
     lo que esté haciendo (el humano se quejó de este "spam" de ventanas).
   - Si la página del agente se cae (pasa en exportaciones largas), el siguiente comando la reabre sola; si sigue viva
     pero ocupada exportando, espera hasta 3 min antes de darla por muerta. `MCA_SIN_AUTO=1` desactiva la apertura sola.
3. `python herramientas/agente.py --conexion` → `{"pagina_conectada": true, "ventana_dedicada": …, "puerto": …}`.

La página normal abre con el hub de inicio (un panel encima del editor); los comandos funcionan igual con el hub abierto
y la ventana dedicada (`?agente=1`) no lo muestra. Cada video es un proyecto en `proyectos/<id>.json` y el abierto se autoguarda (≈1 s después de cada comando que edita).
La ventana dedicada recuerda su propio proyecto abierto: al empezar, `proyectos` y `abrirProyecto` (o `nuevoProyecto`).
No abras el **mismo** proyecto en dos páginas a la vez (la última que guarde gana). Después de cambiar código en `js/`, usa
`recargar`. `guardar` escribe una instantánea en `agente/proyectos/<nombre>.json`; **`abrir` la carga en su propio
proyecto `proyectos/agente-<nombre>.json`** (nunca encima del que estaba abierto: antes lo pisaba, y así el creeper se
autoguardó sobre `mi-animacion`).

## Cómo se llama

```
python herramientas/agente.py <comando> '<argumentos JSON>'
python herramientas/agente.py hoja '{"toma": 3}'
python herramientas/agente.py mob @cambios.json            (argumentos desde un archivo)
```

Responde `{"ok": true, "resultado": …}` o `{"ok": false, "error": "…"}` (código de salida 1). También se puede usar en la
consola del navegador: `await agente.ejecutar("estado")`, o por HTTP: `POST /api/agente {"cmd", "args"}` con el encabezado
`X-Agente: 1` (sin ese encabezado el servidor rechaza el pedido; así una página web cualquiera no puede mandar comandos).
Si la página que tomó un comando no confirma en 3 s (p. ej. se recargó), el servidor lo vuelve a encolar.

Tomas, mobs (`j`), títulos (`k`) y clips de cámara (`k`) se cuentan **desde 1**. Los tiempos van en segundos.

## Comandos de la página

| Comando | Qué hace | Argumentos |
|---|---|---|
| `ayuda` / `catalogo` | Comandos y argumentos / nombres válidos: poses, expresiones, matices, cámaras, **todos los mobs** (id, nombre, categoría, de dónde sale el modelo, tamaño en bloques), objetos (por categoría), escenarios, ambientes y bloques | — / `seccion` (`mobs` \| `objetos`), `buscar`, `cat` |
| `estado` | Duración, tomas (inicio, dur, escenario, mobs, títulos), plantillas, si se está exportando | — |
| **`proyectos`** | Proyectos guardados en `proyectos/` (id, nombre, fecha, duración, tomas) y cuál está abierto | — |
| **`nuevoProyecto`** / **`abrirProyecto`** | Crea (vacío o con plantilla) / abre un proyecto; el anterior queda guardado | `nombre`, `plantilla` / `id` |
| **`duplicarProyecto`** / **`renombrarProyecto`** / **`borrarProyecto`** | Copia, renombra o manda a `proyectos/papelera/` (no el abierto) | `id`, `nombre` |
| `plantilla` | Aplica una plantilla **al proyecto abierto** (reemplaza su animación); para empezar un video nuevo usa `nuevoProyecto` | `id` |
| `toma` | Todo lo de una toma en JSON (escena, mobs completos, cámaras, títulos con inicio relativo) | `toma` |
| `editarToma` | Mezcla cambios en la escena de la toma (`null` borra un campo) | `toma`, `cambios` |
| `mob` / `agregarMob` / `quitarMob` | Edita, agrega o quita un grupo de mobs. `tipo` acepta cualquier mob de la biblioteca: id del animador, nombre en español o inglés, o id de Java (`"zombi"`, `"Esqueleto"`, `"pig"`); si no existe, el error sugiere parecidos | `toma`, `j`, `cambios` / `mob` |
| **`darObjeto`** | Objeto de Minecraft en la mano derecha de LTezla (sin `j`) o de un grupo de mobs (`j`). `null` lo quita | `toma`, `j`, `objeto` (id de Java o nombre: `"diamond_sword"`, `"manzana"`, `"oak_planks"`) |
| `camara` | Edita un clip de cámara (`desde`/`hasta` {az, el, dist, ty, fov, pan, tilt}); rechaza fov > 42° | `toma`, `k`, `cambios` |
| `titulo` / `agregarTitulo` / `quitarTitulo` | Títulos 3D (Minecraft Ten) de la toma | `toma`, `k`, `cambios` / `titulo` |
| **`duracionToma`** | Cambia la duración: lo de adentro se estira, lo de después se corre (cámaras, poses, ojos, matices, títulos, audio) | `toma`, `dur` |
| **`agregarToma`** / **`quitarToma`** | Inserta una toma (vacía o copia de otra) / borra una toma y recorre lo demás | `despues`, `dur`, `copiar`, `escena`, `camara` / `toma` |
| **`personaje`** | LTezla en una toma: `poses` [[id, dur, {…}]], `ojos` [[expresión, dur, mx, my, {aCamara}]], `matices` [[tipo, inicio, dur, int]], `actor`, `ocultar` | `toma`, … |
| **`bloques`** | Pone / quita / consulta bloques del escenario (`op`: poner, quitar, consultar, alturas, limpiar). Se guardan en el proyecto | `escenario` o `toma`, `desde`, `hasta`, `bloque`, `relativo` |
| `deshacer` / `rehacer` / `recargar` | Historial / recargar la página (código nuevo) | — |
| `ir` | Mueve el cabezal de la interfaz para que el humano vea ese momento | `t` |
| `cuadro` | Un cuadro con calidad final → `agente/salida/cuadro_<t>.jpg` | `t`, `escala` (0.5) |
| `hoja` | **Hoja de contactos**: varios cuadros en una imagen con su tiempo → `agente/salida/hoja_toma<n>.jpg` | `toma` o `ts`, `n`, `columnas`, `escala` |
| `inspeccionar` | Qué se ve en `t`: cámara y, por mob, rectángulo en pantalla, alto, en cuadro, tapado por bloques, bajo título | `t` |
| **`traza`** | Movimiento de cada mob cuadro a cuadro (sin render): velocidad, giro y **sacudida** (temblor/tambaleo; quieto > 1.5 se nota) | `toma`, `j`, `series` |
| `revisar` | Revisión automática: física, visibilidad (protagonista, tapados, bajo títulos, al corte) y **sacudidas** | `tomas`, `paso` |
| **`clip`** | Video corto de una toma o rango → `agente/salida/clip_*.mp4` (con audio) | `toma` o `desde`/`hasta`, `escala`, `calidad` |
| `exportar` | MP4 a `Videos/<nombre>.mp4`. `calidad: "alta"` = 1920×1080, supermuestreo (1.5×, o 2 = dibujado a 4K) y ~17 Mbps, para redes | `nombre`, `calidad`, `supermuestreo`, `desde`, `hasta`, `fps` |
| `guardar` / `abrir` | Escribe / lee `agente/proyectos/<nombre>.json`; `abrir` lo deja en su propio proyecto `agente-<nombre>` | `nombre` |

## Comandos locales (los hace `agente.py` con ffmpeg y Python)

| Comando | Qué hace |
|---|---|
| `referencia '{"video": "ruta.mp4", "desfase": 0}'` | Registra el video original con el que se compara (`agente/referencia.json`; el video no se copia) |
| `comparar '{"toma": 3}'` o `'{"ts": [1.2, 5]}'` | Hoja **original arriba / réplica abajo** en los mismos tiempos → `agente/salida/comparar_*.jpg` |
| `medir '{"video": "Videos/x.mp4"}'` | `analisis/analisis_tomas.py` contra la referencia: cortes, y por toma [original, réplica] de luminancia, saturación, temperatura, contraste, movimiento y cámara |

## Biblioteca de recursos (todos los mobs y objetos)

`python herramientas/biblioteca.py` copia de TU computadora (solo para uso local, no se redistribuye) y escribe
`texturas_mc/biblioteca/indice.json`: **92 mobs** (66 con modelos y animaciones de Fresh Animations + texturas de Bare Bones,
12 con la geometría de tu Minecraft Bedrock y animación básica, 14 propios del tráiler) y **1205 objetos** (690 bloques,
330 objetos, 67 herramientas, 53 armaduras, 45 comidas, 20 armas). Hay que correrla una vez (o después de actualizar los packs
o el juego) y luego `recargar`.

```
python herramientas/agente.py catalogo '{"seccion": "mobs", "cat": "monstruo"}'
python herramientas/agente.py catalogo '{"seccion": "objetos", "buscar": "espada"}'
python herramientas/agente.py agregarMob '{"toma": 3, "mob": {"tipo": "zombi", "x": 2, "z": 1, "modo": "caminar", "dir": 90, "objeto": "iron_sword"}}'
python herramientas/agente.py agregarMob '{"toma": 3, "mob": {"tipo": "gato", "variante": "siames", "x": 1}}'
python herramientas/agente.py mob '{"toma": 3, "j": 4, "cambios": {"variante": "desierto+librero"}}'   (aldeano zombi)
python herramientas/agente.py darObjeto '{"toma": 3, "objeto": "diamond_sword"}'            (LTezla)
python herramientas/agente.py darObjeto '{"toma": 3, "j": 2, "objeto": null}'                 (el mob 2 suelta lo que tenga)
```

- **Sonidos reales del juego**: `python herramientas/sonidos.py` copia los de tu Minecraft Java (sin música ni discos) a
  `texturas_mc/sonidos/` + `indice.json` (evento → archivos .ogg). Se ponen como cualquier clip de la pista Audio:
  `{"tipo": "sfx", "archivo": "texturas_mc/sonidos/mob/pig/say1.ogg", "inicio": 2.0, "dur": 0.8, "vol": 1}`.
  Antes el animador sólo tenía efectos generados por ElevenLabs.
- **TikToks verticales en serie**: ver `TIKTOK.md` (`python tiktok/maquina.py`).
- Categorías de mobs: `animal`, `mascota`, `aldeano`, `monstruo`, `acuatico`, `golem`, `jefe`. De objetos: `arma`, `herramienta`,
  `armadura`, `comida`, `bloque`, `objeto`.
- Campos nuevos del grupo de mobs: `objeto` (lo que tiene en la mano) y `bebe: true` (cría a la mitad de tamaño). Los que vuelan
  (abeja, loro, phantom, allay, vex, ghast…) quedan a ~1.6 bloques del suelo y los acuáticos a 0.6 (`y` lo cambia).
- Cada mob de `catalogo` trae `fuente` (`fresh`, `bedrock`, `propio`), `tam` [ancho, alto] en bloques y, si se ve distinto al
  juego, `nota`. Los que tienen varias texturas traen `variantes` (la primera es la que sale sin `variante`) y algunos `extras`.
- **`variante`** (campo del grupo de mobs, en `agregarMob` y `mob`): la textura. Acepta el id, el nombre o el de Java, sin
  acentos ni género (`"Siamés"`, `"siamese"`, `"fria"`/`"frio"`); los extras se suman con `+`; `null` vuelve a la de siempre.
  Si no existe, el error lista las opciones. Hay variantes para: gato (11), caballo (7 colores + marcas `patas_blancas`,
  `manchas_blancas`, `puntos_blancos`, `puntos_negros`), rana / gallina / vaca / cerdo (`templada`, `fria`, `calida`; las
  frías y cálidas de gallina, vaca y cerdo usan su propio modelo de FA), ajolote (5), loro (5), llama y llama del comerciante
  (`crema`, `blanca`, `cafe`, `gris`), champiñaca (`roja`, `cafe`), zorro (`rojo`, `nieve`), aldeano zombi (7 biomas +
  extras de profesión: `"pantano+librero"`), oveja y cordero (16 colores de lana, teñida como en Java), conejo (7), panda (7)
  y gólem de cobre (4, oxidándose). Los del tráiler sin `variante` quedan exactamente igual. Ojo: el aldeano zombi sin
  `variante` ahora lleva la ropa de llanura (como en el juego).
- `traza` marca "sacudida" alta en los que aletean, saltan o nadan (abeja, murciélago, phantom, conejo, slime, peces, blaze):
  es su aleteo o salto, no un temblor; míralos con `hoja` antes de corregir.

Campos de escena, mobs y títulos: comentarios al inicio de `js/mobs.js` (tipos, modos, `accion`, `ruta`, `rumbo`, `calmo`,
`saltaBorde`…), `js/titulos3d.js` y la plantilla del tráiler en `js/plantillas.js` (ejemplos de todo).

## Flujo recomendado (lo que funcionó en el tráiler)

1. `--ventana`; `abrirProyecto` o `nuevoProyecto` (con `plantilla` si aplica); `referencia` si se replica un video.
2. `estado` → elegir la toma; `toma` para ver su JSON.
3. `comparar` (o `hoja`) y **mirar la imagen**: lo visual manda sobre los números.
4. `revisar` la toma: corregir física, visibilidad y sacudidas.
5. Cambiar con `mob` / `camara` / `editarToma` / `titulo` / `personaje` / `bloques`; repetir 3–4.
6. `clip` de la toma para que el humano vea el movimiento; `exportar` y `medir` el video completo.

Límites: al cambiar la duración de una toma, los tiempos internos de sus mobs (`accion.en`, `cabezaYaw`, `rumbo`…) no se
escalan; los escenarios base siguen definidos en `js/mundo.js` (los bloques se editan encima, por escenario).

## Videos musicales con bloques musicales (`agente/orquesta/`)

Guía paso a paso y qué cambiar para otra canción: **[`agente/orquesta/README.md`](agente/orquesta/README.md)** (ejemplo:
"Rush E en bloques"). Todo lo propio de cada canción va en su `video.json` (`secciones.py` propone las secciones). Funciones del motor que se agregaron para ese video:

| Función | Dónde | Qué hace |
|---|---|---|
| Efecto `ecualizador` | efectos.js | Pilas de bloques musicales por columna que suben y bajan con las notas recientes (`archivo`, `desfase`, `z`, `prof`, `ventana`, `max`, `congelar`; ganancia por la mitad activa de las columnas y ola de estadio cuando la densidad pasa de 500 notas/s) |
| Cámara `ruta` | motor.js `rutaEn` | Clip de cámara con puntos `[[tau, az, el, dist, ty, fov, roll], …]`, suavizados con Catmull-Rom (dron) |
| `actorRuta` | motor.js | Punto de mira de la toma `[[tau, x, y, z], …]` (la cámara sigue a lo que suena) |
| `accion.tiempos` | mobs.js | `saltitos` / `atacar` que aterrizan o golpean en cada instante de la lista (músicos en su nota) |
| `personaje.capa` | personaje.js + motor.js + main.js | Capa de Minecraft (textura de 64×32, p. ej. `skins/capa_mcc15.png`): cuelga de los hombros y se levanta al correr |
| `sueloInfinito` | escena.js | `true` = pasto y bosque más allá del borde del escenario; `"agua"` = mar abierto |
| Agua `agua` | mundo.js + escena.js | Profundidad (turquesa → marino), reflejo planar de la escena, olas en rejilla de 1/8 y fresnel (modo premium) |
| Viento `VIENTO` | mundo.js | Pasto, flores y hojas que se mecen (atributo `viento`; modo premium) |
| Escenario `llano` | mundo.js | Pradera plana con lomas a los lados (antes del mundo real) |
| Ojos `emocionado` | rostro-suave.js | Estrellas rojas con volumen (Leo) |

## Mundos reales de Minecraft (`herramientas/mundo_real.py`)

En lugar de un escenario inventado, se puede usar terreno generado por el juego.
1. Generar: servidor oficial en `agente/mundo_real/servidor/` (sólo local, RCON con `herramientas/rcon.py`):
   `locate biome …` y `forceload add x0 z0 x1 z1` (≤ 256 chunks por comando), luego `save-all flush` y `stop`.
2. `python herramientas/mundo_real.py importar <region> <x0> <z0> <ancho> <largo> <nombre>`
   → `texturas_mc/mundos/<nombre>.bin/.json`. Lee 1.18+ y 26.x.
3. `… pasillo <nombre> x0 x1 z0 z1 <salida>`: aplana una franja (respeta el agua), quita los árboles del borde y vuelve a sembrar flores.
4. En la toma: `"set": "real:<nombre>"`. Opcional: `"sueloInfinito": "agua"` (mar más allá del borde) o `true` (pasto y bosque).

Ejemplo: `agente/orquesta/rollo.py` (archipiélago con bosque de flores).

## Modo premium ("shaders" dentro del motor: `js/escena.js` + `js/mundo.js`)

Los shader packs de Minecraft (BSL, Complementary, SEUS) sólo corren dentro del juego (OptiFine/Iris), no en este motor
three.js. Por eso sus efectos se programaron aquí. Se enciende con `"premium": true` en `efectos` del proyecto y conviene
usarlo con el ambiente **`dorado`** (atardecer: sol bajo en az 8°/el 7°, hacia +z, con nubes con volumen).

| Efecto | Dónde | Ajuste (en `efectos`) |
|---|---|---|
| Rayos de sol volumétricos (el cielo visible se arrastra hacia el sol; entre torres y árboles a contraluz) | pase `Atmosfera`, usa la profundidad de GTAO | `rayos` (1) |
| Neblina que se tiñe del color del sol a lo lejos | `Atmosfera` | `neblina` (1) |
| Destellos de lente (fantasmas sobre la línea sol → centro; se apagan si algo tapa el sol) | `Atmosfera` | `destellos` (1) |
| Nubes con volumen iluminadas desde el sol | domo del cielo, `nubesVol` en el ambiente | — |
| Pasto, flores y hojas que se mecen (atributo `viento` por vértice; la base de las plantas queda fija) | `mecerConViento` en mundo.js | `viento` (1) |
| Etalonaje: sombras hacia el azul petróleo, luces cálidas, curva en S y +10 % de color | `EfectoCamara` | `etalonaje` (1) |

Todo depende del tiempo de la toma, así que sale igual en la vista previa, en `hoja` y al exportar. El pase de
oclusión se prende solo, porque premium usa su profundidad. Con el sol de frente baja el bloom: el ambiente `dorado` trae
`brillo: 0.3`; con más, el sol se vuelve una mancha. Los bloques de luz propia (como `notas` con `tenue`) casi no necesitan brillo de día
(0.04). Ejemplo: `agente/orquesta/rollo.py`.

## Efectos visuales por toma (`js/efectos.js`)

Para cortos de divulgación y tráileres: partículas, flechas de fuerza, trayectorias, rejillas, barras, etiquetas 3D con
Minecraft Ten, destellos con bloom, cámara lenta y un Tesla Roadster de bloques con propulsores. Van en la escena de cada toma
(con `editarToma` o en el JSON que arma un script, como `agente/roadster.py`). Todo es función del tiempo de la toma, sin
estado: sale igual en la vista previa, en `hoja` y al exportar (las 9 muestras del desenfoque de movimiento caen en su lugar).
La lista completa de campos está en el comentario al inicio de `js/efectos.js`.

**Campos nuevos de la toma**

| Campo | Qué hace |
|---|---|
| `efectos` | Lista de `{tipo, …}` (abajo). Posiciones `[x, y, z]` en bloques, relativas al ancla de la toma (como los mobs; y = 0 es el piso) |
| `tiempo` | Cámara lenta o congelar: `[[real, simulado], …]` lineal por tramos. Los mobs y los efectos van en tiempo simulado; la cámara, LTezla y el audio, en tiempo real. Ej.: `[[0,0],[0.7,0.7],[0.95,0.82],[3,0.87],[3.6,1.6]]` = va normal, casi se congela 2 s mientras la cámara gira y luego acelera. **Ojo**: `desde`/`hasta` de los efectos se miden en tiempo simulado |
| `brillo` | Multiplica el bloom de la toma (1.3–1.5 para que brillen chorros, flechas y destellos) |
| `ancla` | Ya existía: con `ancla: {x:0, y:0, z:0, rot:0}` los efectos se miden desde el origen y `actor` queda solo como el punto al que mira la cámara |

**Tipos de efecto** (comunes: `desde`, `hasta`, `entra`, `sale` en s; `sigue: "auto"` = `pos`/`dir` en el marco del Roadster:
+z adelante, +y arriba, +x a su izquierda; `dirMundo: true` deja la dirección en el mundo aunque siga al auto)

| `tipo` | Campos principales |
|---|---|
| `roadster` | `claves [[t, x, y, z, rumbo, cabeceo, alabeo], …]` (grados; mejor muestreadas a 60 Hz desde Python con la física: `claves()` en `roadster.py`), `chorros [[t0, t1, grupo, fuerza]]` (grupos `atras`, `abajo`, `abajo_izq`, `abajo_der`, `frente`: aire comprimido en partículas de pixel + núcleo brillante; contra el piso se abren), `succion [[t0, t1]]` (ventiladores celestes y luz en el piso), `humo [[t0, t1]]` (llantas que patinan), `giroRuedas [[t0, t1, rad/s]]`, `chispas [t…]`, `polvo: true`, `estela [{punto, color, largo, ancho}]` (cintas brillantes), `ala` (alerón activo 0..1 o curva), `camara {retraso, ofs, rot}` (**la cámara de la toma sigue al auto**; con retraso se le escapa), `modelo: "ruta.glb"` (reemplaza la carrocería por un modelo glTF), `conActor {pos, rot}` (LTezla sentado en el auto), `sinTecho`, `color` |
| `particulas` | `estilo` (`gas`, `polvo`, `humo`: nubes de **pixeles** como las de Minecraft, un sprite de 8×8 que se encoge; `chispas`, `nucleo`, `aire`: cuadros brillantes; `destellos`: titilan; `estela`), `forma` (`pixel` · `cuadro` · `suave`), `pos`, `area [ax, ay, az]`, `dir`, `abre` (°), `vel`, `tasa`, `vida`, `tam`, `crece`, `g`, `arrastre`, `color`/`color2` (`[r,g,b]` lineal: más de 1 brilla), `suelo`, `rafaga {t, n}` (todas de golpe) |
| `flecha` | Vector 3D (cuerpo + punta de pirámide con contorno oscuro): `pos`, `dir` (o curva `[[t, [x,y,z]], …]`: gira), `largo` (número o curva), `color`, `grosor`, `crece` (s), `encima` (no la tapa nada), `texto` / `tamTexto` / `colorTexto` / `ofsTexto` (etiqueta en la punta) |
| `trayectoria` | `puntos [[x,y,z]…]` o `auto [t0, t1]` (el camino del Roadster: la parábola real), `punteado` (cubitos), `color`, `ancho`, `dibuja [t0, t1]` (se traza de a poco, con una cabeza brillante) |
| `rejilla` | Cuadrícula brillante: `pos`, `tam [w, h]`, `paso`, `plano` (`xz` piso, `xy`, `zy`), `color`, `grosor`, `giro` |
| `barra` | Medidor 3D: `pos`, `ancho`, `alto`, `valor` (0..1 o curva), `color`, `giro` (sin giro mira a la cámara) |
| `texto` | Etiqueta 3D con Minecraft Ten en el mundo: `texto` (con `{v}` + `valor` curva, `dec`, `paso` = contador: `"AIRE {v}%"`, `"{v} S"`), `pos`, `tam` (bloques), `color`/`color2`/`sombra`, `giro` (fijo; sin giro mira a la cámara), `encima` (true), `anim: "golpe"` |
| `destello` | Flash con bloom: `t`, `pos`, `tam`, `color`, `dur`, `anillo` (radio de una onda en el piso) |
| `notas` | **Bloques musicales que suenan**: `golpes [[t, x, y, z, clics], …]` ordenados por t (el bloque en enteros, relativos al ancla redondeada como `bloques` con `relativo`; `clics` 0–24 = tono, `null` = percusión en blanco). En cada golpe el bloque destella (`pulso`, 0.2 s) y sale la corchea de Minecraft con el color de su tono (fórmula de NoteParticle; `vida` 0.7 s, `tam`). Aguanta miles de golpes (binaria + instancias). El bloque es `musical` (id 83, textura `note_block`). Los golpes salen de `agente/orquesta/partitura.py` (`*_eventos.json`). `construye: true` deja cada bloque puesto desde su cuadro (pop de 2 cuadros, brillo `tenue`; una sola malla instanciada, 35.000 bloques renderizan a ~4 s por segundo de video). `archivo: "ruta.json"` ({golpes}) en lugar de `golpes` para no inflar el proyecto; `desfase` = inicio de la toma cuando los golpes están en tiempo de la canción. Escenario `llano` (pasto plano en \|x\| ≤ 44, lomas a los lados): el del rollo de `agente/orquesta/rollo.py` |
| `filtro` | **Filtros de Minecraft** sobre toda la imagen (Super Secret Settings de la 1.8 y estados del juego): `modo` = `invert` (visión de enderman), `creeper`, `spider` (8 ojos), `sobel`, `pencil`, `bits`, `deconverge`, `wobble`, `ntsc`, `flip`, `nausea` (portal), `oscuridad` (pulso del warden), `nieve` (nieve en polvo), `vision` (visión nocturna). Con `desde`/`hasta` o `cambios [[t, modo \| null, fuerza?], …]`; `fuerza` 0..1. Pase `SuperSecreto` al final de `js/escena.js` |
| `impacto` | **Impact frames**: `golpes [t \| [t, color, cx, cy], …]`; cada golpe dura `cuadros` (2) cuadros a 30 fps: silueta negra sobre blanco con líneas radiales de pixeles y luego invertida (silueta del `color`, fondo negro). La silueta es LTezla + mobs + efectos (bloques musicales incluidos), sin mundo ni cielo. `centro [u, v]`, `pixel` (6), `fases` ([1, 2]). ≤ 3 por segundo (fotosensibles) |
| `paleta` | **El mundo cambia de familia de bloques**: `cambios [[t, nombre \| [oscuro, claro]], …]` con `PALETAS` de efectos.js (`nether`, `end`, `rosa`, `azul`, `verde`, `oro`, `prismarina`, `roja`, `hielo`, `obsidiana`, `naranja`, `lila`); conserva la textura y la luz. Tiñe escenarios, mundos reales, suelo y bosque lejanos (no el cielo: cámbialo con `ambiente`) |
| `fragmentos` | Pedazos de bloque que saltan como al romperlo: `golpes [[t, x, y, z, n?], …]` ordenados, `textura` (por defecto el bloque musical), `vel`, `vida`, `tam`, `g`. `filtro`, `impacto`, `paleta` y `fragmentos` aceptan `desfase` (tiempos de la canción). Ejemplo: `agente/cancan/estilo.py` |
| `sacude` | **Sacudida de cámara y golpe de zoom**: `golpes [[t, fuerza?], …]`, `dura` (0.35 s), `zoom` (0.12 = el fov se cierra 12 % y vuelve), `giro` (° de ladeo). Se suma después de la cámara de la toma |
| (`notas`) | Por cada golpe además: `anillo` (radio de una onda del color de la nota), `rayo` (alto de un haz de luz que sale del bloque), `chispas` (n pixeles brillantes que saltan) |
| (`real`) | `real: true` en cualquier efecto = usa el tiempo real aunque `tiempo` congele la toma (bullet time: las notas siguen construyendo mientras la explosión queda suspendida) |
| `rampa` | Cuarto de tubo para saltar: `pos`, `rumbo`, `radio`, `angulo`, `ancho` (mismo arco que usa `roadster.py`: y = R(1 − cos φ)) |

La fuente Minecraft Ten no tiene `≈`, `→` ni `ª` (salen como `?`): usa palabras ("3RA LEY", "0 A 96"). Las minúsculas salen en
mayúsculas.

**El Roadster 2026** (presentado el 15 oct 2026): blanco "de nave espacial", todo planos y ángulos, visor de vidrio cobrizo,
faros triangulares, barra de luz atrás, alerón activo, 4 toberas en el difusor, ventiladores de succión debajo; ≈ 4.5 × 1.96 ×
1.12 bloques, origen en el piso bajo el centro. No hay un modelo 3D público de este diseño: si se consigue uno (`.glb`), ponlo en
`texturas_mc/modelos/` y pásalo en `modelo` (se escala solo al largo del auto; ruedas, toberas y ventiladores siguen siendo
los del motor).

**Escenario `pista`** (`js/mundo.js`): pista de pruebas plana a lo largo de z (asfalto x −4…4, z −62…52, explanada de piedra
lisa hasta |x| = 9), muro blanco para manejar de lado (cara en x = 24, z −60…−28, 11 de alto), pacas de paja en (10, 8), hangar
gris en x ≈ −23, cohete con torre en (34, −40) y lomas con árboles a partir de |x| > 30.

**Cómo se hizo el corto del Roadster** (`agente/roadster.py`, ~73 s, 17 tomas): igual que `epico.py`. La física se calcula en
Python (salto: rampa de R = 7, θ = 32°, 16 m/s → tiro parabólico de 1.85 s y 25 m; arrancón de 0 a 26.8 m/s en 0.81 s; caída
libre ½gt² a las pacas) y va como `claves`. `VW(cam, actor, ty)` pone la cámara con coordenadas del mundo. Audio:
`agente/roadster_audio.py` (música, efectos y voces con el servidor; reutiliza la caché del corto épico) → `roadster_audio.json`;
`armar()` mide cada voz con ffprobe y le pone su `alineacion` (lip-sync). Las voces de eleven_v3 duran ~1.5× lo que se calcula:
mide y acomoda las tomas antes de exportar (que no se encimen). Pasos: `python agente/roadster.py` → `abrir {"nombre":
"roadster"}` → `personaje` con cada línea de `python agente/roadster.py poses` → `recargar` → `hoja` por toma → `exportar`
con `calidad: "alta"`.

## Cómo hacer un video completo de principio a fin (método del corto "El creeper era un cerdo")

Es lo que funcionó para el corto `Videos/El creeper era un cerdo (LTezla).mp4` (40.5 s, 1080p, 30 fps, −14.3 LUFS). Pasó
9 versiones con críticos independientes hasta recibir "ship". **Todo vive en `agente/creeper/`: cópialo a
`agente/<video>/` como plantilla** y cambia guion, tomas y textos. Lee `agente/creeper/ledger.md` antes de empezar: ahí
están los errores que ya se cometieron.

### Archivos (y para qué sirve cada uno)

| Archivo | Qué es |
|---|---|
| `brief.md` | Cada línea del brief con la decisión y su motivo (si el humano deja líneas en blanco, se deciden y se anotan aquí) |
| `facts.json` | **Única fuente** de todo lo que se dice o se escribe: frase exacta de la fuente + URL + dónde se usa. Más `no_se_afirma` |
| `concepto.md` | 2–3 direcciones y la elegida, tres momentos firma (sin nombres de efectos), storyboard (t, en pantalla, para qué, audio, salida, qué pasa a la siguiente) y biblia de estilo (≤ 6 colores) |
| `guion.py` | Líneas de voz (toma A = `eleven_v3` con etiquetas de emoción, B = `eleven_multilingual_v2`), prompt de música y efectos |
| `creeper_audio.py` | Pide al servidor (ElevenLabs, con caché por texto) música, 2 tomas por línea y efectos → `audio.json` |
| `analizar_audio.py` | Whisper: elige la toma que dice **exactamente** el texto y con ~125–145 ppm. librosa: pulso, beats y energía por segundo → `audio_analisis.json` |
| `creeper.py` | **El video entero como código.** `NOMBRES`/`TC` = cortes por nombre en beats; `VOCES` ancladas a palabras (`palabra()` lee las marcas de tiempo de la voz); `SFX_T`; una llamada a `toma()` por plano. `python creeper.py aplicar` lo escribe, lo abre y pone poses y ojos; también escribe `timing.json` |
| `timing.json` | Beats, cortes, cambios de cámara, voces (inicio/fin en s y cuadros), efectos y acciones clave. Los críticos miden contra esto |
| `ensamblar.py v<N>` | Exporta por **tramos** (reinicia la página del agente en cada uno; el título va sin supermuestreo), los une sin perder cuadros (`setpts=N/30/TB`) y pone la mezcla. `--faltan` sólo exporta los tramos que no existen |
| `mezcla.py` | Mezcla final con ffmpeg (no la del navegador): música en tramos, voz, efectos con paso alto y compresión por la voz, "acentos" sin comprimir, loudnorm −14 LUFS / −1.5 dBTP, más la **versión sólo música** |
| `ledger.md` | Cada ronda de críticos: problema, número antes/después y arreglo; también lo que **no** se cambió y por qué |
| `critica/` | Hojas mudas a 2 fps (`mudo_2fps_vN.jpg`) que ve el crítico sin sonido |

### Orden de trabajo

1. **Hechos primero**: `facts.json` con frase textual y URL (para Minecraft: minecraft.wiki, que cita minecraft.net). Si
   una frase de la fuente es opinión ("I think…"), la voz dice "quizás".
2. **Concepto y storyboard** en `concepto.md`. Un solo objeto lleva toda la película (aquí: el cuerpo del cerdo, que se
   para, se vuelve verde y explota) y tiene que leerse sin sonido.
3. **El audio va antes que la imagen**: voces (2 tomas, verificadas con Whisper), música (de unos 40 s, sin nombrar
   artistas en el prompt), beats. Los cortes caen en beats y las acciones clave en una palabra de la voz o en un beat.
   Para un silencio dramático **se corta la música** y se retoma más adelante (`tramos` en timing.json); no se estira
   la imagen.
4. **Escribir las tomas en `creeper.py`** y mirarlas con `hoja` (cuadros sueltos) hasta que cada una se lea. Prueba de
   punta a punta con un tramo de 3–5 s exportado (`exportar` con `desde`/`hasta`).
5. **Render**: `python agente/creeper/ensamblar.py v1`. Revisa el número de cuadros: tiene que dar duración × 30 exacto.
6. **Ronda de críticos** (abajo). Arregla lo más grave primero, vuelve a renderizar (si sólo cambió el audio, basta
   `mezcla.py` sobre `_mudo_vN.mp4`) y anota la ronda en `ledger.md`.
7. **Entrega**: `Videos/<Título>.mp4` y `Videos/<Título> - solo musica.mp4`.

### Ronda de críticos: siempre subagentes NUEVOS que no vieron nada del armado, en paralelo

- **Lectura sin sonido**: sólo puede abrir `critica/mudo_2fps_vN.jpg` (`ffmpeg -i v.mp4 -vf "fps=2,scale=384:-1,tile=9x9"`).
  Cuenta la historia, dice el punto con un % de confianza y lista lo que no entendió y los cuadros rotos.
- **Técnico**: mide con números contra `timing.json`. Duración, tamaño, fps y número de cuadros; cuadro 0 terminado.
  Imagen quieta: diferencia media en gris a 192×108 < 0.3, con un límite de ≤ 1 s cada 30 s y ningún tramo > 0.5 s.
  Cortes a ≤ 1 cuadro. −14 LUFS y TP ≤ −1 dBTP. **Cada efecto audible en su banda.** Contraste ≥ 4.5:1, márgenes
  del 5 %, colisiones de texto y ≤ 3 destellos/s. Además vuelve a revisar cada punto de la ronda anterior. Termina en
  "ship" o "one more pass".
- **Director + verificación de datos**: saca cuadros cada 0.2 s y transcribe con faster-whisper. Hace una tabla
  frase → id de `facts.json` y una crítica dura frente a los buenos animadores de Minecraft. Hay que decirle que el
  look de Bare Bones (hojas de un solo color) y los ojos limitados del rig son decisiones de diseño, si no lo cuenta
  como defecto.
- Los críticos se contradicen entre rondas. Cuando un arreglo deshace otro anterior, **no se aplica**; se anota en
  el ledger con el número que lo justifica (p. ej. el título sobre negro: 1.1:1 → 10.5:1).

### Herramientas del motor que hizo este corto

- **Mob `cerdo_error`** (`js/mobs.js`) es el cerdo vanilla con curvas `[[t, v], …]` en tiempo de la toma:
  - `error`: 0 = cerdo, 1 = cuerpo de pie como creeper; > 1 pasa de largo (rebote). Para la anticipación, −0.07.
  - `verde`: 0..1; los pixeles cambian uno a uno de la piel de cerdo a la del creeper, reacomodada al molde del cerdo, y
    el hocico se encoge.
  - `mecha: [t0, t1]`: se infla y parpadea en blanco, ≤ 2 destellos/s (seguro para fotosensibles).
  - `hasta`: desaparece en ese momento.
- **Títulos 3D** (`js/titulos3d.js`): `vivo` (vaivén lento en grados) y `crece` (escala por segundo) evitan que una tarjeta
  quede congelada. En el corto se usó `vivo: 5`, `crece: 0.08`.
- **Cámara apuntando a algo que no es el actor**: la escena siempre hace lookAt al `actor` (LTezla). `VWT(cam, actor, ty,
  mira)` en `creeper.py` calcula `pan`/`tilt` para mirar a otro punto. Con pan > ~90° el tilt se invierte: mejor una
  toma aparte con `actor` = el objetivo y `ocultar: true`.
- **Etiquetas**: texto negro (`#151515`) con `sombra` clara `#f4f4f4` sobre pasto o cielo. Si cruzan una flecha o un
  personaje, ponlas como efecto `texto` separado (con `desde`/`hasta`) en vez de `texto` de la flecha.
- **Bloques por proyecto**: `p["ediciones"] = {"pradera": [[x, y, z, "bloque" | "aire"], …]}`. El set se cachea: después
  de cambiarlos, `recargar`.

### Errores que ya costaron una ronda (no repetir)

- La exportación completa de una sola vez **cuelga** la página: hay que exportar por tramos de ≤ 7 s con reinicio, y el
  título 3D sin supermuestreo. Corta los tramos en la rejilla de cuadros (`round(t*30)/30`); si no, se pierde un cuadro.
- `abrir` pisaba el proyecto abierto (ya está corregido: ahora va a `agente-<nombre>`).
- Un efecto de ElevenLabs puede salir **casi mudo**: el "pop" picaba a −69.5 dBFS. Revisa el pico de cada archivo con
  `volumedetect` antes de mezclar.
- La compresión por la voz entierra los efectos cortos: pop, idea, whoosh y hojas van en el bus de "acentos", sin
  compresión. Un efecto grave encima de la voz no se oye nunca; si no se puede mover, se quita.
- Whisper alucina palabras sobre música y efectos (oyó "¡Suscríbete!" sobre un oink). Para confirmarlo, transcribe cada
  fuente por separado.
- Las hojas de Bare Bones son de un solo color: un muro de hojas cerca de la cámara se lee como una "losa". Aleja los
  arbustos del fondo de los primeros planos y limpia los arbustos sueltos del escenario con `"aire"`.
- La imagen quieta se mide, no se adivina: una cámara con poco recorrido o un título fijo suman segundos enseguida.
  Usa curvas `lineal` y más recorrido.
- No dejes al personaje tapando lo que la voz describe; antes de renderizar, revisa la línea cámara → objetivo.
