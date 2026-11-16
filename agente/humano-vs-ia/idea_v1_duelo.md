# "Leo vs la IA": el video que hace evidente por qué el camino es la IA

## El problema de la idea obvia (y por qué no sirve)
La idea obvia es poner el mismo video editado a mano y con IA, uno al lado del otro, y que el público elija.
**Eso pierde, o como mucho empata**, por tres razones medidas:

1. **La gente no distingue.** En las pruebas a ciegas, la gente acierta más o menos al azar: 52.4 % con videos de IA
   (Maastricht 2025) y 53.3 % de confusión entre edición humana y de IA (Editvideo.io, 315 personas).
2. **La etiqueta pesa más que el video.** Si la gente cree que algo lo hizo un humano, le pone más de un 30 % de
   preferencia, aunque las etiquetas estén cambiadas (Zhu et al., ACL 2025). Con la Villanova pasó igual con cuentos.
3. **El gusto se discute.** Si el duelo es "cuál quedó más bonito", siempre habrá quien diga "el humano tiene más alma".
   Eso no se gana con argumentos.

Conclusión: **no compitas en belleza; compite en lo que no se discute.** Que la calidad empate (y la prueba a ciegas
demuestra que empata), y que la diferencia quede en tiempo, cantidad, precisión y lo que a mano es imposible.

## La solución: un duelo real con reloj, y un remate que a mano no se puede hacer

**Lo que lo vuelve creíble: Leo edita de verdad un video a mano, con cronómetro y grabación de pantalla.**
Nada de actuarlo. Esos números reales van a `facts.json` como cualquier otro dato.

### El reto
- El mismo guion de 30 s (un TikTok de la serie, p. ej. "El ghast es un gato dormido").
- Los mismos materiales para los dos: voz, música, escenario y mobs.
- **Leo:** lo arma a mano en la interfaz del animador (o en CapCut), con cortes, subtítulos y mezcla. Graba la
  pantalla y deja el cronómetro corriendo, de la primera acción a la exportación.
- **La IA:** `python tiktok/maquina.py todo <slug>`, con la terminal grabada y su propio cronómetro.
- Mismo criterio de calidad para los dos: `revisar` corre sobre **el video de Leo también**. Mide cortes sobre los
  beats, LUFS, pico, imagen quieta y si Whisper entiende la voz.

### Estructura del video (vertical, 61–75 s para que monetice)
| Tiempo | Qué se ve | Para qué sirve |
|---|---|---|
| 0–2 s | Pantalla partida con dos relojes: "LEO 0:00 / IA 0:00". Texto: *"Mismo video. Uno a mano. Otro con IA."* | El gancho es el duelo |
| 2–12 s | **Prueba a ciegas:** los dos resultados terminados, como A y B, sin decir cuál es cuál. *"¿Cuál hizo la IA? Comenta A o B."* | Mete al público, y la respuesta se guarda para el final |
| 12–28 s | El reloj: el timelapse de la pantalla de Leo (horas en 15 s) contra el log de la IA, que termina en minutos. Los relojes siguen corriendo. | **El primer golpe:** el tiempo real medido |
| 28–40 s | La radiografía: los dos videos con sus cortes marcados sobre la onda de la música. Los de la IA caen en el beat (±1 cuadro); los de Leo, a X cuadros. También LUFS y voz. Si Leo gana en algo, **se muestra**. | Precisión que se mide, no gusto. La honestidad da credibilidad |
| 40–58 s | **El remate imposible:** *"Mientras Leo hacía 1…"* La pantalla se llena con la cuadrícula de lo que la IA hizo en ese mismo tiempo: 10, 30, 50 videos distintos (otros mobs, otros datos, versión horizontal, en inglés y en portugués). Cada uno pasó el mismo control de calidad. | **El golpe decisivo.** Esto no se discute: a mano no existe |
| 58–68 s | Respuesta de la prueba a ciegas, y el giro: *"La IA no reemplazó a Leo. Leo pasó de editor a director."* Leo elige la idea y la IA hace el trabajo. | Cierra el argumento sin el rechazo de "te quitan el trabajo" |
| 68–72 s | CTA: *"Comenta qué video quieres y la IA lo hace hoy."* | Lleva a la prueba en vivo (abajo) |

### La solución a la solución: que la prueba la viva el público, no sólo que la vea
Un video se puede discutir. **Lo que el público vive en carne propia, no.** El CTA final abre la segunda parte:

- Al día siguiente, la máquina responde con videos-respuesta (función "responder comentario con video" de TikTok)
  a los **20–30 pedidos más votados**, cada uno con el nombre del pedido en pantalla. Leo los sube a mano, como siempre.
- Se publica la "Parte 2": *"Ayer pidieron 27 videos. Un editor tardaría ~27 h. La IA tardó X."*, con el contador.
- Cada persona que pidió algo y recibió su video ya no necesita que la convenzan. Y la cuenta crece con eso.

## Por qué esto deja la opinión "sin dudas"
- **La calidad empata a propósito:** la prueba a ciegas lo demuestra en vivo, con los comentarios del público.
  Así nadie puede decir "el de la IA es peor".
- **La diferencia está en lo que se mide:** horas contra minutos, beats con ±1 cuadro, LUFS. Son números reales de los
  dos, en `facts.json`.
- **El remate de los 50 videos** es algo que una persona no puede hacer, así que no hay contraargumento.
- **El giro "editor → director"** quita la defensa emocional, y es la verdad de cómo trabaja este proyecto.

## Datos de referencia (para el texto en pantalla; antes van a facts.json con la frase exacta)
- Editar a mano: de 30–60 min por minuto terminado (videos simples) a 1–4 h por minuto
  (Upwork; tastyedits/veedyou). **Mejor usar el número propio de Leo**, que es real y no se discute.
- Prueba a ciegas: 52.4 % de aciertos con videos de IA (Maastricht). 53.3 % confunde la edición de IA con la humana
  (Editvideo.io, una empresa con interés comercial: citar con cuidado o no usar).
- Sesgo de etiqueta > 30 % (Zhu et al., ACL 2025 Findings).

## Riesgos y cómo se cubren
- **"Leo es lento a propósito".** Se graba todo, se muestra el timelapse completo y se cita el promedio de la industria
  como comparación: si Leo está dentro del rango, nadie puede decir que hizo trampa.
- **"La IA tuvo ventaja: el programa ya estaba hecho".** Se dice en el video: *"La máquina tardó semanas en armarse;
  ahora hace 10 al día."* Eso también es el argumento.
- **Voz sintética:** activar "Contenido generado por IA" (ya va en `publicar.txt`).
- **No usar contenido ajeno** (p. ej. el tráiler de Benly) como "el humano": es de otro creador. El humano es Leo.

## Qué hay que construir
1. Leo hace la edición a mano, con cronómetro y grabación de pantalla. **Es lo único que tiene que hacer él.**
2. `revisar` aceptando un mp4 externo (hoy revisa los de la máquina) para medir el video de Leo con las mismas reglas.
3. Una receta de "radiografía": los cortes marcados sobre la onda de la música (librosa + ffmpeg).
4. La cuadrícula de N videos (ffmpeg `xstack`) con contador. Los videos salen de `maquina.py` en lote.
5. El guion como un formato nuevo, `duelo`, en `tiktok/motor/formatos.py`, con la estructura de arriba.
6. Lo de siempre: audio primero, cortes en beats, `ensamblar.py`, `mezcla.py` y una ronda de críticos hasta "ship".

## Fuentes
- https://www.theatdb.com/news/315-person-study-finds-most-viewers-cant-tell-ai-video-editing-from-human-editing-yet-prefer-it
- https://excellence-edlab.maastrichtuniversity.nl/sites/excellenceedlab/files/2026-05/2025-2026%2C%20Media-Steffen%20Kuenn.pdf
- https://arxiv.org/html/2410.03723v2 (Zhu et al., ACL 2025 Findings)
- https://www.thestar.com.my/tech/tech-news/2026/08/06/people-cannot-tell-whether-short-stories-are-generated-by-ai
- https://www.upwork.com/en-gb/hire/video-editors/cost/
- https://www.tastyedits.com/how-long-does-it-take-to-edit-a-video/
- https://www.veedyou.com/how-long-does-it-take-to-edit-a-video/
- https://www.opus.pro/agent/human-creator-vs-ai (formato parecido: duelo en vivo de editores contra IA)
