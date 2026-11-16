# "La orquesta de bloques": un video que a mano tomaría meses

(La idea anterior, el duelo contra un editor, quedó en `idea_v1_duelo.md`.)

## La idea en una frase
**Cada sonido del video es un bloque musical de Minecraft, y cada nota tiene una causa que se ve.** Un bloque se
enciende, un creeper se infla en la caja, un gólem pisa el bombo, una gallina picotea el platillo, la cámara corta a otro
bioma. Son cientos de acciones por minuto, cada una en su cuadro exacto. La música no se le pone encima al video:
**el mundo la toca.**

## Por qué a mano tomaría meses (con números que se pueden citar)
- Un animador de cine 3D termina unos **3 segundos de animación por semana** (David A. Price, *The Pixar Touch*;
  Keith Lango). Un minuto con personajes animados son ~20 semanas: **unos 5 meses para una persona.**
- Animusic, que hacía justo esto (instrumentos animados por la música), tardó **2 años en 7 piezas**. Y no lo hacían
  a mano: crearon su propio programa (MIDImotion) porque a mano no se podía (archivo de SIGGRAPH).
- En nuestro caso, cada evento sale de la partitura, así que **el conteo es exacto** (p. ej. "1.412 acciones, cada una
  en su nota"). Esa cifra se puede poner en pantalla sin inventar nada.

## La solución a la solución: los 4 riesgos de esta idea y cómo se cubren
1. **"Es un visualizador, como el de Winamp."** Un visualizador de barras es barato y todos lo conocen.
   → Ninguna nota se dibuja como barra o forma abstracta. **Cada nota la toca un personaje, de una forma que va con él**:
   el creeper se infla en el redoble, el cerdo salta en el agudo, el aldeano hace "hmm" en el bajo. Y el sonido sale de
   lo que se ve (bloques musicales reales del juego). No se ilustra una canción que ya existía.
2. **"Se ve fácil."** Si todo fluye, el ojo no nota el trabajo.
   → **Radiografía a mitad del video:** la música baja a cámara lenta, ×0.25, y cada evento aparece con su etiqueta
   ("do4 · cerdo salta · cuadro 1.204"). Después, los contadores que suben. El trabajo se vuelve **contable**.
3. **"Es un caos."** Mil cosas a la vez no se entienden.
   → Se construye por capas: cada acto suma un instrumento, y en cada momento hay un solo punto de atención. Lo revisa el
   crítico director.
4. **"Lo de los meses es inventado."** → El cálculo se muestra, con su fuente: los eventos que contamos × el ritmo
   publicado de un animador. Se dice "≈", no "exacto". Todo va a `facts.json`.

## Estructura (60–75 s, vertical; la versión horizontal sale de la misma partitura)
| Tiempo | Acto | Qué pasa |
|---|---|---|
| 0–3 s | Gancho | Cuadro 0: una pradera con cientos de bloques musicales esperando. Texto: *"Cada sonido de este video es un bloque de Minecraft."* LTezla toca el primero |
| 3–15 s | 1. Melodía | Una línea de bloques musicales que se encienden nota por nota. LTezla camina junto a ella |
| 15–27 s | 2. Ritmo | Entran los mobs como percusión: el gólem en el bombo, el creeper en la caja y las gallinas en los platillos, cada uno en su golpe |
| 27–39 s | 3. Viaje | La melodía cruza biomas: **en cada nota, un corte a otro bioma**. LTezla sigue caminando sin cortes (raccord en cada nota) |
| 39–51 s | 4. Coro | Un show de mobs, como un show de drones: cientos de mobs forman figuras con cada acorde (la cara de un creeper, un corazón, "LTEZLA") |
| 51–62 s | 5. Radiografía | Cámara lenta ×0.25 con las etiquetas de cada evento. Después, los contadores: notas, acciones, cuadros, mobs y *"≈5 meses a mano"* |
| 62–70 s | Final | Todo junto en el último golpe, silencio y el texto: *"Lo hizo la IA en una noche. Leo no sabe editar."* Vuelve al cuadro 0 (loop) |

## La música
- **Se compone y se toca con los sonidos reales de los bloques musicales** (`texturas_mc/sonidos/`: arpa, bajo,
  campana, flauta, xilófono, banjo, "bit", trompeta y percusión). La afinación es la del juego (2 octavas, de fa#3 a fa#5)
  para que suene a Minecraft de verdad.
- Como la partitura la escribimos nosotros, sabemos **el instante exacto de cada nota**, y librosa sólo se usa para
  comprobarlo, no para adivinar.
- La melodía tiene que ser **original o de dominio público**, para no tener problemas de derechos. Una melodía conocida da
  más "wow", porque la gente la reconoce tocada por mobs. Para el canal de Latam, *Cielito lindo* (tradicional) o el
  *Himno de la alegría* (Beethoven) funcionan.

## Qué hay que construir
1. **Prueba de carga del motor (lo primero):** cuántos mobs y cuántos bloques musicales aguanta una toma, y cuántos
   segundos tarda cada cuadro. Hoy los mobs no se dibujan "instanciados", así que cientos podrían ser lentos. Si no da,
   el show del coro usa mobs lejanos simplificados o se divide en tomas.
2. `partitura.py`: la partitura en Python → el WAV con los sonidos de los bloques (afinados como en el juego) y
   `eventos.json` (tiempo, instrumento, nota, quién la toca y dónde).
3. `coreografo.py`: `eventos.json` → comandos del animador. Encender bloques, `accion` de cada mob en su cuadro y los
   cortes en cada nota del acto 3.
4. **Formaciones del coro:** las figuras en pixel art → un punto de destino para cada mob, con rutas que no choquen.
5. **Radiografía y contadores**, como efectos encima de la imagen.
6. El método de siempre: audio primero, `ensamblar.py` por tramos, `mezcla.py` (−14 LUFS, ≤ −1 dBTP) y críticos
   nuevos hasta "ship".

## Fuentes
- 3 s de animación por semana: https://www.lostmarblemedia.com/animation-takes-flipping-ages/ ·
  https://www.animatorisland.com/how-fast-should-you-animate/
- Animusic, 2 años en 7 piezas y MIDImotion: https://history.siggraph.org/?p=42921
