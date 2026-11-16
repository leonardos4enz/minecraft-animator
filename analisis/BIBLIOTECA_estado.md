# Biblioteca de recursos: todos los mobs y objetos de Minecraft

Estado de la biblioteca (octubre 2026): qué hay, de dónde sale, cómo se comprobó y lo que todavía se ve distinto al juego.

## 1. Qué hay

`python herramientas/biblioteca.py` genera `texturas_mc/biblioteca/indice.json`:

| | Cuántos | De dónde |
|---|---|---|
| Mobs con Fresh Animations | **66** | Modelos `.jem` y animaciones `.jpm` de tu zip de FA (`texturas_mc/packs/fresh/cem/`, ahora los 114 modelos), textura = Bare Bones encima de FA (`texturas_mc/packs/mezcla/entity/`) |
| Mobs con geometría de Bedrock | **12** | `.geo.json` de tu Minecraft Bedrock (dentro de los `.brarchive`), animación básica hecha en `js/mobs.js`. 11 usan la textura de Bare Bones (misma distribución UV); el conejo usa la de Bedrock |
| Mobs propios del tráiler | **14** | Los de antes (pollito, oveja, cordero, cabra, cabrito, aldeano, granjero, aldeanito, lobo, calamar brillante, strider, llama, cubito, Clawd), sin cambios |
| Objetos | **1205** | 690 bloques, 330 objetos, 67 herramientas, 53 armaduras, 45 comidas, 20 armas. Lista y modelos del `.jar` (26.1.2), texturas de Bare Bones o, si falta, del `.jar` (`texturas_mc/biblioteca/item` y `block`) |

**Variantes** (campo `variante` del grupo de mobs, tabla `VARIANTES` de `biblioteca.py`): 18 mobs traen varias texturas,
todas de Bare Bones encima de Fresh Animations (o del `.jar`/Bedrock si falta). La primera es la que sale sin `variante`.

| Mob | Variantes | Extras (se suman con `+`) |
|---|---|---|
| Gato | atigrado, negro, rojo, siames, britanico, calico, persa, ragdoll, blanco, jellie, todo_negro | |
| Caballo | castano, blanco, crema, cafe, negro, gris, cafe_oscuro | patas_blancas, manchas_blancas, puntos_blancos, puntos_negros |
| Rana | templada, fria, calida | |
| Gallina, vaca, cerdo | templada, fria, calida (fría y cálida con su propio modelo de FA: `cold_cow.jem`…) | |
| Ajolote | rosa, cafe, dorado, cian, azul | |
| Loro | rojo, azul, verde, cian, gris | |
| Llama (tráiler) y llama del comerciante | crema, blanca, cafe, gris (la del comerciante empieza en gris) | |
| Champiñaca | roja, cafe | |
| Zorro | rojo, nieve | |
| Aldeano zombi | llanura, desierto, jungla, sabana, nieve, pantano, taiga | 14 profesiones (agricultor, librero, herrero, armero…) |
| Oveja y cordero (tráiler) | los 16 colores de lana (`es_mx`: naranja, azul_claro, verde_lima…), teñida como Java (DyeColor ×0.75) | |
| Conejo (Bedrock) | cafe, blanco, negro, blanco_manchado, dorado, sal_y_pimienta, toast | |
| Panda (Bedrock) | normal, perezoso, preocupado, jugueton, cafe, debil, agresivo | |
| Gólem de cobre (Bedrock) | cobre, expuesto, erosionado, oxidado | |

Nombres en español = los oficiales de tu Minecraft (`es_mx` de Java). Tamaños = cajas de colisión del pack de comportamiento de
Bedrock, con correcciones de Java donde Bedrock usa otro (hoglin, conejo, gallina, abeja, bacalao, creeper, oveja, cabra, dragón).

## 2. Cómo funciona

- **Prioridad**: Fresh Animations + Bare Bones (como el tráiler) > geometría de Bedrock con textura de Bare Bones > Bedrock.
  FA sigue mandando en los mobs que ya cubría y `podarTransparentes` se aplica a todos (también a los de Bedrock).
- **Pose vanilla de FA** (`js/cem.js`): EMF cuelga cada parte de FA de la parte vanilla de Java, con su pose. Esa pose y
  jerarquía (qué parte cuelga de cuál: brazos de la rana del cuerpo, orejas de la cabeza…) se calcula de la geometría de Bedrock
  (`indice.json → vanilla`) y encima va una tabla escrita a mano con lo que se sabe del código de Java (`MANUAL`: humanoides,
  piglins, illagers, caballos, araña, guardianes, abeja, gato/ocelote, gólem de hierro). La tabla de los 9 mobs del tráiler no se tocó.
- **Lo que el `setupAnim` vanilla hace y FA lee**, emulado: varas del blaze en tres anillos que giran, púas del guardián,
  tentáculos del ghast, y la inclinación de la cabeza se **suma** a la de reposo (el hoglin mira de frente).
- **Geometría de Bedrock** (`js/mobs.js → armarBedrock`): huesos con pivote, rotación, cubos con UV de caja o por cara,
  cubos girados e inflado; `bind_pose_rotation` gira solo los cubos del hueso; la pose de reposo sale de la parte constante de
  sus animaciones de movimiento (Molang evaluado con todo en 0: el cuerpo del oso polar baja 9 px, el del panda va a 90°).
  Animación básica por nombre de hueso: patas en pares diagonales (cuadrúpedos) o alternadas (bípedos), brazos al revés de las
  piernas, cabeza que mira, alas que aletean, colas que se mecen.
- **Marchas nuevas** en la simulación: `volar` (a ~1.6 bloques, vaivén, FA recibe "en el aire"), `nadar` (FA recibe "en el
  agua") y `saltar` (avanza a saltos: conejo, slime, cubo de magma).
- **Objetos** (`js/objetos.js`): un cubito por pixel de la textura (igual que el cuerno del tráiler, que sigue saliendo de
  `texturas_mc/item/goat_horn.png`); los bloques son un cubo. LTezla: las herramientas (espadas, picos…) con la empuñadura en el
  puño y la hoja hacia adelante y arriba; lo demás como el cuerno. Mobs: en el brazo derecho (o en los brazos cruzados del aldeano).

## 3. Cómo se comprobó

- **Galería**: los 92 mobs quietos, de 2 en 2 y de 3 en 3, en la pradera (hojas de contactos, `agente.py hoja`), y una fila de
  6 junto a LTezla para la escala. 15 caminando (zombi, esqueleto, creeper, cerdo, vaca, caballo, araña, gólem, enderman, panda,
  conejo, warden, rana, abeja, piglin).
- **`revisar`** con los 92 caminando: **0** problemas de física (metidos en bloques, flotando, hundidos).
- **`traza`**: la mayoría bajo 12. Altos y revisados a ojo: abeja, murciélago, phantom, renacuajo, peces, blaze, slime, cubo de
  magma, conejo, endermite (aletean, saltan, nadan o giran: es su animación, no temblor).
- **Tráiler sin cambios**: 10 cuadros (1.4, 3.5, 5.6, 9.75 con el cuerno, 13, 19.5, 23, 26.5, 32, 39.5 s) sacados con el
  exportador (`clip`) contra `Videos/LTezla_trailer_1080p_redes.mp4`: diferencia media **0.3–4 / 255** (compresión). Ojo: el
  comando `cuadro` no aplica el desenfoque de movimiento del exportador, por eso comparado con `cuadro` salen 5–31.
  `proyectos/trailer-bobicraft-ltezla.json` se reescribió una vez al cambiar de proyecto en la interfaz, con el mismo contenido
  (comparado campo por campo con otra copia de la plantilla: solo cambian los ids internos).
- **Vlog**: renderiza normal.
- **Variantes**: 9 hojas de contactos con todas las de la tabla (`analisis/variantes/var_toma1..9.jpg`: gatos, caballos con
  marcas, ranas y ajolotes, loros/zorros/champiñacas, llamas, aldeanos zombi bioma+profesión, 16 ovejas, granja fría/cálida,
  conejos/pandas/gólems). El selector del inspector guarda la variante en el proyecto; `agregarMob`/`mob` la validan (acepta
  nombre, id de Java, sin acentos ni género; si no existe, el error da las opciones). Los mobs del tráiler sin `variante`
  siguen por el mismo camino de antes (misma textura y misma clave de caché); `proyectos/trailer-bobicraft-ltezla.json` no se
  tocó (mismo hash). No se volvió a comparar el video cuadro a cuadro.

## 4. Lo que no funciona o se ve distinto al juego (honesto)

**Mobs**
- **Dragón del End**: cuello y cola cuelgan sin su pose (Bedrock los acomoda con Molang en su animación `setup`, que no se evalúa).
- **Wither**: geometría de Bedrock con animación básica; no gira las tres cabezas.
- **Gólem de nieve**: sin la cabeza de calabaza (en el juego es un bloque dibujado aparte).
- **Los 12 de Bedrock** usan animación básica hecha aquí, no la de Bedrock ni la de FA (FA no los trae): caminan y miran, pero no
  hacen sus acciones (el armadillo no se enrolla, el camello no se sienta, el warden no ruge, el breeze no salta).
- **Ocelote** (y a veces el gato) se sienta solo cuando está quieto: es una pose al azar de FA.
- **Slime**: la capa de afuera es translúcida pero sin el brillo del juego.
- **Variantes**: ver §1. Faltan: lobo (es del tráiler: sus 9 pelajes están en los packs, sin tocar), peces tropicales (su
  textura se tiñe en el juego), insignia de nivel del aldeano zombi. La llama gris
  de Bare Bones es muy clara: con luz de día se parece a la blanca. El aldeano zombi sin `variante` ahora lleva la ropa de
  llanura (antes salía solo la piel), como en el juego.
- **Crías** (`bebe: true`): se escalan a la mitad; FA ajusta proporciones solo en algunos.
- **Ojos que brillan** (enderman, araña, phantom, warden) sin emisión; armaduras y sillas de montar solo en el lobo y la llama.
- **Voladores** vuelan a altura fija con vaivén (no hay rutas en 3D). Los acuáticos "nadan" a 0.6 bloques del suelo aunque no
  haya agua.
- `traza` marca como sacudida el aleteo de abeja, murciélago y phantom (ver §3).
- **`rot_y` de FA**: FA lo espera en radianes; el código del tráiler se lo pasaba en grados. Se corrigió solo para los mobs
  nuevos: los del tráiler (oveja, aldeanos, cabra…) siguen en grados porque el video se afinó así. Corregirlo cambia sutilmente
  cómo se inclinan al girar.

**Objetos**
- **24 objetos se ven grises** porque en el juego se tiñen: hojas, bloque de pasto, caña de azúcar, armadura de cuero, pociones,
  flechas con efecto, estrella de fuegos artificiales, mapa lleno.
- **Bloques que no son cubos** (escaleras, losas, vallas, puertas, trampillas, carteles…) se tienen en la mano como un cubo con
  su textura. Objetos con modelo especial (cama, escudo, cofre, cabezas, estandartes) usan su textura plana.
- En la mano de los mobs, la posición es aproximada (no las transformaciones exactas de Java). Los cuadrúpedos no sostienen nada
  (el zorro no lleva cosas en la boca).
- Huevos de aparición: no se incluyen.

**Interfaz**
- Las miniaturas de los mobs se dibujan al abrir la biblioteca (unos segundos la primera vez) y no se guardan entre sesiones.
- El inspector de la toma edita qué hacen, cuántos, el objeto y quitar; la posición exacta, rutas y acciones siguen siendo por
  el agente (`mob`) o editando el proyecto.

## 5. Archivos

```
herramientas/biblioteca.py   copia FA, Bare Bones, Bedrock y .jar a texturas_mc/ y escribe el índice (correr de nuevo si cambian)
herramientas/bedrock.py      lector de .brarchive y de los packs vanilla de Bedrock (geometrías, entidades, texturas, colisiones)
js/objetos.js                objetos en la mano (extruidos y bloques)
js/recursos.js               diálogo "Biblioteca de Minecraft" e inspector "Mobs de la toma" (con selector de variante)
js/mobs.js / js/cem.js       tipos de la biblioteca, geometría de Bedrock, marchas nuevas, poses vanilla y emulación de setupAnim
```
