# Rutina diaria de la máquina de TikToks (la corre Claude, tarea programada)

Objetivo: dejar listos **para hoy** (antes de las 12:00) 5 videos, uno por pilar (`estrategia.json → pilares`):

| Hora (MX) | Pilar | Material |
|---|---|---|
| 12:30 | Lo nuevo (tecnología, ciencia, autos, espacio, récords) | `tiktok/hechos/banco_mundo.json` (tipo noticia) |
| 14:30 | Latam en bloques (humor de la vida diaria) | `tiktok/hechos/latam.json` |
| 17:00 | Curiosidad a escala / Debate (alternan por día) | `banco_mundo.json` (tipo curiosidad) |
| 19:00 | Meme del momento | `tiktok/hechos/memes.json` |
| 20:30 | Bloquenovela (un capítulo al día, misma hora) | `tiktok/novela/biblia.json` |

Leo sólo abre el panel (acceso directo **TikToks LTezla** del escritorio), sube cada video a su hora, lo marca "subido" y a
las 72 h anota las métricas.

Antes de empezar:
- Lee `CLAUDE.md`, `TIKTOK.md` y `tiktok/investigacion_nicho.md`.
- **Nunca abras ventanas visibles.**
- Servidor: si `http://127.0.0.1:8790/api/tiktok/estado` no responde, arráncalo con la vista previa `animator` (o
  `python servidor.py 8790` en segundo plano).
- `FECHA` = la fecha de **hoy** (AAAA-MM-DD): la tarea corre a las 3:00 (fuera de hora pico) y el primer video se publica a las 12:30. Si ya hay
  videos listos de hoy (corrida anterior), sólo completa los que falten.
- **Rondas extra:** si Leo pide más videos el mismo día, el plan se amplía con `python tiktok/maquina.py plan FECHA --ronda 2`
  (otra vuelta de pilares, sin repetir nada de la ronda anterior, con horas desde ahora hasta las 23:30). La corrida trabaja
  sólo los videos del plan que todavía no están listos: no toques los ya entregados (Leo ya los subió). La investigación,
  los críticos y el cierre se hacen igual, sólo sobre la ronda nueva.
- Si algo falla, sigue con el resto y cuéntalo en el resumen.

## 1. Revisar los números y lo anterior, para decidir el rumbo (10 min)
- `python tiktok/maquina.py importar`: lee lo que Leo exportó de TikTok Studio y dejó en
  `Videos/TikTok/metricas/tiktok_studio_exports/` (Resumen → `tiktok/metricas/cuenta.csv`; Contenido → vistas, likes,
  comentarios y compartidos de cada video en `publicaciones.csv`). Si sale un `formato_nuevo` o un video `sin_video`,
  mira el CSV en `tiktok/metricas/crudo/`, ajusta `COLS` en `tiktok/motor/importar.py` y vuelve a correr.
- `python tiktok/maquina.py metricas` → `tiktok/aprendizajes.md` (la cuenta semana contra semana + la tabla por formato).
- **Rumbo del día:** con eso, escribe 2–3 líneas al principio de `tiktok/tendencias/<HOY>.md` (sección "Rumbo"): qué se
  repite hoy porque funcionó, qué se cambia (un solo cambio, A/B) y por qué, con el número que lo respalda. Sin datos
  nuevos, dilo ("sin datos nuevos: se sigue el plan").
  - No cambies la estrategia por un video suelto: con < 20 videos medidos a 72 h es ruido. Antes de eso sólo cuentan los
    extremos (un video ≥ 5× la mediana → Parte 2; uno con < 30 % completo → otro gancho).
  - Las vistas por video y el % "Para ti" pesan más que los likes. El % completo y el tiempo medio, más que todo.
- **Los lunes, análisis semanal** en `tiktok/analisis/<HOY>.md` (≤ 30 líneas; el resumen va también al "Rumbo"):
  - los números de la semana (`cuenta.csv` y `publicaciones.csv`) contra la anterior;
  - los 3 mejores y los 3 peores videos, y qué tienen en común (pilar, gancho, hora, duración, mob, música);
  - qué pilar y qué hora rinden mejor;
  - **una** decisión para la semana (un A/B, o cambiar el peso de un pilar en `estrategia.json` sólo si hay ≥ 20 videos
    medidos) y cómo se va a medir;
  - si el último export tiene > 7 días, la línea "**Leo: exporta Resumen y Contenido (60 días)**" arriba del archivo de
    tendencias, que es lo que se ve en el panel.
  - Formatos y pilares que retienen mejor: el planificador ya los pesa.
  - "Parte 2" de los videos ganadores (≥ p90): reemplaza el pilar más flojo del día por la Parte 2.
  - **ALARMA** de volumen: anótala en el resumen.
- `tiktok/publicaciones.csv` y `tiktok/plan/*.json` de los últimos 14 días:
  - qué temas, memes, premisas y categorías ya salieron;
  - el planificador no repite datos ni premisas, pero tú cuida también **el ángulo**: nada de dos videos de IA seguidos,
    ni el mismo chiste con otra premisa, ni el mismo CTA.
- `tiktok/ideas_leo.md`: las ideas sin marcar (`- [ ]`) tienen prioridad. Úsalas en el pilar que corresponda y márcalas
  `- [x] → <slug>`.

## 2. Investigar (≈ 25 min). Nunca scrapear TikTok
**Lo nuevo**
- Fuentes de los últimos 2 días (URLs en `investigacion_nicho.md`):
  - Google News RSS de ciencia y tecnología (MX y ES);
  - Google Trends RSS (MX, ES, AR, CO), filtrado por la lista blanca del nicho;
  - Wikipedia "lo más leído".
- Agrega ≥ 3 noticias a `banco_mundo.json`, con el mismo formato que las demás:
  - cita literal + URL abierta hoy + una 2.ª fuente;
  - `fecha_evento` y `caduca` (+14 días);
  - categoría.
- Respeta la **lista negra** (`estrategia.json → variedad.lista_negra`).

**Curiosidades**
- Que siempre haya ≥ 5 sin usar: Guinness, NASA, National Geographic, Britannica.
- Que tengan `numeros` visualizables a escala (1 bloque = 1 m).

**Memes**
- Revisa Know Your Meme ("Popular Right Now", "Fresh Entries", el roundup semanal), Google Trends y las listas de Que.es,
  New Engen e Infobae.
- Actualiza `estado` (con la fecha de la evidencia) y agrega los nuevos a `memes.json`.
- Descarta lo sexual, lo violento real, las personas reales identificables y los retos peligrosos.

**Latam**
- Que siempre haya ≥ 5 premisas sin usar en `latam.json`. Escríbelas tú (situaciones cotidianas universales), sin
  estereotipos que ofendan.

**Resumen**
- Escribe `tiktok/tendencias/<HOY>.md` (≤ 25 líneas: el panel lo muestra): primero el "Rumbo" (paso 1), después qué
  está pasando, qué meme sube y qué se usó.

## 3. Plan y guiones
```
python tiktok/maquina.py plan FECHA
python tiktok/maquina.py preparar FECHA
```
Cada `tiktok/videos/<slug>/guion.json` trae en `_notas` el material, la estructura del formato y, en la novela, la biblia y
los capítulos anteriores. Escribe las `lineas` siguiendo `TIKTOK.md`.

**Reglas para todos los videos**
- El gancho en ≤ 3 s, con el sujeto en el cuadro 0, y `gancho_pantalla` de ≤ 7 palabras.
- Ninguna toma de más de 3.6 s: usa 2 tomas por línea con `"en"`.
- LTezla aparece en cada video: es la marca.
- Usa sonidos reales (`mc:`).
- Lo que el tema pida y no exista en Minecraft (un teléfono, una ballena, un cohete, el meme en una pintura) se construye:
  receta `objeto` o `cuadro`, o `fx` en cualquier toma (`TIKTOK.md` → "Objetos a medida"). Si falta un modelo, créalo con
  `tiktok/motor/modelos.py` y guárdalo en la biblioteca para los siguientes videos. Mira la hoja: que se lea y no tape caras.
- `descripcion` de ≤ 150 caracteres, con la palabra clave en la primera línea, y 4 hashtags (categoría + tema + #noticias
  o #humor + #animacion o #minecraft). Nunca #fyp.

**Mundo real (lo_nuevo, curiosidad, debate)**
- Cada línea que afirma algo cita un hecho de `facts.json` (2 fuentes en las noticias).
- Marcas: sí el nombre, **nunca el logotipo**, ni nada que insinúe patrocinio.
- Personas reales: sólo caricatura, y **nunca** frases inventadas.
- Para mostrar escalas usa las recetas `numero`, `versus` y `mob` (los animales como referencia). Si hace falta una receta
  nueva (p. ej. una torre de N bloques), agrégala a `tiktok/motor/recetas.py` y documéntala en `TIKTOK.md`.

**Meme**
- La plantilla recreada con bloques y con un giro propio. **El audio del meme no se incrusta**: escríbelo en
  `pregunta_comentarios` o en `descripcion` como nota, y Leo lo agrega en la app.

**Novela**
- Usa el `reparto` y la receta `dialogo` (planos `dos`, `hombro`, `primer`, `zoom`) con `"izq"` fijo para la continuidad.
- Cliffhanger, y LTezla narra el cierre.
- Al terminar, agrega el capítulo a `biblia.json → capitulos`: `{n, slug, resumen, cliffhanger, fecha}`.
- Nada sexual, nada de violencia ni "canibalismo", nada de roles misóginos: eso tumbó a las frutinovelas.

Pon `"afinado": true` en cada guion terminado.

## 4. Producir
Para cada video: `validar`, `armar` y `hojas`. **Mira la hoja**:
- que el sujeto se vea entero y con la cara visible;
- que nadie tape al que habla;
- que nada se queme a blanco.

Corrige y vuelve a armar.

**Volumen de las voces (pedido de Leo, 18 oct 2026):** los personajes se tienen que oír igual de fuerte que LTezla. La
mezcla ya iguala cada línea a −18 LUFS (`VOZ_LUFS` en `tiktok/motor/post.py`) y no usa `loudnorm` dinámico. `revisar`
lo mide en `salida/sin_musica.wav` (`voces_parejas`: avisa > 2 LU, bloquea > 3 LU) y el crítico técnico lo confirma. Si los
golpes tapan las voces, baja los `sfx` de esas líneas. Lo que no pasa, no se entrega.

Después:
```
python tiktok/maquina.py dia FECHA            (≈ 3 min por video: en segundo plano)
```

## 5. Críticos (CLAUDE.md), en lote
Lanza 3 subagentes **nuevos** en paralelo sobre los 5 videos:
1. **Lectura sin sonido** (`critica/mudo_2fps.jpg`).
2. **Técnico** (`revision.json` + `timing.json`).
3. **Director + datos**: transcripción, tabla frase → `facts.json`, marcas y personas. Avísale que el look de Bare Bones y
   los ojos del rig son decisiones de diseño.

Arregla lo grave y repite. Si sólo cambió el audio: `final` + `revisar` + `entregar`. Anota la ronda en el `ledger.md` de
cada video. Lo que no llega a "ship" **no se entrega**: se reintenta en la próxima corrida y el panel lo muestra.

## 6. Cerrar
```
python tiktok/maquina.py limpiar
python tiktok/maquina.py estado
```
Resumen para Leo (≤ 10 líneas):
- el rumbo del día (qué dicen los números y qué se cambió por ellos);
- los 5 videos de hoy con su hora y su tema;
- qué tendencia o meme entró;
- el material que queda por pilar;
- el espacio en disco;
- las alarmas;
- lo que no se pudo entregar y por qué.
