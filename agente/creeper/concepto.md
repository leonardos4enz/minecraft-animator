# El creeper era un cerdo — concepto, storyboard y biblia de estilo

## Tres direcciones

1. **"El error" (la elegida).** Un solo cuerpo cuenta todo: el cerdo de la primera toma es el mismo objeto que se pone de pie, se repinta de verde y explota. LTezla es el narrador que lo ve pasar.
2. **"El código."** Todo pasa adentro de un editor de bloques gigante; las líneas de código se arman con bloques. Esta la descarté porque es abstracta: el público ve código y no al cerdo.
3. **"El juicio."** Un juicio al creeper con aldeanos de jurado y el cerdo de testigo. Esta la descarté porque son 3 o 4 personajes nuevos para 40 s y el dato queda enterrado.

**Por qué la 1:** la transformación *es* el dato. Si se ve sin sonido, el cerdo convirtiéndose en creeper ya cuenta la historia.

## Tres momentos firma

1. **El cerdo se para.** Las flechas ALTO y ANCHO cambian de lugar en un beat y el cuerpo del cerdo se levanta con un rebote, en el mismo lugar del cuadro.
2. **Los pixeles cambian uno por uno.** La piel rosa pasa a verde de pixel en pixel, el hocico se encoge y la cara del creeper aparece mientras retrocede hacia un arbusto hasta que casi no se ve.
3. **El silencio antes del boom.** La música se corta, sólo queda el siseo y el parpadeo blanco. Luego el destello en blanco abre a una pradera llena de creepers de verdad.

## Storyboard (los tiempos salen de timing.json)

| t (s) | En pantalla | Para qué | Audio | Salida | Qué pasa a la siguiente |
|---|---|---|---|---|---|
| 0.00–2.62 | Macro a la altura de la cara de un cerdo en la pradera con flores; mira a cámara y el cuerpo da un tirón | Gancho: algo raro tiene este cerdo (cuadro 1 terminado) | oink 0.1 · L1 "Este cerdo... esconde un secreto." · glitch en beat 1.97 | La cámara se aleja | el cerdo (mismo lugar del cuadro) |
| 2.62–4.78 | Plano general: LTezla en la pradera con tres cerdos y presenta | Mundo conocido | L2 empieza | corte en beat | el cerdo protagonista a la derecha |
| 4.78–7.55 | Medio: LTezla al lado del cerdo, lo señala | Notch quiso hacer un cerdo | L2 sigue | se acerca al cerdo | el cerdo al centro |
| 7.55–11.63 | Cenital 3/4: rejilla de plano sobre el cerdo, flechas ALTO (vertical) y ANCHO (horizontal); en el beat 10.12 giran y se intercambian | La causa | L3 · pop en el giro | el cerdo empieza a temblar | el cerdo al centro |
| 11.63–14.42 | Contrapicado: el cuerpo se levanta en el beat 12.28 con polvo | **Firma 1** | crujido + boing · L4 | la cámara sube con él | la cosa rosa, alta |
| 14.42–17.00 | LTezla camina de lado; la cabeza de la cosa lo sigue | Te sigue con la mirada | L5 empieza | LTezla se detiene | la mirada |
| 17.00–21.92 | Primer plano de la cara rosa mirando a cámara; reacción de miedo de LTezla en profundidad | Le pareció creepy | L5 termina | la cara llena el cuadro | la cara |
| 21.92–25.36 | Los pixeles pasan a verde; retrocede a un arbusto de hojas | **Firma 2** · el verde | chispitas de pixel · hojas · L6 | sólo quedan los ojos en las hojas | los ojos |
| 25.36–27.28 | LTezla tiene una idea (señala arriba, ojos pícaros) | El amigo | idea ding · L7 empieza | se para la música | LTezla |
| 27.28–30.60 | El creeper sale del arbusto, se infla y parpadea en blanco; LTezla se tapa la cara | La mecha | silencio + siseo · L7 "¿y si explota?" | destello blanco | el blanco |
| 30.60–36.07 | Destello, humo de pixeles y pradera al atardecer con creepers de verdad caminando; uno mira a cámara | **Firma 3** · la consecuencia | explosión · regresa la música · L8 | corte en beat | el creeper mirando |
| 36.07–40.6 | Título "EL CREEPER / ERA UN CERDO" + fuente; un cerdo entra y hace oink | Repaso + remate | oink · remate de la música | fundido | — |

**Sin sonido se lee así:** cerdo raro → LTezla y cerdos → flechas ALTO/ANCHO que se cambian → el cerdo se para → la cosa lo mira → se vuelve verde y se esconde → se infla → explota → creepers por todos lados → "EL CREEPER ERA UN CERDO".

## Biblia de estilo

- **Colores (6):** rosa cerdo `#F0A5A2` · verde creeper `#0DA70B` · verde oscuro `#063A0B` · crema sol `#FFF3C4` · blanco de título `#F2F0EE` · tinta `#141414`.
- **Tipografía:** Minecraft Ten (local, copiada del juego por `herramientas/packs.py`), sólo en mayúsculas, extruida en 3D con relieve.
- **Texturas:** las del juego (Bare Bones + Fresh Animations), con grano 0.025, viñeta 0.28, ACES y DOF del kit.
- **Vocabulario de movimiento:** llegadas lentas con resorte y salidas rápidas; los mobs nunca se quedan quietos (respiran y miran); la cámara se mueve sólo cuando sigue algo; el cuerpo del cerdo rebota al pararse (llega a 1.12 y se asienta en 1); los títulos entran con "golpe".
- **Prohibido:** partículas de adorno, glitches de stock, texto encima de la imagen sin contraste (siempre extruido con sombra).
