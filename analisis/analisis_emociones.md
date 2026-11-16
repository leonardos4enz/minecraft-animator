# Análisis de emociones y lenguaje corporal — video de Benly

Cómo se hizo: 63 cuadros del original (uno cada 0.25 s) revisados uno por uno, cruzados con la
transcripción (Whisper), la energía del audio y la velocidad de la cabeza medida en
`analisis_movimiento.md`. Cada tramo se describe con tres marcos:

- **Rostro (tipo FACS):** apertura de ojos, párpados, cejas, boca, dirección de la mirada.
- **Cuerpo (Laban):** *peso* (ligero/firme), *tiempo* (súbito/sostenido), *espacio* (directo/indirecto),
  apertura de la postura y distancia a la cámara (acercarse = interés, alejarse = invitar a seguir).
- **Emoción (circumplejo de Russell):** valencia (−/+) y activación (baja/alta).

## Línea de tiempo

| Tiempo | Dice | Rostro | Cuerpo | Emoción (valencia / activación) |
|---|---|---|---|---|
| 0.0–0.25 | — | (desenfocado) | Entra desde atrás caminando; la cámara **busca foco** | Neutral, en movimiento |
| 0.25–0.6 | "¡Hola!" | Ojos muy abiertos, cejas arriba, boca en "o" | Se frena, **se echa un poco atrás**, hombros y brazos suben | **Sorpresa** (+ / alta), reacción súbita |
| 0.75–1.5 | "No los había…" | Sonrisa, ojos entrecerrados por la sonrisa | **Saluda** con el brazo alto, cabeza ladeada | Alegría (+ / media‑alta) |
| 1.75–2.5 | "…visto" | Ceja levantada, sonrisa de lado | **Ladea mucho la cabeza** (coqueteo/juego) | Simpatía, juego |
| 2.5–3.0 | — | Mira abajo / a un lado | Cabeza baja, se encoge un poco | Pena leve (+ / baja) |
| 3.0–4.0 | "¿Sí?" | Párpados a medias, **mirada de reojo** | Gira la cabeza, torso apenas | Duda / complicidad (+ / baja) |
| 4.0–5.75 | (risa) | Ojos cerrados ^ ^, boca abierta | Se voltea 3/4, **mano en la nuca** (gesto de "me apené") | Risa apenada (+ / alta) |
| 5.75–7.25 | (risa) | Carcajada, ojos cerrados | **Cabeza hacia atrás**, hombros rebotan | Alegría intensa (+ / muy alta) |
| 7.25–8.25 | — | Ojos entrecerrados, sonrisa pícara | Regresa la mirada a la cámara, sin prisa | Complicidad (+ / media) |
| 8.25–9.25 | "Me…" | Sonrisa, ojos felices | Cabeza ladeada, se balancea | Calidez (+ / media) |
| 9.5–10.75 | "…presento" | Sonrisa abierta | **Mano en el pecho** (autorreferencia, sinceridad) | Orgullo amable (+ / media) |
| 10.75–11.5 | "Soy Zita" | **Guiño** | **Brazos abiertos a los lados**, palmas arriba ("¡ta‑da!") | Juego, confianza (+ / alta) |
| 11.5–12.25 | "y los invito" | Ojos grandes, mirando al lente | **Se acerca** y estira la mano: agarra la cámara | Entusiasmo (+ / alta), acercamiento |
| 12.25–14.0 | "a acompañarme" | Ojos muy abiertos, boca hablando mucho | Cara muy cerca, la cámara se mueve con sus manos | Ilusión (+ / alta) |
| 14.0–15.7 | "¡a algo maravilloso!" | Ojos enormes, boca "o" | **Camina hacia atrás llevando la cámara**, rebota al andar, al final gira rápido (desenfoque de movimiento) | Emoción / anticipación (+ / muy alta) |

## Patrones que hacen que "se sienta"

1. **La emoción llega primero a la cara y después al cuerpo.** La sorpresa abre los ojos en el mismo
   cuadro en que se frena; el cuerpo termina de echarse atrás 0.1–0.2 s después (el resorte del motor
   lo reproduce).
2. **Cada frase tiene un gesto propio** que coincide con la palabra clave: "hola" → saludo, "presento" →
   mano al pecho, "soy" → brazos abiertos, "acompañarme" → tomar la cámara.
3. **Alterna mirar al lente y apartar la mirada.** Mira a la cámara al hablar y la aparta al dudar, al
   apenarse y al reírse. Eso hace que el contacto visual se sienta real.
4. **La activación sube durante todo el video:** sorpresa → juego → risa → calidez → entusiasmo. El
   final es lo más intenso (acercarse, agarrar la cámara, irse caminando).
5. **No hay estrellas ni efectos de caricatura:** la emoción se vende con párpados, cejas, boca y
   postura. Los ojos son de animación (pupila cuadrada, brillo cuadrado, delineado con pestañas) pero
   se mueven como ojos reales: sacadas, parpadeos y mirada fija al hablar.
6. **Pelo con inercia:** los mechones se quedan atrás cuando la cabeza gira o el cuerpo se acerca y
   rebotan al detenerse.

## Cómo se aplicó en la plantilla "Vlog (video Benly)"

Cada fila de la tabla es un clip de pose + un clip de ojos con la misma emoción; los tramos donde mira
al lente usan **"mirar a la cámara"** (la cabeza gira una parte y los ojos el resto, calculado contra
la posición real de la cámara). La voz de LTezla tiene **lip‑sync** por letra (ElevenLabs con marcas de
tiempo) y la cámara usa **enfoque automático** con retraso: arranca desenfocada y se desenfoca un
momento cuando él se acerca rápido, como una videocámara real.
