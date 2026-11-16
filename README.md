# Minecraft Animator

Plataforma para animar personajes de Minecraft: poses con codos y rodillas que se doblan, capa
exterior de la skin en 3D, ojos HD rigeados por personaje, mundo de bloques para construir,
render "de cine" y exportación a video.

**Abrir:** doble clic en el acceso directo **Minecraft Animator** del escritorio (o en `lanzador.vbs`).
Arranca el servidor local sin ventana y abre http://127.0.0.1:8790/. También funciona `abrir.bat`
o `python servidor.py`. Hace falta el servidor: abrir `index.html` directo no deja leer las skins.

## Interfaz

Al abrir el programa aparece el **inicio** (hub): continuar el último proyecto, tus proyectos recientes, crear uno nuevo,
importar un archivo o empezar desde una plantilla. Clic en el logo (arriba a la izquierda) vuelve al inicio. El icono de
la app (`icono.svg`, `icono.ico` del acceso directo y `icono.png`) es un bloque isométrico con un "play".

Tema **claro** por defecto, minimalista, con iconos de línea (trazos de Lucide, licencia ISC, incrustados en `index.html`:
no se descarga nada) y **tema oscuro** opcional (botón luna/sol arriba a la derecha; se recuerda en el navegador). El panel
izquierdo tiene secciones plegables; las herramientas del visor (Cámara, Posar, Mover) son un control segmentado; las
pistas de la línea de tiempo usan un tinte suave de su color. Todos los colores son variables en `css/estilo.css`.

## Personajes (catálogo)

Cada jugador tiene su ficha: nombre, skin, brazos normales o delgados y **su propia configuración de
cara** (dónde están los ojos, si tiene boca, colores y estilo). LTezla viene incluido. En
**Personaje → Cambiar personaje…** puedes:
- **Buscar skin del jugador**: escribe el nombre de Minecraft y la descarga (mc-heads.net).
- **Subir .png** o arrastrar la skin a la ventana.
- Al agregar uno se detectan los ojos solos y se abre el editor para revisarlos. Lo que guardes en
  “Ojos y boca” se queda en el personaje para todos los proyectos.

## Cómo se ve

- **Rig con huesos:** brazos y piernas se doblan suave en codo y rodilla, sin huecos.
- **Capa exterior 3D:** cada pixel de la segunda capa (pelo, mangas, chaqueta) es un cubito pegado al
  cuerpo, como el mod *3D Skin Layers*. Ya no flota separada.
- **Textura suave:** la skin se escala x8 con filtrado, así se ve nítida de cerca y sin “serrucho”.
- **Ojos Suave HD:** iris redondo con degradado, pupila, brillos, párpados curvos con pestaña,
  ^ ^ y > < con trazo limpio (sin mini pixeles). Los estilos pixel siguen disponibles.
- **Render cine:** tonos ACES, sombras suaves, oclusión ambiental (GTAO), desenfoque de fondo,
  grano, aberración y viñeta. “Rápida” lo apaga para editar más fluido.

## Mundo de bloques

Fondo → **Mundo de bloques** → elige terreno (colinas con árboles, plano, isla, **balcón del video de
Benly**) → *Generar terreno*. **🧱 Construir** abre la paleta (23 bloques, incluida la puerta de
roble): clic pone, Shift+clic quita, Alt+clic toma el bloque, “Abrir puerta” la abre o la cierra.
**📍 Mover personaje**: clic encima de un bloque para pararlo ahí; Q / E lo giran. El mundo se guarda
con el proyecto y se puede deshacer.

## Plantilla “Vlog (video Benly)”

Replica el video de @benlyanimations con tu personaje: pasillo-balcón con puerta y edificios,
formato 21:9, cámara en mano, marco REC con batería y cinta, grano, aberración y desenfoque.
15.7 s: saluda, ladea la cabeza, mira a un lado, voltea a la puerta riéndose, se apena, guiña y se
encoge de hombros, se acerca a la cámara y al final “agarran” la cámara. Todo queda editable.

## Plantilla “Tráiler (video Benly · Bobicraft)”

Réplica del tráiler de @benlyanimations para la MINECRAFT LIVE de Bobicraft (40.85 s, 16:9 1280×720):
25 tomas con los mismos cortes que el original, música electrónica a 128 BPM, títulos grandes
(MARZO 21, NUEVOS DROPS, ¿ESTÁN LISTOS?, COSAS SECRETAS, LTEZLA VOTE) y tarjeta final. Los mobs son los del
original con **modelos y texturas reales de tu Minecraft** (aldeanos, granjero, pollitos bebé, ovejas, cabras,
lobos con armadura, calamares brillantes, strider, llama) y LTezla hace el papel de los jugadores.
Análisis: `analisis/analisis_trailer_emociones.md` y `analisis/comparacion_trailer_original_vs_replica.md`.

- **Pista Escenarios** (+ Escenario): cada clip es una toma con corte: escenario (aldea, meseta y acantilado,
  taiga nevada, fondo del mar, cerezos, Nether; mundos de 128×128 con relieve natural y plantas), cielo y luz
  (día, nieve, noche con luna, bajo el agua, cielo rosa, atardecer, Nether), posición del personaje (y hacia
  dónde se mueve), mobs y fundidos a negro. “Pantalla negra” sirve para tarjetas.
- **Pista Títulos** (+ Título): texto 3D extruido con la fuente **Minecraft Ten** de Mojang (como en el original), color,
  tamaño, posición, giro, profundidad y espaciado (`js/titulos3d.js`). La fuente la copia `herramientas/packs.py` de tu
  Minecraft Bedrock instalado (solo para tu PC); si no está, se dibujan en 2D con una fuente pixel.
- **Música**: los clips de audio tipo `musica` usan ElevenLabs Music (`/api/musica`); `desde` empieza más
  adentro del archivo y `salida` lo desvanece.
- **Look y animación**: texturas del pack **Bare Bones** y mobs con los modelos y animaciones de **Fresh Animations**
  (FreshLX). `python herramientas/packs.py` los copia de tus zips en Descargas a `texturas_mc/packs/` (solo para tu
  PC; no se redistribuyen). `js/cem.js` lee los `.jem/.jpm` (formato OptiFine CEM / EMF) y los anima; `js/mobs.js`
  simula cada mob (terreno real, sin atravesar bloques, aullido sentado, embestida, cabritos que chocan, saltos desde
  un borde, saltitos).
- **Easter egg**: Clawd, la mascota de Claude Code, guía a los pollitos al principio del tráiler (tipo de mob `clawd`).
  En Escena → Texturas: "Bare Bones (como los tráileres)". Créditos: Bare Bones (Robotpants / bare-bones),
  Fresh Animations © FreshLX — <https://modrinth.com/resourcepack/fresh-animations>.
- Consola: `await animador.guardarCuadros(["1.4"])` (cuadros de prueba en Videos/_p_*.png) y
  `await animador.revisarFisica()` (mobs metidos en bloques o flotando).

## Biblioteca de Minecraft (todos los mobs y objetos)

Panel izquierdo → **Biblioteca** → **Mobs** u **Objetos**: un catálogo con buscador, categorías y miniaturas (las de los
mobs se dibujan con el mismo modelo del video). Clic en un mob = se agrega a la toma que está bajo el cabezal, al lado de
LTezla; clic en un objeto = LTezla lo tiene en la mano en esa toma. En el inspector de cada toma (pista Escenarios),
**Mobs de la toma** lista sus mobs: qué hacen (quieto, camina, corre, flota), cuántos, su **variante** (gato siamés, caballo
negro con patas blancas, rana fría, oveja rosa, aldeano zombi del desierto bibliotecario…), qué tienen en la mano y quitar.

- **92 mobs**: 66 con los modelos y animaciones de **Fresh Animations** y texturas de **Bare Bones** (zombi, esqueletos,
  creeper, araña, enderman, illagers, piglins, cerdo, vaca, caballos, gato, zorro, abeja, rana, guardianes, gólem de hierro…),
  12 con la geometría de tu **Minecraft Bedrock** y animación básica (conejo, panda, oso polar, armadillo, camello, nautilo,
  breeze, crujidor, warden, wither, dragón del End, gólem de cobre; 11 de ellos con la textura de Bare Bones) y los 14 del
  tráiler. Nombres oficiales en español (los de tu Minecraft).
- **1205 objetos**: armas, herramientas, armadura, comida, bloques y otros, en 3D como en el juego (un cubito por pixel de la
  textura de Bare Bones; los bloques, como cubo). Los mobs también pueden tener uno en la mano (campo `objeto` del grupo).
- `python herramientas/biblioteca.py` lo copia todo de tu PC a `texturas_mc/` (solo para tu computadora; no se redistribuye
  nada de Mojang, FreshLX ni Robotpants) y escribe `texturas_mc/biblioteca/indice.json` con nombre en español, categoría y
  tamaño de cada mob y objeto. Bedrock guarda sus archivos en `.brarchive` (formato propio de Mojang): los lee
  `herramientas/bedrock.py`.
- Lo que se ve distinto al juego: `analisis/BIBLIOTECA_estado.md`.

## Proyectos (un archivo por video)

Cada video es un proyecto guardado en la carpeta **`proyectos/`** del programa (`proyectos/<nombre>.json` + miniatura). El
proyecto abierto **se guarda solo** poco después de cada cambio (el indicador junto a los botones dice "guardado"); además
queda un respaldo en el navegador. Botón **📁 Proyectos**: abrir, duplicar, renombrar o mandar a la papelera
(`proyectos/papelera/`, nunca se borra nada). **Nuevo**, las plantillas grandes (tráiler, vlog) y **Abrir archivo**
crean un proyecto nuevo: el anterior nunca se pisa. **Descargar** baja una copia `.json` para compartir o respaldar.
El tráiler de Bobicraft está guardado como "Tráiler Bobicraft (LTezla)".

## Para agentes de IA (Claude y otros)

El programa se puede controlar entero con comandos JSON, sin tocar el código: un agente carga plantillas, edita tomas,
mobs (cualquiera de Minecraft, con objetos en la mano), cámaras y títulos, renderiza hojas de contactos para mirar, corre una revisión automática (física, mobs tapados o
bajo títulos) y exporta. Tú solo miras: la página muestra "🤖 agente: …" mientras trabaja. Desde la terminal:
`python herramientas/agente.py estado` · `python herramientas/agente.py hoja '{"toma": 3}'`. También compara contra un video
de referencia, mide el movimiento (sacudidas), cambia la estructura de tomas, mueve a LTezla, edita bloques y exporta en
1080p para redes (`exportar '{"calidad": "alta"}'`) desde una página propia **sin ventana** que se abre sola y no te
interrumpe (`agente.py --ventana` sólo si quieres verla trabajar).
Guía completa en `AGENTE.md`. Hay un ejemplo de video completo, desde los hechos hasta la ronda de críticos, en
`agente/creeper/` ("El creeper era un cerdo"). `CLAUDE.md` resume las reglas para Claude.
(código en `js/agente.js`; el puente vive en `servidor.py`, solo en 127.0.0.1 y con encabezado propio).

## Línea de tiempo

Poses, ojos y cámara van en secuencia (arrastra para reordenar, el borde cambia la duración); los
matices (hablar, asentir, reír, temblar…) se encima libres. Tomas de cámara: frente, tres cuartos,
primer plano, órbita, acercamiento, vlog, vlog muy cerca, “agarran la cámara”, etc.
Exporta WebM, PNG o secuencia PNG; formatos cuadrado, 16:9, 21:9 y vertical.

## Archivos

```
js/personaje.js     modelo desde la skin: huesos, doblez suave, capa exterior en voxeles
js/rostro.js        rig de la cara y expresiones · js/rostro-suave.js  ojos HD vectoriales
js/mundo.js         mundo de bloques: texturas, terrenos, malla con AO, puertas, guardar
js/escena.js        three.js: render cine, post-proceso, cielos y ambientes, escenarios, actor, cámara
js/mobs.js          mobs: simulación por toma (terreno, rutas, acciones), tipos de la biblioteca y geometría de Bedrock
js/cem.js           modelos/animaciones Fresh Animations (y pose vanilla de cada parte)
js/objetos.js       objetos en la mano (ítems extruidos y bloques) · js/recursos.js  biblioteca de mobs y objetos (interfaz)
js/poses.js         poses, matices, tomas de cámara, curvas
js/motor.js         evalúa la animación en el tiempo t
js/linea.js         línea de tiempo · js/plantillas.js  plantillas (incluye el vlog de Benly)
js/titulos3d.js     títulos 3D del tráiler (Minecraft Ten extruida, con perspectiva real)
js/efectos.js       efectos por toma: partículas de pixel, flechas, trayectorias, rejillas, etiquetas 3D, cámara lenta, Roadster
js/agente.js        API para agentes de IA: comandos JSON, hojas de contactos, revisión automática, puente con servidor.py
js/main.js          estado, catálogo, construir, inspector, editor de ojos, exportar
servidor.py         servidor local sin caché · lanzador.vbs / abrir.bat  para abrirlo
```

Consola: `animador.proy` es el proyecto, `await animador.foto(3.5)` da un cuadro a tamaño de exportación.

## Herramientas de análisis (gratis, open source, corren en tu PC)

```
python herramientas/escuchar.py video.mp4 salida.json        qué se oye: AST (527 sonidos), CLAP, tono/volumen, Whisper
python herramientas/elegir_audio.py "Giggle,Laughter" a.mp3 b.mp3   elige el audio que más suena a lo pedido
python analisis/comparar.py original.mp4 replica.mp4 carpeta        compara movimiento, foco, color, cámara y audio
python analisis/analisis_tomas.py original.mp4 replica.mp4 carpeta  para videos con cortes: compara toma por toma
python herramientas/packs.py                                        copia Bare Bones, Fresh Animations y la fuente Minecraft Ten
python herramientas/biblioteca.py                                   biblioteca: todos los mobs y objetos (FA, Bare Bones, Bedrock, .jar)
python herramientas/agente.py <comando> '{json}'                    controla el animador (para agentes de IA, ver AGENTE.md)
```
Los modelos (AST del MIT, CLAP de LAION, Whisper) se descargan una vez de Hugging Face.
