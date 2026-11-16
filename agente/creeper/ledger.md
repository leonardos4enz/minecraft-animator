# Ledger — El creeper era un cerdo

## Ronda 0 (lo hice yo antes de llamar a críticos; no cuenta como revisión)
| Problema | Antes | Después |
|---|---|---|
| Arbusto (nicho) tapaba el cuadro en 5 tomas | 5/13 tomas con >40 % del cuadro en verde plano | 0 (nicho detrás del cerdo; tomas finales a z < 0) |
| Cámaras apuntaban a LTezla en lugar de la criatura | primer plano de la cara = nuca de LTezla | `VWT` (pan/tilt hacia el objetivo); primer plano separado en su propia toma |
| Etiquetas ALTO/ANCHO encimadas | se tapaban en 9.8 s | vista lateral; ALTO crece 0.88→1.38, ANCHO se encoge 1.5→0.88 |
| Al pararse, la cabeza salía del cuadro y el polvo tapaba | cabeza fuera ~0.4 s, polvo 1 s | la cámara sube en 0.5 s junto con el cuerpo; polvo 26 partículas, 0.55 s |
| Mezcla | — | −14.1 LUFS, pico −1.5 dBFS; sólo música: −14.2 LUFS |

## Ronda 1 (críticos nuevos sobre v1) — veredicto de los tres: "one more pass"
Lectura sin sonido: entendió el punto en un 85 %, sobre todo gracias al título. Técnico: especificaciones, cortes (±1 cuadro) y sonoridad cumplen. Director: "se siente armado, no dirigido".

| # | Problema (crítico) | Antes (v1) | Arreglo → después (v2) |
|---|---|---|---|
| 1 | La explosión no se ve; la nuca de LTezla tapa ⅓ del cuadro (técnico, director) | mecha por encima del hombro; el creeper desaparece fuera de cuadro | toma propia "La mecha" de 1.5 s, de frente, empujando hacia el creeper; boom en plano abierto con temblor 1.0 en 0.5 s, 320 partículas de humo, 70 de tierra y LTezla que cae sentado |
| 2 | El cerdo se para durante un barrido, en 0.4 s, sin leerse (director, lectura muda) | en otra toma, con barrido de cámara | en la MISMA toma fija de las flechas, 0.86 s después del cruce |
| 3 | ALTO/ANCHO no se intercambian, sólo cambian de largo (director); ANCHO con contraste de 2.3:1 y encimado (técnico) | crecen y se encogen | las dos flechas giran desde la misma esquina como manecillas y se cruzan; etiquetas en blanco |
| 4 | Gancho débil: cerdo quieto 2.6 s (director) | cerdo de frente | cara de creeper que se vuelve cerdo pixel por pixel en el beat 0.70 y tira un glitch en 1.97 |
| 5 | Cámara atraviesa un bloque en 15.4–16.0 s (técnico) | LTezla caminando, la cámara lo sigue | "te seguía con la mirada" = la cámara gira en arco y la cabeza la sigue (LTezla fuera de la toma) |
| 6 | Título ilegible: 1.1–2.8:1 (técnico) | sobre pradera y cielo rosa | título sobre negro, tamaño 13 (antes 9); crédito tamaño 2.4 (antes 1.6) |
| 7 | Remate plano y el "oink" no se oye (director) | cerdo cortado detrás del título | toma propia: el cerdo entra, se detiene, mira a cámara y "oink" con vol 1.3 (antes 0.6) |
| 8 | Primer plano de la cara sin acción durante 2.6 s (director) | empujón de cámara sin acción | 2.13 s y la cabeza gira de golpe hacia cámara en 0.25 s |
| 9 | La exportación completa cuelga la ventana | 1 cuelgue en el título y 1 en 21–28 s | `ensamblar.py`: tramos con la ventana reiniciada en cada uno; cortes en la rejilla de cuadros (1215/1215) |

## Ronda 2 (críticos nuevos sobre v2) — los tres: "one more pass"
Lectura sin sonido: 80 %. Técnico: corregidos (a) cámara a través del bloque, (b) contraste del título (de 1.1–2.8:1 a 10.7:1), (d) nuca en la mecha, (e) explosión oculta y (f) cerdo cortado. Director: gancho y momento verde arreglados; el final "en lo esencial".

| # | Problema | Antes (v2) | Arreglo → después (v3) |
|---|---|---|---|
| 1 | Cuadros quietos: título idéntico durante 2.03 s; total 2.4 s cada 30 s | título fijo; plano parado de 2.8 s | títulos con `vivo` 1.6° y `crece` 2.5 %/s (nuevo en titulos3d.js); se quitó el plano parado: el cerdo se para dentro de la toma de las flechas |
| 2 | Explosión sin impacto: no se infla, no hay reacción y la voz pisa el golpe | inflado 22 %; voz L8 en 30.54 | inflado 38 % y destello que la revienta dentro de su toma; plano abierto del boom de 0.9 s; primer plano de LTezla aturdido de 1.03 s; L8 entra en 31.6 |
| 3 | Centro muerto 11.6–19 s; la cabeza no sigue a nadie | dos planos fijos + push-in | un solo plano: LTezla cruza y la cabeza lo sigue en 3 golpes; el primer plano gira la cabeza justo en "creepy" (17.6 s) |
| 4 | Flechas bajo un destello; etiquetas cortadas; ANCHO a 1.46:1 | destello; texto blanco | sin destello; etiquetas en tinta #151515; cámara alejada y recentrada; ANCHO de 1.4 |
| 5 | El cerdo se para 1.4 s antes de "parado" | PARA 10.98 | PARA 12.28, sobre la palabra (L4 alineada con su marca de tiempo) |
| 6 | Arranque lento con un saludo genérico | saludo de 1.1 s; plano de Notch de 2.76 s | sin saludo; plano de Notch de 1.93 s; la cuadrícula entra en 6.71 |
| 7 | Final largo; el "oink" lo tapa el fundido | creeper 3.3 s; cerdo de 1.98 s | creeper 1.93 s; remate de 3.26 s con "oink" en 38.54 y fundido desde 40.15 |
| 8 | Arbusto de bloques verdes lisos | "hojas" | "hojas_azalea" (con textura) |
| 9 | La reacción se leía alegre | ojos "asustado" (salía como ":3") | "sorprendido" con la mirada que va de lado a lado + caminar hacia atrás |
| 10 | Destellos de la mecha a 8–10 Hz (límite de WCAG) | frecuencia de 2 a 12 | de 2 a 6 → ≤ 3 destellos/s |
| 11 | Voz: "quizás camuflaje" sin verbo; Whisper oía "aún un amigo" | L6B, L7C | L6E "quizás es camuflaje" y L7D "y a un amigo…", las dos verificadas con Whisper |
| 12 | Pop y glitch por encima de la voz | vol 0.6 / 0.55 | 0.4 / 0.35–0.4 |
| 13 | Crédito ilegible; "(2017)" salía "<2017>" | tam 2.4 con paréntesis | tam 3.0: "FUENTE: MINECRAFT.NET - MEET THE CREEPER - 2017" |

## Ronda 3 (críticos nuevos sobre v3) — los tres: "one more pass"
Lectura sin sonido: 85 %. Técnico: corregidos los destellos de la mecha (de 8–10 Hz a ≤ 3/s), los márgenes de las etiquetas y el pop y el glitch por encima de la voz (ahora ≥ 10 dB por debajo). Director: corregidos el gancho, los cortes de "quizás es camuflaje" y "a un amigo", y el crédito.

| # | Problema | Antes (v3) | Arreglo → después (v4) |
|---|---|---|---|
| 1 | Imagen quieta: 3.88 s cada 30 s; título 2.17 s idéntico | cámaras con poco recorrido, curva suave | más recorrido en 6 tomas (curva lineal); título `vivo` 5°, `crece` 8 %/s → **0.30 s cada 30 s**, ningún tramo > 0.33 s (medido) |
| 2 | Arbusto como losas planas detrás de todo y de los primeros planos (las hojas de Bare Bones son de un solo color) | nicho a 1–2 bloques detrás del cerdo | arbusto movido a z 7–9, con dos verdes y forma irregular; se limpiaron los arbustos sueltos alrededor; los primeros planos tienen la pradera detrás |
| 3 | ALTO a 2.99–3.57:1 contra el arbusto oscuro; las puntas tocaban las etiquetas | arbusto detrás de las flechas | la cámara lateral ve pradera clara detrás de las etiquetas; desplazamiento de etiqueta 0.36/0.32; las flechas entran después del cambio de cámara |
| 4 | El cruce de flechas y el pararse quedaban separados por 2.1 s | PARA 12.28 | PARA 11.63 con anticipación (se agacha −0.07 antes); el jadeo de L4 cae sobre el movimiento |
| 5 | Pausa muerta de 2.3 s antes de "a un amigo" | L6 en 20.5 | L6 en 21.0; L5 en 13.55 |
| 6 | La reacción aturdida se leía aburrida; la cabeza cortada | cámara a la altura del pecho | cámara más atrás (dist 2.5, ty 0.95) |
| 7 | El blanco de la explosión llegaba 100 ms antes que el sonido | destello en 1.40 | destello en 1.47 (cuadro anterior al corte) |
| 8 | En la toma del cruce, LTezla tapaba al cerdo | el 7 | el 13, ty 1.5 |

## Ronda 4 (críticos nuevos sobre v4) — los tres: "one more pass" (el director: "una pasada corta")
Lectura sin sonido: 85 %. Técnico: imagen quieta, sincronía de la explosión, contraste de ALTO y recorte de la cabeza → corregidos. Director: corregidos el arbusto en la toma del verde, los fondos de los primeros planos y la unión de flechas y pararse.

| # | Problema | Antes (v4) | Arreglo → después (v5) |
|---|---|---|---|
| 1 | **Los dos "pop" no suenan**: el archivo pica en −69.5 dBFS (técnico) | sfx_33d0985c8e9a | regenerado: sfx_33e192e06eb8, pico −8.3 dB; revisé el pico de los 12 efectos (todos ≥ −21.5 dB; "hojas" subió de vol 0.5 a 0.95) |
| 2 | ANCHO a 3.5–3.9:1 y fuera del margen después de 11.2 s | etiqueta en la punta de la flecha | dos etiquetas de texto propias con sombra clara #f4f4f4, sobre la pradera; flecha de 1.3 |
| 3 | Mecha a ~4 destellos/s | frecuencia de 2 a 6 | de 2 a 4 → ≤ 2/s |
| 4 | Cabeza del creeper cortada en 30.0–30.57 s | push-in hasta z 0.2 | hasta z −0.3, ty 1.55 |
| 5 | Crujido 7–13 dB encima de la primera sílaba de L4 | vol 0.65 / 0.6 | 0.4 / 0.45 |
| 6 | Reacción aturdida "aburrida" y con la voz encima (director) | 1.03 s, ojos cansados, L8 en 31.6 | 1.66 s sin voz: ojos cerrados → mirada de un lado a otro → confundido; balanceo 1.0; estrellitas; sonido de mareo; L8 entra con el corte en 33.2 |
| 7 | Seguimiento de la cabeza tapado por LTezla | cámara detrás de él (az 90) | az 68, el 22: la cabeza queda libre por encima |
| 8 | Presentador quieto 2 s | "presentar" fijo | señala al cerdo → presenta a cámara + balanceo; en Notch, asiente |
| 9 | Plano muerto de 2.6 s antes de las flechas | flechas en 9.5 | cambio de cámara y flechas en 8.2, con la palabra "alto" |
| 10 | Cielo magenta en el creeper y el remate | ambiente atardecer | día, como el resto |
| 11 | Salida del arbusto sin "escondido" y con plano holandés | cámara lateral | de frente al nicho: primero sólo la cara entre hojas (0.55 s) y después sale |
| 12 | El humo tapaba la cara en 32.2–32.5 s | humo a la altura de la cara | humo bajo y detrás |

## Ronda 5 (críticos nuevos sobre v5) — los tres: "one more pass"
Lectura sin sonido: 85 %. Técnico: corregidos ANCHO (6.4–8.0:1 dentro del margen), la mecha (2 destellos/s), el recorte de cabeza y el humo sobre la cara. Director: corregidos el presentador, las flechas sobre "alto" y el cielo.

| # | Problema | Antes (v5) | Arreglo → después (v6) |
|---|---|---|---|
| 1 | El crujido tapaba el jadeo de L4 (+7–13 dB en ventanas de 50 ms) | crujido 0.4 en PARA−0.1 | sin crujido; "levanta" vol 0.3 en PARA−0.12 |
| 2 | Los pops casi no se oyen en la mezcla (la compresión del sidechain y un clic de 2 ms) | vol 0.4 / 0.45; fx ratio 3 | vol 1.0 / 1.0; compresión de efectos ratio 2, umbral 0.05 |
| 3 | Mareo y oink tapados (por la cola de la explosión y por la voz) | mareo +0.1 s vol 0.55; oink +0.3 vol 0.5 | mareo +0.45 s vol 1.0; oink antes de la voz, vol 0.75 |
| 4 | "Píxeles" al mismo nivel que la voz | 0.5 | 0.35 |
| 5 | ANCHO pisaba al cerdo y la flecha tocaba la "O" | etiquetas en (0.36, 2.85) y (1.3, 4.85) | (0.13, 2.15) bajo el hocico y (1.25, 5.15); ALTO con sombra clara |
| 6 | La cabeza del cruce tapada 14.4–15.8 s | el 22 | el 38, tilt 10 (medido: ~0.5 m de aire sobre LTezla) |
| 7 | El creeper no se ve escondido al salir | nicho abierto | seto bajo de 1 bloque delante: tapa las piernas y lo sube de un paso al salir |
| 8 | El mareo no se lee | arranca con los ojos cerrados | la mirada va y viene 5 veces en 1.1 s + niega con la cabeza + balanceo |
| 9 | Pasto que atraviesa al cerdo en la cuadrícula | matas alrededor | aire en y=0 para x −2…2, z 1…5 |
| 10 | "de un error" cae sobre negro sin imagen | título en 35.13 | creeper hasta 36.59 (3.44 s, con 4 creepers detrás); el título entra con "error" |
| 11 | LTezla de espaldas 2 s en "Notch quiso un cerdo" | cámara detrás | de frente con el cerdo en primer término |

## Ronda 6 (críticos nuevos sobre v6) — director: **"ship"**; técnico: "one more pass"; lectura sin sonido: 85 %
Director: "ya está a la altura de trabajo bueno del género"; corregidos los contornos de las etiquetas, el pasto, Notch de frente, el mareo legible y "de un error" que caía sobre negro. Técnico: imagen quieta 0.23 s, cortes, sonoridad, título, mecha, mareo y oink corregidos.

| # | Problema | Antes (v6) | Arreglo → después (v7) |
|---|---|---|---|
| 1 | ANCHO antes del cruce: 3.7:1 y 48 px fuera del margen derecho | etiqueta bajo el hocico, sobre la cuadrícula brillante | sobre el lomo, en (1.15, 2.75): ~12:1 y borde en x = 1667 (límite 1824) |
| 2 | El pop de 10.12 s no se oye (la compresión de la voz lo baja otros 8.8 dB) | todos los efectos al mismo bus comprimido | bus de "acentos" (pop, idea, whoosh, hojas) sin compresión |
| 3 | Whooshes y hojas tapados | vol 0.35–0.6 / 0.95 | 0.6–0.95 / 1.8 |
| 4 | Cambio de cámara de 8.2 s que no estaba en timing.json | — | `cambios_de_camara` en timing.json |

## Ronda 7 (críticos nuevos sobre v7) — técnico: "one more pass" (1 bloqueante); director: "one more pass" (sólo edición); lectura sin sonido: 80 %
Técnico: ANCHO resuelto (~12:1, dentro del margen), pop audible (+5.7 dB en su banda), cambio de cámara registrado.

| # | Problema | Antes (v7) | Arreglo → después (v8, sólo remezcla sobre la imagen de v7) |
|---|---|---|---|
| 1 | **Bloqueante:** el whoosh de 12.71 s queda −17.9 dB bajo la voz (está en graves) | whoosh en el corte de "te sigue con la mirada" | quitado: un efecto que no se oye no se queda (regla de audio) |
| 2 | Hojas débiles (−4.3 dB en su banda); whoosh 6.46 s y oink 2.57 s al límite | 1.8 / 0.6 / 0.75 | 3.2 / 0.95 / 1.0 |

Notas del director de la ronda 7 que **no** se aplicaron, con motivo:
- *Título sobre negro "genérico"*: el negro fue el arreglo del 1.1–2.8:1 de la ronda 1; ahora mide 10.4–11:1, y el director de la ronda 6 lo aprobó.
- *Pausas de 1.5 y 1.9 s en el centro*: el director de la ronda 4 las elogió como "respiros"; quitarlas obliga a rehacer los tiempos de todas las voces ancladas a la parada de la música.
- *Adelantar el plano del arbusto 5 s*: el escondite ya se ve en 22.6–23.9 s ("Se vuelve verde" termina con la cara entre las hojas); la toma de 27.3 s es la salida.
- *"¡Suscríbete!" que oyó Whisper en 38.4 s*: verifiqué que es una alucinación. Ninguna voz suena después de 38.005 s, y el oink, el pop y la cola de la música, transcritos por separado, dan vacío.

Sin cambio, con motivo: L3 conserva la pausa "el alto… ¡con el ancho!" porque es el remate cómico de la línea. El amigo sigue sin cuerpo en pantalla porque es una persona real sin imagen pública en facts.json, así que LTezla lo cuenta.

## Ronda 8 (crítico técnico nuevo sobre v8) → arreglos → **Ronda 9 (crítico técnico nuevo sobre v9): "ship"**
| # | Problema (v8) | Arreglo → v9 (medido por el crítico de la ronda 9) |
|---|---|---|
| 1 | Pop en 10.124 s, 3.6 dB bajo "ancho" en su banda | pasa al instante en que las flechas encajan (GIRO + 0.33), vol 2.5 → +7.6 dB sobre la voz en 1–2 kHz y 8.7 dB debajo en banda ancha |
| 2 | ANCHO pisaba el lomo del cerdo en 8.7–9.9 s (35–40 px) | y 1.15 → 1.42 → 0 px de cerdo dentro de su caja, 35–62 px de aire |

**Estado final (v9 = entrega):** 40.5 s · 1920×1080 · 30 fps · 1215 cuadros · −14.3 LUFS · pico −1.4 dBTP · 0 recortes · imagen quieta 0.23 s (ningún tramo > 0.2 s) · cortes a ≤1 cuadro · los 16 efectos se oyen · etiquetas ≥ 4.6:1 · título 10.5–11.2:1 · mecha 2 destellos/s · todo dicho o escrito figura en facts.json.
Veredictos: técnico **ship** (ronda 9) · director **ship** (ronda 6; en la ronda 7 pidió cambios de edición, respondidos arriba) · lectura sin sonido 80–85 % de forma constante (el "fue un error" lo dice la voz; es un explainer narrado).
