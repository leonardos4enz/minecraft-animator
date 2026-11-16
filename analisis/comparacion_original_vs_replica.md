# Comparación con datos: original (Benly) vs réplica (LTezla)

Video lado a lado: `Videos/comparativa_original_vs_v10.mp4` (arriba el original, abajo la réplica;
audio del original en el oído **izquierdo** y de la réplica en el **derecho**).
Script: `analisis/comparar.py` (mismas métricas en los dos videos, 24 fps, 568×240).
Gráficas de la versión final: `analisis/comparacion_v10/comparacion.png`.

## Perspectivas medidas

| Perspectiva | Métrica | Original | v4 (antes) | v8 | **v10 (final)** |
|---|---|---|---|---|---|
| Cinemática | Energía media de movimiento | 3.32 | 2.03 | 3.35 | **3.54** ✓ |
| Cinemática | Tiempo "quieto" | 15–21 % | 44 % | 35 % | **29 %** |
| Cinemática | Correlación de la curva de movimiento | — | 0.12 | 0.26 | **0.21** (sigue su propia voz) |
| Óptica | Nitidez del personaje | 45 | 78 | 53 | **48** ✓ |
| Óptica | Separación de foco personaje/fondo | 1.45 | 2.69 | 1.92 | **1.78** |
| Óptica | Desenfoque al inicio (0–0.3 s vs 1–2 s) | 0.17 | 0.33 | 0.18 | **0.10** |
| Fotografía | Grano | 0.65 | 1.01 | 0.63 | **0.64** ✓ |
| Fotografía | Luminancia | 106 | 104 | 101 | **101** ✓ |
| Fotografía | Saturación media | 0.45 | 0.21 | 0.29 | **0.29** (ver nota) |
| Composición | Tamaño del personaje en movimiento | 0.175 | 0.087 | 0.141 | **0.154** |
| Audio | Volumen medio (RMS) | 0.059 | 0.109 | 0.068 | **0.068** ✓ |
| Audio | Centroide de la voz | 846 Hz | — | 366 Hz | 366 Hz (voz masculina, es lo esperado) |

Por tramos de 2 s (energía original → v10): 0–2 s 4.8→4.4 · 2–4 s 3.0→2.6 · 4–6 s 2.1→2.7 ·
6–8 s 2.0→2.6 · 8–10 s 3.2→2.5 · 10–12 s 3.1→4.7 · 12–14 s 3.2→3.6 · 14–16 s 5.5→5.8.

## Qué encontraron los datos y qué se cambió

1. **Se quedaba congelado** (44 % del tiempo quieto vs 15 %): se triplicó la "vida" (peso entre piernas,
   cadera, cabeza, codos) y ahora todo el cuerpo se mueve al hablar.
2. **Gestos en picos bruscos** (agarrar la cámara y bajar el brazo del saludo daban picos de 2–3× el
   original): transiciones más largas y movimientos más cortos.
3. **Momentos adelantados**: volver a mirar a la cámara ocurría en 7.5 s y en el original en 8.0 s.
4. **Imagen demasiado nítida** (78 vs 45): suavidad de lente en el pase final.
5. **No arrancaba desenfocado lo suficiente**: el enfoque automático ahora arranca más lejos y desenfoca
   más mientras "busca" (0.18 vs 0.17 del original).
6. **Demasiado grano** (+55 %): bajado a la medida del original.
7. **Cámara lejos** (personaje la mitad de grande): la cámara se acercó.
8. **Voz al doble de volumen**: bajada al nivel del original.

**Nota sobre la saturación:** subirla a 2.75 igualaba el número (0.41) pero volvía la pared gris verde
olivo y el abrigo chillante (se ve en la comparativa). El color del original viene de objetos vivos
(puerta naranja, cielo y edificios azules) y de sombras frías, no de saturar todo; por eso se dejó en
1.4 con luz ambiente azul de cielo.

## Ronda final (v9–v10)

9. **Gestos guiados por la voz:** cada sílaba acentuada (subida de la envolvente en 0.12 s) hace asentir
   la cabeza, sube un poco hombros y brazos, inclina el torso y levanta las cejas. Así el cuerpo sigue a
   la voz de LTezla (coherente aunque no dure igual que la del original).
10. **Desenfoque de movimiento real** al exportar: 5 muestras por cuadro dentro de un obturador de 180°.
    Bajó la nitidez a 48 (original 45) y da el barrido del giro final.
11. **Giro rápido final** (15.4–15.7 s) como el original, con el desenfoque de movimiento.
12. Más gesto al hablar en 2–4 s y 8–10 s (hablar, negar, asentir).

## Lo que todavía no coincide (y por qué)

- **8–10 s tiene ~20 % menos movimiento y 10–12 s ~50 % más** que el original: los gestos siguen la voz
  de LTezla, cuyas frases caen en otros momentos que las de Zita.
- **Tiempo quieto 29 % vs 21 %:** parte es real (aún hay pausas) y parte es medición: la cámara del
  original tiene rotación y paralaje que el compensador de traslación no quita, y eso suma "movimiento".
- **Correlación de la curva 0.21:** las frases de LTezla duran distinto que las de Zita (voz distinta),
  así que los gestos no caen exactamente en los mismos cuadros.
- **La voz** es masculina a propósito (846 Hz → 366 Hz de centroide).
- **El escenario** es de bloques reales de Minecraft; el original tiene una puerta y paredes modeladas
  aparte, con más color.
- **Desenfoque al inicio 0.10 vs 0.17:** arranca un poco más borroso que el original (el desenfoque de
  movimiento se suma al de foco mientras entra caminando).
