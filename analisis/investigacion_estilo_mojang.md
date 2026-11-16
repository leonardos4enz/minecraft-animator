# Investigación: cómo se ven y se mueven las animaciones oficiales de Minecraft (y Actions & Stuff)

Fuentes web consultadas en esta sesión (octubre 2026) más el análisis cuadro a cuadro del original de Benly.
Donde algo **no se encontró**, se dice.

## 1. Tráileres oficiales: quién los hace y qué se sabe

| Tráiler | Estudio | Fuente |
|---|---|---|
| Bundles of Bravery (oct 2024), Minecraft Live 2025 Announcement, Spring to Life (mar 2025), Mounts of Mayhem (dic 2025), Minecraft Live mar 2026 | **Brikk Animation** (Estocolmo) | <https://minecraft.wiki/w/Mojang_cinematics> |
| Chase the Skies with Vibrant Visuals (jun 2025) | **Brikk** | <https://minecraft.wiki/w/CHASE_THE_SKIES_WITH_VIBRANT_VISUALS>, <https://brikk.se/en/cases/game-trailers/minecraft-chase-the-skies-with-vibrant-visuals/> |
| Armored Paws (2024), The Garden Awakens (dic 2024), The Copper Age (2025) | **Filmic Art / Filmic Animation** (Estocolmo) | <https://filmic.se/en/work/the-copper-age/> |
| Minecraft LIVE sep 2025 | Element Animation | <https://minecraft.wiki/w/Mojang_cinematics> |

- Chase the Skies: dirección creativa Josef Andersson (Brikk), dirección de arte **Seung Sung (Mojang)**, rigger dedicado,
  cinco animadores de personaje. Se apoya en Vibrant Visuals: "enhanced lighting", "lifelike reflections", "volumetric fog".
- Live 2025 (Brikk): referencia "Around the World" de Daft Punk; ciclos de animación con foco en "movement, tempo,
  and expression"; storyboard → bocetos de movimiento → animación.
  <https://brikk.se/en/cases/game-trailers/minecraft-live-2025-announcement-trailer/>
- Spring to Life (Brikk): sección "Storyboard and blocking" → flujo pose a pose (blocking y luego pulido).
  <https://brikk.se/en/cases/game-trailers/minecraft-spring-to-life/>
- The Copper Age (Filmic): solo dice "detailed character animation, cinematic camera angles, carefully crafted lighting".
- **No se encontró** qué software usan Brikk o Filmic (Behance de Brikk solo lista herramientas de Adobe:
  <https://www.behance.net/brikk>), ni lentes, profundidad de campo o etalonaje publicados. Benly Animations usa Blender y
  Cinema 4D según prensa (<https://rotek.fr/artiste-recree-trailer-minecraft-film-mieux/>).
- Vibrant Visuals: luz direccional, niebla volumétrica, materiales PBR (metálico, emisivo, rugosidad, subsurface).
  <https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/vvresourcepacks>

## 2. Eric Luhta — "Building an Animation Style True to Minecraft" (Minecraft Legends)

- Es una charla de **Develop:Brighton 2023** (no GDC). Video: <https://www.youtube.com/watch?v=91CnRjj36b4>;
  resumen: <https://www.gameanim.com/2024/09/25/minecraft-legends-building-a-unique-animation-style-true-to-minecraft/>.
- **No se pudieron extraer** los principios concretos: la transcripción no fue accesible y el artículo solo trae la
  introducción. Dato menor: los animales de Legends usan animación por keyframes para que "se sientan vivos"
  (<https://gamingbolt.com/minecraft-legends-video-discusses-visuals-art-direction-and-piglins>).

## 3. Texturas y rigs: ¿hay un pack oficial "de animación"?

- **No existe un pack de texturas ni un rig oficial público de Mojang para animadores.** Todo lo que circula es de la
  comunidad: MCprep (<https://all3dp.com/2/blender-minecraft-addon/>), Thomas Rig
  (<https://extensions.blender.org/add-ons/thomas-rig-legacy>), Ice Cube (<https://ice-cube-rig.carrd.co>), Boxscape
  (<https://www.nari3d.com/boxscape>), Renderer Rig "Mojang-styled" (<https://renderer.gumroad.com/l/RendererRig>),
  Mine-imator y Blockbench.
- Lo más cercano a oficial: el repositorio **Mojang/bedrock-samples** (geometría, texturas y animaciones vanilla):
  <https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/animations>.
- No se encontró qué rig o pack usan Benly, Bobicraft u otros animadores concretos.

### Qué textura usa el original (medido en los cuadros)
Mirando los cuadros del original a tamaño completo (aldea 1.4 s, jinete 9.9 s, Nether 26.6 s):
- Las texturas son las **vanilla pero "limpias"**: mismo dibujo (adoquín, tablones, tronco, nylium distorsionado, pollito),
  con **mucho menos contraste interno** — el pasto de arriba es casi un verde plano con rayitas claras, el camino es un
  degradado liso, el adoquín tiene juntas suaves. Las copas de los árboles lejanos son bloques casi lisos, **sin huecos**.
- La luz hace el resto: sombras **lilas/moradas** (luz de cielo fría), sol cálido, mucha saturación.
- Decisión (a pedido tuyo): usar **Bare Bones** (pack de Robotpants cuya descripción es "Just like the trailers!"),
  que coincide con lo medido: pasto casi liso con rayitas, hojas lisas sin huecos, adoquín suave, camino liso. Lo que
  Bare Bones no trae se toma de tu `.jar`. El pollito bebé nuevo (cubito amarillo del original) no existe en Bare Bones
  1.21.11, así que ese mob se queda con la textura del `.jar`.
- Mobs: modelos y animaciones de **Fresh Animations v1.10.5** (FreshLX) evaluados con un intérprete propio del formato
  OptiFine CEM / EMF (`js/cem.js`); se eligió sobre Actions & Stuff porque A&S es solo para Bedrock (Marketplace) y no
  tiene archivos que se puedan leer, mientras que FA trae sus `.jem/.jpm` en el zip. Términos de FA: uso personal y en
  videos con crédito; no se redistribuye (se lee de tu zip).

## 4. Cómo se mueven los mobs (Fresh Animations, iLike2MoveIt, Actions & Stuff, vanilla)

### Fresh Animations (FreshLX, Java) — <https://modrinth.com/resourcepack/fresh-animations>, <https://fresh-animations.com/>
- **Lobo**: idle, caminar, correr, nadar, sentarse; a veces se acuesta; mueve la cola cuando está domesticado; orejas que se
  sacuden (<https://modrinth.com/resourcepack/fresh-animations/version/1.9.1>). **No tiene aullido**.
- **Pollo**: picotea el suelo de vez en cuando (1.7); salto, caída, aterrizaje, giros, susto (1.10).
- **Oveja**: al girar desplaza el peso (no rota plana); la lana se mueve al saltar.
- **Cabra**: idle, caminar, correr, saltar y **embestir**; pelaje "más flojo".
- **Aldeano**: andar "goofy, bouncy"; cabeza y ojos siguen al jugador mientras el cuerpo camina; sacude la cabeza.
- **Strider**: idle con sacudidas de cabeza, caminar en tierra y lava, ojos animados.
- **Calamar**: nado con pulsos, idle, susto.
- **Caballo** (referencia de montura): sacude la cabeza y patea parado.

### iLike2MoveIt — <https://www.curseforge.com/minecraft/texture-packs/ilike2moveit>
- Lobo se sienta/levanta "con las patas plantadas"; el gato se acuesta sin "encajar de golpe"; transiciones suaves.

### Actions & Stuff (Oreville Studios, Bedrock) — <https://www.namu.moe/w/Actions%20%26%20Stuff>
- Ojos móviles en lobo y aldeano, oveja que come acostada, llama que muda pelaje, animación del jinete (caballo, Happy
  Ghast), jugador con idle, ataque, comer, élitros. **No se publican amplitudes ni ángulos.**

### Vanilla (números reales de Mojang, bedrock-samples) — base que esos packs exageran
- Cuadrúpedo: pata X = `cos(dist·38.17)·80°`, pares diagonales en contrafase; el ciclo avanza **con la distancia recorrida**.
- Pollo: piernas igual; alas en Z con `wing_flap`; en crías la cabeza se escala ×2.
- Humanoide: piernas ±1.4·cos, brazos ±cos; montar: brazos −36°, piernas −81° X y ±18° Y.
- Cabra: embestida = cabeza 0→60° en X; mirada limitada X ±40°, Y −45..25°; caminar con la mitad de amplitud.
- Strider: piernas `sin(dist·0.5)·114.6°`, **bamboleo del cuerpo Z ≈ 23° y Y −4·cos**; pelos con senos de 3–6° en idle.
- Calamar: los 8 tentáculos comparten un mismo pulso X.

### Patrones que se implementaron (resumen; detalle en `TRAILER_estado_y_pendientes.md`)
Las animaciones de cada mob (idle, caminar, correr, orejas, cola, miradas, comer, embestida, saltos) las pone Fresh
Animations tal cual; encima se añadió lo que FA no trae: aullido del lobo, rodadas de cabritos, saltitos de corderos y
pollitos, el terreno real y las rutas sin atravesar bloques. Para el pollito (sin FA):
peso y rebote con resortes (anticipación al arrancar, rebote al frenar), ciclo de patas por distancia, cabeza/orejas/cola
con retraso, miradas con "holds" (gira rápido y se queda), y acciones por mob: aullido del lobo, cabritos que embisten y
ruedan, pollitos que aletean y saltan, strider que se tambalea, aldeano corriendo con los brazos cruzados que rebotan.

## 5. La fuente de los títulos (octubre 2026)

- Es **"Minecraft Ten"**, la tipografía de títulos de Mojang (la de los menús de Bedrock y de minecraft.net). El archivo
  original viene con Minecraft Bedrock: `Content/data/resource_packs/vanilla/font/minecraft-ten.ttf`; sus metadatos dicen
  "(c) 2015-2017 Mojang AB. All rights reserved" y "Minecraft is a trade mark of Mojang AB". Trae 551 glifos (acentos, ¡, ¿).
- Licencia: no es una fuente libre; se usa la copia de TU juego solo en tu PC (`herramientas/packs.py` la copia a
  `texturas_mc/packs/fuentes/`), sin redistribuirla. Las versiones "Minecraft Ten" de sitios de fuentes son de terceros y
  con licencias contradictorias: FontSpace la lista como "Personal Use Free" (<https://www.fontspace.com/minecraft-ten-font-f40317>)
  y online-fonts.com describe otra versión de FontStruct con CC BY-SA 3.0
  (<https://online-fonts.com/fonts/minecraft-ten-font-cyrillic>). No se usaron.
- Estilo en el tráiler de Benly (medido cuadro a cuadro): texto 3D extruido dentro de la escena, cara plana muy saturada,
  extrusión más oscura visible hacia el centro por la perspectiva, letras juntas, renglones casi pegados, sin animación de
  entrada; algunos títulos girados en 3D y uno tapado por los mobs ("NUEVOS DROPS").
