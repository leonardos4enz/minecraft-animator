# La máquina de TikToks de LTezla

Genera TikToks verticales (1080×1920, 30 fps) con Minecraft Animator, de punta a punta y **sin abrir ventanas**: guion →
voz → animación → render → subtítulos → mezcla → control de calidad → carpeta lista para subir. Leo sólo sube el video a mano
y, a las 72 h, anota los números para que la máquina aprenda.

- Estrategia y fuentes: [`tiktok/investigacion.md`](tiktok/investigacion.md). Las reglas medibles están en [`tiktok/estrategia.json`](tiktok/estrategia.json).
- Datos verificados: [`tiktok/hechos/banco.json`](tiktok/hechos/banco.json) (55, con cita y URL) y [`tiktok/hechos/mitos.md`](tiktok/hechos/mitos.md).
- Motor: `tiktok/motor/` · CLI: `python tiktok/maquina.py` (sin argumentos muestra la ayuda).
- Ejemplo completo: `tiktok/videos/ghast-gato/` ("El ghast es un gato dormido").

## Qué publica el canal (desde el 17 oct 2026)

Minecraft es **el estilo** (bloques, mobs, LTezla); **el tema es el mundo real**. Cada día salen 5 videos, uno por pilar
(`estrategia.json → pilares`), y los produce la **tarea programada "TikToks de LTezla: 5 videos del día"** a las 3:00 (fuera de hora pico)
siguiendo [`tiktok/rutina_diaria.md`](tiktok/rutina_diaria.md):

| Hora | Pilar | Formato | Material |
|---|---|---|---|
| 12:30 | Lo nuevo | `noticia` | `tiktok/hechos/banco_mundo.json` (tipo noticia, ≤ 48 h) |
| 14:30 | Latam en bloques | `sketch` | `tiktok/hechos/latam.json` |
| 17:00 | Curiosidad a escala / Debate | `curiosidad` · `debate` (alternan) | `banco_mundo.json` (tipo curiosidad) |
| 19:00 | Meme del momento | `meme` | `tiktok/hechos/memes.json` (sólo "subiendo" o "en su pico") |
| 20:30 | Bloquenovela | `novela` | `tiktok/novela/biblia.json` (reparto, arcos, capítulos) |

- Estrategia del nicho y fuentes de tendencias: [`tiktok/investigacion_nicho.md`](tiktok/investigacion_nicho.md).
- El banco de Minecraft (`hechos/banco.json`) queda como reserva.
- `plan` elige un video por pilar sin empalmar:
  - ningún dato, premisa o meme se repite (el mismo meme no vuelve antes de 7 días);
  - la categoría de un pilar no se repite en 2 días;
  - hay una lista negra de temas.
- `preparar` deja cada guion con su material en `_notas`.

### Bloquenovela ("Pasiones en la Granja")
- **Reparto:**
  - Clotilde: vaca, voz Icónica;
  - Ramiro: cerdo, voz MexiTony;
  - Fiona: gata siamesa, voz Fruna;
  - Don Hierro: gólem de hierro, voz Miguel Zermeño;
  - LTezla: el granjero y narrador.
- En el guion: `"reparto"` y, en cada línea, `"quien"`. Cada personaje habla con su voz. Sólo cuando habla LTezla se
  mueve su boca; los mobs asienten con la cabeza mientras hablan.
- **Receta `dialogo`:** los dos personajes a ¾ hacia la cámara, como en las telenovelas. Planos:
  - `dos`;
  - `hombro`;
  - `primer`;
  - `zoom`: el zoom dramático, con su golpe. En líneas cortas (≤ 2 s) el golpe tapa la voz y `voces_parejas` mide sólo la
    cola: usa `"golpe": false` en la toma y pon `["golpe", "fin", …]` en los `sfx` de la línea (19 oct 2026).

  Campos: `"con"` (el otro personaje) e `"izq"` (quién va a la izquierda, por continuidad). La cámara apunta a la cabeza
  real de cada mob: en los de cuatro patas está adelante del cuerpo.
- **Lo que tumbó a las frutinovelas y aquí no se hace:** lo sexual, la violencia o el "canibalismo" y los roles misóginos.
- Ejemplo: `tiktok/videos/novela-granja-cap01/` (entregado en `Videos/TikTok/002_…`).

## Cómo se usa cada día (resumen)

| Quién | Qué | Dónde |
|---|---|---|
| Claude (rutina diaria) | Investiga tendencias, suma datos verificados, planea `por_dia` videos sin repetir temas, escribe los guiones, renderiza, pasa críticos y limpia el disco | [`tiktok/rutina_diaria.md`](tiktok/rutina_diaria.md) |
| Leo | Abre el panel: arriba está el **siguiente** video con su hora y cuánto falta, y 3 pasos: ① *Abrir el video* (el Explorador con el mp4 seleccionado, para arrastrarlo a TikTok; `POST /api/tiktok/abrir`, sólo carpetas de `Videos/TikTok`) ② *Copiar descripción* ③ *Ya lo subí* (lo marca y pasa al siguiente). Leo no publica comentarios fijados: el panel no los ofrece. Los pasos hechos quedan con ✓ (en el navegador); los subidos se pliegan abajo. A las 72 h anota las métricas. Escribe ideas | Acceso directo **TikToks LTezla** del escritorio, o el botón **TikToks del día** al abrir el animador (`/tiktok/panel.html`) |
| La máquina | Con las métricas ajusta el peso de cada formato en el plan. Si las vistas por video caen > 30 % en una semana, avisa que se baje el ritmo | `tiktok/aprendizajes.md` / `.json` |

### Volumen: 10 videos al día
- Está en `estrategia.json → publicacion.por_dia`. La ventana va de 08:00 a 23:30, con unos 90 min entre video y video.
- Ningún estudio mide 10 al día: el dato más alto es 11+ por **semana**, con +34 % de vistas por video. Lo que sí se sabe:
  - publicar más sube la probabilidad de un video que explote;
  - lo producido en masa, poco original y repetido se castiga.
- Por eso el sistema cuida tres cosas:
  - variedad (ningún dato se repite; un mob no vuelve antes de 3 días; máximo 4 por tema y 6 por formato al día);
  - un control de calidad que bloquea;
  - la alarma de volumen en `metricas`.
- A 10 por día, el banco de datos se gasta en ~4–5 días. Por eso la rutina suma ≥ 10 datos verificados por día, y el
  formato `historia` (sketches) no gasta datos.
- Costo: unos 3.000–4.000 caracteres de ElevenLabs al día (~100.000 al mes, más las repeticiones). Revisa que tu plan los cubra.

### Espacio en disco
- Antes, cada video de 20 s ocupaba ~243 MB.
- Al entregar se borra todo lo que se puede regenerar desde el proyecto `agente/proyectos/tt-<slug>.json`: tramos, wav,
  imagen con subtítulos y copias de salida. Queda ~21 MB de trabajo + ~55 MB de entrega.
- 14 días después de marcar un video como subido, se borran el mudo y las versiones "sin musica" y "solo musica". Queda el
  video final, el guion, los datos y las métricas.
- Todo se ajusta en `estrategia.json → almacenamiento`; `python tiktok/maquina.py limpiar` lo corre a mano.

## Requisitos

1. El servidor encendido: la vista previa `animator` de `.claude/launch.json` (o `python servidor.py`).
2. Una vez: `python tiktok/maquina.py kit`. Genera 6 músicas de 48 s (misterio, comedia, épico, terror, chill y noticia) y
   12 efectos con ElevenLabs. Les mide el bpm, los beats y el pico.

## Un video, paso a paso

```
python tiktok/maquina.py ideas                       # datos sin video, de más a menos potencial
python tiktok/maquina.py nuevo golem_flores          # borrador: tiktok/videos/golem-flores/{guion,facts}.json
  … afinar el guion (abajo) …
python tiktok/maquina.py validar golem-flores
python tiktok/maquina.py armar golem-flores          # voces + Whisper + línea de tiempo + proyecto + poses
python tiktok/maquina.py hojas golem-flores          # un cuadro por toma: MIRARLO antes de renderizar
python tiktok/maquina.py todo golem-flores           # render → final → revisar → entregar
```

Por día: `plan MAÑANA` → `preparar MAÑANA` → afinar guiones (`"afinado": true`) → `dia MAÑANA`. `lote a b c` corre `todo` para varios videos, uno detrás de otro. Si uno falla, sigue con el siguiente. Cada video tarda
unos minutos de render por cada 10 s de video. `estado` muestra en qué paso va cada uno.

## El guion (`tiktok/videos/<slug>/guion.json`)

```json
{
 "slug": "ghast-gato", "titulo": "El ghast es un gato dormido", "formato": "sabias_que", "objetivo": "crecer",
 "musica": "misterio", "escenario": "nether", "ambiente": "nether", "clave": "ghast",
 "gancho_pantalla": "EL GHAST ES UN GATO",
 "voz": {"motor": "eleven", "id": "wXojZ3FhzsE0AumH6Oym", "modelo": "eleven_multilingual_v2"},
 "lineas": [
  {"id": "L1", "texto": "El ghast que te asusta en el Nether... es un gato dormido.", "hechos": ["ghast_gato_c418"],
   "tomas": [{"receta": "mob", "mob": "ghast", "plano": "medio"},
             {"receta": "mob", "mob": "gato", "escenario": "pradera", "ambiente": "dia", "en": "gato"}],
   "sfx": [["golpe", "inicio", 0.8]]}
 ],
 "descripcion": "Por qué el ghast suena así en Minecraft…", "hashtags": ["#minecraft", "#ghast", "#curiosidadesminecraft"],
 "pregunta_comentarios": "¿Qué otro sonido quieres que investigue?"
}
```

- **Una línea = una frase de voz.** Su primera toma entra en el beat más cercano a la frase. Las demás tomas entran en
  la palabra `"en"`. Si una toma pasa de 3.6 s, la máquina la parte sola en dos ángulos.
- **`hechos`**: cada línea que afirma algo cita un id de `facts.json`, con la frase exacta de la fuente y su URL (la regla
  de CLAUDE.md). Las líneas que no afirman nada (chistes, CTA) llevan `"afirma": false`.
- **`sfx`**: `[nombre, "inicio" | "fin" | "palabra:<w>" | segundos, volumen]`. Dos tipos de nombre:
  - **Kit de ElevenLabs:** whoosh, pop, golpe, glitch, ding, error, tictac, subida, explosion, risa, brillo, rasguno, aplauso (propio, 21 oct 2026: no es el audio de ningún meme).
  - **Sonidos REALES de Minecraft:** `"mc:<evento del juego>"`, p. ej. `"mc:entity.ghast.scream"`,
    `"mc:entity.cat.hiss"`, `"mc:entity.player.levelup"`, `"mc:block.chest.open"`. La lista completa (1844 eventos) está en
    `texturas_mc/sonidos/indice.json`.
  - Las copia `python herramientas/sonidos.py` de tu Minecraft Java instalado: unos 4.458 archivos, 83 MB, sólo para uso
    local, como las texturas. No copia la música ni los discos (C418 y otros), porque tienen derechos aparte y dan reclamos
    de copyright.
- **Cada toma `mob` suena sola** con el sonido real de su mob (`entity.<id java>.ambient`). En la toma se puede pedir
  `"sonido": "hurt" | "death" | false` y `"vol_sonido"`. La receta `explosion` usa la explosión real del juego.
- `escenario` y `ambiente` se pueden cambiar por toma. Escenarios probados en vertical: pradera, nieve, noche, cerezos,
  nether y aldea.
- `voz` es opcional: si falta, se usa `estrategia.json → voz.defecto` (David C). Para un personaje, copia uno de `voz.personajes`.
- Muestras de todas las voces probadas: `Videos/TikTok/_muestras_voz/`. Para buscar más voces juveniles en la biblioteca
  (sólo lectura): `herramientas/eleven.py biblioteca '{"language":"es","age":"young"}'`.

### Recetas de toma (`tiktok/motor/recetas.py`)

| receta | qué es | campos |
|---|---|---|
| `presentador` | LTezla le habla a cámara (lip-sync con la voz) | `pose`, `pose2`, `cara`, `plano` (medio · primer · completo), `objeto`, `mob` (a su lado), `variante`; `camina` (metros que avanza hacia la cámara), `el` (altura de la cámara en °, negativa = plano bajo), `ty` (a qué altura apunta: 0.45 = piernas, como en los trends de caminata), `matices` (extra, p. ej. `[["caminar", 1]]`) |
| `reaccion` | LTezla en primer plano con un empujón rápido | `pose` (sorpresa, miedo, facepalm, risa_atras, pensar…), `cara`, `temblor`, `tiembla` |
| `mob` | un mob protagonista; la cámara gira y se acerca | `mob`, `variante`, `plano`, `modo` ("caminar" = viene a cámara), `accion`, `objeto`, `bebe`, `extras` |
| `versus` | dos mobs lado a lado con etiqueta 3D | `a`, `b`, `etiqueta_a`, `etiqueta_b` |
| `horda` | muchos mobs vienen hacia la cámara | `mob`, `n`, `modo` |
| `numero` | un número 3D que cuenta (`"{v} BLOQUES"`). El texto se achica solo para caber en el ancho (`ancho_texto`). Con `mob` chico el texto queda muy arriba: mejor sin `mob` (LTezla) y la toma ≤ 3.6 s para que no la parta | `texto`, `desde_v`, `hasta_v`, `dec`, `mob` (o LTezla) |
| `explosion` | el mob se infla y revienta (con su sonido) | `mob`, `t` |
| `paisaje` | plano general con mobs paseando | `mobs`, `con_ltezla` |
| `objeto` | un objeto a medida de la biblioteca (`tiktok/modelos/`) como protagonista: teléfono, ballena, cohete, trofeo, foco, tele… | `modelo`, `escala`, `giro`, `gira` (°/s), `flota`, `pop`, `plano`, `con_ltezla` (LTezla al lado: da la escala), `pose`, `cara` |
| `cuadro` | una imagen en el mundo como pintura con marco de madera (pixelada) o pantalla | `imagen` (nombre en `tiktok/imagenes/`), `ancho`, `con_ltezla`, `plano`, `luz` (> 1 = pantalla que brilla), `marco`, `pixel` |

**Objetos y cuadros en cualquier toma (`fx`):** cualquier toma acepta `"fx": [...]` con efectos extra de `js/efectos.js`, por
ejemplo `{"tipo": "voxel", "modelo": "trofeo", "pos": [-0.8, 0, 0.2], "pop": 0.3, "desde": 0}` o
`{"tipo": "cuadro", "imagen": "fantasma_bu", "pos": [1.5, 1.4, -0.5], "ancho": 1.6}`.

### Objetos a medida: no sólo Minecraft vanilla (`tiktok/motor/modelos.py`)
- **Biblioteca** en `tiktok/modelos/<nombre>.json` (cajas de colores; 1 bloque = 1 m). `python tiktok/motor/modelos.py lista`.
  De ejemplo (`modelos.py base`): `telefono_plegable`, `ballena_azul` (33 bloques), `cohete`, `trofeo`, `foco`, `tele`, y el
  dibujo `fantasma_3d`.
- **Crear uno nuevo:**
  - desde Python con `caja`, `cilindro`, `esfera`, `cono` y `guardar(nombre, cajas)`; lo que lleva `brilla` no recibe luz y
    brilla con el bloom (pantallas, fuego, focos);
  - desde un dibujo ASCII con paleta: `modelos.py dibujo <nombre> <archivo.txt> [prof]` (sale el modelo 3D y el PNG);
  - desde una imagen con transparencia: `modelos.py imagen <nombre> <img> <ancho_bloques> [prof]`.
- **Cuadros:** `modelos.py pixelar <img> <nombre>` deja la imagen con look de Minecraft en `tiktok/imagenes/`. El dibujo
  ASCII también genera su PNG.
- **Memes en cuadros:** se **recrea** la plantilla con un dibujo propio (pixel art), nunca la foto original: casi todas tienen
  dueño o salen personas reales. Nada de logotipos de marcas.
- El Roadster de bloques sigue siendo su propio efecto (`roadster` en `js/efectos.js`, con física y propulsores).
- Lo que aprendí al probarlo:
  - el actor de la toma **es** LTezla: para ponerlo junto a algo se mueve el objeto, no el actor;
  - los objetos gigantes (la ballena de 33) quedan lejos y con neblina en vertical: mejor un plano parcial (`giro` 30–40°,
    `plano` medio) o una `escala` menor con un número que diga el tamaño real;
  - después de cambiar `js/` hay que correr `herramientas/agente.py --reiniciar` (la página del agente guarda el JS viejo).

Los nombres válidos de poses, expresiones y mobs están en `tiktok/motor/catalogo.json` (lo genera `catalogo`).
**Encuadre vertical:** el lente de 40° deja sólo ~23° de ancho, por eso la receta calcula la distancia con el ancho, el alto y
la profundidad del mob. Los mobs que vuelan se miran 1.6 bloques más arriba, y los blancos (ghast, gólem de nieve…) llevan
menos bloom.

## Formatos (series) — `tiktok/motor/formatos.py`

| formato | estructura | música |
|---|---|---|
| `sabias_que` | gancho-contradicción con el mob en el cuadro 0 → contexto → dato → giro → remate que hace loop | misterio |
| `mito` | "¿Es verdad que…?" → LTezla duda → veredicto (ding/error) → prueba → "¿cuál pruebo ahora?" | comedia |
| `versus` | los dos lado a lado + pregunta → dato A → dato B → resultado → pregunta a comentarios | épico |
| `noticia` | "Esto acaba de llegar a Minecraft" → qué es → 2 cosas → versión → remate | noticia |
| `historia` | mini sketch de LTezla: clímax en el cuadro 0 → problema → giro → remate en loop | comedia |

## Reglas que la máquina mide (`revisar` → `revision.json`)

**Bloquean la entrega:**
- formato 1080×1920 a 30 fps, con cuadros = duración × 30;
- −14 ±1 LUFS y pico ≤ −1 dBTP;
- el cuadro 0 no es negro;
- Whisper oye el guion en la mezcla (similitud < 0.7 bloquea);
- todas las líneas que afirman algo citan un hecho.

**Avisan:**
- duración (22–40 s para crecer, 61–75 s para monetizar);
- la voz entra antes de 0.5 s y la primera frase termina antes de 3.2 s;
- la palabra clave se dice antes de 5 s y está en el texto-gancho;
- ninguna toma pasa de 3.6 s;
- imagen quieta ≤ 1 s cada 30 s, sin ningún tramo de más de 0.5 s;
- la voz va a 140–185 palabras por minuto;
- la descripción tiene ≤ 150 caracteres y 2–4 hashtags, sin #fyp ni #viral.

**Por construcción:**
- **todas las voces suenan igual de fuerte** (pedido de Leo, 18 oct 2026): `mezclar` (`tiktok/motor/post.py`) mide cada
  línea y la lleva a `VOZ_LUFS` (−18 LUFS) antes de mezclar. Las voces de personajes de ElevenLabs (Icónica, Fruna,
  MexiTony) salen 6–10 dB más bajas que la de LTezla, y la de Don Hierro, más alta. No quitar este paso; si una voz
  nueva suena rara, se ajusta `VOZ_LUFS`, no el volumen de cada voz a mano. La mezcla llega a −14 LUFS con ganancia
  fija + limitador, **sin `loudnorm` dinámico** (de una pasada subía los primeros 3–5 s y dejaba el gancho 3–4 LU más
  bajo). `revisar` mide cada línea en `sin_musica.wav`, en el tramo sin efectos encima (`voces_parejas`: avisa > 2 LU,
  bloquea > 3 LU). Si los golpes tapan las voces, se bajan los `sfx` de esas líneas;
- subtítulos palabra por palabra en Minecraft Ten, centrados en x = 510 con la base en y = 1200: dentro de la zona segura
  x∈[120, 900], y∈[240, 1260], que libra los botones de la derecha y el texto de abajo;
- texto-gancho 3D arriba (y ≈ 480) durante los primeros ~2.5 s, con un pop.

Después del control automático va la **ronda de críticos de CLAUDE.md**, con subagentes nuevos:
- lectura sin sonido: `critica/mudo_2fps.jpg`;
- técnico: `revision.json` + `timing.json`;
- director + verificación de datos.

Como un TikTok dura 20–40 s y la mayoría de los chequeos técnicos ya son automáticos, basta con una ronda corta por
video. Se anota en `tiktok/videos/<slug>/ledger.md` y se itera hasta "ship".

## Lo que recibe Leo: `Videos/TikTok/NNN_<slug>/`

- `<Título>.mp4`: voz + música + efectos + subtítulos.
- `<Título> - sin musica.mp4`: para ponerle un **sonido en tendencia** en la app, bajito (5–10 %).
- `<Título> - solo musica.mp4`.
- `portada.jpg`: el cuadro de 1 s, con el texto-gancho.
- `publicar.txt`: descripción con hashtags, horario sugerido, el aviso de activar "Contenido generado por IA" (la voz es
  sintética), el comentario para fijar y las fuentes.

## Bucle de aprendizaje

1. Leo exporta de TikTok Studio (Estadísticas → pestaña **Resumen** y pestaña **Contenido** → rango de 60 días →
   **Descargar datos**, arriba a la derecha) y deja los zip en `Videos/TikTok/metricas/tiktok_studio_exports/`. La rutina
   corre `python tiktok/maquina.py importar` (cuenta → `tiktok/metricas/cuenta.csv`; por video → `publicaciones.csv`).
   TikTok sólo guarda 60 días y va ~1 día atrasado. El tiempo medio, el % completo y el % "Para ti" no salen en el export:
   a las 72 h Leo los anota en el panel (o se leen en "Ver datos" de cada video).
2. `python tiktok/maquina.py metricas` → `tiktok/aprendizajes.md`:
   - tabla por formato;
   - "Parte 2" para los videos sobre el percentil 90;
   - "cambia el gancho" si menos del 30 % los ve completos.
3. El siguiente lote se arma con más peso para los formatos que mejor retienen. Cada A/B cambia una sola cosa.

Ritmo recomendado: 3–5 videos por semana, con ≥ 20 h entre uno y otro (Buffer: más publicaciones = más probabilidad de un
video que explote, no un video típico mejor). Usa una cuenta **personal**: el Creator Rewards excluye las cuentas de empresa
y pide videos de > 1 min. Para eso está `"objetivo": "monetizar"` (61–75 s).

## Voz

| motor | cuándo | nota |
|---|---|---|
| `eleven` (por defecto) | videos que se publican | **David C - Viral Storytelling** (`qRUgOhnxGASxirG4fKjv`), elegida por Leo el 17 oct 2026. El plan de pago da derechos comerciales |
| `eleven`, personajes mujer | cuando habla un personaje femenino | **Fruna** (`2CGcaXd1E04jesxY7nfq`, juguetona) e **Icónica** (`G5fUGgDJhRU7jqXTv65B`, vibrante): de la biblioteca de ElevenLabs. Funcionan directo por su id, sin agregarlas a la cuenta (la API key no tiene permiso `voices_write`). Ids en `estrategia.json → voz.personajes` |
| `edge` (`es-MX-JorgeNeural`, gratis) | borradores y pruebas | Su uso comercial sin Azure no está claro: no publicar con ella si se monetiza |
| **voz de TikTok** | sólo dentro de la app | No hay API oficial. Las librerías piden la cookie `sessionid`, que es la credencial de la cuenta, y van contra los Términos: **no se usa**. Si Leo la quiere: subir la versión sin voz y añadir el TTS a mano en el editor (Aa → Texto a voz) |

Las voces se verifican con Whisper. Whisper escucha mal los nombres en inglés ("ghast" → "gas", "C418" → "Secure 68"):
una similitud de 0.85–0.9 en esas líneas es normal.

## Pendiente / ideas para crecer la máquina

- Velocidad de la voz de ElevenLabs. `voice_settings.speed` requiere añadir la velocidad a la firma de caché de
  `servidor.py`. Hoy algunas líneas salen a ~250 ppm.
- Más recetas: "objeto en primer plano", "antes/después", "POV" con la cámara en primera persona (`vlog`).
- Escenarios de agua y cresta para vertical: medir la zona plana antes.
