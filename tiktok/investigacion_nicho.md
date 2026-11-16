# Investigación del nicho: mundo real con animación de bloques (17 oct 2026)

Resumen de la segunda investigación (subagente). Las etiquetas son las mismas que en `investigacion.md`.

## Referentes
- **Ac2ality** (España, ~4,2 M) [ESTUDIO]
  - Hace ~5 videos al día con tres formatos: "5 Cosas De Hoy" (30 s), "Explícamelo Fácil" (1 min) y "Trends" (con un
    audio viral).
  - Sus guiones tienen unas 190 palabras por minuto de video. [Reuters Institute](https://reutersinstitute.politics.ox.ac.uk/news/how-spanish-startup-became-second-biggest-european-news-publisher-tiktok)
- **Doctor Fisión** (España, ~4,8 M, sobre todo astronomía).
- **Zack D. Films**: el referente de curiosidades en 3D, con clips de 20–45 s.
- **Washington Post** (Dave Jorgenson): personaje fijo y humor, con 4 videos al día. [Adweek](https://event.adweek.com/adweek-abroad-in-cannes-2022/speaker/478988/dave-jorgenson)
- Audiencia [ESTUDIO]:
  - El 43 % de los menores de 30 en EE. UU. se informa en TikTok. [Pew 2025](https://www.pewresearch.org/short-reads/2025/09/25/1-in-5-americans-now-regularly-get-news-on-tiktok-up-sharply-from-2020/)
  - En México, TikTok es la red que más crece para informarse. [Reuters DNR 2025](https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2025/mexico)
- No apareció ninguna cuenta hispana grande de noticias **animadas con personaje**. Puede ser un hueco libre, pero no
  está demostrado.

## Noticias: ventana y mezcla
- [MARKETER] Una noticia rinde en las primeras 1–4 h, con un pico de 24–48 h.
  - Google Trends filtra por "empezó hace 4 h / 24 h / 48 h / 7 días". [OFICIAL](https://support.google.com/trends/answer/3076011?hl=en)
- Una máquina que sube a mano no gana carreras de 2 horas. Por eso la noticia va siempre con un ángulo explicativo
  ("¿por qué…?") que dure días, y es minoría en el día.

## Detectar tendencias sin tocar TikTok (*probadas el 17 oct 2026*)
| Fuente | URL | Uso |
|---|---|---|
| Google Trends "Trending now" (RSS) | `https://trends.google.com/trending/rss?geo=MX` (también ES, US, AR, CO) | Filtrar con una lista blanca (casi todo es fútbol) |
| Google News por tema (RSS) | `https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=es-419&gl=MX&ceid=MX:es-419` (también TECHNOLOGY) | Descubrir; la fuente final es la primaria |
| Wikipedia "lo más leído" | `https://es.wikipedia.org/api/rest_v1/feed/featured/AAAA/MM/DD` (`mostread`), con User-Agent propio | Picos de interés |
| Creator Search Insights | Sólo en la app (Leo) | "Content gap" → el panel → "Ideas para la máquina" |
| Reddit | ~~RSS~~: lo cierran el 13 nov 2026 y el uso comercial exige contrato | No automatizar |

## Evitar [OFICIAL]
- Tragedias, accidentes y crisis: pueden quedar fuera del Para Ti. [TikTok](https://www.tiktok.com/community-guidelines/en/sensitive-mature-themes)
- Política y elecciones. [TikTok](https://www.tiktok.com/community-guidelines/en/integrity-authenticity)

## Originalidad con volumen alto
- [OFICIAL] El Para Ti excluye el material "no original o reutilizado sin nada nuevo". [TikTok](https://www.tiktok.com/community-guidelines/en/integrity-authenticity)
- Lo que protege a la cuenta: personaje, escenas, guion y voz propios, y no repetir la misma plantilla más de 2 veces al
  día.

## Hashtags
- 3–5 hashtags, sin #fyp, y nunca en los comentarios. #AprendeEnTikTok es oficial en español.

## Marcas y personas [OFICIAL]
- **Marcas:** se pueden nombrar para comentar, comparar o parodiar. **No** se usan sus logotipos ni se insinúa
  patrocinio. [TikTok IP](https://www.tiktok.com/legal/page/global/copyright-policy/en)
- **NASA:** su logotipo no es de dominio público. [NASA](https://www.nasa.gov/nasa-brand-center/nasa-logo-use/)
- **Figuras públicas:** sólo como caricatura de bloques. **Nunca** se les ponen frases que no dijeron; las citas reales
  van con su fuente. **Nunca** personas privadas.
- No es asesoría legal.

## Reglas adoptadas (en `estrategia.json` y la rutina)
1. Mezcla diaria por pilares: una noticia como mucho, siempre con un ángulo que dure.
2. Una noticia sólo vale si empezó hace ≤ 24–48 h. Después se reconvierte en "¿por qué X?" o se descarta.
3. Lista negra: elecciones, partidos, guerras, atentados, muertes, accidentes con víctimas y desastres en curso.
4. Cada dato real lleva 2 fuentes en `facts.json`, al menos una primaria.
5. Ninguna plantilla idéntica más de 2 veces al día: rotar escenario, cámara y música.
