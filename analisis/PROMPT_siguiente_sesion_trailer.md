Proyecto: C:\Users\Leo\Desktop\Minecraft Animator (plataforma web para animar personajes de Minecraft).

CONTEXTO
Ya existe una réplica del tráiler de @benlyanimations para la MINECRAFT LIVE de Bobicraft
(https://x.com/benlyanimations/status/2035469539861750084) con mi personaje LTezla: plantilla
"Tráiler (video Benly · Bobicraft)" en js\plantillas.js y video Videos\LTezla_trailer_replica_Benly_Bobicraft.mp4.
Lee PRIMERO, completos:
  - analisis\TRAILER_estado_y_pendientes.md  (cómo está hecho, cómo trabajar, TODO lo que falta, fuentes)
  - analisis\analisis_trailer_emociones.md   (el original toma por toma)
  - analisis\comparacion_trailer_original_vs_replica.md (datos original vs réplica)
  - README.md
No borres la plantilla del vlog de Benly ni la del tráiler: mejora la del tráiler.

OBJETIVO
Que la réplica se vea como una animación de Mojang / Benly: mobs y LTezla con movimiento vivo estilo
add-on "Actions & Stuff", sin errores físicos, y cada escena lo más parecida posible al original.

1) INVESTIGAR PRIMERO (y documentar con fuentes en analisis\)
  - Cómo se ven y se mueven las animaciones oficiales de Minecraft (tráileres de actualizaciones, Minecraft
    Live, p. ej. "Chase the Skies" de Brikk Animation, "The Copper Age" de Filmic Art) y el look Vibrant Visuals.
  - Qué textura/pack usan esas animaciones y Benly (Blender/Cinema 4D): busca guías para editores y
    animadores de Minecraft (MCprep, rigs estilo Mojang, charla de Eric Luhta sobre el estilo de Minecraft
    Legends, influencers/animadores que expliquen su flujo). Si no hay un pack oficial público, dilo y
    elige la opción más fiel (vanilla de mi .jar con ajustes PBR/tinte, u otra) justificándolo con cuadros.
  - Cómo animan los mobs Actions & Stuff y Fresh Animations (+ iLike2MoveIt): peso, rebote, idle, acciones.
    Mira videos/capturas y anota los patrones concretos por mob.

2) ANIMACIÓN DE MOBS ESTILO ACTIONS & STUFF (js\mobs.js)
  - Reusar el sistema masa-resorte de js\motor.js (RESORTES) para cada mob: cuerpo que sube/baja e inclina
    al caminar y correr, cabeza/orejas/cola con retraso e inercia, anticipación al arrancar y rebote al frenar.
  - Idle vivo por mob (respirar, mirar alrededor, picotear, sacudirse, mover la cola).
  - Acciones: el LOBO AÚLLA en la toma de la luna (3.75–5.53 s: se detiene, levanta la cabeza a la luna,
    hocico arriba) — hoy no aúlla; cabritos embisten y ruedan; pollitos aletean y dan saltitos; strider se
    tambalea; aldeano corre con los brazos cruzados rebotando. LTezla también al correr y al montar la cabra.

3) FÍSICA Y TERRENO
  - Los mobs deben pisar el terreno real (alturaEn del set en cada posición, suavizado): nada flotando ni
    metido en bloques.
  - Nada atraviesa paredes, casas, árboles ni hongos: rutas libres o desvío; revisa en especial la estampida
    (14.9–18.5 s), el cruce de la calle (22.3–25.9 s), el Nether y el atardecer.

4) DESENFOQUES
  - Enfocar al protagonista real de cada toma (cuando LTezla está oculto, hoy enfoca su cabeza invisible).
  - Revisar bokeh exagerado en primeros planos, desenfoque de movimiento "doble" en mobs rápidos y el bloom
    que lava la nieve y las ovejas.

5) CADA ESCENA, CUADRO A CUADRO CONTRA EL ORIGINAL
  - Baja el original (API pública de sindicación, ver el documento) a TU carpeta temporal, nunca al proyecto.
  - Usa la tabla de la sección 5.4 del documento: casas de frente con escalones y antorchas (toma 1),
    cresta baja con cielo y luna enorme con el lobo aullando (3), montaña nevada con franjas y objeto en la
    mano del jinete (6–7), calamares cerca y rayos de luz (8), identificar y modelar los mobs morado/verde con
    arnés rojo (13–14), lava cayendo y contraste morado/turquesa en el Nether (16–17), cielo rosa liso (18),
    mobs grandes cerca de la lente y llama con baúl (19), montañas moradas en la vista final (20), etc.
  - Haz hojas lado a lado del original y la réplica en los mismos tiempos y míralas TODAS en cada ronda.

6) RENDER, MEDIR Y CORREGIR (varias rondas)
  - Servidor: preview "animator" (8790). Si 8790 lo ocupa otro proceso con código viejo, usa "animator-8791".
  - Exporta MP4 1280×720 a 24 fps con animador.exportar (espera a que termine antes de analizar).
  - Cada ronda: python analisis\analisis_tomas.py <original> <réplica> analisis\comparacion_trailer_<ronda>,
    python analisis\comparar.py ... y python herramientas\escuchar.py sobre tu versión.
  - Los datos no mandan solos: si igualar un número se ve peor, manda lo visual.
  - Al final rehaz Videos\comparativa_original_vs_trailer_LTezla.mp4 (original arriba, réplica abajo, reloj
    al centro, audio original oído izquierdo y réplica derecho).

REGLAS
  - NUNCA abras, leas, busques dentro ni imprimas archivos .env. La key de ElevenLabs se carga sola
    (Simulador Vida); solo 2 peticiones simultáneas.
  - Cámara: lente máx. ~42°, no más cerca de ~1.4 bloques de una cara; nada de tomas a la entrepierna.
  - Ojos de LTezla: pupila cuadrada estilo masculino, sin estrellas; pelo con física solo en pixeles de pelo.
  - Borra los cuadros de prueba que dejes en Videos\.

ENTREGA
  MP4 final, comparativo, documentación actualizada en analisis\ (qué se investigó con fuentes, qué se
  cambió, datos antes/después y lo que todavía no coincide dicho con honestidad) y la plantilla funcionando
  desde la app.
