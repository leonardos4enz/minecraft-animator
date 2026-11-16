# Investigación: cómo crecer en TikTok con animaciones de Minecraft en español (17 oct 2026)

Etiquetas: **[OFICIAL]** = lo dice TikTok/Mojang · **[ESTUDIO]** = análisis de datos de terceros · **[MARKETER]** = opinión de blog/herramienta.
Las páginas de soporte de TikTok y minecraft.net/usage-guidelines no se pudieron leer directamente; ahí se citan fuentes secundarias.

## 1. Algoritmo, duración, frecuencia, horarios
- [OFICIAL] El "Para ti" usa interacciones (likes, compartidos, follows, comentarios), información del video (texto, sonidos, hashtags) y, con menos peso, el dispositivo. Terminar un video largo es señal fuerte. "Ni el número de seguidores ni haber tenido videos exitosos son factores directos": una cuenta nueva puede hacerse viral. [TikTok Newsroom 2020](https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you)
- [ESTUDIO] Metricool (2,3 M de posts, may 2026): 7 de cada 10 vistas vienen del "Para ti"; pesan primero la retención inicial y la finalización; guardados y compartidos pesan más que los likes. Las vistas por video cayeron 31 % interanual por saturación (+72 % de videos). [IEBS](https://www.iebschool.com/hub/algoritmo-tiktok-estudio-metricool-2026/) · [Metricool](https://metricool.com/es/estudio-tiktok/) · [nota de prensa](https://metricool.com/press-release-tiktok-study-2026/)
- [ESTUDIO] Duración: Buffer → 30–60 s tienen +18,9 % de alcance frente a 10–30 s. [NetInfluencer](https://www.netinfluencer.com/tiktok-longer-videos-outperform-short-form-content-study-reveals/) · Fanpage Karma: 0–10 s ganan alcance por seguidor; el engagement en duraciones medias. [Fanpage Karma](https://www.fanpagekarma.com/insights/optimal-tiktok-video-length/)
- [OFICIAL vía terceros] Creator Rewards paga sólo videos originales de ≥ 1 min, ≥ 1.000 vistas cualificadas; cuenta con 10.000 seguidores, 100.000 vistas/30 días, mayor de 18, cuenta personal. Cuenta el valor de búsqueda. [Metricool](https://metricool.com/tiktok-creator-fund/) · [TikTok 2024](https://newsroom.tiktok.com/creator-search-insights?lang=en)
- **Práctica:** para crecer, 20–40 s; para monetizar, 61–75 s.
- [ESTUDIO] Frecuencia (Buffer, 11,4 M posts): 2–5/sem +17 % vistas por post, 6–10/sem +29 %, 11+/sem +34 % frente a 1/sem. La mediana casi no cambia: publicar más sube la probabilidad de un video que "pegue". [Buffer](https://buffer.com/resources/how-often-should-you-post-on-tiktok/)
- [ESTUDIO] Horarios (NapoleonCat 2026): México lun 9 y 13 h, mar 7 y 12 h, mié 10–11 h, jue 12, 15 y 22 h; España lun 12 y 16 h, mié 13–14 h, jue 15 y 18 h, vie 19 y 21 h, sáb 17 y 19 h. Pico global 20:00. [NapoleonCat](https://napoleoncat.com/es/blog/mejor-hora-para-publicar-en-tiktok/) — En cuanto haya datos, manda TikTok Studio.

## 2. Ganchos y loops
- [MARKETER] 33–65 % desliza antes de 3 s; retener 70–85 % en 3 s ≈ 2,2× vistas. [Opus](https://www.opus.pro/blog/tiktok-hook-formulas) · [Virlo](https://virlo.ai/blog/why-the-first-few-seconds-matter)
- Fórmulas: pregunta + imagen que la responde a medias; afirmación que contradice; clímax en el cuadro 1 y "te cuento cómo pasó"; texto en pantalla para quien ve sin sonido; cambio visual cada 3–5 s. [Teleprompter](https://teleprompter.com/blog/tiktok-3-second-rule)
- Loops: no hay datos medidos; es una apuesta a validar con A/B propio.

## 3. Subtítulos y zona segura (1080×1920)
- Plantilla de TikTok In-Feed reescalada: arriba 240 px, abajo 660 px, lados 120 px, columna de botones ~180 px a la derecha desde y = 840. [Socialync](https://www.socialync.io/tools/safe-zones/tiktok)
- [MARKETER] Letra de 60–75 px (mín. 55, máx. ~100). [Blitzcut](https://blitzcutai.com/blog/best-caption-size-youtube-shorts-2026) · Palabra por palabra: convención, sin estudio.

## 4. Formatos del nicho
- Sin datos fiables de cuentas de animación Minecraft en TikTok. Modelo de serie con personajes fijos: Kamui Animation (7,39 M subs). [VidIQ](https://vidiq.com/youtube-stats/channel/UC-IC1Sv1onK1kWlJTTQfrkw)
- Actualidad: "Chicken Jockey" (A Minecraft Movie, 2025) [KYM](https://amp.knowyourmeme.com/memes/chicken-jockey-minecraft-movie); drops 2026: Tiny Takeover (26.1, mobs bebé, 24 mar), Chaos Cubed (26.2, sulfur cube, 16 jun), 26.3 previsto para otoño (verificar en minecraft.net). [esports.gg](https://esports.gg/news/minecraft/minecraft-live-march-2026-recap-tiny-takeover-release-date-new-game-drop-and-more)
- [OFICIAL] Creator Search Insights → filtro "content gap": temas muy buscados con pocos videos. Fuente natural de ideas.

## 5. Voz
- **TTS de TikTok fuera de la app: NO.** No hay API oficial; los envoltorios piden la cookie `sessionid` (credencial de la cuenta) y los Términos prohíben el acceso automatizado. Riesgo para la cuenta. [npm tiktok-tts](https://www.npmjs.com/package/tiktok-tts) · [ConductAtlas](https://conductatlas.com/platform/tiktok/tiktok-terms-of-service/prohibition-on-scraping-and-data-extraction/)
- TTS dentro del editor de TikTok (Aa → Texto a voz): legítimo, pero manual.
- edge-tts: gratis, pero usarlo comercialmente sin Azure "podría violar" los términos (moderador de Microsoft). [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/2088770/are-opensource-edge-tts-free-for-commercial-use) → sirve para borradores; para monetizar, la misma voz en Azure AI Speech.
- ElevenLabs: el plan de pago (Starter en adelante) da derechos comerciales. [BigVU](https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs/)
- No hay prueba oficial de que la voz TTS baje el alcance; lo que se castiga es lo producido en masa y poco original. Una voz de personaje constante (LTezla) diferencia más que una TTS genérica (opinión).

## 6. Hashtags, descripción, SEO
- [ESTUDIO] Con ≥ 1 hashtag, +10 % interacciones; 1–2 de nicho; evitar #fyp/#viral. [IEBS](https://www.iebschool.com/hub/algoritmo-tiktok-estudio-metricool-2026/)
- [MARKETER] La palabra clave en voz (≤ 5 s), texto en pantalla (≤ 3 s) y primera línea de la descripción. [OpenClip](https://openclip.app/blog/metadata-impacts-tiktok-seo) · Vida útil de un post ≈ 10 días.

## 7. Métricas
- Mirar: tiempo medio, % que lo ve completo, fuente de tráfico (Para ti / búsqueda), espectadores nuevos.
- [MARKETER] Finalización ≥ 60 % excelente, 40–60 % bueno, < 30–40 % malo; tiempo medio ≥ 50 % de la duración. Promedio general ~10 % completo. [Dash Social](https://pages.dashsocial.com/hubfs/social-media-benchmark/2025/H2/all-industry.pdf)
- A/B orgánico no existe (sólo Ads): manual, un cambio por par de videos. Ganadores (> percentil 90 propio) → "Parte 2".

## 8. Música
- Cuenta personal: biblioteca general y sonidos en tendencia (no comercial). Cuenta de empresa: sólo Commercial Music Library, y queda fuera de Creator Rewards → **cuenta personal**.
- No incrustar música con copyright en el MP4: exportar versión "sin música" y añadir el sonido en tendencia en la app, bajito.

## 9. Políticas
- [OFICIAL vía prensa] Etiquetar contenido IA realista. Una animación 3D de Minecraft no es realista y el programa no es IA generativa; con voz sintética, activar la etiqueta es prudente. [TechSpot](https://www.techspot.com/news/110315-sick-ai-slop-feed-tiktok-finally-you-turn.html)
- Mojang (vía secundaria): se permite monetizar videos con suficiente contenido propio; "Minecraft" no puede dominar el nombre del canal ni de la serie. [ConductAtlas](https://conductatlas.com/platform/minecraft/minecraft-usage-guidelines/commercial-use-and-monetization-restrictions/) — verificar en minecraft.net/usage-guidelines.

Huecos: cuentas concretas del nicho con cifras, texto oficial de Mojang y TikTok, datos medidos de loops y portadas.
