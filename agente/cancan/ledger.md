# Can-can en bloques: ledger

## Ronda 0 (19 oct 2026): audio
- MIDI `cancan_completo.mid`: 1.918 notas, 100,0 % a menos de medio cuadro (mediana 5,3 ms, máx. 16,0 ms). Leo: "suena bien".

## Ronda 1 (19 oct 2026): estilo nuevo, prueba del coro (compases 40–55, 31,2–44,0 s)
- Motor: efectos `filtro` (14 filtros de Minecraft), `impacto` (impact frames de 2 cuadros con silueta), `paleta`
  (el mundo cambia de familia de bloques) y `fragmentos` (pedazos de bloque). Generador: `estilo.py`.
- Hoja 1: el suelo lejano no cambiaba de paleta (toma 2 verde) → `conTinte` también en suelo y bosque lejanos.
  El anillo del bajo apilaba torres (mismo bloque cada vuelta) → el bajo ya no se apila. La cámara quedaba entre los
  bloques y tapaba a LTezla → cámaras o muy cerca (r < 6) o lejos y altas. Silueta gris → trazos internos con umbral.
- Medido en `salida/prueba_coro_v1.mp4` (384 cuadros): impact frames en los cuadros 0, 48, 96, 144, 192, 240, 288, 336
  (cada 1,6 s, en el tiempo 1 del compás) y el invertido en el siguiente; ≈ 1,25 destellos/s (límite 3).
- Pendiente: la toma 5 (giro de 200° con `sobel`) se ve muy movida; en la toma 1 un brillo tapa las manos de LTezla;
  falta la ronda de críticos (esto fue una prueba de estilo).

## Ronda 2 (19 oct 2026): canción completa con golpe en el mundo
- Leo sobre la v1: "esperaba más efectos para cada nota", "el impact frame debe ir con algún impacto en el Minecraft",
  "alguna toma con perspectiva, efecto dramático".
- Motor: `sacude` (sacudida + golpe de zoom), `notas` con `anillo`, `rayo` y `chispas`, y `real: true` para congelar
  sólo parte de la toma. `estilo.py` ahora arma los 118,4 s: 10 secciones, 69 tomas, 61 impactos; en cada uno LTezla
  salta y aterriza, explosión de humo de pixeles, onda en el suelo, tierra que salta, bloques que estallan y sacudida.
  Cámaras: contrapicado gran angular (fov 64), vértigo (3,6 → 13 bloques con fov 64 → 20), holandés (16–22°), látigo
  de 180°, grúa, cenital, empuje y 3 tomas congeladas (31,2 · 44,0 · 75,2 s) + la nota larga suspendida 4 s.
- Hoja 1: el humo (90 nubes de 0,95) tapaba la pantalla y el destello se colaba en la silueta del impact frame →
  40 nubes de 0,5 (20 en tomas cercanas), destello 4 en vez de 9, los brillos sumados fuera de la máscara.
- Destellos: máximo 2,5/s (impactos cada compás en la segunda mitad del coro en re y en el final); límite 3.
- Hoja 2: en las tomas cercanas la silueta del impact frame se llenaba de bloques → la silueta es sólo LTezla (y mobs) y
  las líneas salen de su pecho en pantalla. El haz de luz de las notas del bajo pasaba delante de la cámara (destellos
  extra) → el bajo va en su propio archivo, sin haz.
- v3: 4 subidas bruscas de luz por segundo donde hay un impacto por compás → los impactos de mitad de toma y los de
  compás par del final van sólo invertidos (sin el cuadro blanco).
- v4 (`salida/borrador_v4.mp4`): 3552 cuadros, máximo 3,0 destellos/s (pares de cambios de luz > 0,1), en el límite.
  Audio −13,1 LUFS en el borrador (loudnorm de una pasada; el final usa dos pasadas). Falta la ronda de críticos.

## Ronda 4 (19 oct 2026): críticos sobre v4 → v5
- Técnico: "ship" (61/61 impactos y 15/15 cortes en su cuadro exacto, 0 cuadros quietos, TP −1,3) pero sin margen de
  destellos (3,0/s a pantalla completa, hasta 5,5/s por regiones en el final). Sin sonido: gancho flojo, personaje
  tapado o invisible, filtros que confunden, final colgado (60 % de confianza en "baila la canción en bloques").
  Director: "one more pass" (gancho a los 3 s, siluetas de 20 px en planos abiertos, lápiz 9,6 s en el clímax,
  creeper ×3 y spider ×2, notas gigantes que tapan la cara, cámara dentro de bloques, final sin cierre).
- No aplicado: bajar los impactos a 12–16 (a Leo le gustan; v4 "está super"). La camiseta "15" es la capa MCC 15 de Leo.
- Arreglos: impacto en el cuadro 0 con plano cercano; cada impact frame en un plano cercano insertado de 2 cuadros
  (silueta grande siempre); sin impactos de mitad de toma (61 → 51); `resolver_ruta` sube o acerca la cámara si cae en un
  bloque o algo tapa a LTezla (221 muestras corregidas); planos abiertos de 27 → 17 bloques; lápiz sólo 3,2 s; un creeper,
  un spider de 0,8 s; oscuridad al 50 %; brillo 0,6 en el cielo rosa; corcheas que se apagan a < 4,5 bloques de la
  cámara; final de 118,4 → 119,8 s con la cola real del último acorde y la espiral de las 1.918 notas.
- v5: 3594 cuadros, 48 kHz, máx. 2,5 destellos/s, 0 cuadros quietos. −13,1 LUFS en el borrador (el final, dos pasadas).

## Ronda 5 (19 oct 2026): segunda ronda de críticos sobre v5 → v7
- Sin sonido: "one more pass" (65 % de confianza): humo sobre LTezla (~15 casos), invertido de hielo irreconocible,
  cenitales con LTezla diminuto, gancho con un cuadro 0 ilegible, final que no se detiene. Director: "one more pass":
  verificó arreglados las siluetas, la cámara en bloques, el lápiz, creeper/spider; siguen las corcheas sobre la cara
  (6 casos), el gancho, LTezla diminuto en 4 planos, sobel repetido ×6, final de 1,8 s sin pausa. Técnico: "one more
  pass" sólo por destellos por cuadrante (5/s en 115,8–116,9 s: el invert entraba 2 cuadros después del corte).
- No aplicado: reducir los impact frames a 4–5 ni hacer que la espiral forme una figura (a Leo le gustan los impactos;
  la espiral es la forma de la música).
- Arreglos: corcheas, ondas, haces y destellos se apagan si están a < 4,5 bloques de la cámara o a < ~1 bloque de la
  línea cámara → pecho de LTezla (`noTapa` en efectos.js); cuadro 0 con LTezla de pie (sin aterrizaje), mira a 1,25;
  humo a ras del piso, rápido hacia los lados (14/32 nubes) y nada de humo en congeladas ni en el cuadro 0; planos
  abiertos 17 → 12, cenital 14 → 10, grúa 12 → 9,5; sin `invert`; sobel sólo en 114 y 122 (antes del lápiz) y 128;
  creeper al 60 %; re-la con cielo de atardecer (antes niebla morada casi invisible) y oscuridad al 40 %; los filtros
  entran en el corte; final: impactos en 141/143/145 y el último en 147 (12 cuadros) y la recompensa de 117,2 a 119,8 s
  con 0,8 s quieta sobre la espiral entera.
- v7: 3594 cuadros, 48 kHz, 50 impactos; destellos máx. 2,0/s en pantalla completa y ≤ 3,0/s en todas las mitades y
  cuadrantes (`referencias/destellos.py`). Pendiente: ronda 3 de críticos y el render final en alta (−14 LUFS de dos
  pasadas, TP ≤ −1, versión sólo música, miniatura aparte porque el cuadro 0 es una silueta).

## Ronda 6 (19 oct 2026): tercera ronda de críticos sobre v7 → v8 → final
- Sin sonido: **ship** (65 %; quedan detalles: cuadro 0 con tierra, LTezla chico en 60–63 s). Director: **ship**
  (verificó cumplidos los 6 pedidos; recomienda bajar el bloom que quemaba la cara en 28–30 s). Técnico: "one more pass"
  por un fallo nuevo y real: **un cuadro intruso en f+2 de 48 de 49 impactos** (el plano insertado duraba 0,0667 s >
  2/30 por el redondeo a 4 decimales, y el cuadro siguiente caía todavía en él; estaba desde v5) + el spider que se
  apagaba 2 cuadros tarde. Destellos por cuadrante ya en ≤ 3/s.
- Arreglos: todos los cortes 2 ms antes de su cuadro (duraciones exactas, desfases de las notas al nuevo inicio);
  `hasta` del filtro medido desde la frase; bloom 0,8 (0,6 con cielo rosa o atardecer); sin tierra en el cuadro 0;
  cenital 10 → 7,5; dos planos de noche con cielo lila; la recompensa también pasa por `resolver_ruta`.
- v8 medido: f+2 ya es la toma (diferencia media 97 en f+2 y 31 en f+3; los 3 casos > 40 en f+3 son sacudida y látigo,
  revisados a ojo); destellos 2,0/s pantalla completa, ≤ 3,0/s en cuadrantes (el 3,0 es el impacto final, 116,3 s).
- **Final entregado** (`python agente/cancan/estilo.py final v1`, 12 tramos de 10 s en alta, ~13 min):
  `Videos/Can-can en bloques (LTezla).mp4` y `… - solo musica.mp4` (mismo audio: no hay voces), 1080×1920, 30 fps,
  3594 cuadros, 48 kHz, −13,8 LUFS, TP −1,3 dBTP, destellos 2,0/s en pantalla completa y ≤ 3,0/s por cuadrante.
  Portada aparte: `salida/portada.jpg` (3,6 s, LTezla pateando). Si se publica con crédito de la música, falta
  `facts.json` (Offenbach, Orphée aux enfers 1858, dominio público, origen y licencia del MIDI).
