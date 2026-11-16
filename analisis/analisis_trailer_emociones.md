# Análisis del tráiler de @benlyanimations para Bobicraft (MINECRAFT LIVE 2026)

Video: <https://x.com/benlyanimations/status/2035469539861750084> · 40.85 s · 1280×720 (máxima variante
descargable; el original es 1920×1080) · 24 fps · AAC estéreo 48 kHz.
Se descargó con la API pública de sindicación solo para analizarlo (no está en el proyecto).

Cómo se hizo:
- **163 cuadros** (uno cada 0.25 s) revisados uno por uno, más acercamientos a la cara del jugador-gato
  (27.9–29.7 s), al jinete de la cabra (8.5–11 s) y al corte de la luna (5.2–5.7 s, cuadro a cuadro).
- **Cortes** medidos con `analisis/analisis_tomas.py` (diferencia de histograma + de pixeles): 21 cortes y
  2 fundidos. Coinciden con la revisión a mano.
- **Sonido** con `herramientas/escuchar.py` (AST, CLAP, tono/volumen, Whisper) y un análisis propio de tempo
  (autocorrelación del flujo espectral) y golpes de bajo.

## Lo que se oye (revisado en TODO el video, no solo en silencios)

| Medida | Resultado |
|---|---|
| Música | **Toda la duración.** AST: "Music" 0.5–0.85 en cada medio segundo; "Video game music", "Electronic music", "Techno", "Drum machine". CLAP: "music" 0.8–0.99 todo el video. |
| Tempo | **127.7 BPM**, bombo en cada tiempo (cada 0.47 s). |
| Forma | Entrada suave 0–2.4 s (−40 → −15 dB), primer golpe de bajo en **2.41 s**, energía pareja (−9 a −11 dB) hasta ~38 s, desvanece 38–40.6 s. |
| Golpes | "Bang"/"Burst" en 2.0, 4.5, 6.0–6.5, 8.0, 12.0–12.5, **14.5 (el más fuerte, arranca la estampida)**, 15.5, 21, 23, 24.5, 29.5, 33.5. |
| Cortes y música | 10 de 25 cortes caen a menos de 0.1 s de un golpe de bajo (se edita al ritmo). |
| Diálogo | **Ninguno.** Whisper "oyó" «¡SUSCRÍBETE!» en 9.1 s y 35.6 s: es una alucinación clásica de Whisper sobre música (no hay voz: el tono medido es el del bajo, 80–110 Hz). |
| Efectos | Ningún efecto distinguible de la música (ni pasos ni animales): todo el diseño sonoro es la pista musical con sus golpes. |

## Tomas, emociones y lenguaje corporal

Marcos: **rostro** tipo FACS cuando hay cara expresiva; **cuerpo** con los factores de esfuerzo de Laban
(peso ligero/firme, tiempo súbito/sostenido, espacio directo/indirecto, flujo libre/contenido);
**emoción** con valencia/activación (Russell). Aquí casi todos son mobs: su "actuación" es de cuerpo y
cámara, no de cara.

| Toma | Tiempo | Qué pasa | Cuerpo (Laban) | Rostro | Emoción (val./act.) | Cámara |
|---|---|---|---|---|---|---|
| 1 | 0.00–2.83 | Aldea. Granjero con sombrero de paja apoyado junto a su puerta, brazos cruzados; un aldeanito camina por el centro y voltea; entran pollitos | Granjero: peso firme, tiempo sostenido, flujo contenido (no se mueve). Aldeanito: ligero, indirecto | Aldeanos: uniceja baja (AU4 permanente), mirada al frente | Calma, curiosidad (+ / baja) | Fija, frontal a las fachadas; fundido desde negro ~0.5 s |
| 2 | 2.83–3.75 | Los pollitos cruzan el pasto | Pollitos: ligero, súbito, directo | — | Juego (+ / media) | Más baja y cerca; panea siguiéndolos |
| 3 | 3.75–5.53 | Noche, luna enorme: un lobo con armadura rosada camina; pollitos aletean alrededor; entra otro lobo morado | Lobo: firme, sostenido, directo (paso tranquilo) | — | Misterio sereno (+ / media) | Travelling lateral a la par del lobo |
| 4 | 5.53–7.33 | Acantilado con árboles en silueta, luna, **"MARZO 21"** verde | Nada se mueve | — | Anticipación (+ / baja) | Fija, acercamiento casi imperceptible |
| 5 | 7.33–8.54 | Cabra corriendo en la nieve, fondo barrido | Súbito, firme, directo | — | Ímpetu (+ / alta) | Travelling lateral pegado, desenfoque de fondo (80 % del ancho/s) |
| 6–7 | 8.54–11.0 | Un jugador monta una cabra quieta mientras los cabritos ruedan y juegan; empujón de cámara hacia el jinete | Jinete: firme, contenido (calma). Cabritos: ligero, libre, indirecto | Jinete serio | Contraste calma/caos, humor (+ / media) | Plano general → acercamiento rápido con foco que se reajusta |
| 8 | 11.0–13.04 | Bajo el agua: calamares brillantes flotan; **"NUEVOS DROPS"** cian | Ligero, sostenido, indirecto (flotan) | — | Maravilla (+ / media) | Casi fija, mirando hacia arriba |
| 9 | 13.04–14.92 | Primer plano de un aldeano junto a la pared: mira de reojo y luego clava la vista en la cámara | Inmóvil; solo cabeza y ojos | Uniceja baja + mirada lateral → directa (sospecha que confronta) | Sospecha cómica (− leve / baja) | Fija, lente largo, fondo desenfocado |
| 10–12 | 14.92–18.54 | **Estampida de pollitos** hacia la cámara; luego 4 cortes rapidísimos (0.21 s) | Ligero, súbito, directo, flujo libre | Ojos de pollito fijos al frente | Alegría desbordada (+ / muy alta) | Cámara al ras del suelo retrocediendo y paneando; cortes al ritmo |
| 13 | 18.54–20.29 | Cerezos: oveja grande, corderos brincando; **"¿ESTÁN LISTOS?"** rosa | Oveja: firme, sostenida. Corderos: ligeros, súbitos | — | Pregunta / anticipación (+ / media‑alta) | Fija, baja |
| 14 | 20.29–22.29 | Vista cenital: los mobs giran y "vuelan" hacia la cámara | Súbito, libre, indirecto (dan vueltas) | — | Caos divertido (+ / alta) | Cenital con giro lento |
| 15 | 22.29–25.88 | Calle de la aldea: un aldeano cruza corriendo; después un jugador cruza con pollitos detrás; **"COSAS SECRETAS"** amarillo | Súbito, directo | — | Travesura (+ / media) | Fija, baja, entre dos casas |
| 16–17 | 25.88–27.92 | Nether: striders tambaleándose, pollitos; plano general con **"BOBI VOTE"** | Firme, sostenido, tambaleo | — | Aventura (+ / media‑alta) | Contrapicado cercano → general |
| 18 | 27.92–29.67 | **Primer plano del jugador‑gato**: mira abajo a un lado y, en ~0.2 s, gira la cabeza a la cámara | Contenido → súbito y directo en el giro | Ojos verdes, párpados un poco bajos (AU7 ligero), boca neutra: mirada firme | Determinación "cool" (+ / media‑alta) | Fija, contrapicado suave, cielo rosa |
| 19 | 29.67–31.38 | Atardecer: llama, oveja, cabra, pollitos y aldeano caminan hacia la cámara | Firme, sostenido, directo (todos al mismo paso) | — | Unión, calidez (+ / media) | Baja, retrocede y panea (7.5 %/s) |
| 20 | 31.38–33.33 | De espaldas: jugadores y mobs miran el sol sobre montañas moradas; fundido a negro | Quietud, peso firme | — | Asombro compartido (+ / media) | Fija, el sol en el centro; fundido 33.1–33.3 |
| 21 | 33.33–40.85 | Tarjeta: MINECRAFT LIVE · MARZO 21 · 10:00 AM GMT‑6 · youtube.com/bobicraftmc | — | — | Información, cierre | Entra en 0.5 s, sale 39.4–40.6 s |

## Patrones que hacen que funcione

1. **La edición manda**: tomas de 0.2–3.6 s cortadas sobre el bombo de 128 BPM. La energía sube por
   acumulación de cortes (14.9–18.5 s: estampida + cuatro cortes de 0.21 s).
2. **Cada título vive en su propia toma** y queda quieto en pantalla (no "rebota"): MARZO 21 → NUEVOS DROPS →
   ¿ESTÁN LISTOS? → COSAS SECRETAS → BOBI VOTE. Colores distintos por toma (verde, cian, rosa, amarillo).
3. **Alterna calma y caos**: granjero quieto / pollitos corriendo; jinete serio / cabritos rodando;
   aldeano inmóvil en primer plano / estampida.
4. **Un solo momento de "actuación" humana con cara**: el giro de cabeza del jugador‑gato a la cámara
   (28.9 s). Es el clímax emocional antes del atardecer.
5. **Mirada a cámara** solo dos veces: el aldeano (sospecha, humor) y el jugador (determinación). El resto
   del tiempo nadie mira al lente.
6. **Look**: muy saturado y brillante, contraste alto, cielos con degradado, brillo (bloom) en luna, sol y
   calamares; desenfoque de fondo en primeros planos y desenfoque de movimiento en los travellings.

## Movimiento medido del original (por toma, `analisis_tomas.py`)

Cámara: casi todas las tomas son **fijas** (0 % del ancho/s); se mueven la de los pollitos al inicio
(7.5 %/s), la cabra corriendo (80.8 %/s, travelling), la estampida (16.8 %/s), los cortes rápidos
(7.5–18.8 %/s), la cenital (7.5 %/s) y el atardecer (7.5 %/s). Movimiento dentro del cuadro alto en la cabra
(37), la estampida (13–15) y el atardecer (13); casi nulo en la aldea inicial, la luna y la tarjeta.

## Cómo se adaptó a LTezla

LTezla toma **el papel de los jugadores** (los mobs y aldeanos son los del original, con modelos y texturas
reales de tu Minecraft): monta la cabra (toma 6–7: serio y determinado, y sonríe a la cámara en el
acercamiento), cruza corriendo con los pollitos (toma 15: muy feliz), hace el primer plano del giro de cabeza
(toma 18: mira abajo a un lado y voltea en 0.2 s con ojos "determinado" mirando al lente) y mira el atardecer
de espaldas con el grupo (toma 20). "BOBI VOTE" pasa a "LTEZLA VOTE" y la tarjeta final dice "LTEZLA LIVE"
(sin copiar el logo de Minecraft Live). No hay diálogo, igual que en el original, así que el lip‑sync no se usa.
