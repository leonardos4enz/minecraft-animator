# El creeper era un cerdo — brief

La consigna llegó con todas las líneas en blanco ("aplícalo en un nuevo video de Minecraft"), así que decidí cada una. Abajo va la elección y el porqué en una línea.

| Línea | Elección | Por qué |
|---|---|---|
| **mode** | explainer | El origen del creeper es una sola causa y su efecto (un error en el modelo del cerdo → el mob más famoso). Es la forma exacta de un explainer. |
| **subject** | Cómo nació el creeper: un cerdo con el alto y el ancho cambiados | Es un dato real y documentado (minecraft.net, "Meet the Creeper") que se puede *mostrar* con los modelos del juego en vez de contarlo. |
| **viewer** | Jugadores hispanohablantes de 10 a 25 años que ven Shorts/Reels/TikTok de Minecraft | Ya conocen al creeper y al cerdo; lo que les importa es la sorpresa de "¿en serio era un cerdo?". |
| **end state** | Que sientan "¡no puede ser!" y sepan que el creeper es un cerdo mal programado | La sorpresa es lo que hace que lo compartan. |
| **length** | 41 s, 16:9, 1920×1080 | Le da al guion de 8 líneas aire entre frases; 16:9 es el formato del canal (los cortos anteriores del kit son 16:9). Una versión 9:16 recompuesta queda como trabajo aparte. |
| **frame rate** | 30 fps | Es animación de personajes (LTezla y mobs). |
| **brand** | La serie de LTezla: Minecraft Ten para los títulos, verde creeper + rosa cerdo + crema del sol | Sigue a los cortos anteriores del kit. La paleta sale de las dos texturas reales que se transforman. |
| **facts** | `facts.json` (minecraft.wiki → minecraft.net "Meet the Creeper", 15 may 2017) | Es la única fuente de lo que se dice en pantalla y en la voz. |
| **assets** | Modelos y texturas del juego que ya están en el kit (Fresh Animations + Bare Bones, copiados de la PC del usuario) y la skin de LTezla | No se redibuja nada: el cerdo y el creeper del video usan las texturas reales del juego. |
| **style** | Animación de Minecraft "de cine" del kit: render ACES, DOF, mobs de Fresh Animations | Es el estilo de los cortos que ya hizo el kit, con los tráileres oficiales de Minecraft como referencia de nivel. |
| **sound** | voz + música + efectos | Un explainer necesita narración. La voz es la de LTezla, por continuidad. |
| **autonomy** | sin pausas (no se detiene en cada ◆) | El pedido fue de una línea, sin revisiones intermedias; las decisiones se anotan aquí y en `ledger.md`. |
| **toolchain** | El kit de este repo: Minecraft Animator (three.js, render cuadro a cuadro, ffmpeg) controlado por `herramientas/agente.py` | Es el kit del proyecto; ya tiene render, exportación y audio con ElevenLabs. |
| **sign-off** | Título "EL CREEPER / ERA UN CERDO" + crédito de la fuente; remate: un cerdo entra al cuadro y hace "oink" | Cierra el chiste con el cerdo "inocente". No hay CTA de marca porque no se vende nada. |

**Voz:** probé dos tomas por línea con la voz de LTezla (A = eleven_v3 con emociones, B = multilingual_v2, y una C cuando las dos fallaron con Whisper). No audicioné una segunda voz porque LTezla ya tiene voz en la serie y cambiarla rompe la continuidad.
