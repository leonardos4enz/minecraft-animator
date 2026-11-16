# Qué le falta a "Rush E en bloques" para ser viral (investigación, 19 oct 2026)

Tres subagentes nuevos investigaron por separado: referentes virales, algoritmo de TikTok y psicología/narrativa.
Las views de YouTube son del 19 oct 2026 (returnyoutubedislikeapi). Lo que es de blogs y no tiene fuente oficial va marcado.

## Referentes (lo medido)
| Video | Views | Qué lo hizo despegar |
|---|---|---|
| Wintergatan, *Marble Machine (… 2000 marbles)* | 292,7 M | escala en el título; cada nota tiene una causa visible |
| Sheet Music Boss, *RUSH E* | 119,1 M | meme + "imposible para un humano" |
| Mark Rober, *Robot Piano Catches Fire Playing Rush E* | 54,8 M | máquina al límite y catástrofe (humo) prometida en el título |
| Grandayy, *Coffin Dance Note Block Cover* | 21,5 M | canción meme en su pico |
| Animusic, *Pipe Dream* | 17,6 M | cada nota la toca un objeto visible |
| TheWolfBone, *Megalovania note blocks* | 14,2 M | canción meme gamer |
| **CurvedTurtle, *Rush E But it's MINECRAFT (17077 note blocks)*** | **4,8 M** | "X but it's Minecraft" + número absurdo. **El más parecido al nuestro** |
| SepthGear, *RUSH E IMPOSSIBLE MINECRAFT COVER* | 1,26 M | "IMPOSSIBLE" |
| SepthGear, *RUSH E 1+2+3* (secuela) | 458 k | la secuela rindió un tercio |
| Tutoriales de Rush E en note blocks | 23–52 k | utilidad, no espectáculo |
| Black MIDI de Rush E ("1,6 M / 1.700 M de notas") | 156–62 k | número enorme sin nada que ver |

Misma canción y mismo instrumento: de 4,8 M a 406 views. **Cambian el título, la promesa y la escena, no la canción.**

## Lo que el video ya hace bien
- Cada nota tiene causa visible (bloque + destello + mob). Es lo que separa a Animusic y Marble Machine del Black MIDI.
- Gancho con el clímax en el cuadro 0, contador siempre visible y final que hace bucle.
- Canción meme con público enorme. 34.961 bloques es el doble que el referente de 4,8 M.

## Lo que falta (por impacto)
1. **La promesa en palabras, con número.** El título en pantalla dice "RUSH E / EN BLOQUES", sin número y sin "imposible".
   La descripción es informativa, no promete nada. Todos los que pasan de 1 M llevan la escala o la imposibilidad en el
   título ("17077 note blocks", "2000 marbles", "World's Hardest Song").
2. **Tensión: "¿aguanta?".** Mark Rober (54,8 M) es la misma canción con un piano que se quema. Nuestro video es
   contemplativo: nada puede salir mal. Falta un riesgo (que algo se rompa, explote o se caiga) o alguien con un objetivo.
3. **Escalada y humor cuando Rush E se desmadra.** El meme es que la pieza se vuelve absurda. Nuestro video sigue la
   misma lógica de principio a fin; los músicos podrían "no dar abasto" (caerse, chocar) en el clímax.
4. **Duración contra el tamaño de la cuenta.** 2:49 no es malo en sí (Buffer: los videos de más de 1 min tienen más
   alcance, pero es correlación). El riesgo está en que la gente se vaya antes del clímax, y la cuenta tiene 15 vistas
   por semana. **Hace falta una versión de 30–60 s.**
5. **YouTube Shorts: no subir los 2:49.** Un Short de más de 1 min con cualquier reclamo de Content ID queda bloqueado en
   todo el mundo (ayuda oficial: support.google.com/youtube/answer/15424877). Hay que subir una versión de 60 s o menos.
6. **Comentarios y regreso.** Falta una pregunta: "¿qué canción imposible sigue? 1/2/3" en el caption y en el comentario
   fijado. Un error escondido ("un gato se equivoca de nota, ¿cuál?") hace que la gente vuelva a verlo y comente el minuto.
7. **La escala, en algo que se pueda imaginar.** 34.961 es abstracto. Hitos en el contador con comparaciones verificadas
   en facts.json, o LTezla diminuto junto a la estructura.
8. **Proceso, en un video aparte.** "¿Cuánto tardaste?" es el comentario natural. El cómo se hizo funciona como segundo
   video, no metido en el primero.

## Mitos o cosas no verificadas
- "#fyp / #parati dan alcance": mito.
- "Lotes de 200–300 vistas que deciden todo" y "70 % de finalización obligatorio": sin fuente oficial.
- Lo oficial (newsroom de TikTok): terminar de ver un video largo es una señal fuerte, "no me interesa" es negativa, y los
  seguidores no son un factor directo. Una cuenta chica sí puede salir.
- Buffer (11,4 M de posts): con 2–5 posts por semana, +17 % de vistas por post, pero la mediana queda en ~500 vistas.
  Publicar más sube la probabilidad de un video fuera de serie, no el promedio.
- No se sabe si Content ID o TikTok detectan un arreglo propio en bloques. Hay que asumir que sí.

## Para el siguiente video
- **La canción importa más que el arreglo:** una canción meme *en su momento* (revisar `tiktok/tendencias/`), o otra
  "imposible" que ya tenga búsquedas.
- **Título con número + riesgo:** "[canción] pero en Minecraft: N bloques. ¿Aguanta?". El número va en pantalla en el
  segundo 0.
- **Un riesgo visible:** por ejemplo, hardcore (si falla una nota, explota) o un creeper que se acerca toda la canción.
  La pausa dramática se vuelve "¿explota?".
- **Un evento nuevo cada 20–25 s,** y en el clímax, caos físico con humor.
- **Formato:** versión de 45–60 s para TikTok y Shorts, más la completa como "parte 2 / versión completa en mi perfil".
- **Al final:** votación de la siguiente canción y comentario fijado con el crédito a Sheet Music Boss.
- **Serie con nombre fijo,** donde el número de bloques sube en cada parte. Las secuelas de la *misma* canción rinden menos.

## Cómo encaja con la plantilla (`README.md` + `video.json`)
Otro agente documentó el proceso y lo volvió plantilla el mismo día. Lo de arriba se reparte así:

| Recomendación | Con la plantilla actual | Hace falta código nuevo |
|---|---|---|
| Número y promesa en el segundo 0 | `textos.gancho.lineas`, p. ej. `["RUSH E", "34.961 BLOQUES"]` | — |
| Hitos del contador ("NOTA 10.000: …") | — | `textos.py`: lista de hitos con su segundo y su texto (desde facts.json) |
| Versión de 45–60 s | `midi.tramos` + `secciones.py` para recortar; o recortar el render final | un `corto.py` que saque 45–60 s del video final, con el gancho y la ola, sin volver a renderizar |
| Riesgo / creeper / hardcore | — | un actor o mob con su ruta en `rollo.py` y un evento en la pausa (ej. siseo + flash) |
| Caos con humor en el clímax | `MUSICOS` en `rollo.py` sólo saltan en su nota | acciones nuevas: caerse, chocar, desmayarse (en la primera nota imposible) |
| Evento cada 20–25 s | `secciones` (14 en Rush E) | revisar en `secciones.py` que no haya > 25 s sin un cambio |
| Votación, crédito y pregunta | `publicar.txt` (paso 15 del README) | — |
| Error escondido para re-ver | — | un músico con 1 nota cambiada a propósito (anotarlo en facts.json para no perderlo) |
